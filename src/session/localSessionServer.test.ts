import { describe, expect, it } from 'vitest';

import { CAREER_TUNING } from '../career/careerTuning';
import { localSessionServer } from './localSessionServer';
import { meetDayFactsFromCache } from '../game/meetClient';
import { meetResultProposal } from '../game/meetDay';
import { playMeet } from '../game/meetPreview';
import { MEET_ENTRY, MEET_LOCAL } from '../game/meetTuning';
import { readFederation, readTotalKg, readingValue } from '../game/progression';
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

/** Play a whole meet on the real engine against whatever this port holds. */
function playAWholeMeet(port: ReturnType<typeof localSessionServer>, day: number) {
  const facts = meetDayFactsFromCache(openingCache(port), day, SESSION_TUNING.STARTING_E1RM);
  const state = playMeet(
    () => 'perfect',
    () => 'small',
    {
      day,
      meet: MEET_LOCAL,
      entry: MEET_ENTRY,
      bestE1rmKg: facts.bestE1rmKg,
      previousBestTotalKg: facts.previousBestTotalKg,
      previousBestByLiftKg: facts.previousBestByLiftKg,
      fatigue: port.meetBrief(day).fatigue,
    },
  );
  const proposal = meetResultProposal(state);
  if (proposal === null) throw new Error('the played meet produced no proposal');
  return proposal;
}

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
        : stepSession(next, { kind: 'rep-resolved', outcome: 'good-lift', executionQuality: 1 });
  }
  return next;
}

function closeOutOf(state: SessionState): SessionCloseOut {
  if (state.closeOut === null) throw new Error('no close-out');
  return state.closeOut;
}

