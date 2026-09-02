/**
 * sportingReputation.ts — Stage E reputation feed foundation.
 *
 * GDD: Career-side of the reputation feed, built as a pure function first;
 * the Career/Meet → Empire persistent write stays a later, explicitly
 * authorised crossing. This module is the Empire-owned calculator and the
 * input contract that crossing will have to fill. It does not import
 * Career, Meet, React, or `src/game`. It does not mutate gym state.
 *
 * Reputation here is sporting credibility, not a second currency bar and
 * not participation XP. A bomb-out, an opened app, a completed nine
 * attempts, or a maintained streak are not, by themselves, a contribution.
 *
 * ===========================================================================
 * 1. Two contributors, two grains
 * ===========================================================================
 *
 * `reputationFromMembers` is the member/institution half: a per-day rate
 * from a roster. This file is the sporting half: a per-result contribution
 * from a competition outcome. `composeGymReputationContributions` adds two
 * already-computed `ReputationPoints` values when a caller has chosen an
 * accounting grain. It does not convert a meet into a daily rate.
 *
 * `reputationFromMembers`'s optional `competitionResultReputationBonus` is
 * left unused on purpose. That argument adds a bonus into a per-day member
 * rate. A meet result is not a day of dues. Folding one into the other
 * would mix grains inside the member function. Stage E reports that
 * mismatch rather than widening the argument.
 *
 * ===========================================================================
 * 2. Input contract (neutral result shape)
 * ===========================================================================
 *
 * Accepted, because the current meet/Career model can supply them as facts:
 *
 *   - `kind` — GDD §6.1 ladder words, owned here, not imported from Career
 *   - `totalKg` / `place` / `fieldSize` — posted total and placing; both
 *     null together on a bomb-out
 *   - `isTotalPr` — this meet raised the published best total
 *   - `newlyQualifiedFor` — rungs the crossing already decided were newly
 *     earned; Empire does not re-derive Career qualifying-total tables
 *
 * Refused or deferred, because they would fabricate prestige or give an
 * existing quantity a second meaning:
 *
 *   - entering a meet, completing nine attempts, opening the app, streak
 *   - Total kilograms as a scalar into reputation (Total already means Total)
 *   - DOTS, e1RM, per-lift PRs as extra gym credit
 *   - fictional opponent prestige, federation rank, hidden performance score
 *   - Gym Bucks, Training IQ, member satisfaction (those stay other axes)
 *
 * A later member-outcome contribution composes beside this function the
 * same way `fromMembers` already does. Persistent roster history is Stage G
 * and is not started here.
 *
 * ===========================================================================
 * 3. Why the number moved
 * ===========================================================================
 *
 * Each non-zero term carries a `kind` and a `text` line so a later screen
 * can say "placed 1 of 16 at a local meet" rather than toasting +12 REP
 * with no cause. Wiring that screen is not this piece.
 */

import { asReputation, refuseWith, type ReputationPoints } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { scrubPrecision } from './production';

const SPORTING = EMPIRE_TUNING.SPORTING_REPUTATION;

export type SportingMeetKind = (typeof SPORTING.meetKinds)[number];
export type SportingQualifyRung = (typeof SPORTING.qualifyRungs)[number];

export type SportingReputationReasonKind =
  | 'no-total'
  | 'placing'
  | 'total-pr'
  | 'qualify';

export interface SportingMeetResult {
  readonly kind: SportingMeetKind;
  readonly totalKg: number | null;
  readonly place: number | null;
  readonly fieldSize: number;
  readonly isTotalPr: boolean;
  readonly newlyQualifiedFor: readonly SportingQualifyRung[];
}

export interface SportingReputationReason {
  readonly kind: SportingReputationReasonKind;
  readonly text: string;
  readonly points: ReputationPoints;
}

export interface SportingReputationContribution {
  readonly points: ReputationPoints;
  readonly reasons: readonly SportingReputationReason[];
}

export interface ComposedGymReputationContribution {
  readonly points: ReputationPoints;
  readonly sporting: ReputationPoints;
  readonly fromMembers: ReputationPoints;
}

function isSportingMeetKind(value: string): value is SportingMeetKind {
  for (const kind of SPORTING.meetKinds) {
    if (kind === value) return true;
  }
  return false;
}

function isSportingQualifyRung(value: string): value is SportingQualifyRung {
  for (const rung of SPORTING.qualifyRungs) {
    if (rung === value) return true;
  }
  return false;
}

