/**
 * sportingReputation.test.ts — Stage E sporting contributor.
 *
 * Pins the accepted Stage E contract, placing share, qualification truth,
 * SPORT-HEAVY calibration, E-REP-01 (still open), the Stage E CLOSED mint,
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

  it('refuses invented kinds, empty categories, and qualify-local', () => {
    expect(() => sportingReputationFromResult(posted({ kind: 'open' as never }))).toThrow(
      /meet kind/,
    );
    expect(() =>
      sportingReputationFromResult(posted({ placement: { place: 1, categoryFieldSize: 0 } })),
    ).toThrow(/positive whole number/);
    expect(() =>
      sportingReputationFromResult(posted({ newlyQualifiedFor: 'local' as never })),
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

describe('qualification runtime — no coercion, rung strictly outranks meet kind', () => {
  it('does not coerce newlyQualifiedFor through String()', () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/isSportingQualifyRung\(\s*String\s*\(/);
    expect(code).toMatch(/typeof rung !== 'string'/);
  });

  it('refuses a single-element array that would stringify into a valid rung', () => {
    expect(String(['regional'])).toBe('regional');
    expect(() =>
      sportingReputationFromResult(posted({ newlyQualifiedFor: ['regional'] as never })),
    ).toThrow(/must be null or a sporting qualify rung/);
  });

  it('refuses a multi-element qualification array', () => {
    expect(() =>
      sportingReputationFromResult(
        posted({ newlyQualifiedFor: ['regional', 'nationals'] as never }),
      ),
    ).toThrow(/must be null or a sporting qualify rung/);
  });

  it('refuses object, number, and boolean qualification values', () => {
    expect(() =>
      sportingReputationFromResult(posted({ newlyQualifiedFor: {} as never })),
    ).toThrow(/must be null or a sporting qualify rung/);
    expect(() =>
      sportingReputationFromResult(posted({ newlyQualifiedFor: 1 as never })),
    ).toThrow(/must be null or a sporting qualify rung/);
    expect(() =>
      sportingReputationFromResult(posted({ newlyQualifiedFor: true as never })),
    ).toThrow(/must be null or a sporting qualify rung/);
  });

  it('refuses every illegal same-tier or lower-tier qualification pair', () => {
    const illegal: readonly (readonly [SportingMeetKind, unknown])[] = [
      ['regional', 'regional'],
      ['regional', 'local'],
      ['nationals', 'regional'],
      ['nationals', 'nationals'],
      ['worlds', 'regional'],
      ['worlds', 'nationals'],
      ['worlds', 'worlds'],
    ];
    expect(illegal).toHaveLength(7);
    for (const [kind, rung] of illegal) {
      expect(
        () => sportingReputationFromResult(posted({ kind, newlyQualifiedFor: rung as never })),
        `${kind} → ${String(rung)} must refuse`,
      ).toThrow(/qualify rung|not a new standing/);
    }
  });

  it('accepts next-rung qualification and legal jumps', () => {
    const legal: readonly (readonly [SportingMeetKind, SportingQualifyRung, number])[] = [
      ['local', 'regional', S.kindScale.regional * S.qualifyUnit],
      ['local', 'nationals', S.kindScale.nationals * S.qualifyUnit],
      ['local', 'worlds', S.kindScale.worlds * S.qualifyUnit],
      ['regional', 'nationals', S.kindScale.nationals * S.qualifyUnit],
      ['regional', 'worlds', S.kindScale.worlds * S.qualifyUnit],
      ['nationals', 'worlds', S.kindScale.worlds * S.qualifyUnit],
    ];
    expect(legal).toHaveLength(6);
    for (const [kind, rung, qualifyPoints] of legal) {
      const contribution = sportingReputationFromResult(
        posted({ kind, newlyQualifiedFor: rung }),
      );
      expect(contribution.reasons.map((row) => row.kind)).toEqual(['placing', 'qualify']);
      expect(contribution.reasons[1]?.points).toBeCloseTo(qualifyPoints, 6);
      expect(contribution.points).toBeCloseTo(S.kindScale[kind] * S.placingUnit + qualifyPoints, 6);
    }
  });

  it('a worlds result may only qualify as null', () => {
    const title = sportingReputationFromResult(
      posted({ kind: 'worlds', newlyQualifiedFor: null }),
    );
    expect(title.reasons.map((row) => row.kind)).toEqual(['placing']);
    expect(() =>
      sportingReputationFromResult(posted({ kind: 'worlds', newlyQualifiedFor: 'worlds' })),
    ).toThrow(/not a new standing/);
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
 * Shipped band is SPORT-HEAVY (human ruling). Conservative (worlds 8)
 * is investigation history, not a recommendation.
 *
 * Title-only and extras are pinned separately. PR and qualification are
 * contingent; a championship must have coherent value on its own.
 * Fixtures are reachable under Career eligibility (a result may not newly
 * qualify for its own meet tier or a lower one).
 */
