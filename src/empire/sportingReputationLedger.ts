/**
 * sportingReputationLedger.ts — CAREER-EMPIRE-REP-01 write side.
 *
 * Stage E already owns the per-result calculator. This module is the
 * sporting ledger that stores those event deltas on the played gym tree.
 * It does not write `EmpireState.reputation`, does not retune E-REP-01,
 * and does not import Career, Meet, React, or `src/game`.
 *
 * `totalKg` on the played-facts input is read only as null versus
 * non-null. Kilograms never enter the points. `isTotalPr` is the
 * server's boolean, adopted unchanged.
 */

import { refuseWith, type ReputationPoints } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { scrubPrecision } from './production';
import {
  sportingReputationFromResult,
  type SportingMeetKind,
  type SportingMeetResult,
  type SportingQualifyRung,
  type SportingReputationReason,
} from './sportingReputation';

const SPORTING = EMPIRE_TUNING.SPORTING_REPUTATION;

/** The server-confirmed shape the crossing reads. Structurally satisfied by `RecordedMeet`; nothing here imports it. */
export interface PlayedMeetFacts {
  readonly totalKg: number | null;
  readonly isTotalPr: boolean;
  readonly placing: { readonly place: number | null; readonly fieldSize: number };
}

export interface SportingReputationEntry {
  readonly meetId: string;
  readonly atSeconds: number;
  readonly points: ReputationPoints;
  readonly reasons: readonly SportingReputationReason[];
}

export interface SportingReputationLedger {
  readonly creditedReputation: number;
  readonly entries: readonly SportingReputationEntry[];
}

export type SportingCreditReport =
  | {
      readonly kind: 'credited';
      readonly meetId: string;
      readonly points: ReputationPoints;
      readonly reasons: readonly SportingReputationReason[];
    }
  | {
      readonly kind: 'not-creditable';
      readonly meetId: string;
      readonly reason: 'unknown-meet';
    };

export function createSportingReputationLedger(): SportingReputationLedger {
  return Object.freeze({
    creditedReputation: 0,
    entries: Object.freeze([]),
  });
}

export function lastSportingReputationEntry(
  ledger: SportingReputationLedger,
): SportingReputationEntry | null {
  const record = ledger.entries[ledger.entries.length - 1];
  return record ?? null;
}

function playedMeetKind(meetId: string): SportingMeetKind | undefined {
  const map = SPORTING.playedMeetKindById;
  for (const id of Object.keys(map)) {
    if (id === meetId) {
      return map[id as keyof typeof map];
    }
  }
  return undefined;
}

function requirePlayedFacts(facts: PlayedMeetFacts): void {
  const fieldSize = facts.placing.fieldSize;
  const place = facts.placing.place;
  if (facts.totalKg === null) {
    if (place !== null) {
      refuseWith('a bomb-out cannot place');
    }
    return;
  }
  if (
    !Number.isFinite(fieldSize) ||
    !Number.isInteger(fieldSize) ||
    fieldSize < 1
  ) {
    refuseWith(`fieldSize must be a positive whole number, received ${fieldSize}`);
  }
  if (place === null) {
    refuseWith('a posted total carries a category placement');
  }
  if (!Number.isInteger(place) || place < 1 || place > fieldSize) {
    refuseWith(`place must be a whole number from 1 to fieldSize, received ${place}`);
  }
}

/**
 * Maps played-meet facts onto Stage E's input. `totalKg` is consulted only
 * for nullness. Kilograms are not an operand.
 */
export function sportingMeetResultFromPlayedFacts(
  facts: PlayedMeetFacts,
  kind: SportingMeetKind,
  newlyQualifiedFor: SportingQualifyRung | null,
): SportingMeetResult {
  requirePlayedFacts(facts);
  if (facts.totalKg === null) {
    return Object.freeze({ kind, outcome: 'bombed-out' as const });
  }
  const place = facts.placing.place;
  if (place === null) {
    refuseWith('a posted total carries a category placement');
  }
  return Object.freeze({
    kind,
    outcome: 'total' as const,
    placement: Object.freeze({
      place,
      categoryFieldSize: facts.placing.fieldSize,
    }),
    isTotalPr: facts.isTotalPr,
    newlyQualifiedFor,
  });
}

export function creditSportingResult(
  ledger: SportingReputationLedger,
  meetId: string,
  facts: PlayedMeetFacts,
  atSeconds: number,
  newlyQualifiedFor: SportingQualifyRung | null,
): { readonly ledger: SportingReputationLedger; readonly report: SportingCreditReport | null } {
  for (const entry of ledger.entries) {
    if (entry.meetId === meetId) {
      return { ledger, report: null };
    }
  }
  const kind = playedMeetKind(meetId);
  if (kind === undefined) {
    return {
      ledger,
      report: Object.freeze({
        kind: 'not-creditable',
        meetId,
        reason: 'unknown-meet',
      }),
    };
  }
  if (!Number.isFinite(atSeconds) || atSeconds < 0) {
    refuseWith(`sporting atSeconds must be a non-negative number, received ${atSeconds}`);
  }
  const last = lastSportingReputationEntry(ledger);
  if (last !== null && atSeconds < last.atSeconds) {
    refuseWith(`sporting stamp ${atSeconds} is earlier than last entry ${last.atSeconds}`);
  }
  const result = sportingMeetResultFromPlayedFacts(facts, kind, newlyQualifiedFor);
  const contribution = sportingReputationFromResult(result);
  const entry = Object.freeze({
    meetId,
    atSeconds,
    points: contribution.points,
    reasons: contribution.reasons,
  });
  const next = Object.freeze({
    creditedReputation: scrubPrecision(ledger.creditedReputation + contribution.points),
    entries: Object.freeze([...ledger.entries, entry]),
  });
  return {
    ledger: next,
    report: Object.freeze({
      kind: 'credited',
      meetId,
      points: contribution.points,
      reasons: contribution.reasons,
    }),
  };
}
