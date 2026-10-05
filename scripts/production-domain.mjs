/** Portable release boundary checks. The full Vitest suite remains a CI gate. */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLift, stepLift } from '../src/game/lift.ts';
import { TICK_MS } from '../src/game/liftTuning.ts';
import { EMPTY_FATIGUE_STATE, NEUTRAL_CHECK_IN, sessionFeel } from '../src/game/fatigue.ts';
import { applyTrainingSession, newServerRecord } from '../src/game/sessionServer.ts';
import { asMeetId, asProposalId } from '../src/game/progression.ts';
import { MEET_ENTRY, MEET_LOCAL } from '../src/game/meetTuning.ts';
import { dotsScore, officialTotalKg } from '../src/game/dots.ts';
import { decodeSavedGame, encodeSavedGame } from '../src/game/saveGame.ts';
import { localSessionServer } from '../src/session/localSessionServer.ts';
import { streakDayFromLocalWallClock } from '../src/game/streak.ts';
import { createGymViewState } from '../src/facility/ladderView.ts';
import { decodeFacilitySave, encodeFacilitySave, persistableGymTruthFromGymView, restoreGymViewState } from '../src/facility/facilityPersistence.ts';
import { accrueLadderGymBucks } from '../src/facility/ladder.ts';
import { EMPIRE_TUNING } from '../src/facility/empireTuning.ts';
import { advanceBrowserLift, createBrowserLift, pauseBrowserLift, queueBrowserInput, resumeBrowserLift } from '../web/src/liftBrowser.ts';
import { practiceFacility } from '../web/src/facilityPort.ts';

const clock = { year: 2026, month: 9, day: 29, hour: 12 };
const day = streakDayFromLocalWallClock(clock);
const instant = async () => undefined;
const profileDraft = { name: 'R. VELLUM', sex: 'male', bodyweightKgText: '83.5' };
const training = {
  kind: 'record-training-session',
  report: {
    deviceWallClock: clock,
    card: {
      unit: 'kg',
      kilogramSets: Array.from({ length: 3 }, () => ({ lift: 'bench', weight: 200, reps: 3, rpe: 8, executionQuality: 1 })),
    },
  },
};

function memoryStore(bytes = null) {
  let text = bytes;
  const quarantined = [];
  return {
    load: () => text,
    save: (value) => { text = value; },
    quarantine: (value, code) => { quarantined.push({ value, code }); },
    quarantined,
  };
}

function port(store) {
  return localSessionServer({
    store, sleep: instant, freshSignupDay: day,
    entropy: () => 'release-boundary-entropy',
    nowIso: () => '2026-09-29T12:00:00.000Z',
  });
}

test('the browser clock feeds the frozen lift engine one input per fixed tick', () => {
  for (const kind of ['squat', 'bench', 'deadlift']) {
    const config = { kind, loadRatio: 0.75, seed: 4, feel: sessionFeel(EMPTY_FATIGUE_STATE, day, NEUTRAL_CHECK_IN), moment: { workSetsCompleted: 0, repsCompletedInSet: 0 } };
    let browser = createBrowserLift(config);
    let reference = createLift(config);
    browser = queueBrowserInput(browser, 'press');
    for (let i = 0; i < 40; i += 1) {
      if (i === 20) browser = queueBrowserInput(browser, 'release');
      browser = advanceBrowserLift(browser, TICK_MS);
      reference = stepLift(reference, i === 0 ? { kind: 'press' } : i === 20 ? { kind: 'release' } : null);
      assert.deepEqual(browser.state, reference, `${kind}: fixed tick ${i}`);
    }
    assert.equal(advanceBrowserLift(browser, Number.NaN), browser);
    assert.equal(advanceBrowserLift(browser, -1), browser);
  }
});

test('a background hitch pauses and releases the bar without fast-forwarding', () => {
  const config = { kind: 'squat', loadRatio: 0.75, seed: 4, feel: sessionFeel(EMPTY_FATIGUE_STATE, day, NEUTRAL_CHECK_IN), moment: { workSetsCompleted: 0, repsCompletedInSet: 0 } };
  const pressed = advanceBrowserLift(queueBrowserInput(createBrowserLift(config), 'press'), TICK_MS);
  assert.equal(pressed.state.held, true);
  const paused = advanceBrowserLift(pressed, 10_000);
  assert.equal(paused.paused, true);
  assert.equal(paused.state.tick, pressed.state.tick);
  assert.equal(paused.state.held, false);
  assert.deepEqual(paused.inputs, []);
  assert.equal(advanceBrowserLift(paused, TICK_MS), paused);
  const resumed = resumeBrowserLift(pauseBrowserLift(paused));
  assert.equal(resumed.paused, false);
  assert.equal(resumed.state.tick, pressed.state.tick);
  assert.equal(resumed.state.held, false);
});

test('training moves e1RM and streak through the port, never official Total; replay is refused', async () => {
  const server = port();
  const before = server.openingSnapshot();
  const response = await server.recordTrainingSession(day, training, asProposalId('release-training'));
  assert.equal(response.kind, 'snapshot');
  assert.equal(response.wire.totalKg, before.totalKg);
  assert.ok(response.wire.bestE1rmKg.bench > before.bestE1rmKg.bench);
  assert.equal(response.wire.streak.currentStreak, before.streak.currentStreak + 1);
  const duplicate = await server.recordTrainingSession(day, training, asProposalId('release-training-again'));
  assert.equal(duplicate.kind, 'refused');
  assert.deepEqual(server.openingSnapshot(), { ...response.wire, acknowledgedProposalId: null });
  assert.equal(port().openingSnapshot().revision, 0, 'a fresh practice instance must not inherit the previous row');
});