function applySlots(template: string, slots: Readonly<Record<string, string>>): string {
  const openBrace = 0x7b;
  const closeBrace = 0x7d;
  let out = String.fromCharCode();
  let key = String.fromCharCode();
  let capturing = false;
  for (const ch of template + String.fromCharCode()) {
    const code = ch.charCodeAt(0);
    if (!capturing && code === openBrace) {
      capturing = true;
      key = String.fromCharCode();
      continue;
    }
    if (capturing && code === closeBrace) {
      const value = slots[key];
      if (value !== undefined) {
        out += value;
      } else {
        out += String.fromCharCode(openBrace) + key + String.fromCharCode(closeBrace);
      }
      capturing = false;
      continue;
    }
    if (capturing) {
      key += ch;
      continue;
    }
    out += ch;
  }
  if (capturing) out += String.fromCharCode(openBrace) + key;
  return out;
}

function requireSportingMeetResult(result: SportingMeetResult): SportingMeetResult {
  if (!isSportingMeetKind(result.kind)) {
    refuseWith(`${String(result.kind)} is not a sporting meet kind`);
  }
  const bombed = result.totalKg === null;
  if (bombed !== (result.place === null)) {
    refuseWith('a posted total and a placing arrive together, or neither does');
  }
  if (
    !Number.isFinite(result.fieldSize) ||
    !Number.isInteger(result.fieldSize) ||
    result.fieldSize < 1
  ) {
    refuseWith(`fieldSize must be a positive whole number, received ${result.fieldSize}`);
  }
  if (!bombed) {
    const totalKg = result.totalKg;
    const place = result.place;
    if (totalKg === null || place === null) {
      refuseWith('a posted total and a placing arrive together, or neither does');
    }
    if (!Number.isFinite(totalKg) || totalKg < 0) {
      refuseWith(`totalKg must be finite and at or above zero, received ${totalKg}`);
    }
    if (!Number.isInteger(place) || place < 1 || place > result.fieldSize) {
      refuseWith(`place must be a whole number from 1 to fieldSize, received ${place}`);
    }
  }
  if (bombed && result.isTotalPr) {
    refuseWith('a bomb-out cannot raise a published best total');
  }
  if (bombed && result.newlyQualifiedFor.length > 0) {
    refuseWith('a bomb-out cannot newly qualify for a higher rung');
  }
  const seen = new Set<string>();
  for (const rung of result.newlyQualifiedFor) {
    if (!isSportingQualifyRung(rung)) {
      refuseWith(`${String(rung)} is not a sporting qualify rung`);
    }
    if (seen.has(rung)) refuseWith(`${rung} appears twice in newlyQualifiedFor`);
    seen.add(rung);
  }
  return result;
}

function reason(
  kind: SportingReputationReasonKind,
  text: string,
  points: number,
): SportingReputationReason {
  return Object.freeze({
    kind,
    text,
    points: asReputation(scrubPrecision(points)),
  });
}

/**
 * Per-result Empire reputation from a competition outcome.
 *
 * Deterministic. No clock, no network, no React. Points are the sum of the
 * reason rows; a bomb-out returns one `no-total` row at zero.
 */
export function sportingReputationFromResult(
  result: SportingMeetResult,
): SportingReputationContribution {
  requireSportingMeetResult(result);
  const scale = SPORTING.kindScale[result.kind];
  const reasons: SportingReputationReason[] = [];

  if (result.totalKg === null || result.place === null) {
    reasons.push(reason('no-total', SPORTING.copy.noTotal, 0));
  } else {
    const placingShare = (result.fieldSize - result.place + 1) / result.fieldSize;
    const placingPoints = scale * SPORTING.placingUnit * placingShare;
    reasons.push(
      reason(
        'placing',
        applySlots(SPORTING.copy.placing, {
          place: String(result.place),
          field: String(result.fieldSize),
          kind: result.kind,
        }),
        placingPoints,
      ),
    );
    if (result.isTotalPr) {
      reasons.push(
        reason(
          'total-pr',
          applySlots(SPORTING.copy.totalPr, { kind: result.kind }),
          scale * SPORTING.totalPrUnit,
        ),
      );
    }
  }

  for (const rung of result.newlyQualifiedFor) {
    reasons.push(
      reason(
        'qualify',
        applySlots(SPORTING.copy.qualified, { rung }),
        SPORTING.kindScale[rung] * SPORTING.qualifyUnit,
      ),
    );
  }

  let total = 0;
  for (const row of reasons) total += row.points;
  return Object.freeze({
    points: asReputation(scrubPrecision(total)),
    reasons: Object.freeze(reasons),
  });
}

/**
 * Named sum of the sporting per-result contribution and the members per-day
 * contribution. The caller supplies both already computed; this does not
 * read a roster or a meet.
 */
export function composeGymReputationContributions(input: {
  readonly sporting: ReputationPoints;
  readonly fromMembers: ReputationPoints;
}): ComposedGymReputationContribution {
  return Object.freeze({
    sporting: input.sporting,
    fromMembers: input.fromMembers,
    points: asReputation(scrubPrecision(input.sporting + input.fromMembers)),
  });
}
