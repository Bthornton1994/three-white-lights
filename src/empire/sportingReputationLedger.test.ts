/**
 * sportingReputationLedger.test.ts — CAREER-EMPIRE-REP-01 write side.
 *
 * Adapter, ledger, fail-closed unknown meet, identity replay, rewind
 * stamp, and the fences this crossing must not cross.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { MEET_LOCAL } from '../game/meetTuning';
import { sportingReputationFromResult } from './sportingReputation';
import {
  createSportingReputationLedger,
  creditSportingResult,
  lastSportingReputationEntry,
  sportingMeetResultFromPlayedFacts,
  type PlayedMeetFacts,
  type SportingReputationLedger,
} from './sportingReputationLedger';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(HERE, 'sportingReputationLedger.ts'), 'utf8');
const GDD = readFileSync(path.join(HERE, '..', '..', 'docs', 'GDD.md'), 'utf8');
const S = EMPIRE_TUNING.SPORTING_REPUTATION;

function postedFacts(
  overrides: Partial<PlayedMeetFacts> & {
    readonly placing?: PlayedMeetFacts['placing'];
  } = {},
): PlayedMeetFacts {
  return {
    totalKg: 600,
    isTotalPr: false,
    placing: { place: 1, fieldSize: 16 },
    ...overrides,
  };
}

function bombedFacts(
  overrides: Partial<PlayedMeetFacts> = {},
): PlayedMeetFacts {
  return {
    totalKg: null,
    isTotalPr: false,
    placing: { place: null, fieldSize: 16 },
    ...overrides,
  };
}

describe('sportingMeetResultFromPlayedFacts — Stage E input from played facts', () => {
  it('maps a posted total onto outcome, placement, isTotalPr, and newlyQualifiedFor', () => {
    const result = sportingMeetResultFromPlayedFacts(
      postedFacts({ isTotalPr: true }),
      'local',
      'regional',
    );
    expect(result).toEqual({
      kind: 'local',
      outcome: 'total',
      placement: { place: 1, categoryFieldSize: 16 },
      isTotalPr: true,
      newlyQualifiedFor: 'regional',
    });
  });

  it('maps a bomb-out without placement, PR, or qualify keys', () => {
    const result = sportingMeetResultFromPlayedFacts(bombedFacts(), 'local', null);
    expect(result).toEqual({ kind: 'local', outcome: 'bombed-out' });
    expect(Object.keys(result).sort()).toEqual(['kind', 'outcome']);
  });

  it('refuses a total with place === null', () => {
    expect(() =>
      sportingMeetResultFromPlayedFacts(
        postedFacts({ placing: { place: null, fieldSize: 16 } }),
        'local',
        null,
      ),
    ).toThrow(/posted total carries a category placement/);
  });

  it('refuses a bomb-out with a place', () => {
    expect(() =>
      sportingMeetResultFromPlayedFacts(
        bombedFacts({ placing: { place: 1, fieldSize: 16 } }),
        'local',
        null,
      ),
    ).toThrow(/bomb-out cannot place/);
  });

  it('refuses a non-integer or zero field', () => {
    expect(() =>
      sportingMeetResultFromPlayedFacts(
        postedFacts({ placing: { place: 1, fieldSize: 0 } }),
        'local',
        null,
      ),
    ).toThrow(/fieldSize must be a positive whole number/);
    expect(() =>
      sportingMeetResultFromPlayedFacts(
        postedFacts({ placing: { place: 1, fieldSize: 1.5 } }),
        'local',
        null,
      ),
    ).toThrow(/fieldSize must be a positive whole number/);
  });

  it('refuses place above fieldSize', () => {
    expect(() =>
      sportingMeetResultFromPlayedFacts(
        postedFacts({ placing: { place: 17, fieldSize: 16 } }),
        'local',
        null,
      ),
    ).toThrow(/place must be a whole number from 1 to fieldSize/);
  });

  it('does not carry a numeric Total on the Stage E output type', () => {
    const result = sportingMeetResultFromPlayedFacts(postedFacts(), 'local', null);
    // @ts-expect-error — adapter output carries no numeric Total
    expect(result.totalKg).toBeUndefined();
  });

  it('source does not treat DOTS, e1RM, Gym Bucks, Training IQ, or a qualifying Total as reputation', () => {
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/dots|e1rm|gymBucks|trainingIq|meetsQualifyingTotal/i);
  });
});

describe('playedMeetKindById — two-way pin against the local field of 16', () => {
  it('maps the played local meet to local, and that field is 16 beside the GDD calibration line', () => {
    expect(MEET_LOCAL.id).toBe('local-open-2026');
    expect(S.playedMeetKindById['local-open-2026']).toBe('local');
    expect(MEET_LOCAL.ghostTotalsKg.length + 1).toBe(16);
    expect(GDD).toMatch(/first of 16 in\s+category/);
  });
});

describe('creditSportingResult — ledger', () => {
  it('opens at zero with no entries', () => {
    const ledger = createSportingReputationLedger();
    expect(ledger).toEqual({ creditedReputation: 0, entries: [] });
    expect(lastSportingReputationEntry(ledger)).toBeNull();
  });

  it('credits first-of-16 plus PR at local as +40 with placing and total-pr reasons', () => {
    const facts = postedFacts({ isTotalPr: true });
    const credited = creditSportingResult(
      createSportingReputationLedger(),
      MEET_LOCAL.id,
      facts,
      12,
      null,
    );
    const direct = sportingReputationFromResult(
      sportingMeetResultFromPlayedFacts(facts, 'local', null),
    );
    expect(credited.report?.kind).toBe('credited');
    expect(credited.ledger.creditedReputation).toBe(40);
    expect(direct.points).toBe(40);
    expect(credited.report).toMatchObject({
      kind: 'credited',
      meetId: MEET_LOCAL.id,
      points: 40,
    });
    expect(credited.report && credited.report.kind === 'credited' ? credited.report.reasons : []).toEqual([
      { kind: 'placing', text: S.copy.placing.replace('{place}', '1').replace('{field}', '16').replace('{kind}', 'local'), points: 24 },
      { kind: 'total-pr', text: S.copy.totalPr.replace('{kind}', 'local'), points: 16 },
    ]);
    const entry = lastSportingReputationEntry(credited.ledger);
    expect(entry?.meetId).toBe(MEET_LOCAL.id);
    expect(entry?.atSeconds).toBe(12);
    expect(entry?.points).toBe(40);
  });

  it('pays zero placing for last-of-16', () => {
    const facts = postedFacts({ placing: { place: 16, fieldSize: 16 } });
    const credited = creditSportingResult(
      createSportingReputationLedger(),
      MEET_LOCAL.id,
      facts,
      0,
      null,
    );
    expect(credited.ledger.creditedReputation).toBe(0);
    expect(credited.report && credited.report.kind === 'credited' ? credited.report.reasons[0] : null).toMatchObject({
      kind: 'placing',
      points: 0,
    });
  });

  it('replays the same meetId as a ledger identity no-op', () => {
    const facts = postedFacts({ isTotalPr: true });
    const first = creditSportingResult(
      createSportingReputationLedger(),
      MEET_LOCAL.id,
      facts,
      0,
      null,
    );
    const replay = creditSportingResult(first.ledger, MEET_LOCAL.id, facts, 0, null);
    expect(replay.ledger).toBe(first.ledger);
    expect(replay.report).toBeNull();
  });

  it('fails closed on an unknown meetId without throwing', () => {
    const ledger = createSportingReputationLedger();
    const outcome = creditSportingResult(ledger, 'not-a-meet', postedFacts(), 0, null);
    expect(outcome.ledger).toBe(ledger);
    expect(outcome.report).toEqual({
      kind: 'not-creditable',
      meetId: 'not-a-meet',
      reason: 'unknown-meet',
    });
  });

  it('refuses a stamp earlier than the last entry', () => {
    const prior: SportingReputationLedger = Object.freeze({
      creditedReputation: 0,
      entries: Object.freeze([
        Object.freeze({
          meetId: 'already-recorded',
          atSeconds: 100,
          points: 0 as never,
          reasons: Object.freeze([]),
        }),
      ]),
    });
    expect(() =>
      creditSportingResult(prior, MEET_LOCAL.id, postedFacts(), 99, null),
    ).toThrow(/earlier than last entry/);
  });

  it('records a bomb-out as a 0-point no-total entry', () => {
    const credited = creditSportingResult(
      createSportingReputationLedger(),
      MEET_LOCAL.id,
      bombedFacts(),
      0,
      null,
    );
    expect(credited.ledger.creditedReputation).toBe(0);
    expect(credited.ledger.entries).toHaveLength(1);
    expect(credited.report).toMatchObject({
      kind: 'credited',
      meetId: MEET_LOCAL.id,
      points: 0,
    });
    expect(credited.report && credited.report.kind === 'credited' ? credited.report.reasons : []).toEqual([
      { kind: 'no-total', text: S.copy.noTotal, points: 0 },
    ]);
  });
});

describe('fences — Career, game, React, v1 Empire, Portfolio', () => {
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('imports only empireCore, empireTuning, production, and sportingReputation', () => {
    const specifiers = [...CODE.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*(['"`])([^'"`]+)\1/g)].map(
      (match) => match[2],
    );
    expect(specifiers.sort()).toEqual([
      './empireCore',
      './empireTuning',
      './production',
      './sportingReputation',
    ]);
  });

  it('is a pure ledger: no clock, network, randomness, or React', () => {
    expect(CODE).not.toMatch(/\bDate\b/);
    expect(CODE).not.toMatch(/Math\.random/);
    expect(CODE).not.toMatch(/\bfetch\b/);
    expect(CODE).not.toMatch(/from\s+['"]react['"]/);
    expect(CODE).not.toMatch(/EmpireState/);
    expect(CODE).not.toMatch(/portfolio|Portfolio/);
    expect(CODE).not.toMatch(/NpcLifter/);
  });
});
