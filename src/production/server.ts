import { createGymViewState, gymViewReduce, type GymViewState, type GymViewAction } from '../facility/ladderView';
import { decodeFacilitySave, encodeFacilitySave, persistableGymTruthFromGymView, restoreGymViewState } from '../facility/facilityPersistence';
import { EMPIRE_TUNING } from '../facility/empireTuning';
import { TRAINING_STATION_KINDS } from '../facility/trainingStation';
import { applyTrainingSession, newServerRecord, snapshotWireFor, type ServerRecord } from '../game/sessionServer';
import { applyMeetResult, meetDayFacts } from '../game/meetServer';
import { applyFederationChoice, careerLifterFor, careerCalendarFor } from '../game/careerServer';
import { meetDefinitionFor } from '../game/careerMeet';
import { kilogramMeetEntryFrom } from '../game/lifterEntry';
import { createLifterProfile, editLifterName, editLifterBodyweight, type LifterProfile } from '../game/lifterProfile';
import { decodeSavedGame, encodeSavedGame } from '../game/saveGame';
import { briefFatigueFor } from '../game/sessionClient';
import { SESSION_TUNING } from '../game/sessionTuning';
import { MEET_ENTRY, type MeetDefinition } from '../game/meetTuning';
import type { MeetDayContext } from '../game/meetDay';
import { CAREER_FEDERATION_IDS } from '../career/federation';
import type { FacilityAction, ProductionOpening } from './contracts';
import type { TrainingEvidenceContext, TrainingLiftEvidence, MeetLiftEvidence } from './liftEvidence';
import { replayTrainingEvidence, replayMeetEvidence } from './evidenceReplay';
import { sealServerValue, type ProposalOfKind } from '../game/progression';
import { PRODUCTION_LIMITS } from './productionTuning';
import { utcAccountDay } from './clock';

/** Database-only state. No client replacement API exists. */
export interface ProductionState {
  readonly version: typeof PRODUCTION_LIMITS.schemaVersion;
  readonly gameSave: string;
  readonly facilitySave: string;
  readonly facilityAtMs: number;
  readonly presenceAtMs: number;
  readonly activeMeet: { readonly meetId: string; readonly day: number; readonly gameSave: string } | null;
}
export interface ProductionMutation { readonly kind: string; readonly requestId: string; readonly expectedRevision: number; readonly payload: Record<string, unknown> }
export class ProductionRefusal extends Error {
  readonly status: number;
  constructor(message: string, status: number = PRODUCTION_LIMITS.invalidRequestStatus) { super(message); this.name = 'ProductionRefusal'; this.status = status; }
}
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new ProductionRefusal(message); }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean { return Object.keys(value).every(key => allowed.includes(key)); }
function member<T extends string>(value: unknown, values: readonly T[]): value is T { return typeof value === 'string' && values.some(candidate => candidate === value); }

export function utcServerDay(nowMs: number): number { ensure(Number.isSafeInteger(nowMs) && nowMs >= 0, 'The server clock is invalid.'); return utcAccountDay(nowMs); }
export function initialProductionState(nowMs: number, signupAtMs: number = nowMs): ProductionState {
  const day = utcServerDay(Math.min(nowMs, signupAtMs));
  return Object.freeze({ version: PRODUCTION_LIMITS.schemaVersion, gameSave: encodeSavedGame(newServerRecord(day), new Date(nowMs).toISOString()), facilitySave: encodeFacilitySave(persistableGymTruthFromGymView(createGymViewState())), facilityAtMs: nowMs, presenceAtMs: nowMs, activeMeet: null });
}
function hydrate(state: ProductionState): { record: ServerRecord; profile: LifterProfile | null; facility: GymViewState } {
  ensure(object(state) && state.version === PRODUCTION_LIMITS.schemaVersion && typeof state.gameSave === 'string' && typeof state.facilitySave === 'string' && Number.isSafeInteger(state.facilityAtMs) && Number.isSafeInteger(state.presenceAtMs), 'Stored account data has an unsupported shape.');
  const game = decodeSavedGame(state.gameSave); const facility = decodeFacilitySave(state.facilitySave);
  ensure(game.ok, 'Stored lifter data cannot be decoded. Progress was not replaced.');
  ensure(facility.kind === 'loaded', 'Stored gym data cannot be decoded. Progress was not replaced.');
  return { record: game.record, profile: game.profile, facility: restoreGymViewState(facility.envelope.truth) };
}
function accrued(state: ProductionState, nowMs: number, facility: GymViewState): { facility: GymViewState; atMs: number } {
  utcServerDay(nowMs); ensure(state.facilityAtMs <= nowMs, 'The database clock precedes the last saved gym tick.');
  const tickMs = EMPIRE_TUNING.TICK_SECONDS * PRODUCTION_LIMITS.millisecondsPerSecond;
  const elapsedMs = Math.floor((nowMs - state.facilityAtMs) / tickMs) * tickMs;
  if (elapsedMs <= 0) return { facility, atMs: state.facilityAtMs };
  return { facility: gymViewReduce(facility, { kind: 'advance-clock', gapSeconds: elapsedMs / PRODUCTION_LIMITS.millisecondsPerSecond, mode: nowMs - state.presenceAtMs <= PRODUCTION_LIMITS.onlinePresenceGapMs ? 'online' : 'offline' }), atMs: state.facilityAtMs + elapsedMs };
}
/** One spendable Gym Bucks purse: Career shows the whole bucks held by Empire.
 * Fractional idle earnings remain in the native facility purse, never a second
 * wallet. Chalk is carried through because Empire has no Chalk authority. */
