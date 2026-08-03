import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { dotsScore, officialTotalKg, type OfficialTotalKg } from './dots';
import { estimateE1rm } from './e1rm';
import { LIFT_ORDER, type LiftKind } from './meet';
import * as progressionModule from './progression';
import {
  ACCEPT_RECOVERY_DAY_REPORT_KEYS,
  applyServerSnapshot,
  asMeetId,
  asProposalId,
  asServerRevision,
  cachedSnapshot,
  CONFIRMED_MEET_RESULT_KEYS,
  CONVENIENCE_GRANTS,
  COSMETIC_SLOTS,
  emptyProgressionCache,
  emptyProjection,
  ENTITLEMENT_EFFECT_KINDS,
  factsMovedBy,
  inFlightProposal,
  isConfirmedReading,
  markCacheStale,
  MEET_ATTEMPT_REPORT_KEYS,
  MEET_RESULT_REPORT_KEYS,
  meetsQualifyingTotal,
  PROGRESSION_CACHE_POLICY,
  PROGRESSION_FACT_KEYS,
  PROGRESSION_PROPOSAL_KINDS,
  PROJECTION_KEYS,
  projectedCount,
  projectedKg,
  PROPOSAL_ORIGIN_BY_KIND,
  PROPOSAL_ORIGIN_KINDS,
  proposeChange,
  PROTECTED_CONCERNS,
  PURCHASABLE_PROPOSAL_KINDS,
  PURCHASE_EVIDENCE_KEYS,
  readBalance,
  readBestE1rmKg,
  readingValue,
  readMeets,
  readStreakDays,
  readTotalKg,
  receiveProgressionSnapshot,
  REDEEM_ENTITLEMENT_REPORT_KEYS,
  rejectProposal,
  snapshotAcknowledges,
  snapshotFacts,
  snapshotRevision,
  SPEND_CURRENCY_REPORT_KEYS,
  TRAINING_SESSION_REPORT_KEYS,
  TRAINING_SET_REPORT_KEYS,
  WALLET_CURRENCIES,
  type ConfirmedFacts,
  type ConfirmedKg,
  type ConfirmedTotalKg,
  type EntitlementEffect,
  type MeetResultReport,
  type ProgressionCache,
  type ProgressionProjection,
  type ProgressionProposal,
  type ProgressionSnapshot,
  type ProgressionSnapshotWire,
  type ProjectedKg,
  type RedeemEntitlementReport,
  type TrainingSetReport,
} from './progression';
import { createStreakState, recordTrainingDay, streakDayFromCivilDate, STREAK_FACT_KEYS } from './streak';

const MODULE_SOURCE = readFileSync(fileURLToPath(new URL('./progression.ts', import.meta.url)), 'utf8');

// ---------------------------------------------------------------------------
// Fixtures. Every one of them goes through `receiveProgressionSnapshot`,
// because that is the only door and a test that ducked around it would be
// testing a different module than the app runs.
// ---------------------------------------------------------------------------

function wire(overrides: Partial<ProgressionSnapshotWire> = {}): ProgressionSnapshotWire {
  return {
    revision: 7,
    totalKg: 630,
    bestE1rmKg: { squat: 240, bench: 150, deadlift: 280 },
    streak: {
      currentStreak: 12,
      longestStreak: 31,
      lastTrainedDay: 20_000,
      recoveredThroughDay: null,
      consecutiveRecoveryDaysUsed: 0,
      recoveryDayBalance: 2,
      hasResolvedFirstBreakOffer: true,
    },
    meets: [
      {
        meetId: 'meet-2026-spring',
        meetDayIndex: 19_900,
        totalKg: 630,
        bestByLift: { squat: 230, bench: 145, deadlift: 255 },
        bodyweightKg: 93,
      },
    ],
    wallet: { gymBucks: 1200, chalk: 40 },
    acknowledgedProposalId: null,
    ...overrides,
  };
}

function expectOk<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

function expectErr<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } },
): { code: string; message: string } {
  if (result.ok) {
    throw new Error('expected an error, got ok');
  }
  return result.error;
}

function snapshot(overrides: Partial<ProgressionSnapshotWire> = {}): ProgressionSnapshot {
  return expectOk(receiveProgressionSnapshot(wire(overrides)));
}

function confirmedCache(overrides: Partial<ProgressionSnapshotWire> = {}): ProgressionCache {
  return expectOk(applyServerSnapshot(emptyProgressionCache(), snapshot(overrides)));
}

const A_PROPOSAL: ProgressionProposal = {
  kind: 'record-training-session',
  report: {
    deviceWallClock: { year: 2026, month: 8, day: 3, hour: 19 },
    sets: [{ lift: 'squat', weightKg: 200, reps: 3, rpe: 8 }],
  },
};