const SHIPPED = Object.freeze({
  localWin: 24,
  localPr: 40,
  localQualify: 56,
  localPrQualify: 72,
  regionalTitle: 48,
  regionalQualify: 112,
  regionalNextRungPeak: 144,
  nationalsTitle: 96,
  nationalsQualify: 352,
  nationalsPeak: 416,
  worldsTitle: 384,
  worldsPr: 640,
  twelveLocal: 288,
});

const DISCARDED_CONSERVATIVE_WORLDS_SCALE = 8;

describe('calibration — SPORT-HEAVY shipped; title-only distinct from extras', () => {
  const club = T.NPC_RECRUIT_REPUTATION_THRESHOLD.club;
  const regionalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.regional;
  const nationalRecruit = T.NPC_RECRUIT_REPUTATION_THRESHOLD.national;
  const legendary = T.NPC_RECRUIT_REPUTATION_THRESHOLD.legendary;
  const firstTier = T.REPUTATION_TIER_THRESHOLDS[1] as number;

  it('ships SPORT-HEAVY kindScale and formula units', () => {
    expect(S.kindScale).toEqual({ local: 1, regional: 2, nationals: 4, worlds: 16 });
    expect(S.placingUnit).toBe(24);
    expect(S.totalPrUnit).toBe(16);
    expect(S.qualifyUnit).toBe(16);
  });

  it('pins title-only results separately from PR and qualification', () => {
    const localWin = sportingReputationFromResult(posted({ kind: 'local' }));
    const localPr = sportingReputationFromResult(posted({ kind: 'local', isTotalPr: true }));
    const localQualify = sportingReputationFromResult(
      posted({ kind: 'local', newlyQualifiedFor: 'regional' }),
    );
    const localPrQualify = sportingReputationFromResult(
      posted({ kind: 'local', isTotalPr: true, newlyQualifiedFor: 'regional' }),
    );
    const regionalTitle = sportingReputationFromResult(posted({ kind: 'regional' }));
    const regionalQualify = sportingReputationFromResult(
      posted({ kind: 'regional', newlyQualifiedFor: 'nationals' }),
    );
    const regionalPeak = sportingReputationFromResult(
      posted({ kind: 'regional', isTotalPr: true, newlyQualifiedFor: 'nationals' }),
    );
    const nationalsTitle = sportingReputationFromResult(posted({ kind: 'nationals' }));
    const nationalsQualify = sportingReputationFromResult(
      posted({ kind: 'nationals', newlyQualifiedFor: 'worlds' }),
    );
    const nationalsPeak = sportingReputationFromResult(
      posted({ kind: 'nationals', isTotalPr: true, newlyQualifiedFor: 'worlds' }),
    );
    const worldsTitle = sportingReputationFromResult(posted({ kind: 'worlds' }));
    const worldsPr = sportingReputationFromResult(posted({ kind: 'worlds', isTotalPr: true }));

    expect(localWin.points).toBeCloseTo(SHIPPED.localWin, 6);
    expect(localPr.points).toBeCloseTo(SHIPPED.localPr, 6);
    expect(localQualify.points).toBeCloseTo(SHIPPED.localQualify, 6);
    expect(localPrQualify.points).toBeCloseTo(SHIPPED.localPrQualify, 6);
    expect(regionalTitle.points).toBeCloseTo(SHIPPED.regionalTitle, 6);
    expect(regionalQualify.points).toBeCloseTo(SHIPPED.regionalQualify, 6);
    expect(regionalPeak.points).toBeCloseTo(SHIPPED.regionalNextRungPeak, 6);
    expect(nationalsTitle.points).toBeCloseTo(SHIPPED.nationalsTitle, 6);
    expect(nationalsQualify.points).toBeCloseTo(SHIPPED.nationalsQualify, 6);
    expect(nationalsPeak.points).toBeCloseTo(SHIPPED.nationalsPeak, 6);
    expect(worldsTitle.points).toBeCloseTo(SHIPPED.worldsTitle, 6);
    expect(worldsPr.points).toBeCloseTo(SHIPPED.worldsPr, 6);
    expect(12 * localWin.points).toBeCloseTo(SHIPPED.twelveLocal, 6);

    expect(localWin.reasons.map((row) => row.kind)).toEqual(['placing']);
    expect(worldsTitle.reasons.map((row) => row.kind)).toEqual(['placing']);
    expect(worldsPr.reasons.map((row) => row.kind)).toEqual(['placing', 'total-pr']);
    expect(nationalsTitle.reasons.map((row) => row.kind)).toEqual(['placing']);
    expect(nationalsQualify.reasons.map((row) => row.kind)).toEqual(['placing', 'qualify']);
    expect(regionalTitle.reasons.map((row) => row.kind)).toEqual(['placing']);
    expect(regionalQualify.reasons.map((row) => row.kind)).toEqual(['placing', 'qualify']);
  });

  it('reason rows sum to the contribution', () => {
    const peak = sportingReputationFromResult(
      posted({ kind: 'nationals', isTotalPr: true, newlyQualifiedFor: 'worlds' }),
    );
    const named = peak.reasons.reduce((sum, row) => sum + row.points, 0);
    expect(peak.points).toBeCloseTo(named, 6);
    expect(peak.points).toBeCloseTo(SHIPPED.nationalsPeak, 6);
  });

  it('a Worlds title is institutionally meaningful without a Total PR', () => {
    const worldsTitle = sportingReputationFromResult(posted({ kind: 'worlds' })).points;
    const worldsPr = sportingReputationFromResult(
      posted({ kind: 'worlds', isTotalPr: true }),
    ).points;
    const localPr = sportingReputationFromResult(posted({ isTotalPr: true })).points;

    expect(worldsTitle).toBe(SHIPPED.worldsTitle);
    expect(worldsPr).toBe(SHIPPED.worldsPr);
    expect(worldsTitle).toBeGreaterThan(regionalRecruit);
    expect(worldsTitle).toBeGreaterThan(firstTier);
    expect(worldsTitle).toBeLessThan(nationalRecruit);
    expect(worldsPr).toBeGreaterThan(nationalRecruit);
    expect(worldsPr).toBeLessThan(legendary);
    expect(worldsPr).toBeLessThan(T.REPUTATION_MAX);
    expect(localPr).toBeLessThan(club);
    expect(legendary).toBe(1500);
  });

  it('records discarded conservative worldsScale 8 as history, not the shipped band', () => {
    const placing = S.placingUnit;
    const pr = S.totalPrUnit;
    expect(DISCARDED_CONSERVATIVE_WORLDS_SCALE * placing).toBe(192);
    expect(DISCARDED_CONSERVATIVE_WORLDS_SCALE * (placing + pr)).toBe(320);
    expect(DISCARDED_CONSERVATIVE_WORLDS_SCALE * placing).toBeLessThan(regionalRecruit);
    expect(S.kindScale.worlds).not.toBe(DISCARDED_CONSERVATIVE_WORLDS_SCALE);
    expect(S.kindScale.worlds * placing).toBe(SHIPPED.worldsTitle);
  });

  it('records E-REP-01 without retuning check-in reputation', () => {
    expect(T.REPUTATION_PER_CHECK_IN).toBe(2);
    const yearOfCheckIns = T.REPUTATION_PER_CHECK_IN * 365;
    expect(yearOfCheckIns).toBe(730);
    expect(SOURCE).toMatch(/E-REP-01/);
    const worldsTitle = sportingReputationFromResult(posted({ kind: 'worlds' })).points;
    const worldsPr = sportingReputationFromResult(
      posted({ kind: 'worlds', isTotalPr: true }),
    ).points;
    expect(worldsTitle).toBe(SHIPPED.worldsTitle);
    expect(worldsPr).toBe(SHIPPED.worldsPr);
    expect(worldsTitle).toBeGreaterThan(firstTier);
    expect(yearOfCheckIns).toBeGreaterThan(worldsPr);
    expect(legendary).toBe(1500);
  });
});

