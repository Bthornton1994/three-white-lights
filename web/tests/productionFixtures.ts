import { runLift, type LiftConfig } from '../../src/game/lift';
import { repScript, type RepStyle } from '../../src/game/meetPreview';
import { createSession, stepSession, repConfigFor, executionQualityFrom, sessionProposal } from '../../src/game/session';
import { todayForLifter, type ServerRecord } from '../../src/game/sessionServer';
import { createMeetDay, stepMeetDay, attemptConfigFor, meetResultProposal, type MeetDayContext } from '../../src/game/meetDay';
import { currentAttemptContext, LIFT_ORDER, type LiftKind } from '../../src/game/meet';
import type { LiftEvidence, TrainingEvidenceContext, TrainingLiftEvidence, MeetLiftEvidence } from '../../src/production/liftEvidence';
import { careerLifterFor, careerCalendarFor } from '../../src/game/careerServer';
import { meetDefinitionFor } from '../../src/game/careerMeet';
import { kilogramMeetEntryFrom } from '../../src/game/lifterEntry';
import { meetDayFacts } from '../../src/game/meetServer';
import { SESSION_TUNING } from '../../src/game/sessionTuning';
import { MEET_ENTRY } from '../../src/game/meetTuning';
import { briefFatigueFor } from '../../src/game/sessionClient';
import { decodeSavedGame } from '../../src/game/saveGame';
import type { ProductionState } from '../../src/production/server';
import { civilDateFromStreakDay, asStreakDay, STREAK_DAY_BOUNDARY } from '../../src/game/streak';

/** Fixtures play the existing native engine; no result or judging flag is fabricated. */
export function playedLift(config: LiftConfig, style: RepStyle = 'perfect'): { evidence: LiftEvidence; resolution: NonNullable<ReturnType<typeof runLift>['final']['resolution']> } {
  const script = repScript(config, style); const replay = runLift(config, script);
  if (!replay.final.resolution) throw new Error('Native fixture lift did not resolve.');
  const actions = new Map(script.filter(event => event.tick <= replay.final.tick).map(event => [event.tick, event]));
  return { evidence: { config, events: [...actions.values()].sort((a, b) => a.tick - b.tick), resolvedTick: replay.final.tick }, resolution: replay.final.resolution };
}

export function playedTraining(record: ServerRecord, day: number, lift: LiftKind = 'squat') {
  const context: TrainingEvidenceContext = { checkIn: { sleep: 'ok', soreness: 'normal', motivation: 'steady' }, targetRpe: SESSION_TUNING.RPE_CHOICES[SESSION_TUNING.DEFAULT_RPE_INDEX] };
  let state = createSession(todayForLifter(record, day, lift));
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'sleep', answer: context.checkIn.sleep } });
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'soreness', answer: context.checkIn.soreness } });
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'motivation', answer: context.checkIn.motivation } });
  state = stepSession(state, { kind: 'choose-rpe', rpe: context.targetRpe });
  const evidence: TrainingLiftEvidence[] = [];
  while (state.phase !== 'close-out') {
    if (state.phase === 'rest') { state = stepSession(state, { kind: 'begin-set' }); continue; }
    if (state.phase !== 'set') throw new Error('Native fixture training did not begin.');
    const played = playedLift(repConfigFor(state));
    evidence.push({ setIndex: state.setIndex, repIndex: state.repIndex, evidence: played.evidence });
    state = stepSession(state, { kind: 'rep-resolved', outcome: played.resolution.outcome, executionQuality: executionQualityFrom(played.resolution) });
  }
  if (!state.closeOut) throw new Error('Native fixture has no close-out.');
  const proposal = sessionProposal(state.closeOut, { ...civilDateFromStreakDay(asStreakDay(day)), hour: STREAK_DAY_BOUNDARY.ROLLOVER_HOUR_LOCAL });
  if (!proposal) throw new Error('Native fixture has no training proposal.');
  return { proposal, context, evidence, closeOut: state.closeOut };
}

export function savedGame(state: ProductionState) {
  const game = decodeSavedGame(state.gameSave); if (!game.ok) throw new Error('Fixture account cannot be decoded.'); return game;
}
export function openLocalMeet(state: ProductionState, day: number): MeetDayContext {
  const game = savedGame(state); if (!game.profile) throw new Error('Fixture account has no profile.');
  const entry = careerCalendarFor(careerLifterFor(game.record), day).entries.find(row => row.meet.tier === 'local' && row.verdict.kind === 'open');
  if (!entry) throw new Error('No open native local meet.');
  return { ...meetDayFacts(game.record, day, SESSION_TUNING.STARTING_E1RM), meet: meetDefinitionFor(entry.meet), entry: kilogramMeetEntryFrom(game.profile, game.record.federation.id, MEET_ENTRY.lot), fatigue: briefFatigueFor(game.record.fatigue, day) };
}
export function playedMeet(context: MeetDayContext, style: RepStyle = 'perfect') {
  let state = stepMeetDay(createMeetDay(context), { kind: 'confirm-weigh-in' });
  for (const lift of LIFT_ORDER) state = stepMeetDay(state, { kind: 'set-opener', lift, weightKg: context.meet.rules.barAndCollarsWeight[lift] });
  state = stepMeetDay(state, { kind: 'confirm-openers' });
  const evidence: MeetLiftEvidence[] = [];
  while (state.phase !== 'recap' && state.phase !== 'bombed') {
    if (state.phase === 'attempt-select') {
      const next = currentAttemptContext(state.meet); if (!next) throw new Error('Native fixture has no next declaration.');
      state = stepMeetDay(state, { kind: 'declare', weightKg: next.minimumWeight });
    }
    if (state.phase !== 'walkout' || !state.live) throw new Error('Native fixture did not enter walkout.');
    const { lift, attemptNumber } = state.live;
    state = stepMeetDay(state, { kind: 'walkout-done' }); const played = playedLift(attemptConfigFor(state), style);
    evidence.push({ lift, ordinal: attemptNumber, evidence: played.evidence });
    state = stepMeetDay(state, { kind: 'lift-resolved', resolution: played.resolution });
    state = stepMeetDay(state, { kind: 'deliberation-done' }); state = stepMeetDay(state, { kind: 'verdict-done' });
  }
  const proposal = meetResultProposal(state); if (!proposal) throw new Error('Native fixture has no completed meet proposal.');
  return { proposal, evidence, state };
}
