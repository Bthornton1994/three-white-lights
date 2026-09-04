/**
 * meetField.ts — bounded fixture opponents on the same statistical universe.
 *
 * A1: a few named competitors on this flight, not a giant fake leaderboard
 * and not GDD §5 empire NPCs. Every published kg / best / Total / bomb-out
 * is produced by `meet.ts`. The make/miss draw is cheaper. The result is not
 * fake.
 *
 * PURITY: zero React, zero I/O, no clock. The seed is an input.
 */

import {
  ATTEMPTS_PER_LIFT,
  ATTEMPT_NUMBERS,
  LIFT_ORDER,
  createMeet,
  declareAttempt,
  finalMeetTotal,
  isBombedOut,
  resolveAttempt,
  roundToCallableWeightIgnoringTheCard,
  totalOnTheBoard,
  type AttemptNumber,
  type JudgePanel,
  type LiftKind,
  type MeetLoadingRules,
  type MeetState,
} from './meet';
import { nextRandom, seedState } from './prng';
import { MEET_TUNING, type FieldLifterSpec } from './meetTuning';

export interface FieldLifter {
  readonly id: string;
  readonly name: string;
  readonly bodyweightKg: number;
  readonly isPlayer: boolean;
}

export interface FieldAttemptPlan {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly weightKg: number;
  readonly good: boolean;
  readonly lights: JudgePanel;
}

export interface FieldCard {
  readonly lifter: FieldLifter;
  readonly dayMaxKg: Readonly<Record<LiftKind, number>>;
  readonly plan: readonly FieldAttemptPlan[];
  /** Their card, replayed through `meet.ts`. Authoritative for published totals. */
  readonly meet: MeetState;
}

export interface MeetField {
  readonly cards: readonly FieldCard[];
  /** Highest official Total among the fixture, kg. The local meet record. */
  readonly meetRecordTotalKg: number;
  readonly meetRecordHolderName: string;
}

export interface FieldReveal {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly playerWeightKg: number | null;
  /** True once the player's attempt in this round has been judged. */
  readonly afterPlayer: boolean;
}

const WHITE: JudgePanel = ['white', 'white', 'white'];
const RED: JudgePanel = ['red', 'red', 'red'];

function roundCall(weight: number, lift: LiftKind, rules: MeetLoadingRules, mode: 'up' | 'down'): number {
  return roundToCallableWeightIgnoringTheCard(weight, lift, rules, mode);
}

function planLift(
  lift: LiftKind,
  dayMaxKg: number,
  rules: MeetLoadingRules,
  missThird: boolean,
): readonly FieldAttemptPlan[] {
  const opener = roundCall(dayMaxKg * MEET_TUNING.FIELD.OPENER_FRAC, lift, rules, 'down');
  const secondRaw = roundCall(dayMaxKg * MEET_TUNING.FIELD.SECOND_FRAC, lift, rules, 'up');
  const minSecond = roundCall(opener + rules.minIncrement, lift, rules, 'up');
  const second = secondRaw >= minSecond ? secondRaw : minSecond;
  const thirdRaw = roundCall(dayMaxKg, lift, rules, 'up');
  const minThird = roundCall(second + rules.minIncrement, lift, rules, 'up');
  const third = thirdRaw >= minThird ? thirdRaw : minThird;
  const thirdGood = !missThird;
  const openerN = ATTEMPT_NUMBERS[0];
  const secondN = ATTEMPT_NUMBERS[1];
  const thirdN = ATTEMPT_NUMBERS[2];
  return [
    { lift, attemptNumber: openerN, weightKg: opener, good: true, lights: WHITE },
    { lift, attemptNumber: secondN, weightKg: second, good: true, lights: WHITE },
    { lift, attemptNumber: thirdN, weightKg: third, good: thirdGood, lights: thirdGood ? WHITE : RED },
  ];
}

function replayCard(plan: readonly FieldAttemptPlan[], rules: MeetLoadingRules): MeetState {
  let meet = createMeet(rules);
  for (const attempt of plan) {
    if (isBombedOut(meet) || meet.phase.kind === 'complete') break;
    const declared = declareAttempt(meet, { weight: attempt.weightKg });
    if (!declared.ok) break;
    const resolved = resolveAttempt(declared.value, { lights: attempt.lights });
    if (!resolved.ok) break;
    meet = resolved.value;
  }
  return meet;
}

function missThird(seed: number, index: number): boolean {
  const draw = nextRandom(seedState(seed + (index + 1) * MEET_TUNING.FIELD.MISS_SEED_STRIDE));
  return draw.value < MEET_TUNING.FIELD.MISS_THIRD_CHANCE;
}

export function buildMeetField(
  specs: readonly FieldLifterSpec[],
  rules: MeetLoadingRules,
  seed: number,
): MeetField {
  const cards: FieldCard[] = specs.map((spec, index) => {
    const dayMaxKg = spec.dayMaxKg;
    const plan: FieldAttemptPlan[] = [];
    for (const lift of LIFT_ORDER) {
      const miss = missThird(seed, index) && lift !== 'squat';
      plan.push(...planLift(lift, dayMaxKg[lift], rules, miss));
    }
    const meet = replayCard(plan, rules);
    return {
      lifter: {
        id: spec.id,
        name: spec.name,
        bodyweightKg: spec.bodyweightKg,
        isPlayer: false,
      },
      dayMaxKg,
      plan,
      meet,
    };
  });

  let recordKg = 0;
  let recordHolder = cards[0]?.lifter.name ?? '';
  for (const card of cards) {
    const total = finalMeetTotal(card.meet);
    if (total !== null && total > recordKg) {
      recordKg = total;
      recordHolder = card.lifter.name;
    }
  }

  return {
    cards,
    meetRecordTotalKg: recordKg,
    meetRecordHolderName: recordHolder,
  };
}

