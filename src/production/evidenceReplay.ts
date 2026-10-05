import { createLift, stepLift, type LiftConfig, type LiftResolution } from '../game/lift';
import { LIFT_ORDER } from '../game/meet';
import { createSession, stepSession, repConfigFor, executionQualityFrom, sessionProposal } from '../game/session';
import { todayForLifter, type ServerRecord } from '../game/sessionServer';
import { SESSION_TUNING } from '../game/sessionTuning';
import { createMeetDay, stepMeetDay, attemptConfigFor, meetResultProposal, type MeetDayContext } from '../game/meetDay';
import type { ProposalOfKind } from '../game/progression';
import type { LiftEvidence, TrainingEvidenceContext, TrainingLiftEvidence, MeetLiftEvidence } from './liftEvidence';
import { PRODUCTION_LIMITS } from './productionTuning';

export const REPLAY_LIMITS = Object.freeze({ ticksPerLift: PRODUCTION_LIMITS.ticksPerLift, eventsPerLift: PRODUCTION_LIMITS.eventsPerLift, totalTicks: PRODUCTION_LIMITS.totalReplayTicks });
export class EvidenceRefusal extends Error { constructor(message: string) { super(message); this.name = 'EvidenceRefusal'; } }
function require(condition: unknown, message: string): asserts condition { if (!condition) throw new EvidenceRefusal(message); }
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

/** Difficulty is reconstructed on the server; serialized opaque feel is ignored. */
export function replayLiftEvidence(evidence: LiftEvidence, authoritative: LiftConfig): LiftResolution {
  require(evidence && typeof evidence === 'object' && evidence.config && typeof evidence.config === 'object', 'Lift input evidence is missing.');
  const config = evidence.config;
  require(config.kind === authoritative.kind && config.seed === authoritative.seed && config.loadRatio === authoritative.loadRatio && canonicalJson(config.moment) === canonicalJson(authoritative.moment), 'Lift evidence does not match this lifter, load, day, and attempt.');
  require(Number.isSafeInteger(evidence.resolvedTick) && evidence.resolvedTick > 0 && evidence.resolvedTick <= REPLAY_LIMITS.ticksPerLift, 'Lift evidence has an invalid resolution tick.');
  require(Array.isArray(evidence.events) && evidence.events.length <= REPLAY_LIMITS.eventsPerLift, 'Lift input history exceeds the request limit.');
  let state = createLift(authoritative);
  for (const event of evidence.events) {
    require(event && typeof event === 'object' && Number.isSafeInteger(event.tick) && event.tick >= 0 && event.tick <= evidence.resolvedTick, 'Lift input history contains an invalid tick.');
    require(['press', 'release', 'clear-grip'].includes(event.kind), 'Lift input history contains an unknown action.');
    if (event.kind === 'clear-grip') {
      require(event.tick >= state.tick, 'Lift input history is out of order.');
      while (state.tick < event.tick && state.phase !== 'RESOLVED') state = stepLift(state);
      require(state.tick === event.tick && state.phase !== 'RESOLVED', 'Lift input history continues after resolution.');
      state = { ...state, held: false };
    } else {
      require(event.tick > state.tick, 'A lift accepts one press or release per native tick.');
      while (state.tick < event.tick - 1 && state.phase !== 'RESOLVED') state = stepLift(state);
      require(state.phase !== 'RESOLVED', 'Lift input history continues after resolution.');
      state = stepLift(state, { kind: event.kind });
    }
  }
  while (state.tick < evidence.resolvedTick && state.phase !== 'RESOLVED') state = stepLift(state);
  require(state.phase === 'RESOLVED' && state.tick === evidence.resolvedTick && state.resolution, 'The native engine did not resolve at the reported tick.');
  return state.resolution;
}

