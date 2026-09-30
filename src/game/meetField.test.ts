import { describe, expect, it } from 'vitest';

import {
  ATTEMPTS_PER_LIFT,
  DEFAULT_MEET_RULES,
  LIFT_ORDER,
  allCompletedAttempts,
  bestSuccessfulAttempt,
  finalMeetTotal,
  isOnIncrementGrid,
  totalOnTheBoard,
} from './meet';
import { MEET_ENTRY, MEET_FIELD_FIXTURE, MEET_LOCAL, type FieldLifterSpec } from './meetTuning';
import {
  FIXTURE_REPLAY_FAILED,
  buildMeetField,
  comparePlatformOrder,
  fieldTotalsKg,
  isAttemptVisible,
  officialTotalKg,
  onDeckName,
  replayFixtureCard,
  revealAfterPlayer,
  revealForDeclaration,
  visibleOnTheBoard,
  whoJustWent,
  type FieldAttemptPlan,
} from './meetField';

const SEED = 20320;
const WHITE = ['white', 'white', 'white'] as const;
const RED = ['red', 'red', 'red'] as const;

function attempt(
  partial: Pick<FieldAttemptPlan, 'weightKg' | 'lot'> & Partial<FieldAttemptPlan>,
): FieldAttemptPlan {
  return {
    lift: 'squat',
    attemptNumber: 1,
    good: true,
    lights: WHITE,
    lifterId: 'x',
    ...partial,
  };
}