/**
 * Bounded search over kindScale.worlds × placingUnit × totalPrUnit × qualifyUnit.
 * Local/regional/nationals scales stay the GDD §6.1 doubling 1/2/4.
 *
 * Bands (history of the search; shipped is sport-heavy):
 *   conservative — worlds peak in (250, 600) — discarded for the product
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

describe('calibration sensitivity grid — conservative discarded, sport-heavy shipped', () => {
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
    ).toBe('sport-heavy');
    expect(
      classifySensitivityBand(
        sensitivityPeaks(
          DISCARDED_CONSERVATIVE_WORLDS_SCALE,
          S.placingUnit,
          S.totalPrUnit,
          S.qualifyUnit,
        ).worlds,
        S.placingUnit + S.totalPrUnit,
      ),
    ).toBe('conservative');
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

const STAGE_E_RUNTIME_SHA = 'b91a84c19fcf561051ec0d651aeda31addd3e882';
const GDD = readFileSync(path.join(HERE, '..', '..', 'docs', 'GDD.md'), 'utf8');

describe('Stage E mint — CLOSED; wiring still blocked', () => {
  it('records Stage E CLOSED at the accepted runtime SHA', () => {
    expect(GDD).toMatch(/STAGE E CLOSED — SPORTING REPUTATION FOUNDATION ACCEPTED \/ WIRING STILL\s+BLOCKED/);
    expect(GDD).toContain(STAGE_E_RUNTIME_SHA);
    expect(GDD).toContain('sportingReputationFromResult');
    expect(GDD).not.toMatch(/Stage E is the next authorized stage/);
    expect(GDD).not.toMatch(/Stage E \(reputation feed foundation\) is authorized from this SHA/);
  });

  it('freezes SPORT-HEAVY as the accepted sporting band', () => {
    expect(S.kindScale).toEqual({ local: 1, regional: 2, nationals: 4, worlds: 16 });
    expect(S.placingUnit).toBe(24);
    expect(S.totalPrUnit).toBe(16);
    expect(S.qualifyUnit).toBe(16);
    expect(SHIPPED).toEqual({
      localWin: 24,
      localPr: 40,
      localQualify: 56,
      localPrQualify: 72,
      regionalTitle: 48,
      regionalQualify: 112,
      regionalNextRungPeak: 144,
      nationalsTitle: 96,
      nationalsQualify: 352,
      nationalsPeak: 416,
      worldsTitle: 384,
      worldsPr: 640,
      twelveLocal: 288,
    });
    expect(GDD).toMatch(/12 local titles 288/);
    expect(GDD).toMatch(/worlds title 384; \+PR 640/);
  });

  it('leaves E-REP-01 open and does not retune check-in reputation', () => {
    expect(T.REPUTATION_PER_CHECK_IN).toBe(2);
    expect(T.REPUTATION_PER_CHECK_IN * 365).toBe(730);
    expect(GDD).toMatch(/E-REP-01 CHECK-IN REPUTATION SEMANTIC DEBT/);
    expect(GDD).toMatch(/The Stage E\s+mint leaves E-REP-01 open/);
    expect(GDD).toMatch(/does not retune `REPUTATION_PER_CHECK_IN`/);
  });

  it('keeps D2 frozen and D2-CONSEQUENCE-01 authoritative', () => {
    expect(GDD).toMatch(/D2 CLOSED — PARTIAL BY DESIGN \/ CONSEQUENCE BOUNDARY REACHED/);
    expect(GDD).toMatch(/D2-CONSEQUENCE-01 remains true/);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.quality).toBe(120);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.capacity).toBe(180);
    expect(T.STATION_UPGRADE_COST_GYM_BUCKS.throughput).toBe(30);
    expect(T.FLOOR_SIM_STATION_CHANGEOVER_TICKS).toBe(18);
    expect(T.STATION_THROUGHPUT_CHANGEOVER_TICKS).toBe(6);
    expect(T.STATION_STOCK_TRAINING_EXPERIENCE).toBe(1);
    expect(T.STATION_QUALITY_TRAINING_EXPERIENCE).toBe(2);
    expect(T.STATION_QUALITY_AFFINITY_BONUS).toBe(0.25);
    expect(T.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage).toBe(60);
    expect(T.OFFLINE_EARNINGS_FRACTION).toBe(0.5);
  });

  it('keeps Career/Meet write, Portfolio, and persistent NPC roster blocked', () => {
    expect(GDD).toMatch(/Closing Stage E does not authorize a\s+Career or Meet result writing `EmpireState\.reputation`/);
    expect(GDD).toMatch(/Wiring remains blocked/);
    expect(GDD).toMatch(/Portfolio remain blocked/);
    expect(GDD).toMatch(/Persistent\s+NPC roster\/tenure \(Stage G\) and Portfolio remain blocked/);
    expect(Object.keys(sportingRuntime).sort()).toEqual(['sportingReputationFromResult']);
    expect(SOURCE).not.toMatch(/composeGymReputationContributions/);
    expect(SOURCE).not.toMatch(/EmpireState/);
    expect(SOURCE).not.toMatch(/portfolio|Portfolio/);
    expect(SOURCE).not.toMatch(/beginRecruitment|createNpcLifter/);
  });
});