function projectionWith(overrides: Partial<ProgressionProjection>): ProgressionProjection {
  return { ...emptyProjection(), ...overrides };
}

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('purity', () => {
  it('reads no clock, no randomness and no network', () => {
    // The same source-scan `streak.test.ts` uses, for the same reason: the
    // claim in the header is worth nothing if nothing checks it.
    const withoutComments = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/\bDate\b/);
    expect(withoutComments).not.toMatch(/Math\.random/);
    expect(withoutComments).not.toMatch(/performance\.now/);
    expect(withoutComments).not.toMatch(/\bfetch\(/);
    expect(withoutComments).not.toMatch(/\bawait\b/);
    expect(withoutComments).not.toMatch(/from 'react/);
    expect(withoutComments).not.toMatch(/supabase/i);
  });

  it('mints server truth in exactly one place', () => {
    // The private symbol is what makes `ProgressionSnapshot` unforgeable, so
    // the number of places that write it is the number of doors there are.
    // Expected: the interface declaration, and the one construction inside
    // `receiveProgressionSnapshot`.
    const writes = MODULE_SOURCE.match(/\[SNAPSHOT_CONTENTS\]:/g) ?? [];
    expect(writes).toHaveLength(2);
  });

  it('does not cast its way past its own boundary', () => {
    const withoutComments = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/as unknown as/);
    expect(withoutComments).not.toMatch(/as ProgressionSnapshot/);
    expect(withoutComments).not.toMatch(/\bany\b/);
  });

  it('keeps the pay-to-win guard derived, in source, where vitest cannot see it', () => {
    // Every assertion in this module is a type-level `const ... = true`. esbuild
    // strips the types, so `npm test` runs a file in which they are all just
    // `true` — deleting one, or replacing the derived union with the literal
    // union it used to be, would not fail a single test. There is no CI
    // workflow, so the only other thing that would notice is a human running
    // `npm run typecheck`. This scan is what makes the source itself the thing
    // under test, the way dots.test.ts pins its branded signatures.
    const code = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // Sanity: the comment strip left real code behind, so the scans below are
    // looking at something.
    expect(code).toContain('export function receiveProgressionSnapshot');

    // The purchasable set is COMPUTED from the origin map...
    expect(code).toMatch(
      /export type PurchasableProposalKind = \{\s*\[K in ProgressionProposalKind\]: \(typeof PROPOSAL_ORIGIN_BY_KIND\)\[K\] extends 'purchase' \? K : never;\s*\}\[ProgressionProposalKind\];/,
    );
    // ...and is not a hand-written union of kind names, which is what it was.
    expect(code).not.toMatch(/export type PurchasableProposalKind\s*=\s*'/);

    // The origin map stays exhaustive and stays literal. Losing `as const`
    // widens its values and collapses the derivation to `never`.
    expect(code).toMatch(/as const satisfies Readonly<Record<ProgressionProposalKind, ProposalOrigin>>/);

    // The assertions the derivation feeds, each named so a deletion is visible.
    const requiredAssertions = [
      /export const PROPOSAL_ORIGIN_COVERS_EVERY_KIND: KeysAreExactly</,
      /export const PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS: AreDisjoint</,
      /export const PURCHASE_REACH_IS_NOT_VACUOUS: IsNonEmptyUnion</,
      /export const PURCHASABLE_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion</,
      /export const MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE: IsSubsetOf</,
      /export const MONEY_CARRYING_KINDS_ARE_NOT_VACUOUS: IsNonEmptyUnion</,
      /export const NOTHING_MOVES_TRAINING_PACE: AreDisjoint</,
    ];
    for (const assertion of requiredAssertions) {
      expect(code).toMatch(assertion);
    }

    // And the payload cross-check reads the report types rather than a list of
    // kinds, so it cannot be satisfied by editing the same list twice.
    expect(code).toMatch(/Extract<keyof ReportFor<K>, PurchaseEvidenceKey>/);
  });
});

// ---------------------------------------------------------------------------
// The allowlists, checked against live objects rather than against themselves
// ---------------------------------------------------------------------------

describe('the fact allowlist', () => {
  it('is exactly the keys a live snapshot carries', () => {
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts).sort()).toEqual([...PROGRESSION_FACT_KEYS].sort());
  });

  it('has no key that could hold a purchased performance bonus', () => {
    // A blocklist is weaker than the allowlist above and is here as a second,
    // dumber check: if the allowlist is ever widened carelessly, this names the
    // shapes that would matter.
    for (const key of PROGRESSION_FACT_KEYS) {
      expect(key).not.toMatch(/bonus|multiplier|boost|pace/i);
    }
  });

  it('names Total, e1RM, meet results and training pace as protected', () => {
    expect([...PROTECTED_CONCERNS].sort()).toEqual(['bestE1rmKg', 'meets', 'totalKg', 'trainingPace']);
  });

  it('leaves streak and wallet unprotected on purpose', () => {
    // Recovery Days are purchasable and do move a streak (GDD §4.2, §8.2);
    // buying Chalk moves a balance by definition. Protecting them here would be
    // a lie the code could not keep.
    expect(PROTECTED_CONCERNS).not.toContain('streak');
    expect(PROTECTED_CONCERNS).not.toContain('wallet');
  });

  it('keeps the Recovery Day ledger out of the wallet', () => {
    // One consumable, one ledger. `streak.ts` holds it, with the hold cap and
    // the consecutive-use limit attached.
    expect([...WALLET_CURRENCIES]).toEqual(['gymBucks', 'chalk']);
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts.wallet)).not.toContain('recoveryDays');
    expect(facts.streak.recoveryDayBalance).toBe(2);
  });

  it('tracks streak.ts own allowlist rather than duplicating it', () => {
    const facts = snapshotFacts(snapshot());
    expect(Object.keys(facts.streak).sort()).toEqual([...STREAK_FACT_KEYS].sort());
  });

  it('pins every report type to its declared inputs', () => {
    expect([...TRAINING_SET_REPORT_KEYS].sort()).toEqual(['lift', 'reps', 'rpe', 'weightKg']);
    expect([...TRAINING_SESSION_REPORT_KEYS].sort()).toEqual(['deviceWallClock', 'sets']);
    expect([...ACCEPT_RECOVERY_DAY_REPORT_KEYS].sort()).toEqual(['deviceWallClock', 'offeredDaysSeen']);
    expect([...MEET_ATTEMPT_REPORT_KEYS].sort()).toEqual(['attemptNumber', 'good', 'lift', 'weightKg']);
    expect([...MEET_RESULT_REPORT_KEYS].sort()).toEqual(['attempts', 'bodyweightKg', 'meetId']);
    expect([...REDEEM_ENTITLEMENT_REPORT_KEYS].sort()).toEqual(['receipt', 'sku']);
    expect([...SPEND_CURRENCY_REPORT_KEYS].sort()).toEqual(['amount', 'currency', 'sku']);
  });

  it('lets no report name an output', () => {
    const everyReportKey = [
      ...TRAINING_SET_REPORT_KEYS,
      ...TRAINING_SESSION_REPORT_KEYS,
      ...ACCEPT_RECOVERY_DAY_REPORT_KEYS,
      ...MEET_ATTEMPT_REPORT_KEYS,
      ...MEET_RESULT_REPORT_KEYS,
      ...REDEEM_ENTITLEMENT_REPORT_KEYS,
      ...SPEND_CURRENCY_REPORT_KEYS,
    ];
    for (const key of everyReportKey) {
      expect(PROGRESSION_FACT_KEYS as readonly string[]).not.toContain(key);
      expect(key).not.toMatch(/e1rm|total|streak|balance|effect/i);
    }
  });

  it('keeps a meet result to its declared fields', () => {
    const [meet] = snapshotFacts(snapshot()).meets;
    expect(meet).toBeDefined();
    expect(Object.keys(meet as object).sort()).toEqual([...CONFIRMED_MEET_RESULT_KEYS].sort());
  });

  it('keeps a projection to a subset of the real facts', () => {
    expect(Object.keys(emptyProjection()).sort()).toEqual([...PROJECTION_KEYS].sort());
    for (const key of PROJECTION_KEYS) {
      expect(PROGRESSION_FACT_KEYS as readonly string[]).toContain(key);
    }
    // A meet result is never optimistic.
    expect(PROJECTION_KEYS as readonly string[]).not.toContain('meets');
  });
});

// ---------------------------------------------------------------------------
// The pay-to-win line (GDD §8.1, §12.3)
// ---------------------------------------------------------------------------

