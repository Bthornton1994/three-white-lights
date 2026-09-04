import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEET_RULES,
  LIFT_ORDER,
  bestSuccessfulAttempt,
  finalMeetTotal,
  isOnIncrementGrid,
  totalOnTheBoard,
} from './meet';
import { MEET_FIELD_FIXTURE } from './meetTuning';
import {
  buildMeetField,
  fieldTotalsKg,
  officialTotalKg,
  revealAfterPlayer,
  revealForDeclaration,
  visibleOnTheBoard,
} from './meetField';

const SEED = 20320;

describe('meetField — same statistical universe', () => {
  const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED);

  it('builds one card per fixture lifter', () => {
    expect(field.cards.map((card) => card.lifter.name)).toEqual(
      MEET_FIELD_FIXTURE.map((spec) => spec.name),
    );
  });

  it('publishes Total from meet.ts, not a hand-sum of planned kg', () => {
    for (const card of field.cards) {
      const engineTotal = finalMeetTotal(card.meet);
      const fromBests =
        (bestSuccessfulAttempt(card.meet.lifts.squat) ?? 0) +
        (bestSuccessfulAttempt(card.meet.lifts.bench) ?? 0) +
        (bestSuccessfulAttempt(card.meet.lifts.deadlift) ?? 0);
      if (engineTotal === null) {
        expect(card.meet.phase.kind).toBe('complete');
        continue;
      }
      expect(engineTotal).toBe(fromBests);
      expect(officialTotalKg(card)).toBe(engineTotal);
    }
  });

  it('declares every planned weight on the meet grid', () => {
    for (const card of field.cards) {
      for (const attempt of card.plan) {
        expect(isOnIncrementGrid(attempt.weightKg, DEFAULT_MEET_RULES.declarationIncrement)).toBe(
          true,
        );
      }
    }
  });

  it('never decreases within a lift', () => {
    for (const card of field.cards) {
      for (const lift of LIFT_ORDER) {
        const weights = card.plan.filter((row) => row.lift === lift).map((row) => row.weightKg);
        for (let i = 1; i < weights.length; i += 1) {
          expect(weights[i]).toBeGreaterThanOrEqual(weights[i - 1] ?? 0);
        }
      }
    }
  });

  it('is deterministic for a seed', () => {
    const again = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED);
    expect(fieldTotalsKg(again)).toEqual(fieldTotalsKg(field));
    expect(again.meetRecordTotalKg).toBe(field.meetRecordTotalKg);
  });

  it('hides later-round attempts until they are revealed', () => {
    const card = field.cards[0];
    if (card === undefined) throw new Error('fixture empty');
    const before = revealForDeclaration('squat', 1, 200);
    const after = revealAfterPlayer(before);
    expect(visibleOnTheBoard(card, before)).toBeLessThanOrEqual(visibleOnTheBoard(card, after));
    expect(visibleOnTheBoard(card, after)).toBeLessThanOrEqual(totalOnTheBoard(card.meet));
  });

  it('names a meet record held by a fixture Total', () => {
    expect(field.meetRecordTotalKg).toBeGreaterThan(0);
    expect(field.meetRecordHolderName.length).toBeGreaterThan(0);
    const holder = field.cards.find((card) => card.lifter.name === field.meetRecordHolderName);
    expect(officialTotalKg(holder!)).toBe(field.meetRecordTotalKg);
  });
});
