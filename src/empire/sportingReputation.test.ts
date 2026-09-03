/**
 * sportingReputation.test.ts — Stage E.1 sporting contributor.
 *
 * Pins the corrected input contract, placing share (beating nobody is
 * zero), single qualification, refused inputs, calibration bands, E-REP-01,
 * and the fences this piece must not cross.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { reputationFromMembers } from './members';
import * as sportingRuntime from './sportingReputation';
import {
  sportingReputationFromResult,
  type SportingMeetKind,
  type SportingMeetResult,
  type SportingQualifyRung,
} from './sportingReputation';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = EMPIRE_TUNING;
const S = T.SPORTING_REPUTATION;
const SOURCE = readFileSync(path.join(HERE, 'sportingReputation.ts'), 'utf8');
const MEMBERS_SOURCE = readFileSync(path.join(HERE, 'members.ts'), 'utf8');
const CAREER_FLIGHT = readFileSync(path.join(HERE, '../career/flight.ts'), 'utf8');
const CAREER_RECORD = readFileSync(path.join(HERE, '../career/careerRecord.ts'), 'utf8');

function posted(
  overrides: Partial<Extract<SportingMeetResult, { readonly outcome: 'total' }>> = {},
): SportingMeetResult {
  const placement = overrides.placement ?? { place: 1, categoryFieldSize: 16 };
  return {
    kind: 'local',
    outcome: 'total',
    isTotalPr: false,
    newlyQualifiedFor: null,
    ...overrides,
    placement,
  };
}

function bombed(kind: SportingMeetKind = 'local'): SportingMeetResult {
  return { kind, outcome: 'bombed-out' };
}

function placingPoints(kind: SportingMeetKind, place: number, categoryFieldSize: number): number {
  const scale = S.kindScale[kind];
  if (categoryFieldSize <= 1) return 0;
  const share = (categoryFieldSize - place) / (categoryFieldSize - 1);
  return scale * S.placingUnit * share;
}

describe('sportingReputationFromResult — sporting accomplishment, not participation', () => {
  it('pays nothing for a bomb-out and names the missing total', () => {
    const contribution = sportingReputationFromResult(bombed());
    expect(contribution.points).toBe(0);
    expect(contribution.reasons).toEqual([
      { kind: 'no-total', text: S.copy.noTotal, points: 0 },
    ]);
  });

  it('refuses a bomb-out that tries to place, PR, or qualify', () => {
    expect(() =>
      sportingReputationFromResult({
        kind: 'local',
        outcome: 'bombed-out',
        placement: { place: 1, categoryFieldSize: 16 },
        isTotalPr: true,
        newlyQualifiedFor: 'regional',
      } as never),
    ).toThrow(/bomb-out cannot place/);
  });

  it('does not carry a numerical Total on the input type', () => {
    expect(SOURCE).not.toMatch(/totalKg/);
    expect(SOURCE).not.toMatch(/totalLbs/);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bweight\b/);
  });

  it('names the placement denominator categoryFieldSize, not a flight', () => {
    expect(SOURCE).toMatch(/categoryFieldSize/);
    expect(SOURCE).toMatch(/SAME award category/);
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bfieldSize\b/);
  });

  it('pays zero placing reputation for last of N and for a one-person category', () => {
    const last = sportingReputationFromResult(posted({ placement: { place: 16, categoryFieldSize: 16 } }));
    const only = sportingReputationFromResult(posted({ placement: { place: 1, categoryFieldSize: 1 } }));
    expect(last.reasons[0]?.kind).toBe('placing');
    expect(last.reasons[0]?.points).toBe(0);
    expect(last.points).toBe(0);
    expect(only.reasons[0]?.points).toBe(0);
    expect(only.points).toBe(0);
  });

  it('pays full placing share for first of N>1, and is monotonic in place', () => {
    const first = sportingReputationFromResult(posted({ placement: { place: 1, categoryFieldSize: 16 } }));
    expect(first.points).toBeCloseTo(S.kindScale.local * S.placingUnit, 6);
    const series: number[] = [];
    for (let place = 1; place <= 16; place += 1) {
      series.push(
        sportingReputationFromResult(posted({ placement: { place, categoryFieldSize: 16 } })).points,
      );
    }
    expect(series[0]).toBeGreaterThan(series[1] as number);
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i - 1] as number).toBeGreaterThanOrEqual(series[i] as number);
    }
    expect(series[15]).toBe(0);
    for (let place = 1; place <= 16; place += 1) {
      expect(series[place - 1]).toBeCloseTo(placingPoints('local', place, 16), 6);
    }
  });

  it('keeps PR and qualification independent of a zero placing share', () => {
    const lastWithExtras = sportingReputationFromResult(
      posted({
        placement: { place: 16, categoryFieldSize: 16 },
        isTotalPr: true,
        newlyQualifiedFor: 'regional',
      }),
    );
    expect(lastWithExtras.reasons[0]?.points).toBe(0);
    expect(lastWithExtras.points).toBeCloseTo(
      S.kindScale.local * S.totalPrUnit + S.kindScale.regional * S.qualifyUnit,
      6,
    );
  });

  it('scales placing, record, and qualify by the GDD §6.1 kind ladder', () => {
    expect(Object.keys(S.kindScale).sort()).toEqual([...S.meetKinds].sort());
    expect([...S.meetKinds]).toEqual(['local', 'regional', 'nationals', 'worlds']);
    const local = sportingReputationFromResult(posted({ kind: 'local' })).points;
    const regional = sportingReputationFromResult(posted({ kind: 'regional' })).points;
    const nationals = sportingReputationFromResult(posted({ kind: 'nationals' })).points;
    const worlds = sportingReputationFromResult(posted({ kind: 'worlds' })).points;
    expect(regional).toBeCloseTo(local * (S.kindScale.regional / S.kindScale.local), 6);
    expect(nationals).toBeCloseTo(local * (S.kindScale.nationals / S.kindScale.local), 6);
    expect(worlds).toBeCloseTo(local * (S.kindScale.worlds / S.kindScale.local), 6);
    expect(local).toBeLessThan(regional);
    expect(regional).toBeLessThan(nationals);
    expect(nationals).toBeLessThan(worlds);
  });

  it('adds a published-total record as its own named term', () => {
    const plain = sportingReputationFromResult(posted({ isTotalPr: false }));
    const record = sportingReputationFromResult(posted({ isTotalPr: true }));
    expect(record.points - plain.points).toBeCloseTo(S.kindScale.local * S.totalPrUnit, 6);
    expect(record.reasons.map((row) => row.kind)).toEqual(['placing', 'total-pr']);
    expect(record.reasons[1]?.text).toContain('Raised published best total');
  });

  it('adds a single qualification using the standing achieved, not a stack', () => {
    const plain = sportingReputationFromResult(posted());
    const qualified = sportingReputationFromResult(posted({ newlyQualifiedFor: 'regional' }));
    expect(qualified.points - plain.points).toBeCloseTo(S.kindScale.regional * S.qualifyUnit, 6);
    expect(qualified.reasons[qualified.reasons.length - 1]?.text).toBe(
      'Newly qualified for regional',
    );
    expect(SOURCE).not.toMatch(/newlyQualifiedFor:\s*readonly/);
    expect(SOURCE).toMatch(/newlyQualifiedFor:\s*SportingQualifyRung \| null/);
  });

  it('refuses invented kinds, empty categories, qualify-local, and stacked qualify arrays', () => {
    expect(() => sportingReputationFromResult(posted({ kind: 'open' as never }))).toThrow(
      /meet kind/,
    );
    expect(() =>
      sportingReputationFromResult(posted({ placement: { place: 1, categoryFieldSize: 0 } })),
    ).toThrow(/positive whole number/);
    expect(() =>
      sportingReputationFromResult(posted({ newlyQualifiedFor: 'local' as never })),
    ).toThrow(/qualify rung/);
    expect(() =>
      sportingReputationFromResult(
        posted({ newlyQualifiedFor: ['regional', 'nationals'] as never }),
      ),
    ).toThrow(/qualify rung/);
  });

  it('is deterministic and names why the number moved, per term', () => {
    const input = posted({ isTotalPr: true, newlyQualifiedFor: 'regional' });
    const a = sportingReputationFromResult(input);
    const b = sportingReputationFromResult(input);
    expect(a).toEqual(b);
    expect(a.reasons.map((row) => row.kind)).toEqual(['placing', 'total-pr', 'qualify']);
    expect(a.reasons[0]?.text).toBe('Placed 1 of 16 in category at a local meet');
    expect(a.reasons.every((row) => row.text.length > 0)).toBe(true);
    const named = a.reasons.reduce((sum, row) => sum + row.points, 0);
    expect(a.points).toBeCloseTo(named, 6);
  });
});

describe('Career source contract — facts the crossing must compose, not import', () => {
  it('Career flight source says a flight is not an award category', () => {
    expect(CAREER_FLIGHT).toMatch(/A FLIGHT IS NOT AN AWARD CATEGORY/);
    expect(CAREER_FLIGHT).toMatch(/readonly categoryId: string/);
    expect(CAREER_FLIGHT).toMatch(/place` is a place WITHIN `categoryId`/);
  });

  it('Career standing unlock is one resulting to-tier, not a stacked list', () => {
    expect(CAREER_RECORD).toMatch(/export function tierUnlockBetween/);
    expect(CAREER_RECORD).toMatch(/kind: 'tier-unlocked'/);
    expect(CAREER_RECORD).toMatch(/readonly to: CareerTier/);
  });
});

describe('no grain-mixing composer, no member-bonus trap', () => {
  it('does not export a member-rate plus event-delta composer', () => {
    expect(SOURCE).not.toMatch(/composeGymReputationContributions/);
    expect(SOURCE).not.toMatch(/ComposedGymReputationContribution/);
    expect(Object.keys(sportingRuntime).sort()).toEqual(['sportingReputationFromResult']);
  });

  it('reputationFromMembers has no competition-result bonus argument', () => {
    expect(MEMBERS_SOURCE).not.toMatch(/competitionResultReputationBonus/);
    expect(reputationFromMembers.length).toBe(1);
    expect(reputationFromMembers([{ type: 'powerlifter', count: 2 }])).toBeCloseTo(
      2 * T.MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY.powerlifter,
      6,
    );
  });
});

/**
 * Shipped band is CONSERVATIVE. SPORT-HEAVY is pinned as the viable
 * alternative a human may still choose; it is not silent defaulting.
 *
 * Peak = first of 16 in category, plus Total PR, plus at most one qualify.
 */