describe('nothing purchasable reaches performance', () => {
  it('declares a non-empty reach for every proposal kind', () => {
    // The disjointness checks below are vacuously true over an empty reach, so
    // this runs first: if the reach table is ever gutted, this fails rather
    // than the guard silently passing forever.
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      expect(factsMovedBy(kind).length).toBeGreaterThan(0);
    }
  });

  it('gives every proposal kind an origin, from one map', () => {
    // The subject of the check below. If a kind could exist without an origin,
    // the check below would be back to iterating a list someone maintains.
    expect(Object.keys(PROPOSAL_ORIGIN_BY_KIND).sort()).toEqual([...PROGRESSION_PROPOSAL_KINDS].sort());
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      expect(PROPOSAL_ORIGIN_KINDS as readonly string[]).toContain(PROPOSAL_ORIGIN_BY_KIND[kind]);
    }
  });

  it('derives the purchasable set from that map rather than restating it', () => {
    // `PURCHASABLE_PROPOSAL_KINDS` is computed by the module; this recomputes it
    // straight off the origin map. The two agreeing is what makes the module's
    // type predicate — which `tsc` cannot check against its conditional type —
    // safe to build the pay-to-win guard on.
    const fromTheMap = PROGRESSION_PROPOSAL_KINDS.filter((kind) => PROPOSAL_ORIGIN_BY_KIND[kind] === 'purchase');
    expect([...PURCHASABLE_PROPOSAL_KINDS].sort()).toEqual([...fromTheMap].sort());
    // Non-vacuity in BOTH directions: some kinds are purchases and some are not.
    // An empty derived set would make every check below pass over nothing; a
    // total one would mean the tag stopped discriminating.
    expect(PURCHASABLE_PROPOSAL_KINDS.length).toBeGreaterThan(0);
    expect(PURCHASABLE_PROPOSAL_KINDS.length).toBeLessThan(PROGRESSION_PROPOSAL_KINDS.length);
  });

  it('keeps every purchase-originated proposal off the protected facts', () => {
    // The iteration set is DERIVED, not listed here. A new proposal kind tagged
    // `'purchase'` joins it without this test being edited — which is the whole
    // point: the previous version hardcoded the two kinds it knew about and was
    // blind to a third.
    expect(PURCHASABLE_PROPOSAL_KINDS.length).toBeGreaterThan(0);
    for (const kind of PURCHASABLE_PROPOSAL_KINDS) {
      const reach = factsMovedBy(kind) as readonly string[];
      expect(reach.length).toBeGreaterThan(0);
      for (const concern of PROTECTED_CONCERNS) {
        expect(reach).not.toContain(concern);
      }
    }
  });

  it('names purchase evidence that real reports carry and earned reports do not', () => {
    // The runtime half of `MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE`. That
    // assertion is a subset check over the kinds whose report names money, so it
    // passes for free if `PURCHASE_EVIDENCE_KEYS` points at fields nothing has.
    const purchaseReportKeys: readonly string[] = [
      ...REDEEM_ENTITLEMENT_REPORT_KEYS,
      ...SPEND_CURRENCY_REPORT_KEYS,
    ];
    const earnedReportKeys: readonly string[] = [
      ...TRAINING_SET_REPORT_KEYS,
      ...TRAINING_SESSION_REPORT_KEYS,
      ...ACCEPT_RECOVERY_DAY_REPORT_KEYS,
      ...MEET_ATTEMPT_REPORT_KEYS,
      ...MEET_RESULT_REPORT_KEYS,
    ];
    expect(PURCHASE_EVIDENCE_KEYS.length).toBeGreaterThan(0);
    for (const evidence of PURCHASE_EVIDENCE_KEYS) {
      expect(purchaseReportKeys).toContain(evidence);
      expect(earnedReportKeys).not.toContain(evidence);
    }
  });

  it('lets no proposal at all move training pace', () => {
    for (const kind of PROGRESSION_PROPOSAL_KINDS) {
      expect(factsMovedBy(kind) as readonly string[]).not.toContain('trainingPace');
    }
  });

  it('lets earned proposals move the facts a purchase may not', () => {
    // The positive control for the check above. If e1RM were unreachable by
    // *everything*, the purchase check would pass for the wrong reason.
    const training = factsMovedBy('record-training-session') as readonly string[];
    expect(training).toContain('bestE1rmKg');
    expect(training).toContain('totalKg');
    expect(factsMovedBy('record-meet-result') as readonly string[]).toContain('meets');
  });

  it('offers no entitlement effect that touches a lift', () => {
    expect([...ENTITLEMENT_EFFECT_KINDS].sort()).toEqual(['convenience', 'cosmetic', 'currency', 'recovery-day']);
    for (const kind of ENTITLEMENT_EFFECT_KINDS) {
      expect(kind).not.toMatch(/e1rm|total|strength|boost|pace|xp/i);
    }
  });

  it('sells no convenience that speeds up training', () => {
    // GDD §8.3B: "Never speed up Sim-mode training progression. That is the
    // credibility line."
    for (const grant of CONVENIENCE_GRANTS) {
      expect(grant).not.toMatch(/session|training|sim|recovery|fatigue/i);
    }
    expect([...CONVENIENCE_GRANTS]).toEqual(['gym-empire-timer-skip', 'extra-save-slot']);
  });

  it('keeps every cosmetic slot cosmetic', () => {
    expect(COSMETIC_SLOTS.length).toBeGreaterThan(0);
    for (const slot of COSMETIC_SLOTS) {
      expect(slot).not.toMatch(/e1rm|total|strength|boost|pace/i);
    }
  });
});

// ---------------------------------------------------------------------------
// The one door
// ---------------------------------------------------------------------------