test('a pound training card is refused before kilogram progression changes', () => {
  const row = newServerRecord(day);
  const pounds = { ...training, report: { ...training.report, card: { unit: 'lb', poundSets: training.report.card.kilogramSets } } };
  const refused = applyTrainingSession(row, day, pounds, 'release-wrong-unit');
  assert.equal(refused.ok, false);
  assert.equal(row.revision, 0);
  assert.equal(row.streak.currentStreak, 0);
  assert.equal(row.totalKg, null);
});

test('identity and accepted training survive save/reopen without reminting or losing facts', async () => {
  const store = memoryStore();
  const first = port(store);
  assert.equal((await first.createProfile({ ...profileDraft, bodyweightKgText: 'not-a-weight' }, 'meridian')).kind, 'refused');
  assert.equal(store.load(), null);
  const created = await first.createProfile(profileDraft, 'meridian');
  assert.equal(created.kind, 'saved');
  assert.equal((await first.recordTrainingSession(day, training, asProposalId('release-save-training'))).kind, 'snapshot');
  const before = first.openingSnapshot();
  const reopened = port(store);
  assert.deepEqual(reopened.openingProfile(), created.profile);
  assert.deepEqual(reopened.openingSnapshot(), before);
  const edited = await reopened.editProfileBodyweight('84');
  assert.equal(edited.kind, 'saved');
  assert.equal(edited.profile.id, created.profile.id);
  assert.deepEqual(reopened.openingSnapshot(), before);
});

test('a complete judged meet records an official Total while a duplicate cannot record twice', async () => {
  const server = port();
  const attempts = ['squat', 'bench', 'deadlift'].flatMap((lift) => [1, 2, 3].map((attemptNumber, index) => ({ lift, attemptNumber, weight: 100 + index * 5, good: true })));
  const proposal = { kind: 'record-meet-result', report: { meetId: asMeetId(MEET_LOCAL.id), bodyweight: MEET_ENTRY.bodyweight, card: { unit: 'kg', kilogramAttempts: attempts } } };
  const response = await server.recordMeetResult(day, MEET_LOCAL, proposal, asProposalId('release-meet'));
  assert.equal(response.kind, 'recorded');
  assert.equal(response.result.totalKg, 330);
  assert.equal(server.openingSnapshot().totalKg, 330);
  assert.ok(Number.isFinite(dotsScore(MEET_ENTRY.sex, MEET_ENTRY.bodyweight.kilograms, officialTotalKg(330))));
  const duplicate = await server.recordMeetResult(day, MEET_LOCAL, proposal, asProposalId('release-meet-again'));
  assert.equal(duplicate.kind, 'refused');
  assert.equal(server.openingSnapshot().meets.length, 1);
});

test('unreadable future saves are quarantined before a fresh mutation replaces the active key', async () => {
  const future = JSON.parse(encodeSavedGame(newServerRecord(day), '2026-09-29T12:00:00.000Z'));
  future.version = 999;
  const bytes = JSON.stringify(future);
  const decoded = decodeSavedGame(bytes);
  assert.equal(decoded.ok, false);
  assert.equal(decoded.code, 'FUTURE_VERSION');
  const store = memoryStore(bytes);
  const server = port(store);
  assert.deepEqual(store.quarantined, [{ value: bytes, code: 'FUTURE_VERSION' }]);
  const created = await server.createProfile(profileDraft, 'meridian');
  assert.equal(created.kind, 'saved');
  assert.notEqual(store.load(), bytes);
  assert.equal(store.quarantined[0].value, bytes);
});

test('facility saves round-trip durable truth and fail closed on unknown versions', () => {
  const truth = persistableGymTruthFromGymView(createGymViewState());
  const bytes = encodeFacilitySave(truth);
  const restored = decodeFacilitySave(bytes);
  assert.equal(restored.kind, 'loaded');
  assert.deepEqual(persistableGymTruthFromGymView(restoreGymViewState(restored.envelope.truth)), truth);
  const future = JSON.parse(bytes);
  future.schemaVersion = 999;
  assert.deepEqual(decodeFacilitySave(JSON.stringify(future)), { kind: 'refused', reason: 'unsupported-version' });
});

test('away earnings stop at the shipped cap even after an arbitrarily long absence', () => {
  const cap = EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR;
  const rate = 100;
  const capped = accrueLadderGymBucks(rate, cap);
  const long = accrueLadderGymBucks(rate, cap * 100);
  assert.equal(long.gymBucks, capped.gymBucks);
  assert.equal(long.secondsBanked, cap);
  assert.ok(long.secondsDiscarded > 0);
});

test('practice actions bank sub-tick elapsed time without fractional engine clocks or discarded remainder', async () => {
  const originalNow = Date.now;
  const beginning = 100_000;
  let now = beginning;
  Date.now = () => now;
  try {
    const facility = practiceFacility();
    const tickMs = EMPIRE_TUNING.TICK_SECONDS * 1000;
    for (const [fraction, tickCount] of [[.4, 0], [.9, 0], [1.1, 1], [1.6, 1], [1.9, 1], [2.05, 2]]) {
      now = beginning + Math.floor(fraction * tickMs);
      const response = await facility.facilityAction({ kind: 'check-in' }, `clock-${fraction}`);
      assert.equal(response.kind, 'saved');
      assert.equal(response.state.managed.gym.ladder.collectedAt, tickCount * EMPIRE_TUNING.TICK_SECONDS);
    }
  } finally { Date.now = originalNow; }
});
