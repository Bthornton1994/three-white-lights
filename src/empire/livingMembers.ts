/**
 * livingMembers.ts — Stage G.1 / G.1A identity, G.2 service history, stay
 * response, and G.2C2 departure execution.
 *
 * Pure module: zero React, zero side effects, zero I/O, no `Math.random`.
 * Persists the bodies the player sees on the played floor — NOT `NpcLifter`
 * (`empireCore.ts`'s idle roster), NOT `MemberRoster` (`members.ts`'s
 * aggregate satisfaction inputs). Those populations stay separate.
 *
 * G.1A IDENTITY AUTHORITY: member ids are gym-local ordinals under a nonce
 * (`member:n1:0`) and do NOT encode the current facility rung. Facility
 * relocation reconciles the roster — it never recreates existing members.
 * Creation ordinals are minted from `nextOrdinal` so a departed identity is
 * never reused.
 *
 * G.1C PRESENTATION: `displayName` is a stored given name assigned once at
 * creation. It does not enter FloorSim, station choice, or any G.2 quantity.
 *
 * G.2A derives recent-service meaning in `livingMemberExperience.ts` from
 * `recentVisits`. G.2B derives type-blind retention pressure from that accepted
 * experience. G.2C1 persists only the member's response to that pressure in
 * `stayState`, once per real service observation. G.2C2 may then remove an
 * already-eligible member from the active roster after one further
 * strain-qualifying service observation. This file does not rebuild
 * satisfaction or retention arithmetic.
 *
 * NOT BUILT HERE, ON PURPOSE — later stages:
 *
 *   - No arrival dynamics beyond accepted facility expansion, no dues wiring,
 *     no `reputationFromMembers` wiring, no `memberSatisfaction` calls.
 *   - No offline-fabricated service visits, stay changes, or departures —
 *     observations arrive only from real `floorSim.ts` steps while the sim
 *     is running.
 *   - No Athlete season calendar, no returning members, and no Career/Meet →
 *     `EmpireState.reputation` path.
 */

import { refuseWith } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { ambientMemberRoster } from './floor';
import type { FloorSimPopulationEntry, FloorSimServiceObservation } from './floorSim';
import type { LadderEquipmentItem, LadderRung } from './ladder';
import {
  createLivingMemberDepartureRecord,
  livingMemberShouldDepart,
  type LivingMemberDepartureRecord,
} from './livingMemberDeparture';
import { livingMemberExperience } from './livingMemberExperience';
import { livingMemberRetentionPressure } from './livingMemberRetention';
import {
  advanceLivingMemberStay,
  createLivingMemberStayState,
  livingMemberStayEvidence,
  type LivingMemberStayState,
} from './livingMemberStay';
import { equipmentBiasedMemberTypes, type MemberType } from './members';
import type { SessionEquipmentItem } from './sessions';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Stable identity for one living floor member. Derived, never random. */
export type GymMemberId = string & { readonly __brand: 'GymMemberId' };

/** One completed or interrupted station use, recorded from floor-sim truth. */
export interface ServiceVisitRecord {
  readonly stationKind: FloorSimServiceObservation['stationKind'];
  readonly stationKey: string;
  /** True queue wait: arrival at the queue cell → use start, in sim ticks. */
  readonly queueWaitTicks: number;
  readonly trainingExperience: number;
  readonly outcome: 'completed' | 'interrupted';
  readonly observedAtTick: number;
}

/** One persistent member the player can recognise across sim resets. */
export interface LivingGymMember {
  readonly id: GymMemberId;
  /** Presentation identity only. Assigned once at creation and stored. */
  readonly displayName: string;
  /** Frozen for this member's lifetime during G.1 — equipment purchases do not retag. */
  readonly type: MemberType;
  /** Gym clock seconds when this member joined the floor roster. */
  readonly joinedAtSeconds: number;
  readonly recentVisits: readonly ServiceVisitRecord[];
  /** G.2C1 response state. It is not a probability and does not itself remove this row. */
  readonly stayState: LivingMemberStayState;
}

/** The authoritative living roster carried in `GymViewState`. */
export interface LivingMemberRoster {
  readonly rung: LadderRung;
  readonly identityNonce: number;
  /** Next unused creation ordinal. Never decreases, including after a departure. */
  readonly nextOrdinal: number;
  readonly members: readonly LivingGymMember[];
  /** Archive of departed members. Not active roster rows. */
  readonly departures: readonly LivingMemberDepartureRecord[];
}

