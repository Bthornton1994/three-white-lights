/**
 * sportingReputation.test.ts — Stage E sporting contributor.
 *
 * Pins the input contract, the refused inputs, calibration against the
 * shipped reputation ladder, composition with `reputationFromMembers`, and
 * the fences this piece must not cross (Career progression, persistent NPC
 * roster, Portfolio, cross-directory wiring).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { asReputation } from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { reputationFromMembers, type MemberRoster } from './members';
import {
  composeGymReputationContributions,
  sportingReputationFromResult,
  type SportingMeetResult,
} from './sportingReputation';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = EMPIRE_TUNING;
const S = T.SPORTING_REPUTATION;
const SOURCE = readFileSync(path.join(HERE, 'sportingReputation.ts'), 'utf8');

function localWin(overrides: Partial<SportingMeetResult> = {}): SportingMeetResult {
  return {
    kind: 'local',
    totalKg: 500,
    place: 1,
    fieldSize: 16,
    isTotalPr: false,
    newlyQualifiedFor: [],
    ...overrides,
  };
}

describe('sportingReputationFromResult — sporting accomplishment, not participation', () => {
  it('pays nothing for a bomb-out and names the missing total', () => {
    const contribution = sportingReputationFromResult({
      kind: 'local',
      totalKg: null,
      place: null,
      fieldSize: 16,
      isTotalPr: false,
      newlyQualifiedFor: [],
    });
    expect(contribution.points).toBe(0);
    expect(contribution.reasons).toEqual([
      { kind: 'no-total', text: S.copy.noTotal, points: 0 },
    ]);
  });

  it('does not pay for last place the way it pays for first', () => {
    const first = sportingReputationFromResult(localWin({ place: 1 }));
    const last = sportingReputationFromResult(localWin({ place: 16 }));
    expect(first.points).toBeCloseTo(S.kindScale.local * S.placingUnit, 6);
    expect(last.points).toBeCloseTo((S.kindScale.local * S.placingUnit) / 16, 6);
    expect(last.points).toBeGreaterThan(0);
    expect(first.points).toBeGreaterThan(last.points);
  });

  it('scales placing, record, and qualify by the GDD §6.1 kind ladder', () => {
    expect(Object.keys(S.kindScale).sort()).toEqual([...S.meetKinds].sort());
    const kinds = S.meetKinds;
    expect([...kinds]).toEqual(['local', 'regional', 'nationals', 'worlds']);
    const local = sportingReputationFromResult(localWin({ kind: 'local' })).points;
    const regional = sportingReputationFromResult(localWin({ kind: 'regional' })).points;
    const nationals = sportingReputationFromResult(localWin({ kind: 'nationals' })).points;
    const worlds = sportingReputationFromResult(localWin({ kind: 'worlds' })).points;
    expect(regional).toBeCloseTo(local * (S.kindScale.regional / S.kindScale.local), 6);
    expect(nationals).toBeCloseTo(local * (S.kindScale.nationals / S.kindScale.local), 6);
    expect(worlds).toBeCloseTo(local * (S.kindScale.worlds / S.kindScale.local), 6);
    expect(local).toBeLessThan(regional);
    expect(regional).toBeLessThan(nationals);
    expect(nationals).toBeLessThan(worlds);
  });

  it('adds a published-total record as its own named term', () => {
    const plain = sportingReputationFromResult(localWin({ isTotalPr: false }));
    const record = sportingReputationFromResult(localWin({ isTotalPr: true }));
    expect(record.points - plain.points).toBeCloseTo(S.kindScale.local * S.totalPrUnit, 6);
    expect(record.reasons.map((row) => row.kind)).toEqual(['placing', 'total-pr']);
    expect(record.reasons[1]?.text).toContain('Raised published best total');
  });

  it('adds qualification using the rung qualified for, not the meet kind', () => {
    const plain = sportingReputationFromResult(localWin());
    const qualified = sportingReputationFromResult(
      localWin({ newlyQualifiedFor: ['regional'] }),
    );
    expect(qualified.points - plain.points).toBeCloseTo(
      S.kindScale.regional * S.qualifyUnit,
      6,
    );
    expect(qualified.reasons[qualified.reasons.length - 1]?.text).toBe(
      'Newly qualified for regional',
    );
  });

  it('does not let Total kilograms become a second reputation scalar', () => {
    const light = sportingReputationFromResult(localWin({ totalKg: 200, isTotalPr: true }));
    const heavy = sportingReputationFromResult(localWin({ totalKg: 800, isTotalPr: true }));
    expect(heavy.points).toBe(light.points);
    expect(heavy.reasons.map((row) => row.kind)).toEqual(light.reasons.map((row) => row.kind));
  });

  it('refuses a participation-shaped lie: placing without a total, or a PR on a bomb-out', () => {
    expect(() =>
      sportingReputationFromResult(localWin({ totalKg: null, place: 1 })),
    ).toThrow(/together/);
    expect(() =>
      sportingReputationFromResult({
        kind: 'local',
        totalKg: null,
        place: null,
        fieldSize: 8,
        isTotalPr: true,
        newlyQualifiedFor: [],
      }),
    ).toThrow(/bomb-out/);
  });

  it('refuses invented kinds, empty fields, duplicate qualify rungs, and qualify on a bomb-out', () => {
    expect(() => sportingReputationFromResult(localWin({ kind: 'open' as never }))).toThrow(
      /meet kind/,
    );
    expect(() => sportingReputationFromResult(localWin({ fieldSize: 0 }))).toThrow(
      /positive whole number/,
    );
    expect(() =>
      sportingReputationFromResult(localWin({ newlyQualifiedFor: ['regional', 'regional'] })),
    ).toThrow(/twice/);
    expect(() =>
      sportingReputationFromResult(localWin({ newlyQualifiedFor: ['local' as never] })),
    ).toThrow(/qualify rung/);
    expect(() =>
      sportingReputationFromResult({
        kind: 'local',
        totalKg: null,
        place: null,
        fieldSize: 8,
        isTotalPr: false,
        newlyQualifiedFor: ['regional'],
      }),
    ).toThrow(/bomb-out cannot newly qualify/);
  });

  it('names why the number moved, per term', () => {
    const contribution = sportingReputationFromResult(
      localWin({ isTotalPr: true, newlyQualifiedFor: ['regional'] }),
    );
    expect(contribution.reasons.map((row) => row.kind)).toEqual(['placing', 'total-pr', 'qualify']);
    expect(contribution.reasons[0]?.text).toBe('Placed 1 of 16 at a local meet');
    expect(contribution.reasons.every((row) => row.text.length > 0)).toBe(true);
    const named = contribution.reasons.reduce((sum, row) => sum + row.points, 0);
    expect(contribution.points).toBeCloseTo(named, 6);
  });
});

describe('calibration — Career matters without swallowing the institution', () => {
  const club = T.NPC_RECRUIT_REPUTATION_THRESHOLD.club;
  const regionalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.regional;
  const nationalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.national;
  const firstTier = T.REPUTATION_TIER_THRESHOLDS[1];

  it('keeps one ordinary local placing under the club unlock', () => {
    const points = sportingReputationFromResult(localWin()).points;
    expect(points).toBeCloseTo(12, 6);
    expect(points).toBeLessThan(club);
  });

  it('keeps a local win plus published-total record under the club unlock', () => {
    const points = sportingReputationFromResult(localWin({ isTotalPr: true })).points;
    expect(points).toBeCloseTo(20, 6);
    expect(points).toBeLessThan(club);
  });

  it('lets a regional peak meet reach club without reaching regional recruit', () => {
    const points = sportingReputationFromResult({
      kind: 'regional',
      totalKg: 600,
      place: 1,
      fieldSize: 16,
      isTotalPr: true,
      newlyQualifiedFor: ['regional'],
    }).points;
    expect(points).toBeCloseTo(56, 6);
    expect(points).toBeGreaterThanOrEqual(club);
    expect(points).toBeLessThan(regionalRecruit);
  });

  it('lets a nationals qualify-for-worlds peak meet stay under a worlds win and under regional recruit', () => {
    const points = sportingReputationFromResult({
      kind: 'nationals',
      totalKg: 700,
      place: 1,
      fieldSize: 16,
      isTotalPr: true,
      newlyQualifiedFor: ['worlds'],
    }).points;
    expect(points).toBeCloseTo(144, 6);
    expect(points).toBeLessThan(regionalRecruit);
    expect(points).toBeLessThan(nationalRecruit);
  });

  it('keeps a worlds win plus record, without a stacked qualify, under regional recruit', () => {
    const points = sportingReputationFromResult({
      kind: 'worlds',
      totalKg: 800,
      place: 1,
      fieldSize: 16,
      isTotalPr: true,
      newlyQualifiedFor: [],
    }).points;
    expect(points).toBeCloseTo(160, 6);
    expect(points).toBeLessThan(regionalRecruit);
    expect(points).toBeLessThan(firstTier as number);
  });

  it('keeps a year of ordinary local wins under daily check-in reputation and under three powerlifters', () => {
    const yearOfLocalWins = 12 * sportingReputationFromResult(localWin()).points;
    expect(yearOfLocalWins).toBeCloseTo(144, 6);
    const dailyCheckIns = T.REPUTATION_PER_CHECK_IN * 365;
    expect(dailyCheckIns).toBe(730);
    expect(yearOfLocalWins).toBeLessThan(dailyCheckIns);
    const threePowerlifters =
      T.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.powerlifter * 3 * 365;
    expect(threePowerlifters).toBeCloseTo(164.25, 6);
    expect(yearOfLocalWins).toBeLessThan(threePowerlifters);
  });
});

describe('composeGymReputationContributions — two grains, named sum', () => {
  it('adds sporting points beside reputationFromMembers without feeding the bonus argument', () => {
    const roster: MemberRoster = [{ type: 'powerlifter', count: 2 }];
    const fromMembers = reputationFromMembers(roster);
    const sporting = sportingReputationFromResult(localWin()).points;
    const composed = composeGymReputationContributions({ sporting, fromMembers });
    expect(composed.fromMembers).toBe(fromMembers);
    expect(composed.sporting).toBe(sporting);
    expect(composed.points).toBeCloseTo(sporting + fromMembers, 6);
    expect(fromMembers).toBeCloseTo(
      2 * T.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.powerlifter,
      6,
    );
  });

  it('does not treat a zero sporting result as erasing the member rate', () => {
    const fromMembers = asReputation(3);
    const composed = composeGymReputationContributions({
      sporting: asReputation(0),
      fromMembers,
    });
    expect(composed.points).toBe(fromMembers);
  });
});

describe('fences — Career progression, NPC roster, Portfolio, wiring', () => {
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('imports only empireCore, empireTuning, and production', () => {
    const specifiers = [...CODE.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*(['"`])([^'"`]+)\1/g)].map(
      (match) => match[2],
    );
    expect(specifiers.sort()).toEqual(['./empireCore', './empireTuning', './production']);
  });

  it('does not import Career, Meet, game, React, or shell', () => {
    expect(CODE).not.toMatch(/from\s+['"][^'"]*(career|meet|game|react|shell)/);
    expect(CODE).not.toMatch(/\bsrc\/(career|meet|game|shell)\b/);
  });

  it('does not write EmpireState.reputation or start a persistent roster', () => {
    expect(CODE).not.toMatch(/EmpireState/);
    expect(CODE).not.toMatch(/beginRecruitment|createNpcLifter|accrueReputation/);
    expect(CODE).not.toMatch(/portfolio|Portfolio/);
  });

  it('does not speed training, raise e1RM, or rewrite a Total', () => {
    expect(CODE).not.toMatch(/e1RM|e1rm|trainingPace|training-pace/);
    expect(CODE).not.toMatch(/meetsQualifyingTotal/);
  });
});
