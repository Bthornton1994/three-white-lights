import { describe, expect, it } from 'vitest';
import { replayLiftEvidence, replayTrainingEvidence, replayMeetEvidence } from '../../src/production/evidenceReplay';
import { applyProductionMutation, initialProductionState, productionOpening, utcServerDay } from '../../src/production/server';
import { applyTrainingSession } from '../../src/game/sessionServer';
import { CAREER_FEDERATION_IDS } from '../../src/career/federation';
import { playedLift, playedTraining, playedMeet, savedGame, openLocalMeet } from './productionFixtures';

const NOW = Date.UTC(2026, 8, 30, 19); const DAY = utcServerDay(NOW);
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function profiled() {
  return applyProductionMutation(initialProductionState(NOW), { kind: 'create-profile', requestId: 'profile', expectedRevision: 0, payload: { draft: { name: 'Alex Iron', sex: 'male', bodyweightKgText: '82.5' }, federationId: CAREER_FEDERATION_IDS[0] } }, NOW, 'test-account:profile').state;
}

describe('native input evidence authority', () => {
  it.each(['squat', 'bench', 'deadlift'] as const)('replays all native %s training reps after a JSON round trip', lift => {
    const initial = initialProductionState(NOW); const record = savedGame(initial).record; const played = playedTraining(record, DAY, lift);
    expect(replayTrainingEvidence(record, DAY, copy(played.proposal), copy(played.context), copy(played.evidence))).toEqual(played.proposal);
    const applied = applyProductionMutation(initial, { kind: 'record-training-session', requestId: `train-${lift}`, expectedRevision: 0, payload: { day: DAY, proposal: played.proposal, context: played.context, evidence: played.evidence } }, NOW, 'test-account');
    const expected = applyTrainingSession(record, DAY, played.proposal, `train-${lift}`);
    expect(expected.ok).toBe(true); if (!expected.ok) throw new Error(expected.error.message);
    const actual = savedGame(applied.state).record;
    expect(actual.bestE1rmKg).toEqual(expected.value.record.bestE1rmKg);
    expect(actual.streak).toEqual(expected.value.record.streak);
    expect(actual.totalKg).toBeNull();
    expect(actual.wallet).toEqual(record.wallet);
  });

  it('refuses forged loads, seeds, moments, timing, repetition order, and claimed training quality', () => {
    const record = savedGame(initialProductionState(NOW)).record; const played = playedTraining(record, DAY);
    const first = played.evidence[0]!;
    for (const config of [{ ...first.evidence.config, loadRatio: 0.01 }, { ...first.evidence.config, seed: first.evidence.config.seed + 1 }, { ...first.evidence.config, moment: { workSetsCompleted: 99, repsCompletedInSet: 0 } }]) expect(() => replayTrainingEvidence(record, DAY, played.proposal, played.context, [{ ...first, evidence: { ...first.evidence, config } }, ...played.evidence.slice(1)])).toThrow();
    expect(() => replayTrainingEvidence(record, DAY, played.proposal, played.context, played.evidence.slice(1))).toThrow();
    expect(() => replayTrainingEvidence(record, DAY, played.proposal, played.context, [...played.evidence].reverse())).toThrow();
    expect(() => replayTrainingEvidence(record, DAY, played.proposal, played.context, [{ ...first, evidence: { ...first.evidence, resolvedTick: first.evidence.resolvedTick + 1 } }, ...played.evidence.slice(1)])).toThrow();
    const changed = copy(played.proposal);
    if (changed.report.card.unit !== 'kg') throw new Error('Fixture must load kilograms.');
    const row = changed.report.card.kilogramSets[0]!;
    const forged = { ...changed, report: { ...changed.report, card: { ...changed.report.card, kilogramSets: [{ ...row, weight: row.weight + 100, executionQuality: 1 }, ...changed.report.card.kilogramSets.slice(1)] } } };
    expect(() => replayTrainingEvidence(record, DAY, forged, played.context, played.evidence)).toThrow();
  });

  it('rebuilds opaque difficulty and refuses duplicate input ticks or input after resolution', () => {
    const config = { kind: 'bench' as const, seed: 12, loadRatio: 0.75 }; const played = playedLift(config);
    expect(replayLiftEvidence(copy(played.evidence), config)).toEqual(played.resolution);
    const event = played.evidence.events[0]!;
    expect(() => replayLiftEvidence({ ...played.evidence, events: [event, event, ...played.evidence.events.slice(1)] }, config)).toThrow();
    expect(() => replayLiftEvidence({ ...played.evidence, events: [...played.evidence.events, { tick: played.evidence.resolvedTick, kind: 'clear-grip' }] }, config)).toThrow();
  });

  it('records all nine native attempts and acknowledges the original meet proposal ID', () => {
    const initial = profiled(); const context = openLocalMeet(initial, DAY); const played = playedMeet(context);
    expect(played.evidence).toHaveLength(9);
    expect(replayMeetEvidence(context, copy(played.proposal), copy(played.evidence))).toEqual(played.proposal);
    const entered = applyProductionMutation(initial, { kind: 'enter-career-meet', requestId: 'entry', expectedRevision: 0, payload: { meetId: context.meet.id } }, NOW, 'test-account').state;
    const applied = applyProductionMutation(entered, { kind: 'record-meet-result', requestId: `${context.meet.id}:original-proposal`, expectedRevision: 0, payload: { day: DAY, meetId: context.meet.id, proposalId: 'original-proposal', proposal: played.proposal, evidence: played.evidence } }, NOW, 'test-account');
    const game = savedGame(applied.state); const opening = productionOpening(applied.state, 3, NOW, 'original-proposal');
    expect(game.record.meets).toHaveLength(1); expect(game.record.totalKg).toBeGreaterThan(0);
    expect(game.record.bestE1rmKg).toEqual(savedGame(initial).record.bestE1rmKg);
    expect(opening.wire.acknowledgedProposalId).toBe('original-proposal');
    expect(applied.state.activeMeet).toBeNull();
  });

  it('rejects forged meet bodyweight, attempt order, good flags, and a meet not entered on the account', () => {
    const initial = profiled(); const context = openLocalMeet(initial, DAY); const played = playedMeet(context);
    const changed = copy(played.proposal);
    const wrongBodyweight = { ...changed, report: { ...changed.report, bodyweight: { unit: 'kg' as const, kilograms: 50 } } };
    expect(() => replayMeetEvidence(context, wrongBodyweight, played.evidence)).toThrow();
    expect(() => replayMeetEvidence(context, played.proposal, [...played.evidence].reverse())).toThrow();
    if (changed.report.card.unit !== 'kg') throw new Error('Fixture must load kilograms.');
    const row = changed.report.card.kilogramAttempts[0]!;
    const forged = { ...changed, report: { ...changed.report, card: { ...changed.report.card, kilogramAttempts: [{ ...row, good: !row.good }, ...changed.report.card.kilogramAttempts.slice(1)] } } };
    expect(() => replayMeetEvidence(context, forged, played.evidence)).toThrow();
    expect(() => applyProductionMutation(initial, { kind: 'record-meet-result', requestId: `${context.meet.id}:x`, expectedRevision: 0, payload: { day: DAY, meetId: context.meet.id, proposalId: 'x', proposal: played.proposal, evidence: played.evidence } }, NOW, 'test')).toThrow(/Enter this meet/);
  });

  it('accepts a genuine native three-attempt bomb-out without inventing a total', () => {
    const initial = profiled(); const context = openLocalMeet(initial, DAY); const played = playedMeet(context, 'dumped');
    expect(played.evidence).toHaveLength(3); expect(played.state.phase).toBe('bombed');
    expect(replayMeetEvidence(context, played.proposal, played.evidence)).toEqual(played.proposal);
  });

  it('uses server time despite a future device hint and preserves corrupt saves for recovery', () => {
    const initial = initialProductionState(NOW); const record = savedGame(initial).record; const played = playedTraining(record, DAY);
    const proposal = { ...played.proposal, report: { ...played.proposal.report, deviceWallClock: { year: 2099, month: 12, day: 31, hour: 23 } } };
    const applied = applyProductionMutation(initial, { kind: 'record-training-session', requestId: 'clock', expectedRevision: 0, payload: { day: DAY, proposal, context: played.context, evidence: played.evidence } }, NOW, 'test');
    expect(productionOpening(applied.state, 1, NOW).serverDay).toBe(DAY);
    expect(() => productionOpening({ ...initial, gameSave: 'not-json' }, 0, NOW)).toThrow(/not replaced/);
    expect(() => applyProductionMutation(initial, { kind: 'record-training-session', requestId: 'wrong-day', expectedRevision: 0, payload: { day: DAY + 1, proposal: played.proposal, context: played.context, evidence: played.evidence } }, NOW, 'test')).toThrow(/different server UTC day/);
  });
});