export function withFacilityWallet(record: ServerRecord, facility: GymViewState): ServerRecord {
  const gymBucks = Math.floor(facility.managed.gym.ladder.gymBucks);
  ensure(Number.isSafeInteger(gymBucks) && gymBucks >= 0, 'The saved gym balance is invalid.');
  if (record.wallet.gymBucks === gymBucks) return record;
  return sealServerValue({ ...record, wallet: { gymBucks, chalk: record.wallet.chalk } });
}
export function productionOpening(state: ProductionState, revision: number, nowMs: number, appliedProposalId: string | null = null): ProductionOpening {
  const loaded = hydrate(state); const serverDay = utcServerDay(nowMs);
  const facility = accrued(state, nowMs, loaded.facility).facility;
  return Object.freeze({ wire: snapshotWireFor(withFacilityWallet(loaded.record, facility), appliedProposalId), fatigue: briefFatigueFor(loaded.record.fatigue, serverDay), profile: loaded.profile, facility, serverDay, serverNowMs: nowMs, revision });
}
export function readProductionMutation(value: unknown): ProductionMutation {
  ensure(object(value) && keys(value, ['kind', 'payload', 'requestId', 'expectedRevision']), 'Progress request has an invalid shape.');
  ensure(typeof value.kind === 'string' && object(value.payload), 'Progress command and payload are required.');
  ensure(typeof value.requestId === 'string' && value.requestId.length > 0 && value.requestId.length <= PRODUCTION_LIMITS.maxRequestIdLength && /^[A-Za-z0-9._:-]+$/.test(value.requestId), 'Progress request ID is invalid.');
  ensure(typeof value.expectedRevision === 'number' && Number.isSafeInteger(value.expectedRevision) && value.expectedRevision >= 0, 'Progress revision is invalid.');
  return { kind: value.kind, payload: value.payload, requestId: value.requestId, expectedRevision: value.expectedRevision };
}
export function readFacilityAction(value: unknown): FacilityAction {
  ensure(object(value) && typeof value.kind === 'string', 'Gym action is invalid.');
  const ladder = EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]; const session = EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS as readonly string[]; const managed = [...ladder, ...session];
  switch (value.kind) {
    case 'check-in': case 'move-up': case 'dismiss-manager': case 'recover-gym': ensure(keys(value, ['kind']), 'Gym action contains unsupported fields.'); break;
    case 'buy-ladder': case 'floor-remove-furniture': ensure(keys(value, ['kind', 'item']) && member(value.item, ladder), 'Gym furniture is invalid.'); break;
    case 'buy-session': case 'floor-remove': ensure(keys(value, ['kind', 'item']) && member(value.item, session), 'Gym equipment is invalid.'); break;
    case 'repair-item': case 'decline-repair': ensure(keys(value, ['kind', 'item']) && member(value.item, managed), 'Repair item is invalid.'); break;
    case 'floor-place': case 'floor-place-furniture': ensure(keys(value, ['kind', 'item', 'position']) && member(value.item, value.kind === 'floor-place' ? session : ladder), 'Placement equipment is invalid.'); ensure(object(value.position) && keys(value.position, ['x', 'y']) && Number.isSafeInteger(value.position.x) && Number.isSafeInteger(value.position.y), 'Placement coordinates must be whole tiles.'); break;
    case 'hire-manager': ensure(keys(value, ['kind', 'tier']) && member(value.tier, EMPIRE_TUNING.MANAGER_TIERS), 'Manager tier is invalid.'); break;
    case 'answer-prompt': ensure(keys(value, ['kind', 'response']) && member(value.response, ['repair', 'dismiss']), 'Maintenance response is invalid.'); break;
    case 'upgrade-station': ensure(keys(value, ['kind', 'station', 'axis']) && member(value.station, TRAINING_STATION_KINDS) && member(value.axis, EMPIRE_TUNING.STATION_UPGRADE_AXES), 'Station upgrade is invalid.'); break;
    default: throw new ProductionRefusal('This gym action is not available through the saved account API.');
  }
  return value as FacilityAction;
}
function resolvedMeet(record: ServerRecord, day: number, meetId: unknown): MeetDefinition {
  ensure(typeof meetId === 'string', 'Meet ID is invalid.');
  const entry = careerCalendarFor(careerLifterFor(record), day).entries.find(candidate => candidate.meet.id === meetId);
  ensure(entry, 'This meet is not on the account career calendar.');
  ensure(entry.verdict.kind === 'open', entry.verdict.kind === 'refused' ? entry.verdict.sentence : 'Meet entry is unavailable.');
  ensure(entry.meet.scheduling === 'async', 'Live competitive meets require the multiplayer service.');
  return meetDefinitionFor(entry.meet);
}
function meetContext(record: ServerRecord, profile: LifterProfile | null, day: number, meet: MeetDefinition): MeetDayContext {
  ensure(profile, 'Create a lifter before entering a meet.');
  return { ...meetDayFacts(record, day, SESSION_TUNING.STARTING_E1RM), meet, entry: kilogramMeetEntryFrom(profile, record.federation.id, MEET_ENTRY.lot), fatigue: briefFatigueFor(record.fatigue, day) };
}
export function applyProductionMutation(state: ProductionState, command: ProductionMutation, nowMs: number, identityEntropy: string): { state: ProductionState; response: unknown } {
  const loaded = hydrate(state); let record = loaded.record; let profile = loaded.profile;
  const tick = accrued(state, nowMs, loaded.facility); let facility = tick.facility; let activeMeet = state.activeMeet;
  const day = utcServerDay(nowMs); const payload = command.payload; let response: unknown;
  switch (command.kind) {
    case 'facility-action': {
      ensure(keys(payload, ['action']), 'Gym payload contains unsupported fields.'); const action = readFacilityAction(payload.action);
      if (action.kind !== 'check-in') facility = gymViewReduce(facility, action as GymViewAction);
      response = facility.lastRefusal ? { kind: 'refused', message: facility.lastRefusal.replaceAll('-', ' '), state: facility } : { kind: 'saved', state: facility }; break;
    }
    case 'record-training-session': {
      ensure(keys(payload, ['day', 'proposal', 'context', 'evidence']) && payload.day === day, 'This training session is from a different server UTC day. Reopen training to receive today’s plan.');
      const verified = replayTrainingEvidence(record, day, payload.proposal as ProposalOfKind<'record-training-session'>, payload.context as TrainingEvidenceContext, payload.evidence as readonly TrainingLiftEvidence[]);
      const applied = applyTrainingSession(record, day, verified, command.requestId); ensure(applied.ok, applied.ok ? '' : applied.error.message);
      record = withFacilityWallet(applied.value.record, facility); response = { kind: 'snapshot', wire: snapshotWireFor(record, command.requestId) }; break;
    }
    case 'record-meet-result': {
      ensure(keys(payload, ['day', 'meetId', 'proposalId', 'proposal', 'evidence']) && payload.day === day, 'This meet is from a different server UTC day. Re-enter it from Career.');
      ensure(typeof payload.proposalId === 'string' && payload.proposalId.length > 0 && command.requestId === `${String(payload.meetId)}:${payload.proposalId}`, 'Meet proposal acknowledgement ID is invalid.');
      ensure(activeMeet && activeMeet.day === day && activeMeet.meetId === payload.meetId, 'Enter this meet from the account career calendar before recording it.');
      const start = decodeSavedGame(activeMeet.gameSave); ensure(start.ok, 'The saved meet entry cannot be decoded.');
      const meet = resolvedMeet(record, day, payload.meetId);
      const verified = replayMeetEvidence(meetContext(start.record, start.profile, day, meet), payload.proposal as ProposalOfKind<'record-meet-result'>, payload.evidence as readonly MeetLiftEvidence[]);
      const applied = applyMeetResult(record, day, meet, verified, payload.proposalId); ensure(applied.ok, applied.ok ? '' : applied.error.message);
      record = withFacilityWallet(applied.value.record, facility); activeMeet = null; const result = applied.value;
      response = { kind: 'recorded', wire: snapshotWireFor(record, payload.proposalId), result: { totalKg: result.totalKg, previousBestTotalKg: result.previousBestTotalKg, isTotalPr: result.isTotalPr, liftPrs: result.liftPrs, placing: result.placing, bestByLiftKg: result.bestByLiftKg, previousBestByLiftKg: result.previousBestByLiftKg, bombedLift: result.bombedLift, career: result.career } }; break;
    }
    case 'enter-career-meet': {
      ensure(keys(payload, ['meetId']), 'Meet entry payload contains unsupported fields.'); const meet = resolvedMeet(record, day, payload.meetId);
      meetContext(record, profile, day, meet); activeMeet = { meetId: meet.id, day, gameSave: encodeSavedGame(record, new Date(nowMs).toISOString(), profile) }; response = { kind: 'entered', meetId: meet.id }; break;
    }
    case 'choose-federation': {
      ensure(keys(payload, ['proposal']) && object(payload.proposal) && payload.proposal.kind === 'choose-federation' && object(payload.proposal.report) && keys(payload.proposal.report, ['federationId']) && member(payload.proposal.report.federationId, CAREER_FEDERATION_IDS), 'Federation proposal is invalid.');
      const applied = applyFederationChoice(record, { kind: 'choose-federation', report: { federationId: payload.proposal.report.federationId } }, command.requestId);
      ensure(applied.ok, applied.ok ? '' : applied.error.message); record = withFacilityWallet(applied.value.record, facility); response = { kind: 'chosen', wire: snapshotWireFor(record, command.requestId) }; break;
    }
    case 'create-profile': {
      ensure(keys(payload, ['draft', 'federationId']) && object(payload.draft) && keys(payload.draft, ['name', 'sex', 'bodyweightKgText']) && typeof payload.draft.name === 'string' && typeof payload.draft.bodyweightKgText === 'string' && member(payload.draft.sex, ['male', 'female'] as const), 'Lifter profile input is invalid.');
      ensure(member(payload.federationId, CAREER_FEDERATION_IDS), 'Federation is invalid.');
      if (!profile) {
        const created = createLifterProfile({ name: payload.draft.name, sex: payload.draft.sex, bodyweightKgText: payload.draft.bodyweightKgText }, identityEntropy); ensure(created.ok, created.ok ? '' : created.detail);
        if (!record.federation.chosen) { const chosen = applyFederationChoice(record, { kind: 'choose-federation', report: { federationId: payload.federationId } }, command.requestId); ensure(chosen.ok, chosen.ok ? '' : chosen.error.message); record = chosen.value.record; }
        profile = created.profile;
      }
      response = { kind: 'saved', profile }; break;
    }
    case 'edit-profile-name': case 'edit-profile-bodyweight': {
      ensure(profile, 'There is no lifter profile to edit.'); const nameEdit = command.kind === 'edit-profile-name';
      ensure(keys(payload, [nameEdit ? 'name' : 'bodyweightKgText']) && typeof payload[nameEdit ? 'name' : 'bodyweightKgText'] === 'string', 'Lifter edit input is invalid.');
      const edited = nameEdit ? editLifterName(profile, { name: payload.name as string }) : editLifterBodyweight(profile, { bodyweightKgText: payload.bodyweightKgText as string });
      ensure(edited.ok, edited.ok ? '' : edited.detail); profile = edited.profile; response = { kind: 'saved', profile }; break;
    }
    default: throw new ProductionRefusal('This progression command is not available through the saved account API.');
  }
  record = withFacilityWallet(record, facility);
  return { state: Object.freeze({ version: PRODUCTION_LIMITS.schemaVersion, gameSave: encodeSavedGame(record, new Date(nowMs).toISOString(), profile), facilitySave: encodeFacilitySave(persistableGymTruthFromGymView(facility)), facilityAtMs: tick.atMs, presenceAtMs: nowMs, activeMeet }), response };
}