describe('the stand-in server port', () => {
  it('exposes five methods and no way at the row', () => {
    // The whole reason the row moved behind a port. A getter here would put the
    // bypass back within reach of the hook.
    //
    // SIX, SINCE MEET DAY AND THE CAREER WERE WIRED TO THE SAME ROW.
    // `meetBrief` and `recordMeetResult` are the meet half and
    // `chooseFederation` is the career's; A2 added the four identity methods.
    // The count is pinned rather than bounded so that an eleventh — in particular
    // a `record` getter, which is the only method that could put the bypass back —
    // is a failure and not a silent widening.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    expect(Object.keys(port).sort()).toEqual([
      'chooseFederation',
      'createProfile',
      'editProfileBodyweight',
      'editProfileName',
      'meetBrief',
      'openingProfile',
      'openingSnapshot',
      'recordMeetResult',
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

// ---------------------------------------------------------------------------
// ONE ROW, BOTH MODES — and the guard that could not fire until it was one row
// ---------------------------------------------------------------------------

describe('the meet half writes the row the session half reads', () => {
  /** Play a whole meet on the real engine, against whatever this port holds. */
  function playAMeet(port: ReturnType<typeof localSessionServer>, day: number) {
    const facts = meetDayFactsFromCache(openingCache(port), day, SESSION_TUNING.STARTING_E1RM);
    const state = playMeet(
      () => 'perfect',
      () => 'small',
      {
        day,
        meet: MEET_LOCAL,
        entry: MEET_ENTRY,
        bestE1rmKg: facts.bestE1rmKg,
        previousBestTotalKg: facts.previousBestTotalKg,
        previousBestByLiftKg: facts.previousBestByLiftKg,
        fatigue: port.meetBrief(day).fatigue,
      },
    );
    const proposal = meetResultProposal(state);
    if (proposal === null) throw new Error('the played meet produced no proposal');
    return proposal;
  }

  it('A MEET BANKS A TOTAL THAT THE SESSION SIDE CAN THEN READ', async () => {
    // The whole point, as one assertion. Before this, meet day held a
    // `ServerRecord` of its own, so the total it banked went into an object that
    // was garbage when the screen unmounted and no other surface could ever see
    // it. Read through `readTotalKg`, because there is no row to read.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    expect(readingValue(readTotalKg(openingCache(port)))).toBeNull();

    const response = await port.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAMeet(port, DAY),
      asProposalId('meet-1'),
    );
    expect(response.kind).toBe('recorded');
    if (response.kind !== 'recorded') throw new Error('unreachable');
    expect(response.result.totalKg).toBeGreaterThan(0);
    expect(readingValue(readTotalKg(openingCache(port)))).toBe(response.result.totalKg);
  });

  it('and the response hands back no stored row', async () => {
    // `AppliedMeetResult` carries one; `RecordedMeet` must not, or the client
    // has the bypass back under a different name.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const response = await port.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAMeet(port, DAY),
      asProposalId('meet-1'),
    );
    if (response.kind !== 'recorded') throw new Error('unreachable');
    const body: Record<string, unknown> = { ...response.result };
    expect(body.record).toBeUndefined();
    // `previousBestByLiftKg` joined this list with GDD §6.5's per-lift call-out:
    // the recap cannot tell a beaten record from a first one without the number
    // that was beaten, and it printed "PR" for both while it could not. Three
    // kilogram readings about the lifter's own past meets — not a stored row,
    // which is what this list is here to keep out.
    expect(Object.keys(body).sort()).toEqual([
      'bestByLiftKg',
      'bombedLift',
      // What the result did to the CAREER — best-total movement and newly
      // qualified tiers, computed by careerServer.ts inside applyMeetResult.
      // Derived readings about the lifter's own record, not a stored row.
      'career',
      'isTotalPr',
      'liftPrs',
      'placing',
      'previousBestByLiftKg',
      'previousBestTotalKg',
      'totalKg',
    ]);
  });

  it('MEET_ALREADY_RECORDED FIRES ON THE SECOND MEET — reachable for the first time', async () => {
    // =======================================================================
    // WHAT BECAME REACHABLE, AND WHY REACHING IT IS CORRECT
    // =======================================================================
    // This guard could not fire while `useMeetDay` rebuilt its row per mount:
    // the row that would have remembered the first meet was thrown away with
    // the screen. It fires now, and the verdict is RIGHT rather than merely new
    // — `MEET_LOCAL` is a single dated event (it carries a `dateIso`), and
    // banking one competition twice is exactly what this refusal is for.
    //
    // WHAT IT COSTS A PLAYER is real and is recorded in GDD §11: with one
    // ungated door to one meet, a second meet in an app run is refused, so the
    // recap does not appear. The phase is still `'recap'`, so the shell draws
    // BACK TO TRAINING and nobody is stranded — but it is a blank screen with a
    // way out, and the fix is GDD §6.1's Career calendar knowing which meets a
    // lifter has already competed at.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const first = await port.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAMeet(port, DAY),
      asProposalId('meet-1'),
    );
    expect(first.kind).toBe('recorded');

    const second = await port.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAMeet(port, DAY),
      asProposalId('meet-2'),
    );
    expect(second.kind).toBe('refused');
    if (second.kind !== 'refused') throw new Error('unreachable');
    expect(second.error.code).toBe('MEET_ALREADY_RECORDED');
  });

  it('a refused second meet leaves the banked total exactly where it was', async () => {
    // The refusal must not half-apply. A total that moved on a refused write
    // would be worse than the defect it replaced, because `totalKg` is monotone
    // and nothing later can walk it back.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    await port.recordMeetResult(DAY, MEET_LOCAL, playAMeet(port, DAY), asProposalId('meet-1'));
    const banked = readingValue(readTotalKg(openingCache(port)));
    expect(banked).not.toBeNull();

    await port.recordMeetResult(DAY, MEET_LOCAL, playAMeet(port, DAY), asProposalId('meet-2'));
    expect(readingValue(readTotalKg(openingCache(port)))).toBe(banked);
  });

  it('a meet does not touch the streak, so competing is not a training day', async () => {
    // `applyMeetResult` carries `record.streak` through untouched and
    // `meetServer.ts` argues why. Asserted from the CLIENT side, because that is
    // where it would be noticed: a meet that silently logged a training day
    // would give a player a streak they did not earn and — worse under GDD
    // §12.3 — would consume that day's coverage.
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const before = todayFromCache(openingCache(port), DAY, LIFT);

    await port.recordMeetResult(DAY, MEET_LOCAL, playAMeet(port, DAY), asProposalId('meet-1'));
    const after = todayFromCache(openingCache(port), DAY, LIFT);
    expect(after.streakBefore).toBe(before.streakBefore);
    expect(after.alreadyTrainedToday).toBe(before.alreadyTrainedToday);
  });

  it('and does not touch the e1RM either — a meet is not a training session', async () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const before = todayFromCache(openingCache(port), DAY, LIFT).bestE1rmKg;

    await port.recordMeetResult(DAY, MEET_LOCAL, playAMeet(port, DAY), asProposalId('meet-1'));
    expect(todayFromCache(openingCache(port), DAY, LIFT).bestE1rmKg).toBe(before);
  });

  it('the meet brief carries the ledger and nothing else (GDD §3.4, §12.3)', () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    expect(Object.keys(port.meetBrief(DAY))).toEqual(['fatigue']);
  });
});

