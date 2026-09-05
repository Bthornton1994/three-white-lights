/**
 * institutionalReputation.test.ts — CAREER-EMPIRE-REP-01 composer.
 *
 * Points plus points, clamp at REPUTATION_MAX, alignment, rate-mixing
 * fence, and the REP-GRAIN-01 pin. No retune.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { asReputation } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { institutionalReputation } from './institutionalReputation';
import type { LivingMemberReputationLedger } from './livingMemberReputation';
import type {
  SportingReputationEntry,
  SportingReputationLedger,
} from './sportingReputationLedger';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(HERE, 'institutionalReputation.ts'), 'utf8');
const T = EMPIRE_TUNING;

function membersLedger(
  creditedReputation: number,
  settledAtSeconds: number,
): LivingMemberReputationLedger {
  return Object.freeze({
    settledAtSeconds,
    creditedReputation,
    settlements: Object.freeze([]),
  });
}

function sportingLedger(
  creditedReputation: number,
  entries: readonly SportingReputationEntry[] = [],
): SportingReputationLedger {
  return Object.freeze({
    creditedReputation,
    entries: Object.freeze([...entries]),
  });
}

function stamped(atSeconds: number): SportingReputationEntry {
  return Object.freeze({
    meetId: 'stamp',
    atSeconds,
    points: asReputation(0),
    reasons: Object.freeze([]),
  });
}

describe('institutionalReputation — points plus points', () => {
  it('reads 0 + 0 as 0', () => {
    const reading = institutionalReputation(membersLedger(0, 0), sportingLedger(0));
    expect(reading).toEqual({
      points: 0,
      fromMembers: 0,
      fromSporting: 0,
      discardedAtCeiling: 0,
      asOfSeconds: 0,
    });
    expect(reading.points).toBe(asReputation(0));
  });

  it('reports a member-only reading', () => {
    const reading = institutionalReputation(membersLedger(12, 40), sportingLedger(0));
    expect(reading.points).toBe(12);
    expect(reading.fromMembers).toBe(12);
    expect(reading.fromSporting).toBe(0);
    expect(reading.asOfSeconds).toBe(40);
  });

  it('reports a sporting-only reading', () => {
    const reading = institutionalReputation(
      membersLedger(0, 10),
      sportingLedger(40, [stamped(10)]),
    );
    expect(reading.points).toBe(40);
    expect(reading.fromMembers).toBe(0);
    expect(reading.fromSporting).toBe(40);
  });

  it('adds both halves and reports each', () => {
    const reading = institutionalReputation(
      membersLedger(12, 10),
      sportingLedger(40, [stamped(10)]),
    );
    expect(reading.points).toBe(52);
    expect(reading.fromMembers).toBe(12);
    expect(reading.fromSporting).toBe(40);
    expect(reading.discardedAtCeiling).toBe(0);
  });

  it('clamps at REPUTATION_MAX and reports the discard', () => {
    const over = T.REPUTATION_MAX + 80;
    const reading = institutionalReputation(membersLedger(over, 0), sportingLedger(0));
    expect(reading.points).toBe(asReputation(T.REPUTATION_MAX));
    expect(reading.fromMembers).toBe(over);
    expect(reading.fromSporting).toBe(0);
    expect(reading.discardedAtCeiling).toBe(80);
  });

  it('refuses a sporting stamp after the member mark', () => {
    expect(() =>
      institutionalReputation(membersLedger(0, 10), sportingLedger(24, [stamped(11)])),
    ).toThrow(/after member mark/);
  });
});

describe('REP-GRAIN-01 — scale disparity is named, not retuned', () => {
  it('pins the shipped numbers without changing them', () => {
    expect(T.HIGH_PAYING_MEMBER_ARRIVAL_REPUTATION_THRESHOLD).toBe(1);
    expect(T.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.powerlifter).toBe(0.15);
    expect(T.SPORTING_REPUTATION.placingUnit).toBe(24);
  });
});

describe('fences — rate mixing, v1 write, Portfolio', () => {
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('never mixes a per-day rate into the event composer', () => {
    expect(CODE).not.toMatch(/memberReputationPerDay/);
    expect(CODE).not.toMatch(/reputationFromMembers/);
    expect(CODE).not.toMatch(/memberSatisfaction/);
    expect(CODE).not.toMatch(/SECONDS_PER_DAY/);
  });

  it('does not write EmpireState or start a roster', () => {
    expect(CODE).not.toMatch(/EmpireState/);
    expect(CODE).not.toMatch(/portfolio|Portfolio/);
    expect(CODE).not.toMatch(/NpcLifter/);
    expect(CODE).not.toMatch(/\bDate\b/);
    expect(CODE).not.toMatch(/Math\.random/);
  });
});