const CONSERVATIVE_PEAK = Object.freeze({
  local: 24,
  localPr: 40,
  regional: 112,
  nationals: 288,
  worlds: 320,
  twelveLocal: 288,
});

const SPORT_HEAVY_WORLDS_SCALE = 16;
const SPORT_HEAVY_PEAK = Object.freeze({
  local: 24,
  localPr: 40,
  regional: 112,
  nationals: 416,
  worlds: 640,
  twelveLocal: 288,
});

describe('calibration — conservative shipped, sport-heavy documented', () => {
  const club = T.NPC_RECRUIT_REPUTATION_THRESHOLD.club;
  const regionalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.regional;
  const nationalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.national;
  const legendary = T.NPC_RECRUIT_REPUTATION_THRESHOLD.legendary;
  const firstTier = T.REPUTATION_TIER_THRESHOLDS[1] as number;

  it('ships the conservative band: worlds crosses 250 and stays under national recruit', () => {
    const local = sportingReputationFromResult(posted()).points;
    const localPr = sportingReputationFromResult(posted({ isTotalPr: true })).points;
    const regional = sportingReputationFromResult(
      posted({
        kind: 'regional',
        isTotalPr: true,
        newlyQualifiedFor: 'regional',
      }),
    ).points;
    const nationals = sportingReputationFromResult(
      posted({
        kind: 'nationals',
        isTotalPr: true,
        newlyQualifiedFor: 'worlds',
      }),
    ).points;
    const worlds = sportingReputationFromResult(
      posted({ kind: 'worlds', isTotalPr: true }),
    ).points;
    const twelveLocal = 12 * local;

    expect(local).toBeCloseTo(CONSERVATIVE_PEAK.local, 6);
    expect(localPr).toBeCloseTo(CONSERVATIVE_PEAK.localPr, 6);
    expect(regional).toBeCloseTo(CONSERVATIVE_PEAK.regional, 6);
    expect(nationals).toBeCloseTo(CONSERVATIVE_PEAK.nationals, 6);
    expect(worlds).toBeCloseTo(CONSERVATIVE_PEAK.worlds, 6);
    expect(twelveLocal).toBeCloseTo(CONSERVATIVE_PEAK.twelveLocal, 6);

    expect(local).toBeLessThan(club);
    expect(localPr).toBeLessThan(club);
    expect(regional).toBeGreaterThan(local);
    expect(worlds).toBeGreaterThan(firstTier);
    expect(worlds).toBeGreaterThan(regionalRecruit);
    expect(worlds).toBeLessThan(nationalRecruit);
    expect(worlds).toBeLessThan(legendary);
    expect(worlds).toBeLessThan(T.REPUTATION_MAX);
  });

  it('records the sport-heavy band: worlds may cross 600 and stays under legendary', () => {
    const placing = S.placingUnit;
    const pr = S.totalPrUnit;
    const qualify = S.qualifyUnit;
    const localScale = S.kindScale.local;
    const regionalScale = S.kindScale.regional;
    const nationalsScale = S.kindScale.nationals;
    expect(localScale * placing).toBeCloseTo(SPORT_HEAVY_PEAK.local, 6);
    expect(localScale * (placing + pr)).toBeCloseTo(SPORT_HEAVY_PEAK.localPr, 6);
    expect(regionalScale * (placing + pr + qualify)).toBeCloseTo(SPORT_HEAVY_PEAK.regional, 6);
    expect(
      nationalsScale * (placing + pr) + SPORT_HEAVY_WORLDS_SCALE * qualify,
    ).toBeCloseTo(SPORT_HEAVY_PEAK.nationals, 6);
    expect(SPORT_HEAVY_WORLDS_SCALE * (placing + pr)).toBeCloseTo(SPORT_HEAVY_PEAK.worlds, 6);
    expect(SPORT_HEAVY_PEAK.worlds).toBeGreaterThan(nationalRecruit);
    expect(SPORT_HEAVY_PEAK.worlds).toBeLessThan(legendary);
    expect(SPORT_HEAVY_PEAK.worlds).toBeLessThan(T.REPUTATION_MAX);
  });

  it('records E-REP-01 without retuning check-in reputation', () => {
    expect(T.REPUTATION_PER_CHECK_IN).toBe(2);
    const yearOfCheckIns = T.REPUTATION_PER_CHECK_IN * 365;
    expect(yearOfCheckIns).toBe(730);
    expect(SOURCE).toMatch(/E-REP-01/);
    const worlds = sportingReputationFromResult(posted({ kind: 'worlds', isTotalPr: true })).points;
    expect(worlds).toBeGreaterThan(firstTier);
    expect(legendary).toBe(1500);
  });

  it('cannot cross national recruit at the shipped worlds/local ratio without blowing past club', () => {
    const worldsLocalRatio = S.kindScale.worlds / S.kindScale.local;
    expect(worldsLocalRatio).toBe(8);
    const localPr = S.placingUnit + S.totalPrUnit;
    expect(worldsLocalRatio * localPr).toBeLessThan(nationalRecruit);
    expect(nationalRecruit / worldsLocalRatio).toBeGreaterThan(club);
    expect(SPORT_HEAVY_WORLDS_SCALE / S.kindScale.local).toBeGreaterThan(worldsLocalRatio);
  });
});

