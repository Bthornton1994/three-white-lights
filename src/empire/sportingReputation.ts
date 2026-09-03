/**
 * sportingReputation.ts — Stage E.2 sporting reputation contract.
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
 * 1. Two contributors, two grains — not added here
 * ===========================================================================
 *
 * `reputationFromMembers` is the member/institution half: a per-day rate
 * from a roster. This file is the sporting half: a per-result event delta.
 * Those grains are not interchangeable. Stage E.2 does not ship a composer
 * that adds them. A later persistence/accounting boundary may add an
 * integrated member delta over a defined period to a sporting event delta
 * once both operands share a grain. That boundary does not exist yet.
 *
 * ===========================================================================
 * 2. Input contract — facts the later crossing will compose
 * ===========================================================================
 *
 * The facts are distributed today. No single current Meet/Career object
 * already carries outcome, category placing, published-total PR, and
 * standing unlock together. The crossing will fill this shape from:
 *
 *   - game/meet: posted a total vs bombed out
 *   - career/flight: place within an award category (`categoryId`), not a
 *     logistical flight
 *   - career/careerRecord: `tierUnlockBetween` yields one `to` tier or none
 *   - the appropriate result/record comparison: whether this meet raised
 *     the published best total
 *
 * Accepted here:
 *
 *   - `kind` — GDD §6.1 ladder words, owned here, not imported from Career
 *   - `outcome` — `'total'` or `'bombed-out'`; no numerical Total
 *   - `placement` — place and `categoryFieldSize` on a posted total; absent
 *     on a bomb-out. `categoryFieldSize` is the number of competitors in
 *     the SAME award category the place is in. It is not flight size,
 *     session size, bar-sharing count, or overall meet attendance.
 *   - `isTotalPr` — this meet raised the published best total
 *   - `newlyQualifiedFor` — the single new standing actually achieved, or
 *     null. Runtime value is `null` or a string that is already a qualify
 *     rung — not an array, object, number, or boolean that stringifies into
 *     one. The rung must strictly outrank the meet kind (a regional meet
 *     cannot newly qualify for regional). Jumps (local → worlds) are allowed
 *     because one Total may cross several thresholds and Career's
 *     `tierUnlockBetween` reports the resulting top `to` tier. No `local`
 *     qualification. A worlds result cannot newly qualify.
 *
 * Refused or deferred:
 *
 *   - entering a meet, completing nine attempts, opening the app, streak
 *   - Total kilograms (or any unit) as a reputation scalar
 *   - DOTS, e1RM, per-lift PRs as extra gym credit
 *   - fictional opponent prestige, federation rank, hidden performance score
 *   - Gym Bucks, Training IQ, member satisfaction (those stay other axes)
 *
 * Persistent roster history is Stage G and is not started here.
 *
 * ===========================================================================
 * 3. E-REP-01 — check-in reputation semantic debt
 * ===========================================================================
 *
 * The consumed reputation model still awards `REPUTATION_PER_CHECK_IN`
 * (2) per check-in. That is inherited activity reputation. It has not been
 * reconciled with the doctrine that reputation is institutional sporting
 * credibility. Stage E.2 does not retune that constant and does not close
 * the debt. World-level sporting credit is not held below a year of
 * check-ins (730) merely to protect that inherited source.
 *
 * ===========================================================================
 * 4. Why the number moved
 * ===========================================================================
 *
 * Each non-zero term carries a `kind` and a `text` line so a later screen
 * can say why reputation changed rather than toasting a bare +REP.
 * Wiring that screen is not this piece.
 */

import { asReputation, refuseWith, type ReputationPoints } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { scrubPrecision } from './production';

const SPORTING = EMPIRE_TUNING.SPORTING_REPUTATION;

export type SportingMeetKind = (typeof SPORTING.meetKinds)[number];
export type SportingQualifyRung = (typeof SPORTING.qualifyRungs)[number];
export type SportingOutcome = 'total' | 'bombed-out';

export type SportingReputationReasonKind =
  | 'no-total'
  | 'placing'
  | 'total-pr'
  | 'qualify';

export interface SportingCategoryPlacement {
  readonly place: number;
  readonly categoryFieldSize: number;
}