describe('the career half chooses on the row the other halves read', () => {
  it('a chosen federation is on the snapshot every surface opens', async () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    expect(readingValue(readFederation(openingCache(port)))).toEqual({
      id: CAREER_TUNING.DEFAULT_FEDERATION_ID,
      chosen: false,
    });
    const response = await port.chooseFederation(
      { kind: 'choose-federation', report: { federationId: 'grandhall' } },
      asProposalId('fed-1'),
    );
    expect(response.kind).toBe('chosen');
    if (response.kind !== 'chosen') throw new Error('unreachable');
    expect(response.wire.federation).toEqual({ id: 'grandhall', chosen: true });
    // The same row, read back through the session half's opening snapshot.
    expect(readingValue(readFederation(openingCache(port)))).toEqual({
      id: 'grandhall',
      chosen: true,
    });
  });

  it('a banked meet locks the row against moving to another federation', async () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const recorded = await port.recordMeetResult(
      DAY,
      MEET_LOCAL,
      playAWholeMeet(port, DAY),
      asProposalId('meet-lock'),
    );
    expect(recorded.kind).toBe('recorded');
    const refused = await port.chooseFederation(
      { kind: 'choose-federation', report: { federationId: 'grandhall' } },
      asProposalId('fed-2'),
    );
    expect(refused.kind).toBe('refused');
    if (refused.kind !== 'refused') throw new Error('unreachable');
    expect(refused.error.code).toBe('FEDERATION_LOCKED_BY_RESULTS');
    // And nothing moved: the row still answers with the seeded default.
    expect(readingValue(readFederation(openingCache(port)))).toEqual({
      id: CAREER_TUNING.DEFAULT_FEDERATION_ID,
      chosen: false,
    });
  });

  it('a refused choice is dead: the second attempt after a real one is refused too', async () => {
    const port = localSessionServer({ record: storedRecord(), sleep: instantly });
    const first = await port.chooseFederation(
      { kind: 'choose-federation', report: { federationId: 'ironline' } },
      asProposalId('fed-3'),
    );
    expect(first.kind).toBe('chosen');
    const second = await port.chooseFederation(
      { kind: 'choose-federation', report: { federationId: 'meridian' } },
      asProposalId('fed-4'),
    );
    expect(second.kind).toBe('refused');
    if (second.kind !== 'refused') throw new Error('unreachable');
    expect(second.error.code).toBe('FEDERATION_ALREADY_CHOSEN');
  });
});

// ---------------------------------------------------------------------------
// Sprint 2 — the row survives a reload, through the injected store
// ---------------------------------------------------------------------------

import { decodeSavedGame, SAVE_VERSION } from '../game/saveGame';
import type { SaveStore } from './localSessionServer';

/** An in-memory store a test can read back out of, with every call counted. */
function fakeStore(initial: string | null = null): SaveStore & {
  text: string | null;
  saves: number;
  quarantined: Array<{ text: string; code: string }>;
} {
  const box = {
    text: initial,
    saves: 0,
    quarantined: [] as Array<{ text: string; code: string }>,
    load: () => box.text,
    save: (text: string) => {
      box.saves += 1;
      box.text = text;
    },
    quarantine: (text: string, code: string) => {
      box.quarantined.push({ text, code });
    },
  };
  return box;
}

const CHOOSE_IRONLINE = {
  kind: 'choose-federation',
  report: { federationId: 'ironline' },
} as const;