/** History limits compared in tests; the shipped limit is the middle entry. */
export const SERVICE_HISTORY_WINDOWS = EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOWS;
export const SHIPPED_SERVICE_HISTORY_WINDOW = EMPIRE_TUNING.LIVING_MEMBER_SERVICE_HISTORY_WINDOW;
export const SERVICE_WAIT_SHORT_MAX_TICKS = EMPIRE_TUNING.LIVING_MEMBER_WAIT_SHORT_MAX_TICKS;
export const SERVICE_WAIT_LONG_MIN_TICKS = EMPIRE_TUNING.LIVING_MEMBER_WAIT_LONG_MIN_TICKS;
export const SERVICE_WAIT_VERY_LONG_MIN_TICKS =
  EMPIRE_TUNING.LIVING_MEMBER_WAIT_VERY_LONG_MIN_TICKS;

/**
 * Curated given-name pool. Generic first names only — no surnames, no real
 * athletes, no federation references. Sized above warehouse (40) for
 * headroom. Assignment indexes by creation ordinal and stores the chosen
 * string on the member so a later pool reorder cannot rename anyone.
 */
export const LIVING_MEMBER_GIVEN_NAMES: readonly string[] = Object.freeze([
  'Nia',
  'Omar',
  'Wren',
  'Lila',
  'Theo',
  'Mara',
  'Enzo',
  'Priya',
  'Cole',
  'Anya',
  'Reid',
  'Suki',
  'Hugo',
  'Elke',
  'Jonas',
  'Rina',
  'Miles',
  'Yara',
  'Felix',
  'Noor',
  'Arlo',
  'Tessa',
  'Ivo',
  'Hana',
  'Quinn',
  'Dara',
  'Leif',
  'Mira',
  'Skye',
  'Olin',
  'Vera',
  'Joss',
  'Kian',
  'Petra',
  'Rowan',
  'Tove',
  'Ellis',
  'Zora',
  'Hale',
  'Ines',
  'Kai',
  'Bec',
  'Cora',
  'Drew',
  'Farah',
  'Galen',
  'Pia',
  'Remy',
  'Soren',
  'Uma',
  'Yves',
  'Blair',
  'Dove',
  'Fern',
  'Gray',
  'Kade',
  'Nils',
  'Orla',
  'Paz',
  'Rafi',
  'Shae',
  'Toni',
  'Veda',
  'Wynn',
]);

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Deterministic gym-local id from the roster nonce and a monotonic ordinal.
 * Does NOT encode the current facility rung — relocation must not change it.
 */
export function deriveMemberId(identityNonce: number, ordinal: number): GymMemberId {
  if (!Number.isInteger(ordinal) || ordinal < 0) {
    refuseWith(`member ordinal must be a non-negative whole number, received ${ordinal}`);
  }
  if (!Number.isInteger(identityNonce) || identityNonce < 0) {
    refuseWith(
      `living-member identity nonce must be a non-negative whole number, received ${identityNonce}`,
    );
  }
  return `member:n${identityNonce}:${ordinal}` as GymMemberId;
}

/** The ordinal encoded in a shipped member id, for display and reconciliation. */
export function memberOrdinalFromId(id: GymMemberId): number {
  const parts = id.split(':');
  const ordinal = Number(parts[2]);
  if (!Number.isInteger(ordinal) || ordinal < 0) {
    refuseWith(`member id ${id} does not encode a valid ordinal`);
  }
  return ordinal;
}

function ambientCountForRung(rung: LadderRung): number {
  const count = EMPIRE_TUNING.AMBIENT_MEMBER_COUNT_BY_RUNG[rung];
  if (count === undefined) refuseWith(`${String(rung)} has no registered ambient member count`);
  return count;
}

function memberTypeForIndex(
  sessionOwned: readonly SessionEquipmentItem[],
  index: number,
): MemberType {
  const biased = equipmentBiasedMemberTypes(sessionOwned);
  return biased[index % biased.length] as MemberType;
}

/**
 * Stored presentation name for a newly created member. Indexed by ordinal so
 * a warehouse-sized roster is unique; identityNonce is validated with the id
 * so a bad nonce cannot mint a name. The chosen string is copied onto the
 * member — later pool edits do not rename existing people.
 */
export function displayNameForCreation(identityNonce: number, ordinal: number): string {
  deriveMemberId(identityNonce, ordinal);
  const name = LIVING_MEMBER_GIVEN_NAMES[ordinal];
  if (name === undefined) {
    refuseWith(
      `living-member given-name pool (${LIVING_MEMBER_GIVEN_NAMES.length}) has no name for ordinal ${ordinal}`,
    );
  }
  return name;
}