export type SportingMeetResult =
  | {
      readonly kind: SportingMeetKind;
      readonly outcome: 'bombed-out';
    }
  | {
      readonly kind: SportingMeetKind;
      readonly outcome: 'total';
      readonly placement: SportingCategoryPlacement;
      readonly isTotalPr: boolean;
      readonly newlyQualifiedFor: SportingQualifyRung | null;
    };

export interface SportingReputationReason {
  readonly kind: SportingReputationReasonKind;
  readonly text: string;
  readonly points: ReputationPoints;
}

export interface SportingReputationContribution {
  readonly points: ReputationPoints;
  readonly reasons: readonly SportingReputationReason[];
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

/**
 * First of N>1 → 1; last of N>1 → 0; one-person category → 0.
 * Beating nobody is not a placing accomplishment.
 */
function categoryPlacingShare(place: number, categoryFieldSize: number): number {
  if (categoryFieldSize <= 1) return 0;
  return (categoryFieldSize - place) / (categoryFieldSize - 1);
}

function requireSportingMeetResult(result: SportingMeetResult): SportingMeetResult {
  if (!isSportingMeetKind(result.kind)) {
    refuseWith(`${String(result.kind)} is not a sporting meet kind`);
  }
  const outcome = (result as { readonly outcome?: unknown }).outcome;
  if (outcome !== 'total' && outcome !== 'bombed-out') {
    refuseWith(`${String(outcome)} is not a sporting outcome`);
  }
  if (outcome === 'bombed-out') {
    const bag = result as Record<string, unknown>;
    if (
      bag.placement !== undefined ||
      bag.isTotalPr !== undefined ||
      bag.newlyQualifiedFor !== undefined
    ) {
      refuseWith('a bomb-out cannot place, raise a published best total, or newly qualify');
    }
    return result;
  }
  const posted = result as Extract<SportingMeetResult, { readonly outcome: 'total' }>;
  const placement = posted.placement;
  if (placement === null || typeof placement !== 'object') {
    refuseWith('a posted total carries a category placement');
  }
  const place = placement.place;
  const categoryFieldSize = placement.categoryFieldSize;
  if (
    !Number.isFinite(categoryFieldSize) ||
    !Number.isInteger(categoryFieldSize) ||
    categoryFieldSize < 1
  ) {
    refuseWith(
      `categoryFieldSize must be a positive whole number, received ${categoryFieldSize}`,
    );
  }
  if (!Number.isInteger(place) || place < 1 || place > categoryFieldSize) {
    refuseWith(`place must be a whole number from 1 to categoryFieldSize, received ${place}`);
  }
  if (typeof posted.isTotalPr !== 'boolean') {
    refuseWith('isTotalPr must be a boolean');
  }
  const rung: unknown = posted.newlyQualifiedFor;
  if (rung !== null) {
    if (typeof rung !== 'string' || !isSportingQualifyRung(rung)) {
      refuseWith('newlyQualifiedFor must be null or a sporting qualify rung');
    }
    let meetRank = -1;
    let rungRank = -1;
    let rank = 0;
    for (const step of SPORTING.meetKinds) {
      if (step === posted.kind) meetRank = rank;
      if (step === rung) rungRank = rank;
      rank += 1;
    }
    if (rungRank <= meetRank) {
      refuseWith(`${rung} is not a new standing above a ${posted.kind} meet`);
    }
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
  const reasons: SportingReputationReason[] = [];

  if (result.outcome === 'bombed-out') {
    reasons.push(reason('no-total', SPORTING.copy.noTotal, 0));
  } else {
    const scale = SPORTING.kindScale[result.kind];
    const share = categoryPlacingShare(
      result.placement.place,
      result.placement.categoryFieldSize,
    );
    const placingPoints = scale * SPORTING.placingUnit * share;
    reasons.push(
      reason(
        'placing',
        applySlots(SPORTING.copy.placing, {
          place: String(result.placement.place),
          field: String(result.placement.categoryFieldSize),
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
    const rung = result.newlyQualifiedFor;
    if (rung !== null) {
      reasons.push(
        reason(
          'qualify',
          applySlots(SPORTING.copy.qualified, { rung }),
          SPORTING.kindScale[rung] * SPORTING.qualifyUnit,
        ),
      );
    }
  }

  let total = 0;
  for (const row of reasons) total += row.points;
  return Object.freeze({
    points: asReputation(scrubPrecision(total)),
    reasons: Object.freeze(reasons),
  });
}