export function replayTrainingEvidence(record: ServerRecord, day: number, proposal: ProposalOfKind<'record-training-session'>, context: TrainingEvidenceContext, evidence: readonly TrainingLiftEvidence[]): ProposalOfKind<'record-training-session'> {
  require(context && typeof context === 'object' && context.checkIn && typeof context.checkIn === 'object', 'Training readiness evidence is missing.');
  const answers = context.checkIn;
  require(['poor', 'ok', 'good'].includes(answers.sleep) && ['sore', 'normal', 'fresh'].includes(answers.soreness) && ['flat', 'steady', 'fired-up'].includes(answers.motivation), 'Training readiness answers are invalid.');
  require((SESSION_TUNING.RPE_CHOICES as readonly number[]).includes(context.targetRpe), 'Training effort target is invalid.');
  require(Array.isArray(evidence) && evidence.length > 0 && evidence.length <= SESSION_TUNING.WORK_SETS * SESSION_TUNING.REPS_PER_SET, 'Training rep evidence is missing or exceeds the session limit.');
  const lift = evidence[0]?.evidence?.config?.kind;
  require(lift && (LIFT_ORDER as readonly string[]).includes(lift), 'Training lift is invalid.');
  const today = todayForLifter(record, day, lift);
  require(!today.alreadyTrainedToday, 'A training session is already recorded for this UTC day.');
  let state = createSession(today);
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'sleep', answer: answers.sleep } });
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'soreness', answer: answers.soreness } });
  state = stepSession(state, { kind: 'check-in-tap', tap: { question: 'motivation', answer: answers.motivation } });
  state = stepSession(state, { kind: 'choose-rpe', rpe: context.targetRpe });
  let ticks = 0;
  for (const rep of evidence) {
    require(state.phase === 'set' && rep.setIndex === state.setIndex && rep.repIndex === state.repIndex, 'Training rep evidence skips or repeats a set or rep.');
    const resolution = replayLiftEvidence(rep.evidence, repConfigFor(state));
    ticks += rep.evidence.resolvedTick;
    require(ticks <= REPLAY_LIMITS.totalTicks, 'Training replay exceeds the request limit.');
    state = stepSession(state, { kind: 'rep-resolved', outcome: resolution.outcome, executionQuality: executionQualityFrom(resolution) });
    if (state.phase === 'rest') state = stepSession(state, { kind: 'begin-set' });
  }
  require(state.phase === 'close-out' && state.closeOut, 'Training evidence does not complete the prescribed session.');
  require(proposal && proposal.kind === 'record-training-session' && proposal.report && typeof proposal.report === 'object', 'Training proposal is invalid.');
  const verified = sessionProposal(state.closeOut, proposal.report.deviceWallClock);
  require(verified && canonicalJson(verified.report.card) === canonicalJson(proposal.report.card), 'Training sets do not match the native engine replay.');
  return verified;
}

export function replayMeetEvidence(context: MeetDayContext, proposal: ProposalOfKind<'record-meet-result'>, evidence: readonly MeetLiftEvidence[]): ProposalOfKind<'record-meet-result'> {
  require(proposal && proposal.kind === 'record-meet-result' && proposal.report && typeof proposal.report === 'object' && proposal.report.card?.unit === 'kg' && Array.isArray(proposal.report.card.kilogramAttempts), 'Meet proposal must contain a kilogram attempt card.');
  const rows = proposal.report.card.kilogramAttempts;
  require(Array.isArray(evidence) && evidence.length > 0 && evidence.length <= PRODUCTION_LIMITS.maximumMeetAttempts && rows.length === evidence.length, 'Meet input evidence does not cover every reported attempt.');
  let state = stepMeetDay(createMeetDay(context), { kind: 'confirm-weigh-in' });
  for (const lift of LIFT_ORDER) {
    const opener = rows.find(row => row.lift === lift && row.attemptNumber === 1);
    if (opener) state = stepMeetDay(state, { kind: 'set-opener', lift, weightKg: opener.weight });
  }
  let ticks = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!; const rep = evidence[index]!;
    require(row && typeof row === 'object' && rep && typeof rep === 'object' && Number.isFinite(row.weight) && row.weight > 0, 'Meet attempt evidence is invalid.');
    require(rep.lift === row.lift && rep.ordinal === row.attemptNumber, 'Meet evidence is out of attempt order.');
    state = index === 0 ? stepMeetDay(state, { kind: 'confirm-openers' }) : stepMeetDay(state, { kind: 'declare', weightKg: row.weight });
    require(state.phase === 'walkout' && state.live?.lift === row.lift && state.live?.attemptNumber === row.attemptNumber && state.live?.weightKg === row.weight, 'The native meet engine refused this attempt declaration.');
    state = stepMeetDay(state, { kind: 'walkout-done' });
    const resolution = replayLiftEvidence(rep.evidence, attemptConfigFor(state)); ticks += rep.evidence.resolvedTick;
    require(ticks <= REPLAY_LIMITS.totalTicks, 'Meet replay exceeds the request limit.');
    state = stepMeetDay(state, { kind: 'lift-resolved', resolution });
    if (state.phase === 'deliberation') state = stepMeetDay(state, { kind: 'deliberation-done' });
    state = stepMeetDay(state, { kind: 'verdict-done' });
  }
  const verified = meetResultProposal(state);
  require(verified && canonicalJson(verified.report) === canonicalJson(proposal.report), 'Meet results or bodyweight do not match the native engine replay.');
  return verified;
}