/**
 * Bounded search over kindScale.worlds × placingUnit × totalPrUnit × qualifyUnit.
 * Local/regional/nationals scales stay the GDD §6.1 doubling 1/2/4.
 *
 * Bands:
 *   conservative — worlds peak in (250, 600)
 *   sport-heavy — worlds peak in [600, 1500)
 * Rejected when local+PR ≥ club 50, worlds ≥ legendary 1500, or worlds ≤ first
 * sponsor tier 250. The grid's placing max is 40 so local-alone never hits
 * club; REPUTATION_MAX 5000 is never approached (max worlds peak 2048).
 */
const SENSITIVITY_PLACING = [12, 16, 20, 24, 32, 40] as const;
const SENSITIVITY_PR = [8, 12, 16, 20, 24] as const;
const SENSITIVITY_QUALIFY = [8, 12, 16, 20] as const;
const SENSITIVITY_WORLDS = [4, 8, 12, 16, 20, 32] as const;

type SensitivityBand =
  | 'conservative'
  | 'sport-heavy'
  | 'rejected-below-sponsor'
  | 'rejected-localpr-club'
  | 'rejected-legendary';

function sensitivityPeaks(
  worldsScale: number,
  placing: number,
  pr: number,
  qualify: number,
): {
  readonly local: number;
  readonly localPr: number;
  readonly regional: number;
  readonly nationals: number;
  readonly worlds: number;
  readonly twelveLocal: number;
} {
  return {
    local: placing,
    localPr: placing + pr,
    regional: 2 * (placing + pr + qualify),
    nationals: 4 * (placing + pr) + worldsScale * qualify,
    worlds: worldsScale * (placing + pr),
    twelveLocal: 12 * placing,
  };
}

