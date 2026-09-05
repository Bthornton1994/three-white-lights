/**
 * institutionalReputation.ts — CAREER-EMPIRE-REP-01 read side.
 *
 * Composes G.2E member-ledger points with the sporting ledger at the
 * points grain. Computed on read, never stored. A rate is not an
 * argument. The G.2E high-paying arrival gate is not re-pointed here.
 *
 * Prior "Career/Meet → EmpireState.reputation" language names this
 * composed v2 reading. The literal v1 field is not written.
 */

import { asReputation, refuseWith, type ReputationPoints } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import type { LivingMemberReputationLedger } from './livingMemberReputation';
import type { SportingReputationLedger } from './sportingReputationLedger';

export interface InstitutionalReputationReading {
  readonly points: ReputationPoints;
  readonly fromMembers: number;
  readonly fromSporting: number;
  readonly discardedAtCeiling: number;
  readonly asOfSeconds: number;
}

function requireAligned(
  members: LivingMemberReputationLedger,
  sporting: SportingReputationLedger,
): void {
  for (const entry of sporting.entries) {
    if (entry.atSeconds > members.settledAtSeconds) {
      refuseWith(
        `sporting stamp ${entry.atSeconds} is after member mark ${members.settledAtSeconds}`,
      );
    }
  }
}

/**
 * Points plus points, clamped at REPUTATION_MAX on the composed read.
 * Raw ledgers stay unclamped. Alignment: every sporting stamp is at or
 * before the member ledger's settled mark.
 */
export function institutionalReputation(
  members: LivingMemberReputationLedger,
  sporting: SportingReputationLedger,
): InstitutionalReputationReading {
  if (!Number.isFinite(members.creditedReputation) || !Number.isFinite(sporting.creditedReputation)) {
    refuseWith('institutional reputation operands must be finite');
  }
  requireAligned(members, sporting);
  const fromMembers = members.creditedReputation;
  const fromSporting = sporting.creditedReputation;
  const raw = fromMembers + fromSporting;
  const ceiling = EMPIRE_TUNING.REPUTATION_MAX;
  const clamped = raw < 0 ? 0 : raw > ceiling ? ceiling : raw;
  const discardedAtCeiling = raw > ceiling ? raw - ceiling : 0;
  return Object.freeze({
    points: asReputation(clamped),
    fromMembers,
    fromSporting,
    discardedAtCeiling,
    asOfSeconds: members.settledAtSeconds,
  });
}