function createLivingMember(
  identityNonce: number,
  ordinal: number,
  type: MemberType,
  joinedAtSeconds: number,
): LivingGymMember {
  return Object.freeze({
    id: deriveMemberId(identityNonce, ordinal),
    displayName: displayNameForCreation(identityNonce, ordinal),
    type,
    joinedAtSeconds,
    recentVisits: Object.freeze([]),
    stayState: createLivingMemberStayState(),
  });
}

/** Opening roster: one living member per ambient placement, empty history. */
export function createLivingMemberRoster(
  rung: LadderRung,
  barbellOwned: readonly LadderEquipmentItem[],
  sessionOwned: readonly SessionEquipmentItem[],
  joinedAtSeconds: number,
  identityNonce: number,
): LivingMemberRoster {
  if (!Number.isFinite(joinedAtSeconds) || joinedAtSeconds < 0) {
    refuseWith(`joinedAtSeconds must be a non-negative number, received ${joinedAtSeconds}`);
  }
  const placements = ambientMemberRoster(rung, barbellOwned, sessionOwned);
  const members = Object.freeze(
    placements.map((row, index) =>
      createLivingMember(identityNonce, index, row.type, joinedAtSeconds),
    ),
  );
  return Object.freeze({
    rung,
    identityNonce,
    nextOrdinal: members.length,
    members,
    departures: Object.freeze([]),
  });
}

/**
 * Facility relocation: preserve every existing member exactly; append only when
 * the destination ambient count is larger. Refuses when the destination would
 * require fewer members than already live on the floor. New identities mint
 * from `nextOrdinal`, never from active length, so a departed ordinal cannot
 * be reused.
 */
export function reconcileLivingMemberRosterOnRelocation(
  roster: LivingMemberRoster,
  newRung: LadderRung,
  sessionOwned: readonly SessionEquipmentItem[],
  relocationMarkSeconds: number,
): LivingMemberRoster {
  if (!Number.isFinite(relocationMarkSeconds) || relocationMarkSeconds < 0) {
    refuseWith(
      `relocation mark seconds must be a non-negative number, received ${relocationMarkSeconds}`,
    );
  }
  const targetCount = ambientCountForRung(newRung);
  const existing = roster.members;
  if (targetCount < existing.length) {
    refuseWith(
      `relocation to ${String(newRung)} allows ${targetCount} members but roster already has ${existing.length}`,
    );
  }
  if (targetCount === existing.length) {
    return Object.freeze({ ...roster, rung: newRung });
  }
  const startOrdinal = roster.nextOrdinal;
  const appended = Object.freeze(
    Array.from({ length: targetCount - existing.length }, (_unused, offset) => {
      const ordinal = startOrdinal + offset;
      const typeIndex = existing.length + offset;
      return createLivingMember(
        roster.identityNonce,
        ordinal,
        memberTypeForIndex(sessionOwned, typeIndex),
        relocationMarkSeconds,
      );
    }),
  );
  return Object.freeze({
    rung: newRung,
    identityNonce: roster.identityNonce,
    nextOrdinal: startOrdinal + appended.length,
    members: Object.freeze([...existing, ...appended]),
    departures: roster.departures,
  });
}

/** Authoritative population facts for `createFloorSimState` on the played path. */
export function floorSimPopulationFromRoster(
  roster: LivingMemberRoster,
): readonly FloorSimPopulationEntry[] {
  return Object.freeze(
    roster.members.map((member) =>
      Object.freeze({
        memberId: member.id,
        type: member.type,
      }),
    ),
  );
}

/** Resolve a sim member index to its persistent id. */
export function memberIdForIndex(roster: LivingMemberRoster, index: number): GymMemberId | null {
  const row = roster.members[index];
  return row === undefined ? null : row.id;
}

/** Read one living member by sim index. */
export function livingMemberAtIndex(
  roster: LivingMemberRoster,
  index: number,
): LivingGymMember | null {
  const row = roster.members[index];
  return row === undefined ? null : row;
}

/** Read one living member by stable id. */
export function livingMemberById(
  roster: LivingMemberRoster,
  id: GymMemberId,
): LivingGymMember | null {
  const found = roster.members.find((member) => member.id === id);
  return found ?? null;
}

/** Read a departed snapshot by stable id. */
export function departedMemberById(
  roster: LivingMemberRoster,
  id: GymMemberId,
): LivingMemberDepartureRecord | null {
  const found = roster.departures.find((record) => record.member.id === id);
  return found ?? null;
}