describe('receiveProgressionSnapshot', () => {
  it('turns a wire payload into server truth', () => {
    const snap = snapshot();
    expect(snapshotRevision(snap)).toBe(7);
    const facts = snapshotFacts(snap);
    expect(facts.totalKg).toBe(630);
    expect(facts.bestE1rmKg.squat).toBe(240);
    expect(facts.streak.currentStreak).toBe(12);
    expect(facts.wallet.gymBucks).toBe(1200);
    expect(facts.meets).toHaveLength(1);
  });

  it('carries a bomb-out as null, not as a total of zero', () => {
    const facts = snapshotFacts(
      snapshot({
        totalKg: null,
        meets: [
          {
            meetId: 'meet-bombed',
            meetDayIndex: 19_950,
            totalKg: null,
            bestByLift: { squat: 230, bench: null, deadlift: null },
            bodyweightKg: 93,
          },
        ],
      }),
    );
    expect(facts.totalKg).toBeNull();
    expect(facts.meets[0]?.totalKg).toBeNull();
    expect(facts.meets[0]?.totalKg).not.toBe(0);
  });

  it('refuses a zero or negative total rather than storing it', () => {
    expect(expectErr(receiveProgressionSnapshot(wire({ totalKg: 0 }))).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ totalKg: -5 }))).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ totalKg: Number.NaN }))).code).toBe('INVALID_SNAPSHOT');
  });

  it('refuses a malformed revision', () => {
    expect(expectErr(receiveProgressionSnapshot(wire({ revision: -1 }))).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ revision: 1.5 }))).code).toBe('INVALID_SNAPSHOT');
  });

  it('refuses a malformed e1RM', () => {
    const bad = receiveProgressionSnapshot(wire({ bestE1rmKg: { squat: -1, bench: 150, deadlift: 280 } }));
    expect(expectErr(bad).message).toMatch(/bestE1rmKg\.squat/);
  });

  it('refuses a streak whose best is below its current run', () => {
    const bad = receiveProgressionSnapshot(
      wire({ streak: { ...wire().streak, currentStreak: 40, longestStreak: 31 } }),
    );
    expect(expectErr(bad).code).toBe('INVALID_SNAPSHOT');
  });

  it('refuses a fractional currency balance', () => {
    const bad = receiveProgressionSnapshot(wire({ wallet: { gymBucks: 10.5, chalk: 40 } }));
    expect(expectErr(bad).message).toMatch(/wallet\.gymBucks/);
  });

  it('refuses a blank meet id and a blank acknowledgement', () => {
    const badMeet = receiveProgressionSnapshot(
      wire({ meets: [{ ...wire().meets[0]!, meetId: '   ' }] }),
    );
    expect(expectErr(badMeet).code).toBe('INVALID_SNAPSHOT');
    expect(expectErr(receiveProgressionSnapshot(wire({ acknowledgedProposalId: '  ' }))).code).toBe(
      'INVALID_SNAPSHOT',
    );
  });

  it('freezes what it hands back, symbol payload included', () => {
    const snap = snapshot();
    const facts = snapshotFacts(snap);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(facts)).toBe(true);
    expect(Object.isFrozen(facts.wallet)).toBe(true);
    expect(Object.isFrozen(facts.meets)).toBe(true);
    expect(() => {
      (facts as { totalKg: number | null }).totalKg = 900;
    }).toThrow(TypeError);
    expect(snapshotFacts(snap).totalKg).toBe(630);
  });
});

describe('the snapshot is opaque, not branded', () => {
  it('exposes no string-named property at all', () => {
    expect(Object.keys(snapshot())).toEqual([]);
  });

  it('makes a spread-and-override tamper inert', () => {
    // This is the line an object brand would have let through. It compiles here
    // too — a spread copies the symbol-keyed payload and adding a `totalKg`
    // alongside it is assignable — but no reader looks at the added key, so the
    // forged total is not there when anyone asks. See §2 of the module header.
    const real = snapshot();
    const spread = { ...real, totalKg: 900 };
    const asSnapshot: ProgressionSnapshot = spread;
    expect(snapshotFacts(asSnapshot).totalKg).toBe(630);
    expect(snapshotRevision(asSnapshot)).toBe(7);
    const total = snapshotFacts(asSnapshot).totalKg;
    expect(total).not.toBe(900);
  });
});

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

describe('the cache as a cache of server truth', () => {
  it('starts empty, with no truth to read', () => {
    const cache = emptyProgressionCache();
    expect(cache.status).toBe('empty');
    expect(cachedSnapshot(cache)).toBeNull();
    expect(readTotalKg(cache)).toEqual({ kind: 'unknown' });
  });

  it('refuses a proposal before anything has been read', () => {
    const result = proposeChange(emptyProgressionCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection());
    expect(expectErr(result).code).toBe('NO_CONFIRMED_TRUTH');
  });

  it('confirms on the first snapshot', () => {
    const cache = confirmedCache();
    expect(cache.status).toBe('confirmed');
    expect(readTotalKg(cache)).toEqual({ kind: 'confirmed', value: 630 });
  });

  it('refuses a snapshot older than the one it holds', () => {
    const cache = confirmedCache();
    const older = snapshot({ revision: 6, totalKg: 900 });
    const result = applyServerSnapshot(cache, older);
    expect(expectErr(result).code).toBe('SNAPSHOT_BEHIND');
    // And the cache is untouched: the refusal is not a partial apply.
    expect(readingValue(readTotalKg(cache))).toBe(630);
  });

  it('accepts a repeat of the revision it holds, per policy', () => {
    expect(PROGRESSION_CACHE_POLICY.ACCEPT_REPEATED_REVISION).toBe(true);
    const cache = confirmedCache();
    const same = expectOk(applyServerSnapshot(cache, snapshot({ revision: 7, totalKg: 640 })));
    expect(readingValue(readTotalKg(same))).toBe(640);
  });

  it('parks a projection beside truth instead of inside it', () => {
    const cache = confirmedCache();
    const pending = expectOk(
      proposeChange(
        cache,
        asProposalId('p1'),
        A_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645) }),
      ),
    );
    expect(pending.status).toBe('pending');
    // Truth did not move.
    const snap = cachedSnapshot(pending);
    expect(snap).not.toBeNull();
    expect(snapshotFacts(snap as ProgressionSnapshot).totalKg).toBe(630);
    // The optimistic number is readable, and is flagged as optimistic.
    expect(readTotalKg(pending)).toEqual({ kind: 'projected', value: 645, lastConfirmed: 630 });
  });

  it('holds one proposal at a time', () => {
    expect(PROGRESSION_CACHE_POLICY.MAX_IN_FLIGHT_PROPOSALS).toBe(1);
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection()),
    );
    const second = proposeChange(pending, asProposalId('p2'), A_PROPOSAL, emptyProjection());
    expect(expectErr(second).code).toBe('PROPOSAL_ALREADY_IN_FLIGHT');
  });

  it('discards the projection whole when the server acknowledges', () => {
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_PROPOSAL,
        projectionWith({ totalKg: projectedKg(645), streak: { currentStreak: projectedCount(13) } }),
      ),
    );
    const settled = expectOk(
      applyServerSnapshot(pending, snapshot({ revision: 8, totalKg: 632, acknowledgedProposalId: 'p1' })),
    );
    expect(settled.status).toBe('confirmed');
    // The server's number, not the client's guess, and not a merge of the two.
    expect(readTotalKg(settled)).toEqual({ kind: 'confirmed', value: 632 });
    expect(inFlightProposal(settled)).toBeNull();
  });

  it('keeps waiting when a snapshot arrives that settles something else', () => {
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, projectionWith({ totalKg: projectedKg(645) })),
    );
    const elsewhere = expectOk(
      applyServerSnapshot(pending, snapshot({ revision: 9, totalKg: 631, acknowledgedProposalId: 'other' })),
    );
    expect(elsewhere.status).toBe('pending');
    expect(inFlightProposal(elsewhere)?.proposalId).toBe('p1');
    // The base moved; the projection did not become truth.
    expect(readTotalKg(elsewhere)).toEqual({ kind: 'projected', value: 645, lastConfirmed: 631 });
  });

  it('drops the projection and goes stale on a rejection', () => {
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, projectionWith({ totalKg: projectedKg(645) })),
    );
    const rejected = expectOk(rejectProposal(pending, asProposalId('p1')));
    expect(rejected.status).toBe('stale');
    expect(readTotalKg(rejected)).toEqual({ kind: 'stale', value: 630, reason: 'proposal-rejected' });
    expect(inFlightProposal(rejected)).toBeNull();
  });

  it('refuses to reject a proposal that is not the one in flight', () => {
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, emptyProjection()),
    );
    expect(expectErr(rejectProposal(pending, asProposalId('p2'))).code).toBe('NO_MATCHING_PROPOSAL');
    expect(expectErr(rejectProposal(confirmedCache(), asProposalId('p1'))).code).toBe('NO_MATCHING_PROPOSAL');
  });

  it('refuses a proposal against stale truth, per policy', () => {
    expect(PROGRESSION_CACHE_POLICY.ACCEPT_PROPOSALS_WHILE_STALE).toBe(false);
    const stale = markCacheStale(confirmedCache(), 'reconnected');
    expect(expectErr(proposeChange(stale, asProposalId('p1'), A_PROPOSAL, emptyProjection())).code).toBe(
      'CACHE_IS_STALE',
    );
  });

  it('still renders stale truth rather than blanking it', () => {
    const stale = markCacheStale(confirmedCache(), 'signed-in-elsewhere');
    expect(readTotalKg(stale)).toEqual({ kind: 'stale', value: 630, reason: 'signed-in-elsewhere' });
    expect(readingValue(readTotalKg(stale))).toBe(630);
  });

  it('recovers from stale on the next snapshot', () => {
    const stale = markCacheStale(confirmedCache(), 'reconnected');
    const fresh = expectOk(applyServerSnapshot(stale, snapshot({ revision: 11, totalKg: 650 })));
    expect(fresh.status).toBe('confirmed');
    expect(readTotalKg(fresh)).toEqual({ kind: 'confirmed', value: 650 });
  });

  it('has nothing to make stale before the first read', () => {
    expect(markCacheStale(emptyProgressionCache(), 'reconnected').status).toBe('empty');
  });

  it('refuses a malformed proposal and a malformed projection', () => {
    const cache = confirmedCache();
    const noSets: ProgressionProposal = {
      kind: 'record-training-session',
      report: { deviceWallClock: { year: 2026, month: 8, day: 3, hour: 19 }, sets: [] },
    };
    expect(expectErr(proposeChange(cache, asProposalId('p1'), noSets, emptyProjection())).code).toBe(
      'INVALID_PROPOSAL',
    );
    const badSpend: ProgressionProposal = {
      kind: 'spend-currency',
      report: { currency: 'chalk', amount: 0, sku: 'singlet-red' },
    };
    expect(expectErr(proposeChange(cache, asProposalId('p1'), badSpend, emptyProjection())).code).toBe(
      'INVALID_PROPOSAL',
    );
  });
});