describe('the row survives a reload (Sprint 2)', () => {
  it('an accepted mutation writes a decodable save, and a second server opens on it', async () => {
    const store = fakeStore();
    const first = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    const chosen = await first.chooseFederation(CHOOSE_IRONLINE, asProposalId('save-c1'));
    expect(chosen.kind).toBe('chosen');
    expect(store.saves).toBe(1);
    expect(store.text).not.toBeNull();
    const decoded = decodeSavedGame(store.text ?? '');
    expect(decoded.ok, decoded.ok ? '' : decoded.detail).toBe(true);

    // THE RELOAD, at the port level: a brand-new server over the same store is
    // the same lifter — the choice made before the "reload" is on the snapshot
    // the fresh connection opens with.
    const second = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    const reading = readFederation(openingCache(second));
    expect(readingValue(reading)).toEqual({ id: 'ironline', chosen: true });
  });

  it('a REFUSED mutation writes nothing — the row did not move, so neither does the save', async () => {
    const store = fakeStore();
    const port = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    await port.chooseFederation(CHOOSE_IRONLINE, asProposalId('save-c2'));
    expect(store.saves).toBe(1);
    const again = await port.chooseFederation(
      { kind: 'choose-federation', report: { federationId: 'grandhall' } },
      asProposalId('save-c3'),
    );
    expect(again.kind).toBe('refused');
    expect(store.saves).toBe(1);
  });

  it('a save this build cannot read is QUARANTINED before the fresh lifter can overwrite it', async () => {
    const store = fakeStore('not a save at all');
    const port = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    // Quarantined at construction — with the ORIGINAL bytes and the refusal's
    // own code — and only then does the fresh lifter's first accepted
    // mutation overwrite the live key.
    expect(store.quarantined).toEqual([{ text: 'not a save at all', code: 'NOT_JSON' }]);
    await port.chooseFederation(CHOOSE_IRONLINE, asProposalId('save-c4'));
    expect(store.text).not.toBe('not a save at all');
    expect(store.quarantined[0]?.text).toBe('not a save at all');
  });

  it('A SAVE FROM THE FUTURE is refused into quarantine under FUTURE_VERSION — a newer lifter waits for the app, never dies to it', async () => {
    const store0 = fakeStore();
    const writer = localSessionServer({ store: store0, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    await writer.chooseFederation(CHOOSE_IRONLINE, asProposalId('save-c5'));
    const fromTheFuture = (store0.text ?? '').replace(
      `"version":${SAVE_VERSION}`,
      `"version":${SAVE_VERSION + 1}`,
    );
    expect(fromTheFuture).not.toBe(store0.text);

    const store = fakeStore(fromTheFuture);
    const port = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    expect(store.quarantined.map((q) => q.code)).toEqual(['FUTURE_VERSION']);
    expect(store.quarantined[0]?.text).toBe(fromTheFuture);
    // ...and the port is a working fresh lifter, not a dead app.
    const reading = readFederation(openingCache(port));
    expect(readingValue(reading)).toEqual({ id: CAREER_TUNING.DEFAULT_FEDERATION_ID, chosen: false });
  });

  it('a fresh lifter signs up on the day the CALLER names — the wall-clock day, once appServer passes it', async () => {
    const store = fakeStore();
    const port = localSessionServer({ store, sleep: instantly, freshSignupDay: 12345 });
    // Read through the save the server itself writes: the anchor every absence
    // is charged from (GDD §4.2) is the caller's day, not the test constant.
    await port.chooseFederation(CHOOSE_IRONLINE, asProposalId('save-c7'));
    const decoded = decodeSavedGame(store.text ?? '');
    expect(decoded.ok, decoded.ok ? '' : decoded.detail).toBe(true);
    if (decoded.ok) expect(decoded.record.streak.signupDay).toBe(12345);
  });

  it('an explicit record still wins over the store — a test that hands a row in means THAT row', () => {
    const store = fakeStore();
    const seeded = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    // no await needed for a synchronous check: the store had no save, so the
    // explicit-record server below cannot be reading one.
    void seeded;
    const port = localSessionServer({ record: storedRecord(), store, sleep: instantly });
    const reading = readFederation(openingCache(port));
    expect(readingValue(reading)).toEqual({ id: CAREER_TUNING.DEFAULT_FEDERATION_ID, chosen: false });
  });

  it('a store that THROWS does not take the mutation down with it', async () => {
    const store = fakeStore();
    store.save = () => {
      throw new Error('QuotaExceededError: the disk is full');
    };
    const port = localSessionServer({ store, sleep: instantly, freshSignupDay: SIGNUP_DAY });
    const chosen = await port.chooseFederation(CHOOSE_IRONLINE, asProposalId('save-c6'));
    expect(chosen.kind).toBe('chosen');
  });
});