// ---------------------------------------------------------------------------
// Service outcomes
// ---------------------------------------------------------------------------

function visitFromObservation(observation: FloorSimServiceObservation): ServiceVisitRecord {
  return Object.freeze({
    stationKind: observation.stationKind,
    stationKey: observation.stationKey,
    queueWaitTicks: observation.queueWaitTicks,
    trainingExperience: observation.trainingExperience,
    outcome: observation.outcome,
    observedAtTick: observation.observedAtTick,
  });
}

function sameServiceVisit(a: ServiceVisitRecord, b: ServiceVisitRecord): boolean {
  return (
    a.stationKind === b.stationKind &&
    a.stationKey === b.stationKey &&
    a.queueWaitTicks === b.queueWaitTicks &&
    a.trainingExperience === b.trainingExperience &&
    a.outcome === b.outcome &&
    a.observedAtTick === b.observedAtTick
  );
}

function truncateHistory(
  visits: readonly ServiceVisitRecord[],
  limit: number,
): readonly ServiceVisitRecord[] {
  if (visits.length <= limit) return visits;
  return Object.freeze(visits.slice(visits.length - limit));
}

function latestVisitOf(member: LivingGymMember): ServiceVisitRecord | undefined {
  return member.recentVisits[member.recentVisits.length - 1];
}

/**
 * Fold real floor-sim observations into history, G.2C1 stay response, and
 * G.2C2 departure execution. Offline clock does not call this. G.2A/G.2B are
 * consumed whole rather than reimplemented: new history → accepted experience
 * → accepted pressure → type-specific persistent response → possible leave.
 *
 * Exact replay of the latest service event is a whole-roster no-op, including
 * after the observation that executed a departure. If the same member/tick
 * arrives with different service facts, refuse instead of choosing which
 * history is true. A later observation for a departed member fails closed.
 * Same-tick tombstone replay also requires `observation.memberType` to match
 * the archived member snapshot; type is not stored on G.2A visit history.
 *
 * G.2C1 stay still consumes G.2B of the N=5 window. G.2C2 departure
 * confirmation consumes the same frozen type classifier on G.2B of the newly
 * accepted visit alone, so leftover window strain cannot turn a Stable visit
 * into a leave and the G.2C1 recovery path from eligibility stays live.
 */
export function applyServiceObservations(
  roster: LivingMemberRoster,
  observations: readonly FloorSimServiceObservation[],
  historyLimit: number = SHIPPED_SERVICE_HISTORY_WINDOW,
): LivingMemberRoster {
  if (!SERVICE_HISTORY_WINDOWS.includes(historyLimit as (typeof SERVICE_HISTORY_WINDOWS)[number])) {
    refuseWith(
      `service history limit must be one of ${SERVICE_HISTORY_WINDOWS.join(', ')}, received ${historyLimit}`,
    );
  }
  if (observations.length === 0) return roster;
  const byId = new Map<GymMemberId, LivingGymMember>();
  for (const member of roster.members) {
    byId.set(member.id, member);
  }
  const departedById = new Map<GymMemberId, LivingMemberDepartureRecord>();
  for (const record of roster.departures) {
    departedById.set(record.member.id, record);
  }
  const nextDepartures: LivingMemberDepartureRecord[] = [];
  for (const record of roster.departures) {
    nextDepartures.push(record);
  }
  let changed = false;
  for (const observation of observations) {
    const id = observation.memberId as GymMemberId;
    const incomingVisit = visitFromObservation(observation);
    const tombstone = departedById.get(id);
    if (tombstone !== undefined) {
      const departedVisit = latestVisitOf(tombstone.member);
      if (departedVisit?.observedAtTick === incomingVisit.observedAtTick) {
        if (observation.memberType !== tombstone.member.type) {
          refuseWith(
            `service observation type ${observation.memberType} does not match departed member ${id} type ${tombstone.member.type}`,
          );
        }
        if (!sameServiceVisit(departedVisit, incomingVisit)) {
          refuseWith(
            `service observation conflicts with departed member ${id} at tick ${incomingVisit.observedAtTick}`,
          );
        }
        continue;
      }
      refuseWith(`service observation names departed member ${id}`);
    }
    const current = byId.get(id);
    if (current === undefined) {
      refuseWith(`service observation names unknown member ${observation.memberId}`);
    }
    if (observation.memberType !== current.type) {
      refuseWith(
        `service observation type ${observation.memberType} does not match member ${current.id} type ${current.type}`,
      );
    }
    const latestVisit = latestVisitOf(current);
    if (latestVisit?.observedAtTick === incomingVisit.observedAtTick) {
      if (!sameServiceVisit(latestVisit, incomingVisit)) {
        refuseWith(`service observation conflicts with member ${current.id} at tick ${incomingVisit.observedAtTick}`);
      }
      continue;
    }
    const nextVisits = truncateHistory(
      Object.freeze([...current.recentVisits, incomingVisit]),
      historyLimit,
    );
    const visitExperience = livingMemberExperience(Object.freeze([incomingVisit]));
    const visitRetention = livingMemberRetentionPressure(visitExperience);
    const departureEvidence = livingMemberStayEvidence(current.type, visitRetention);
    const experience = livingMemberExperience(nextVisits);
    const retention = livingMemberRetentionPressure(experience);
    const stayState = advanceLivingMemberStay(
      current.stayState,
      current.type,
      retention,
      observation.observedAtTick,
    );
    const nextMember = Object.freeze({
      ...current,
      recentVisits: nextVisits,
      stayState,
    });
    if (livingMemberShouldDepart(current.stayState.status, departureEvidence)) {
      const record = createLivingMemberDepartureRecord(
        nextMember,
        observation.observedAtTick,
        visitRetention,
      );
      byId.delete(id);
      departedById.set(id, record);
      nextDepartures.push(record);
      changed = true;
      continue;
    }
    byId.set(id, nextMember);
    changed = true;
  }
  if (!changed) return roster;
  const nextMembers: LivingGymMember[] = [];
  for (const member of roster.members) {
    const updated = byId.get(member.id);
    if (updated !== undefined) nextMembers.push(updated);
  }
  return Object.freeze({
    ...roster,
    members: Object.freeze(nextMembers),
    departures: Object.freeze(nextDepartures),
  });
}