describe('readings', () => {
  it('reports every fact through the same four-state shape', () => {
    const cache = confirmedCache();
    expect(readBestE1rmKg(cache, 'bench')).toEqual({ kind: 'confirmed', value: 150 });
    expect(readStreakDays(cache)).toEqual({ kind: 'confirmed', value: 12 });
    expect(readBalance(cache, 'chalk')).toEqual({ kind: 'confirmed', value: 40 });
    expect(readMeets(cache).kind).toBe('confirmed');
  });

  it('projects per-lift and per-currency independently', () => {
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        A_PROPOSAL,
        projectionWith({
          bestE1rmKg: { squat: projectedKg(245), bench: null, deadlift: null },
          wallet: { gymBucks: projectedCount(1250), chalk: null },
        }),
      ),
    );
    expect(readBestE1rmKg(pending, 'squat')).toEqual({ kind: 'projected', value: 245, lastConfirmed: 240 });
    // No projection for bench: the confirmed number, not a stale-looking blank.
    expect(readBestE1rmKg(pending, 'bench')).toEqual({ kind: 'confirmed', value: 150 });
    expect(readBalance(pending, 'gymBucks')).toEqual({ kind: 'projected', value: 1250, lastConfirmed: 1200 });
    expect(readBalance(pending, 'chalk')).toEqual({ kind: 'confirmed', value: 40 });
  });

  it('never projects a meet result', () => {
    const pending = expectOk(
      proposeChange(confirmedCache(), asProposalId('p1'), A_PROPOSAL, projectionWith({ totalKg: projectedKg(645) })),
    );
    // Total may be optimistic; the meet list never is.
    expect(readTotalKg(pending).kind).toBe('projected');
    expect(readMeets(pending).kind).toBe('confirmed');
  });

  it('lets a renderer tell truth from a guess', () => {
    const cache = confirmedCache();
    const pending = expectOk(
      proposeChange(cache, asProposalId('p1'), A_PROPOSAL, projectionWith({ totalKg: projectedKg(645) })),
    );
    expect(isConfirmedReading(readTotalKg(cache))).toBe(true);
    expect(isConfirmedReading(readTotalKg(pending))).toBe(false);
    expect(isConfirmedReading(readTotalKg(markCacheStale(cache, 'reconnected')))).toBe(false);
    expect(isConfirmedReading(readTotalKg(emptyProgressionCache()))).toBe(false);
  });

  it('returns null for a value nobody has yet', () => {
    expect(readingValue(readTotalKg(emptyProgressionCache()))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// COMPILE-TIME BOUNDARY.
//
// Every `@ts-expect-error` below is an assertion, not a comment: `npm run
// typecheck` fails with TS2578 "Unused '@ts-expect-error' directive" the moment
// one of these lines starts compiling.
//
// EACH ONE WAS MUTATION-CHECKED rather than reasoned about. The guard it names
// was deleted from `progression.ts`, `tsc` was run, the directive was confirmed
// to go unused (TS2578) or the paired type-level assertion was confirmed to
// fail, and the guard was restored. A `@ts-expect-error` on a line that was
// never going to compile for an unrelated reason proves nothing, and the only
// way to tell the difference is to break the thing and look.
//
// ONE RESULT WORTH WRITING DOWN, because it is the sort of overlap that makes a
// check look stronger than it is: `ConfirmedTotalKg` is `Confirmed<
// OfficialTotalKg>`, so it carries TWO brands. Deleting this module's
// `Confirmed` brand does NOT make `const forged: ConfirmedTotalKg = 630` start
// compiling — dots.ts's brand still refuses the bare number. The test that
// isolates *this* module's brand is the e1RM one below, which uses `ConfirmedKg`
// (no second brand on it); that directive does go unused when `Confirmed` is
// removed. Both tests are worth having, but only one of them is evidence about
// the boundary this file builds.
//
// The positive controls in the last block matter as much as the negatives: a
// boundary where nothing compiles is not a boundary, it is a broken module.
// ---------------------------------------------------------------------------

describe('a client cannot mint server truth', () => {
  it('will not accept a bare number as a confirmed total', () => {
    // @ts-expect-error - a plain number is not a ConfirmedTotalKg. There is no
    // exported mint; the only one is inside receiveProgressionSnapshot.
    const forged: ConfirmedTotalKg = 630;
    expect(forged).toBe(630);
  });

  it('will not accept a locally estimated e1RM as a confirmed one', () => {
    // The client is allowed to compute this. It is not allowed to call it truth.
    const local: number = estimateE1rm({ weight: 200, reps: 3, rpe: 8 });
    expect(local).toBeGreaterThan(200);
    // @ts-expect-error - e1rm.ts returns a number, and a number is not confirmed.
    const forged: ConfirmedKg = estimateE1rm({ weight: 200, reps: 3, rpe: 8 });
    expect(forged).toBe(local);
  });

  it('will not accept an officially-minted total as a confirmed one either', () => {
    // dots.ts's `officialTotalKg` is a client-reachable mint on purpose (it has
    // to be — totals arrive from fixtures and NPC tables). It brands a number as
    // "this is a final total"; it does not brand it as "the server said so", and
    // the two are different claims.
    const official: OfficialTotalKg = officialTotalKg(630);
    // @ts-expect-error - OfficialTotalKg is not Confirmed<OfficialTotalKg>.
    const forged: ConfirmedTotalKg = official;
    expect(forged).toBe(630);
  });

  it('will not accept a hand-built object as a snapshot', () => {
    // @ts-expect-error - ProgressionSnapshot's only key is a module-private symbol.
    const forged: ProgressionSnapshot = { revision: 7, facts: {} };
    expect(forged).toBeDefined();
  });

  it('will not let a wire payload into the cache without the mint', () => {
    const cache = confirmedCache();
    // Forced past the compiler it does not quietly work: there is no payload
    // under the private symbol, so the read throws rather than accepting a
    // client-authored total of 900.
    expect(() => {
      // @ts-expect-error - the wire is JSON; only receiveProgressionSnapshot makes truth of it.
      applyServerSnapshot(cache, wire({ revision: 8, totalKg: 900 }));
    }).toThrow(TypeError);
    expect(readingValue(readTotalKg(cache))).toBe(630);
  });

  it('will not let a projection be fed in as a server response', () => {
    // @ts-expect-error - a client projection is not a wire payload.
    const result = receiveProgressionSnapshot(projectionWith({ totalKg: projectedKg(900) }));
    expect(result.ok).toBe(false);
  });

  it('will not accept a raw string where a proposal id is required', () => {
    const cache = confirmedCache();
    // @ts-expect-error - ProposalId is branded; go through asProposalId.
    const result = proposeChange(cache, 'p1', A_PROPOSAL, emptyProjection());
    expect(result.ok).toBe(true);
  });
});

describe('an unconfirmed value cannot be used as a confirmed one', () => {
  it('will not store a projection as truth', () => {
    // @ts-expect-error - ProjectedKg and Confirmed<T> are disjoint brands.
    const forged: ConfirmedTotalKg = projectedKg(900);
    expect(forged).toBe(900);
  });

  it('will not gate meet entry on a projection', () => {
    // GDD §6.1: meets are gated by qualifying totals. Not by a local guess.
    // @ts-expect-error - meetsQualifyingTotal demands a ConfirmedTotalKg.
    const qualified = meetsQualifyingTotal(projectedKg(900), 600);
    expect(qualified).toBe(true);
  });

  it('will not gate meet entry on a bare number either', () => {
    // @ts-expect-error - the `?? 0` shape: a number is not a confirmed total.
    const qualified = meetsQualifyingTotal(630, 600);
    expect(qualified).toBe(true);
  });

  it('will not let a projected total reach a DOTS score', () => {
    // A provisional number cannot get onto a leaderboard: ProjectedKg is not an
    // OfficialTotalKg, so dots.ts refuses it at the type level.
    // @ts-expect-error - dotsScore takes an OfficialTotalKg.
    const fake = dotsScore('male', 93, projectedKg(900));
    expect(fake).toBeGreaterThan(0);
  });

  it('will not let a confirmed number be passed off as a projection', () => {
    const facts = snapshotFacts(snapshot());
    const total = facts.totalKg;
    expect(total).not.toBeNull();
    // The brand is disjoint in both directions — truth is not a guess either.
    // @ts-expect-error - Confirmed<T> is not Projected<T>.
    const backwards: ProjectedKg = total as ConfirmedTotalKg;
    expect(backwards).toBe(630);
  });

  it('will not let a locally advanced streak be written into the facts', () => {
    // streak.ts is pure, so the client really can compute the next state. What
    // it cannot do is put the answer where the server's answer goes.
    const day = streakDayFromCivilDate({ year: 2026, month: 8, day: 3 });
    const advanced = recordTrainingDay(createStreakState(), day);
    expect(advanced.ok).toBe(true);
    const facts = snapshotFacts(snapshot());
    // @ts-expect-error - a number is not a ConfirmedTotalKg; the facts object
    // cannot be rebuilt with a local total alongside a local streak.
    const forged: ConfirmedFacts = { ...facts, totalKg: 900 };
    expect(forged.totalKg).toBe(900);
  });

  it('will not accept a plain number into a projection either', () => {
    // The projection brand runs the same way: projecting is deliberate too.
    // @ts-expect-error - a plain number is not a ProjectedKg.
    const bad: ProgressionProjection = { ...emptyProjection(), totalKg: 645 };
    expect(bad.totalKg).toBe(645);
  });

  it('will not let a projection invent a fact the server does not have', () => {
    // @ts-expect-error - `meets` is not a projectable fact.
    const bad: ProgressionProjection = { ...emptyProjection(), meets: [] };
    expect(bad).toBeDefined();
  });
});

describe('a purchase cannot reach performance', () => {
  it('offers no entitlement effect that moves e1RM', () => {
    // @ts-expect-error - ENTITLEMENT_EFFECT_KINDS has no 'e1rm-boost' and the
    // union is pinned to it by ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST.
    const boost: EntitlementEffect = { kind: 'e1rm-boost', multiplier: 1.05 };
    expect(boost).toBeDefined();
  });

  it('offers no entitlement effect that moves a Total', () => {
    // @ts-expect-error - nor a 'total-bonus'.
    const boost: EntitlementEffect = { kind: 'total-bonus', kg: 10 };
    expect(boost).toBeDefined();
  });

  it('offers no convenience that skips a training session', () => {
    // @ts-expect-error - CONVENIENCE_GRANTS is an allowlist; a session skip is not on it.
    const grant: EntitlementEffect = { kind: 'convenience', grant: 'sim-session-skip' };
    expect(grant).toBeDefined();
  });

  it('will not let a redemption tell the server what it bought', () => {
    // The server resolves the SKU against its own catalogue. A client that
    // cannot name an effect cannot name a forbidden one.
    const report: RedeemEntitlementReport = {
      sku: 'chalk-pack-3',
      receipt: 'txn-1',
      // @ts-expect-error - RedeemEntitlementReport has no `effect` field.
      effect: { kind: 'currency', currency: 'chalk', amount: 300 },
    };
    expect(report.sku).toBe('chalk-pack-3');
  });

  it('will not let a session report carry the e1RM it thinks it earned', () => {
    // @ts-expect-error - TrainingSetReport is inputs only; there is no e1rmKg.
    const report: TrainingSetReport = { lift: 'squat', weightKg: 200, reps: 3, rpe: 8, e1rmKg: 220 };
    expect(report.weightKg).toBe(200);
  });

  it('will not let a meet report carry the total it thinks it made', () => {
    // GDD §6.4: total = sum of best successful attempt per lift, computed where
    // the attempts are judged, not where they are displayed.
    const report: MeetResultReport = {
      meetId: asMeetId('meet-1'),
      bodyweightKg: 93,
      attempts: [{ lift: 'squat', attemptNumber: 1, weightKg: 220, good: true }],
      // @ts-expect-error - MeetResultReport is inputs only; there is no totalKg.
      totalKg: 900,
    };
    expect(report.bodyweightKg).toBe(93);
  });

  it('has no Recovery Day balance in the wallet to buy against', () => {
    const cache = confirmedCache();
    // @ts-expect-error - 'recoveryDays' is not a WalletCurrency; streak.ts owns that ledger.
    const balance = readBalance(cache, 'recoveryDays');
    expect(balance.kind).toBe('confirmed');
  });
});

describe('the module exports no writer', () => {
  it('has no way to commit a projection', () => {
    // @ts-expect-error - there is no commitProjection, and adding one would make
    // this directive unused and fail the typecheck.
    const commit = progressionModule.commitProjection;
    expect(commit).toBeUndefined();
  });

  it('has no way to set a confirmed total', () => {
    // @ts-expect-error - there is no setConfirmedTotal either.
    const setter = progressionModule.setConfirmedTotal;
    expect(setter).toBeUndefined();
  });

  it('has no exported mint for a confirmed number', () => {
    // @ts-expect-error - `confirm` is module-private and stays that way.
    const mint = progressionModule.confirm;
    expect(mint).toBeUndefined();
  });

  it('exports exactly the surface it is meant to', () => {
    // Mechanical, and the point is that it fails on ANY new export — including
    // one that looks innocent. Adding a writer means editing this list, which
    // means someone reads the file header first.
    const expected = [
      'ACCEPT_RECOVERY_DAY_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'ACCEPT_RECOVERY_DAY_REPORT_KEYS',
      'CONFIRMED_MEET_RESULT_KEYS',
      'CONVENIENCE_GRANTS',
      'COSMETIC_SLOTS',
      'ENTITLEMENTS_CANNOT_REACH_PROTECTED_CONCERNS',
      'ENTITLEMENT_EFFECTS_ARE_EXACTLY_THE_ALLOWLIST',
      'ENTITLEMENT_EFFECT_KINDS',
      'ENTITLEMENT_REACH_IS_NOT_VACUOUS',
      'MEET_ATTEMPT_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_ATTEMPT_REPORT_KEYS',
      'MEET_RESULT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_RESULT_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'MEET_RESULT_REPORT_KEYS',
      'MONEY_CARRYING_KINDS_ARE_NOT_VACUOUS',
      'MONEY_ON_THE_WIRE_IS_DECLARED_A_PURCHASE',
      'NOTHING_MOVES_TRAINING_PACE',
      'PROGRESSION_CACHE_POLICY',
      'PROGRESSION_FACTS_ARE_EXACTLY_THE_ALLOWLIST',
      'PROGRESSION_FACT_KEYS',
      'PROGRESSION_PROPOSAL_KINDS',
      'PROJECTION_IS_EXACTLY_ITS_ALLOWLIST',
      'PROJECTION_KEYS',
      'PROJECTION_ONLY_MIRRORS_REAL_FACTS',
      'PROPOSAL_KINDS_ARE_EXACTLY_THE_ALLOWLIST',
      'PROPOSAL_ORIGIN_BY_KIND',
      'PROPOSAL_ORIGIN_COVERS_EVERY_KIND',
      'PROPOSAL_ORIGIN_KINDS',
      'PROPOSAL_REACH_COVERS_EVERY_KIND',
      'PROTECTED_CONCERNS',
      'PROTECTED_CONCERNS_NAME_REAL_FACTS',
      'PURCHASABLE_KINDS_ARE_NOT_VACUOUS',
      'PURCHASABLE_PROPOSAL_KINDS',
      'PURCHASES_CANNOT_REACH_PROTECTED_CONCERNS',
      'PURCHASE_EVIDENCE_KEYS',
      'PURCHASE_REACH_IS_NOT_VACUOUS',
      'REDEEM_ENTITLEMENT_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'REDEEM_ENTITLEMENT_REPORT_KEYS',
      'SPEND_CURRENCY_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'SPEND_CURRENCY_REPORT_KEYS',
      'STREAK_WIRE_MATCHES_THE_STREAK_ALLOWLIST',
      'TRAINING_SESSION_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'TRAINING_SESSION_REPORT_KEYS',
      'TRAINING_SET_REPORT_IS_EXACTLY_ITS_ALLOWLIST',
      'TRAINING_SET_REPORT_KEYS',
      'WALLET_CURRENCIES',
      'applyServerSnapshot',
      'asMeetId',
      'asProposalId',
      'asServerRevision',
      'cachedSnapshot',
      'emptyProgressionCache',
      'emptyProjection',
      'factsMovedBy',
      'inFlightProposal',
      'isConfirmedReading',
      'markCacheStale',
      'meetsQualifyingTotal',
      'projectedCount',
      'projectedKg',
      'proposeChange',
      'readBalance',
      'readBestE1rmKg',
      'readMeets',
      'readStreakDays',
      'readTotalKg',
      'readingValue',
      'receiveProgressionSnapshot',
      'rejectProposal',
      'snapshotAcknowledges',
      'snapshotFacts',
      'snapshotRevision',
    ];
    expect(Object.keys(progressionModule).sort()).toEqual(expected);
  });

  it('accepts a ConfirmedFacts nowhere', () => {
    // The residual documented in §6 of the header: a `ConfirmedFacts` value can
    // be assembled by hand from an existing one, because object brands do not
    // work. It goes nowhere, and this is the check that keeps it that way —
    // every exported function that takes progression state takes a snapshot or
    // a cache, never bare facts.
    const withoutComments = MODULE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const signatures = [...withoutComments.matchAll(/export function (\w+)\s*(?:<[^>]*>)?\s*\(([\s\S]*?)\)\s*:/g)];
    // Non-vacuity first: a scan that matched nothing would pass forever.
    expect(signatures.length).toBeGreaterThan(15);
    expect(signatures.map((match) => match[1])).toContain('applyServerSnapshot');
    const accepting = signatures.filter((match) => (match[2] ?? '').includes('ConfirmedFacts'));
    expect(accepting.map((match) => match[1])).toEqual([]);
    // And the scan can see parameter types at all — the control for the filter.
    const acceptingSnapshots = signatures.filter((match) => (match[2] ?? '').includes('ProgressionSnapshot'));
    expect(acceptingSnapshots.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Positive controls. If the block above passed because nothing in this module
// compiles, these would fail.
// ---------------------------------------------------------------------------

describe('the boundary lets legitimate work through', () => {
  it('scores a confirmed total with dots.ts, with no cast', () => {
    const facts = snapshotFacts(snapshot());
    const total = facts.totalKg;
    if (total === null) {
      throw new Error('fixture should have a total');
    }
    // No cast anywhere on this line: a ConfirmedTotalKg IS an OfficialTotalKg.
    const score = dotsScore('male', 93, total);
    expect(score).toBeCloseTo(dotsScore('male', 93, officialTotalKg(630)), 9);
    expect(score).toBeGreaterThan(300);
  });

  it('gates meet entry on a confirmed total, with no cast', () => {
    const total = snapshotFacts(snapshot()).totalKg;
    if (total === null) {
      throw new Error('fixture should have a total');
    }
    expect(meetsQualifyingTotal(total, 600)).toBe(true);
    expect(meetsQualifyingTotal(total, 700)).toBe(false);
  });

  it('does arithmetic and formatting on confirmed numbers', () => {
    const facts = snapshotFacts(snapshot());
    const squat = facts.bestE1rmKg.squat;
    if (squat === null) {
      throw new Error('fixture should have a squat e1RM');
    }
    const asNumber: number = squat;
    expect(asNumber * 2).toBe(480);
    expect(squat.toFixed(1)).toBe('240.0');
    expect(Math.max(...LIFT_ORDER.map((lift: LiftKind) => facts.bestE1rmKg[lift] ?? 0))).toBe(280);
  });

  it('projects an optimistic e1RM from the same pure math the server would use', () => {
    // The intended client path end to end: compute locally with e1rm.ts, mark
    // it as a projection, propose the INPUTS, render the guess as a guess.
    const set = { weight: 200, reps: 3, rpe: 8 } as const;
    const projected = projectedKg(estimateE1rm(set));
    const pending = expectOk(
      proposeChange(
        confirmedCache(),
        asProposalId('p1'),
        {
          kind: 'record-training-session',
          report: {
            deviceWallClock: { year: 2026, month: 8, day: 3, hour: 19 },
            sets: [{ lift: set.weight > 0 ? 'squat' : 'bench', weightKg: set.weight, reps: set.reps, rpe: set.rpe }],
          },
        },
        projectionWith({ bestE1rmKg: { squat: projected, bench: null, deadlift: null } }),
      ),
    );
    const reading = readBestE1rmKg(pending, 'squat');
    expect(reading.kind).toBe('projected');
    expect(readingValue(reading)).toBeCloseTo(estimateE1rm(set), 9);
  });

  it('mints ids and revisions the client is allowed to mint', () => {
    expect(asProposalId('p1')).toBe('p1');
    expect(asMeetId('meet-1')).toBe('meet-1');
    expect(asServerRevision(3)).toBe(3);
    expect(() => asProposalId('  ')).toThrow(RangeError);
    expect(() => asMeetId('')).toThrow(RangeError);
    expect(() => asServerRevision(-1)).toThrow(RangeError);
  });

  it('refuses a nonsense projection at the mint', () => {
    expect(() => projectedKg(0)).toThrow(RangeError);
    expect(() => projectedKg(Number.NaN)).toThrow(RangeError);
    expect(() => projectedCount(-1)).toThrow(RangeError);
    expect(() => projectedCount(1.5)).toThrow(RangeError);
  });

  it('answers the acknowledgement question directly', () => {
    const snap = snapshot({ acknowledgedProposalId: 'p1' });
    expect(snapshotAcknowledges(snap, asProposalId('p1'))).toBe(true);
    expect(snapshotAcknowledges(snap, asProposalId('p2'))).toBe(false);
    expect(snapshotAcknowledges(snapshot(), asProposalId('p1'))).toBe(false);
  });

  it('builds every proposal kind the design calls for', () => {
    const proposals: readonly ProgressionProposal[] = [
      A_PROPOSAL,
      {
        kind: 'accept-recovery-day',
        report: { deviceWallClock: { year: 2026, month: 8, day: 3, hour: 9 }, offeredDaysSeen: 1 },
      },
      {
        kind: 'record-meet-result',
        report: {
          meetId: asMeetId('meet-1'),
          bodyweightKg: 93,
          attempts: [{ lift: 'squat', attemptNumber: 1, weightKg: 220, good: true }],
        },
      },
      { kind: 'redeem-entitlement', report: { sku: 'chalk-pack-3', receipt: 'txn-1' } },
      { kind: 'spend-currency', report: { currency: 'gymBucks', amount: 500, sku: 'gym-decor-neon' } },
    ];
    expect(proposals.map((p) => p.kind).sort()).toEqual([...PROGRESSION_PROPOSAL_KINDS].sort());
    for (const proposal of proposals) {
      expect(proposeChange(confirmedCache(), asProposalId('p1'), proposal, emptyProjection()).ok).toBe(true);
    }
  });

  it('builds every entitlement effect the catalogue allows', () => {
    const effects: readonly EntitlementEffect[] = [
      { kind: 'cosmetic', slot: 'singlet' },
      { kind: 'convenience', grant: 'gym-empire-timer-skip' },
      { kind: 'currency', currency: 'chalk', amount: 300 },
      { kind: 'recovery-day', count: 3 },
    ];
    expect(effects.map((e) => e.kind).sort()).toEqual([...ENTITLEMENT_EFFECT_KINDS].sort());
  });
});