function classifySensitivityBand(worlds: number, localPr: number): SensitivityBand {
  const club = T.NPC_RECRUIT_REPUTATION_THRESHOLD.club;
  const firstTier = T.REPUTATION_TIER_THRESHOLDS[1] as number;
  const nationalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.national;
  const legendary = T.NPC_RECRUIT_REPUTATION_THRESHOLD.legendary;
  if (localPr >= club) return 'rejected-localpr-club';
  if (worlds >= legendary) return 'rejected-legendary';
  if (worlds > firstTier && worlds < nationalRecruit) return 'conservative';
  if (worlds >= nationalRecruit && worlds < legendary) return 'sport-heavy';
  return 'rejected-below-sponsor';
}

describe('calibration sensitivity grid — both bands remain viable', () => {
  it('enumerates 720 cells and pins the band census, including the empty ones', () => {
    const tallies: Record<SensitivityBand, number> = {
      conservative: 0,
      'sport-heavy': 0,
      'rejected-below-sponsor': 0,
      'rejected-localpr-club': 0,
      'rejected-legendary': 0,
    };
    let cells = 0;
    let maxWorlds = 0;
    for (const placing of SENSITIVITY_PLACING) {
      for (const pr of SENSITIVITY_PR) {
        for (const qualify of SENSITIVITY_QUALIFY) {
          for (const worldsScale of SENSITIVITY_WORLDS) {
            const peak = sensitivityPeaks(worldsScale, placing, pr, qualify);
            tallies[classifySensitivityBand(peak.worlds, peak.localPr)] += 1;
            cells += 1;
            if (peak.worlds > maxWorlds) maxWorlds = peak.worlds;
          }
        }
      }
    }
    expect(cells).toBe(720);
    expect(tallies).toEqual({
      conservative: 244,
      'sport-heavy': 196,
      'rejected-below-sponsor': 124,
      'rejected-localpr-club': 144,
      'rejected-legendary': 12,
    });
    expect(maxWorlds).toBe(2048);
    expect(maxWorlds).toBeLessThan(T.REPUTATION_MAX);
    expect(
      classifySensitivityBand(
        sensitivityPeaks(S.kindScale.worlds, S.placingUnit, S.totalPrUnit, S.qualifyUnit).worlds,
        S.placingUnit + S.totalPrUnit,
      ),
    ).toBe('conservative');
    expect(
      classifySensitivityBand(
        sensitivityPeaks(SPORT_HEAVY_WORLDS_SCALE, S.placingUnit, S.totalPrUnit, S.qualifyUnit)
          .worlds,
        S.placingUnit + S.totalPrUnit,
      ),
    ).toBe('sport-heavy');
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
    expect(CODE).not.toMatch(/DOTS|dots/);
    expect(CODE).not.toMatch(/gymBucks|trainingIq/);
  });

  it('is a pure calculator: no clock, network, randomness, or React', () => {
    expect(CODE).not.toMatch(/\bDate\b/);
    expect(CODE).not.toMatch(/Math\.random/);
    expect(CODE).not.toMatch(/\bfetch\b/);
    expect(CODE).not.toMatch(/from\s+['"]react['"]/);
  });
});