describe('meetField — same statistical universe', () => {
  const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);

  it('builds one card per fixture lifter', () => {
    expect(field.cards.map((card) => card.lifter.name)).toEqual(
      MEET_FIELD_FIXTURE.map((spec) => spec.name),
    );
    expect(field.playerLot).toBe(MEET_ENTRY.lot);
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

  it('replays every normal fixture card through all nine attempts', () => {
    const expected = ATTEMPTS_PER_LIFT * LIFT_ORDER.length;
    for (const card of field.cards) {
      expect(card.plan.length).toBe(expected);
      expect(allCompletedAttempts(card.meet).length).toBe(expected);
      expect(card.meet.phase.kind).toBe('complete');
      expect(officialTotalKg(card) === null || officialTotalKg(card)! > 0).toBe(true);
    }
  });

  it('declares every planned weight on the meet grid', () => {
    for (const card of field.cards) {
      for (const row of card.plan) {
        expect(isOnIncrementGrid(row.weightKg, DEFAULT_MEET_RULES.declarationIncrement)).toBe(
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
    const again = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);
    expect(fieldTotalsKg(again)).toEqual(fieldTotalsKg(field));
  });

  it('hides later-round attempts until they are revealed', () => {
    const card = field.cards[0];
    if (card === undefined) throw new Error('fixture empty');
    const before = revealForDeclaration('squat', 1, 200);
    const after = revealAfterPlayer(before);
    expect(visibleOnTheBoard(card, before, field.playerLot)).toBeLessThanOrEqual(
      visibleOnTheBoard(card, after, field.playerLot),
    );
    expect(visibleOnTheBoard(card, after, field.playerLot)).toBeLessThanOrEqual(totalOnTheBoard(card.meet));
  });
});

describe('platform order — weight then lot', () => {
  const playerLot = 3;

  it('orders a lighter NPC attempt before the player', () => {
    const npc = attempt({ weightKg: 150, lot: 5, lifterId: 'light' });
    const reveal = revealForDeclaration('squat', 1, 160);
    expect(isAttemptVisible(npc, reveal, playerLot)).toBe(true);
  });

  it('hides a heavier NPC attempt until after the player', () => {
    const npc = attempt({ weightKg: 170, lot: 1, lifterId: 'heavy' });
    const reveal = revealForDeclaration('squat', 1, 160);
    expect(isAttemptVisible(npc, reveal, playerLot)).toBe(false);
    expect(isAttemptVisible(npc, revealAfterPlayer(reveal), playerLot)).toBe(true);
  });

  it('equal weight, NPC lower lot goes before the player', () => {
    const npc = attempt({ weightKg: 160, lot: 1, lifterId: 'early' });
    const reveal = revealForDeclaration('squat', 1, 160);
    expect(comparePlatformOrder(npc, { weightKg: 160, lot: playerLot })).toBeLessThan(0);
    expect(isAttemptVisible(npc, reveal, playerLot)).toBe(true);
  });

  it('equal weight, player lower lot goes before the NPC', () => {
    const npc = attempt({ weightKg: 160, lot: 5, lifterId: 'late' });
    const reveal = revealForDeclaration('squat', 1, 160);
    expect(comparePlatformOrder(npc, { weightKg: 160, lot: playerLot })).toBeGreaterThan(0);
    expect(isAttemptVisible(npc, reveal, playerLot)).toBe(false);
    expect(isAttemptVisible(npc, revealAfterPlayer(reveal), playerLot)).toBe(true);
  });

  it('orders multiple equal-weight NPCs by lot', () => {
    const a = attempt({ weightKg: 160, lot: 1, lifterId: 'a' });
    const b = attempt({ weightKg: 160, lot: 4, lifterId: 'b' });
    const c = attempt({ weightKg: 160, lot: 6, lifterId: 'c' });
    const ordered = [c, a, b].sort(comparePlatformOrder);
    expect(ordered.map((row) => row.lifterId)).toEqual(['a', 'b', 'c']);
  });

  it('names who just went and who is on deck from the same order', () => {
    const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, playerLot);
    const reveal = revealForDeclaration('squat', 1, 160);
    expect(whoJustWent(field, reveal, 160, MEET_ENTRY.name)).toBe('Rex Pembroke');
    expect(onDeckName(field, reveal, 160, MEET_ENTRY.name)).toBe('Jon Harrow');
  });

  it('equal-weight later lot is on deck after the player at 165', () => {
    const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, playerLot);
    const reveal = revealForDeclaration('squat', 2, 165);
    const ordered = [
      ...field.cards.map((card) => {
        const attempt = card.plan.find((row) => row.lift === 'squat' && row.attemptNumber === 2);
        return { name: card.lifter.name, weightKg: attempt?.weightKg ?? 0, lot: card.lifter.lot };
      }),
      { name: MEET_ENTRY.name, weightKg: 165, lot: playerLot },
    ].sort(comparePlatformOrder);
    const playerIndex = ordered.findIndex((slot) => slot.name === MEET_ENTRY.name);
    expect(playerIndex).toBeGreaterThanOrEqual(0);
    expect(ordered[playerIndex + 1]?.name).toBe('Rex Pembroke');
    expect(onDeckName(field, reveal, 165, MEET_ENTRY.name)).toBe('Rex Pembroke');
    expect(whoJustWent(field, reveal, 165, MEET_ENTRY.name)).toBe('Ned Linn');
  });
});

describe('fixture replay fails closed', () => {
  it('refuses a short plan rather than publishing a partial Total', () => {
    const short: FieldAttemptPlan[] = [
      attempt({ weightKg: 150, lot: 1, lifterId: 'bad', attemptNumber: 1 }),
    ];
    expect(() => replayFixtureCard(short, DEFAULT_MEET_RULES, 'bad')).toThrow(FIXTURE_REPLAY_FAILED);
  });

  it('refuses an illegal declaration rather than skipping it', () => {
    const expected = ATTEMPTS_PER_LIFT * LIFT_ORDER.length;
    const plan: FieldAttemptPlan[] = [];
    for (const lift of LIFT_ORDER) {
      plan.push(attempt({ lift, attemptNumber: 1, weightKg: 150, lot: 1, lifterId: 'bad' }));
      plan.push(attempt({ lift, attemptNumber: 2, weightKg: 155, lot: 1, lifterId: 'bad' }));
      plan.push(attempt({ lift, attemptNumber: 3, weightKg: 201, lot: 1, lifterId: 'bad', good: false, lights: RED }));
    }
    expect(plan.length).toBe(expected);
    expect(() => replayFixtureCard(plan, DEFAULT_MEET_RULES, 'bad')).toThrow(FIXTURE_REPLAY_FAILED);
  });

  it('does not treat a colliding lot as a published competitor', () => {
    const clone: FieldLifterSpec = { ...MEET_FIELD_FIXTURE[0]!, lot: MEET_ENTRY.lot };
    expect(() =>
      buildMeetField([clone], DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot),
    ).toThrow(FIXTURE_REPLAY_FAILED);
  });
});

describe('A1-NPC-SIM-01 miss discriminator includes lift', () => {
  it('does not force the same NPC to miss both bench-third and deadlift-third', () => {
    const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);
    const mixed = field.cards.filter((card) => {
      const benchThird = card.plan.find((row) => row.lift === 'bench' && row.attemptNumber === 3);
      const deadThird = card.plan.find((row) => row.lift === 'deadlift' && row.attemptNumber === 3);
      return benchThird !== undefined && deadThird !== undefined && benchThird.good !== deadThird.good;
    });
    expect(mixed.length).toBeGreaterThan(0);
  });

  it('stays deterministic after the lift is included', () => {
    const a = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);
    const b = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);
    expect(
      a.cards.map((card) => card.plan.map((row) => row.good)),
    ).toEqual(b.cards.map((card) => card.plan.map((row) => row.good)));
  });

  it('authors a local attempt grid rather than a wall of makes', () => {
    const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);
    const misses = field.cards.flatMap((card) => card.plan.filter((row) => !row.good));
    expect(misses.length).toBe(9);
    const mira = field.cards.find((card) => card.lifter.name === 'Mira Quill');
    expect(mira?.plan.every((row) => row.good)).toBe(true);
    const harrowSquat = field.cards
      .find((card) => card.lifter.name === 'Jon Harrow')
      ?.plan.filter((row) => row.lift === 'squat');
    expect(harrowSquat?.map((row) => row.weightKg)).toEqual([160, 175, 175]);
    expect(harrowSquat?.map((row) => row.good)).toEqual([true, false, true]);
    for (const card of field.cards) {
      for (const lift of LIFT_ORDER) {
        const rows = card.plan.filter((row) => row.lift === lift);
        const second = rows[1];
        const third = rows[2];
        if (second !== undefined && !second.good) {
          expect(third?.weightKg, `${card.lifter.name} ${lift}`).toBe(second.weightKg);
        }
      }
    }
    const harrowBench3 = field.cards
      .find((card) => card.lifter.name === 'Jon Harrow')
      ?.plan.find((row) => row.lift === 'bench' && row.attemptNumber === 3);
    expect(harrowBench3?.good).toBe(false);
    expect(harrowBench3?.weightKg).toBe(120);
  });
});

describe('standing record is not a current competitor', () => {
  it('names a holder who is not on this flight', () => {
    expect(MEET_LOCAL.standingRecord).not.toBeNull();
    const names = MEET_FIELD_FIXTURE.map((spec) => spec.name);
    expect(names).not.toContain(MEET_LOCAL.standingRecord!.holderName);
  });

  it('does not move when fixture Totals move', () => {
    const a = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, 1, MEET_ENTRY.lot);
    const b = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, 99, MEET_ENTRY.lot);
    expect(MEET_LOCAL.standingRecord?.totalKg).toBe(500);
    expect('meetRecordTotalKg' in a).toBe(false);
    expect('meetRecordTotalKg' in b).toBe(false);
  });
});