function attemptIndex(lift: LiftKind, attemptNumber: AttemptNumber): number {
  return LIFT_ORDER.indexOf(lift) * ATTEMPTS_PER_LIFT + (attemptNumber - 1);
}

export function initialFieldReveal(): FieldReveal {
  return {
    lift: 'squat',
    attemptNumber: 1,
    playerWeightKg: null,
    afterPlayer: false,
  };
}

export function revealForDeclaration(
  lift: LiftKind,
  attemptNumber: AttemptNumber,
  playerWeightKg: number,
): FieldReveal {
  return { lift, attemptNumber, playerWeightKg, afterPlayer: false };
}

export function revealAfterPlayer(reveal: FieldReveal): FieldReveal {
  return { ...reveal, afterPlayer: true };
}

/**
 * Has this fixture attempt been seen on the platform yet?
 *
 * Lighter declared weights in the current round go before the player.
 * Equal weights: the player follows (lot-number convention, not a federation claim).
 */
export function isAttemptVisible(
  attempt: FieldAttemptPlan,
  reveal: FieldReveal,
): boolean {
  const attemptOrd = attemptIndex(attempt.lift, attempt.attemptNumber);
  const revealOrd = attemptIndex(reveal.lift, reveal.attemptNumber);
  if (attemptOrd < revealOrd) return true;
  if (attemptOrd > revealOrd) return false;
  if (reveal.playerWeightKg === null) return false;
  if (attempt.weightKg < reveal.playerWeightKg) return true;
  if (attempt.weightKg > reveal.playerWeightKg) return reveal.afterPlayer;
  return reveal.afterPlayer;
}

export function visiblePlan(card: FieldCard, reveal: FieldReveal): readonly FieldAttemptPlan[] {
  return card.plan.filter((attempt) => isAttemptVisible(attempt, reveal));
}

export function visibleBests(
  card: FieldCard,
  reveal: FieldReveal,
): Readonly<Record<LiftKind, number | null>> {
  const bests: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const attempt of visiblePlan(card, reveal)) {
    if (!attempt.good) continue;
    const held = bests[attempt.lift];
    if (held === null || attempt.weightKg > held) bests[attempt.lift] = attempt.weightKg;
  }
  return bests;
}

export function visibleOnTheBoard(card: FieldCard, reveal: FieldReveal): number {
  const bests = visibleBests(card, reveal);
  let sum = 0;
  for (const lift of LIFT_ORDER) {
    const best = bests[lift];
    if (best !== null) sum += best;
  }
  return sum;
}

/** Official Total from `meet.ts`. Null if they bombed. */
export function officialTotalKg(card: FieldCard): number | null {
  return finalMeetTotal(card.meet);
}

export function officialOnTheBoardKg(card: FieldCard): number {
  return totalOnTheBoard(card.meet);
}

export function fieldTotalsKg(field: MeetField): readonly (number | null)[] {
  return field.cards.map((card) => officialTotalKg(card));
}

export function flightOrder(
  field: MeetField,
  reveal: FieldReveal,
): readonly FieldAttemptPlan[] {
  const round = field.cards.flatMap((card) =>
    card.plan.filter(
      (attempt) => attempt.lift === reveal.lift && attempt.attemptNumber === reveal.attemptNumber,
    ),
  );
  return [...round].sort((a, b) => a.weightKg - b.weightKg);
}

export function namedAttempt(
  field: MeetField,
  attempt: FieldAttemptPlan,
): { readonly name: string; readonly attempt: FieldAttemptPlan } | null {
  for (const card of field.cards) {
    if (card.plan.includes(attempt) || card.plan.some((row) =>
      row.lift === attempt.lift &&
      row.attemptNumber === attempt.attemptNumber &&
      row.weightKg === attempt.weightKg &&
      row.good === attempt.good
    )) {
      const owned = card.plan.find(
        (row) =>
          row.lift === attempt.lift &&
          row.attemptNumber === attempt.attemptNumber &&
          row.weightKg === attempt.weightKg,
      );
      if (owned !== undefined) return { name: card.lifter.name, attempt: owned };
    }
  }
  return null;
}

export function onDeckName(
  field: MeetField,
  reveal: FieldReveal,
  playerWeightKg: number,
): string | null {
  const round = field.cards
    .map((card) => {
      const attempt = card.plan.find(
        (row) => row.lift === reveal.lift && row.attemptNumber === reveal.attemptNumber,
      );
      return attempt === undefined ? null : { name: card.lifter.name, weightKg: attempt.weightKg };
    })
    .filter((row): row is { name: string; weightKg: number } => row !== null)
    .sort((a, b) => a.weightKg - b.weightKg);

  if (!reveal.afterPlayer) {
    const after = round.find((row) => row.weightKg > playerWeightKg);
    return after?.name ?? null;
  }
  const waiting = round.find((row) => row.weightKg > playerWeightKg);
  return waiting?.name ?? null;
}

export function whoJustWent(
  field: MeetField,
  reveal: FieldReveal,
  playerWeightKg: number,
): string | null {
  const round = field.cards
    .map((card) => {
      const attempt = card.plan.find(
        (row) => row.lift === reveal.lift && row.attemptNumber === reveal.attemptNumber,
      );
      return attempt === undefined ? null : { name: card.lifter.name, weightKg: attempt.weightKg };
    })
    .filter((row): row is { name: string; weightKg: number } => row !== null)
    .sort((a, b) => a.weightKg - b.weightKg);

  const before = [...round].reverse().find((row) => row.weightKg < playerWeightKg);
  return before?.name ?? null;
}