/**
 * Clock advance only moves tenure forward. It never fabricates visits, stay
 * response, or departures — the gym may have been away; service truth stays
 * in the sim.
 */
export function advanceLivingMemberTenure(
  roster: LivingMemberRoster,
  _gapSeconds: number,
): LivingMemberRoster {
  return roster;
}

// ---------------------------------------------------------------------------
// Player-facing copy
// ---------------------------------------------------------------------------

/** Short stable label derived from the id ordinal, not the sim index. */
export function playerFacingMemberShortId(id: GymMemberId): string {
  return `member ${memberOrdinalFromId(id)}`;
}

/** Plain-language tenure from gym-clock seconds. */
export function playerFacingTenureLine(joinedAtSeconds: number, nowSeconds: number): string {
  const elapsed = Math.max(0, nowSeconds - joinedAtSeconds);
  const days = Math.floor(elapsed / EMPIRE_TUNING.SECONDS_PER_DAY);
  if (days <= 0) return 'new this week';
  if (days === 1) return '1 day as a member';
  return `${days} days as a member`;
}

/**
 * Player-facing wait copy keyed only on true queue wait. No upgrade name,
 * no Q/C/T ownership, no fake baseline. G.1C adds the upper band so a
 * measured 95-vs-128 tick improvement is not both "long wait".
 */
export function playerFacingWaitExperience(queueWaitTicks: number): string {
  if (!Number.isFinite(queueWaitTicks) || queueWaitTicks < 0) {
    refuseWith(`queue wait ticks must be a non-negative number, received ${queueWaitTicks}`);
  }
  if (queueWaitTicks === 0) return 'no wait';
  if (queueWaitTicks <= SERVICE_WAIT_SHORT_MAX_TICKS) return 'short wait';
  if (queueWaitTicks < SERVICE_WAIT_LONG_MIN_TICKS) return 'waited a while';
  if (queueWaitTicks < SERVICE_WAIT_VERY_LONG_MIN_TICKS) return 'long wait';
  return 'very long wait';
}

export function playerFacingTrainingExperience(trainingExperience: number): string {
  if (trainingExperience >= EMPIRE_TUNING.STATION_QUALITY_TRAINING_EXPERIENCE) {
    return 'solid workout';
  }
  return 'light session';
}

export function playerFacingServiceVisitLine(visit: ServiceVisitRecord): string {
  const wait = playerFacingWaitExperience(visit.queueWaitTicks);
  const training = playerFacingTrainingExperience(visit.trainingExperience);
  if (visit.outcome === 'interrupted') {
    return `${wait}, ${training}, interrupted`;
  }
  return `${wait}, ${training}, finished`;
}
