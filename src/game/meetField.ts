/**
 * meetField.ts — bounded fixture opponents on the same statistical universe.
 *
 * A1: a few named competitors on this flight, not a giant fake leaderboard
 * and not GDD §5 empire NPCs. Every published kg / best / Total / bomb-out
 * is produced by `meet.ts`. The make/miss draw is cheaper. The result is not
 * fake.
 *
 * A1.1: same-weight platform order is declared weight, then lot. Replay of a
 * fixture card either completes all nine attempts or fails closed. Standing
 * records do not live here — they are authored on MeetDefinition before anyone
 * on this flight has a Total.
 *
 * PURITY: zero React, zero I/O, no clock. The seed is an input.
 */

import {
  ATTEMPTS_PER_LIFT,
  ATTEMPT_NUMBERS,
  LIFT_ORDER,
  allCompletedAttempts,
  createMeet,
  declareAttempt,
  finalMeetTotal,
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

export const FIXTURE_REPLAY_FAILED = 'FIXTURE_REPLAY_FAILED';

export interface FixtureReplayError {
  readonly code: typeof FIXTURE_REPLAY_FAILED;
  readonly message: string;
  readonly lifterId: string;
}

export interface FieldLifter {
  readonly id: string;
  readonly name: string;
  readonly bodyweightKg: number;
  readonly lot: number;
  readonly isPlayer: boolean;
}

export interface FieldAttemptPlan {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly weightKg: number;
  readonly good: boolean;
  readonly lights: JudgePanel;
  readonly lot: number;
  readonly lifterId: string;
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
  /** The player's lot on this same flight. Not inferred from NPC lots. */
  readonly playerLot: number;
}

export interface FieldReveal {
  readonly lift: LiftKind;
  readonly attemptNumber: AttemptNumber;
  readonly playerWeightKg: number | null;
  /** True once the player's attempt in this round has been judged. */
  readonly afterPlayer: boolean;
}

export interface PlatformSlot {
  readonly weightKg: number;
  readonly lot: number;
}

export interface NamedRoundSlot extends PlatformSlot {
  readonly name: string;
  readonly id: string;
  readonly isPlayer: boolean;
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
  missThirdAttempt: boolean,
  spec: FieldLifterSpec,
): readonly FieldAttemptPlan[] {
  const opener = roundCall(dayMaxKg * MEET_TUNING.FIELD.OPENER_FRAC, lift, rules, 'down');
  const secondRaw = roundCall(dayMaxKg * MEET_TUNING.FIELD.SECOND_FRAC, lift, rules, 'up');
  const minSecond = roundCall(opener + rules.minIncrement, lift, rules, 'up');
  const second = secondRaw >= minSecond ? secondRaw : minSecond;
  const thirdRaw = roundCall(dayMaxKg, lift, rules, 'up');
  const minThird = roundCall(second + rules.minIncrement, lift, rules, 'up');
  const third = thirdRaw >= minThird ? thirdRaw : minThird;
  const thirdGood = !missThirdAttempt;
  const openerN = ATTEMPT_NUMBERS[0];
  const secondN = ATTEMPT_NUMBERS[1];
  const thirdN = ATTEMPT_NUMBERS[2];
  return [
    { lift, attemptNumber: openerN, weightKg: opener, good: true, lights: WHITE, lot: spec.lot, lifterId: spec.id },
    { lift, attemptNumber: secondN, weightKg: second, good: true, lights: WHITE, lot: spec.lot, lifterId: spec.id },
    { lift, attemptNumber: thirdN, weightKg: third, good: thirdGood, lights: thirdGood ? WHITE : RED, lot: spec.lot, lifterId: spec.id },
  ];
}

function fixtureError(lifterId: string, reason: string): FixtureReplayError {
  return {
    code: FIXTURE_REPLAY_FAILED,
    lifterId,
    message: `${FIXTURE_REPLAY_FAILED}: ${lifterId}: ${reason}`,
  };
}

/**
 * Replay one fixture card through `meet.ts`. Nine planned attempts must all
 * declare and resolve; a malformed plan does not become a partial competitor.
 */
export function replayFixtureCard(
  plan: readonly FieldAttemptPlan[],
  rules: MeetLoadingRules,
  lifterId: string,
): MeetState {
  const expected = ATTEMPTS_PER_LIFT * LIFT_ORDER.length;
  if (plan.length !== expected) {
    throw Object.assign(new Error(fixtureError(lifterId, 'plan is not a full card').message), {
      code: FIXTURE_REPLAY_FAILED,
      lifterId,
    });
  }
  let meet = createMeet(rules);
  for (const attempt of plan) {
    const declared = declareAttempt(meet, { weight: attempt.weightKg });
    if (!declared.ok) {
      throw Object.assign(new Error(fixtureError(lifterId, declared.error.message).message), {
        code: FIXTURE_REPLAY_FAILED,
        lifterId,
      });
    }
    const resolved = resolveAttempt(declared.value, { lights: attempt.lights });
    if (!resolved.ok) {
      throw Object.assign(new Error(fixtureError(lifterId, resolved.error.message).message), {
        code: FIXTURE_REPLAY_FAILED,
        lifterId,
      });
    }
    meet = resolved.value;
  }
  if (meet.phase.kind !== 'complete') {
    throw Object.assign(new Error(fixtureError(lifterId, 'card did not complete').message), {
      code: FIXTURE_REPLAY_FAILED,
      lifterId,
    });
  }
  if (allCompletedAttempts(meet).length !== expected) {
    throw Object.assign(new Error(fixtureError(lifterId, 'resolved fewer attempts than planned').message), {
      code: FIXTURE_REPLAY_FAILED,
      lifterId,
    });
  }
  return meet;
}

/**
 * A1-NPC-SIM-01: the discriminator includes lift, so a bench-third miss does
 * not force the same NPC's deadlift-third miss.
 */
function missThird(seed: number, index: number, lift: LiftKind): boolean {
  const liftIndex = LIFT_ORDER.indexOf(lift) + 1;
  const draw = nextRandom(
    seedState(seed + (index + 1) * MEET_TUNING.FIELD.MISS_SEED_STRIDE + liftIndex),
  );
  return draw.value < MEET_TUNING.FIELD.MISS_THIRD_CHANCE;
}

function assertUniqueLots(specs: readonly FieldLifterSpec[], playerLot: number): void {
  const seen = new Set<number>();
  seen.add(playerLot);
  for (const spec of specs) {
    if (seen.has(spec.lot)) {
      throw Object.assign(new Error(fixtureError(spec.id, 'lot collides on this flight').message), {
        code: FIXTURE_REPLAY_FAILED,
        lifterId: spec.id,
      });
    }
    seen.add(spec.lot);
  }
}

export function buildMeetField(
  specs: readonly FieldLifterSpec[],
  rules: MeetLoadingRules,
  seed: number,
  playerLot: number,
): MeetField {
  assertUniqueLots(specs, playerLot);
  const cards: FieldCard[] = specs.map((spec, index) => {
    const dayMaxKg = spec.dayMaxKg;
    const plan: FieldAttemptPlan[] = [];
    for (const lift of LIFT_ORDER) {
      const miss = missThird(seed, index, lift) && lift !== 'squat';
      plan.push(...planLift(lift, dayMaxKg[lift], rules, miss, spec));
    }
    const meet = replayFixtureCard(plan, rules, spec.id);
    return {
      lifter: {
        id: spec.id,
        name: spec.name,
        bodyweightKg: spec.bodyweightKg,
        lot: spec.lot,
        isPlayer: false,
      },
      dayMaxKg,
      plan,
      meet,
    };
  });

  return {
    cards,
    playerLot,
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
 * Declared weight ascending, then lot ascending. The player is one lot in
 * the same order — they do not win equal-weight ties.
 */
export function comparePlatformOrder(a: PlatformSlot, b: PlatformSlot): number {
  if (a.weightKg !== b.weightKg) return a.weightKg - b.weightKg;
  return a.lot - b.lot;
}

/**
 * Has this fixture attempt been seen on the platform yet?
 *
 * Same round: visible if the attempt's (weight, lot) is strictly before the
 * player's (weight, lot), or if the player has already taken the attempt.
 */
export function isAttemptVisible(
  attempt: FieldAttemptPlan,
  reveal: FieldReveal,
  playerLot: number,
): boolean {
  const attemptOrd = attemptIndex(attempt.lift, attempt.attemptNumber);
  const revealOrd = attemptIndex(reveal.lift, reveal.attemptNumber);
  if (attemptOrd < revealOrd) return true;
  if (attemptOrd > revealOrd) return false;
  if (reveal.playerWeightKg === null) return false;
  const order = comparePlatformOrder(
    { weightKg: attempt.weightKg, lot: attempt.lot },
    { weightKg: reveal.playerWeightKg, lot: playerLot },
  );
  if (order < 0) return true;
  return reveal.afterPlayer;
}

export function visiblePlan(
  card: FieldCard,
  reveal: FieldReveal,
  playerLot: number,
): readonly FieldAttemptPlan[] {
  return card.plan.filter((attempt) => isAttemptVisible(attempt, reveal, playerLot));
}

export function visibleBests(
  card: FieldCard,
  reveal: FieldReveal,
  playerLot: number,
): Readonly<Record<LiftKind, number | null>> {
  const bests: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const attempt of visiblePlan(card, reveal, playerLot)) {
    if (!attempt.good) continue;
    const held = bests[attempt.lift];
    if (held === null || attempt.weightKg > held) bests[attempt.lift] = attempt.weightKg;
  }
  return bests;
}

export function visibleOnTheBoard(card: FieldCard, reveal: FieldReveal, playerLot: number): number {
  const bests = visibleBests(card, reveal, playerLot);
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
  return [...round].sort(comparePlatformOrder);
}

function namedRound(
  field: MeetField,
  reveal: FieldReveal,
  playerWeightKg: number,
  playerName: string,
): readonly NamedRoundSlot[] {
  const slots: NamedRoundSlot[] = field.cards.map((card) => {
    const attempt = card.plan.find(
      (row) => row.lift === reveal.lift && row.attemptNumber === reveal.attemptNumber,
    );
    return {
      id: card.lifter.id,
      name: card.lifter.name,
      weightKg: attempt === undefined ? 0 : attempt.weightKg,
      lot: card.lifter.lot,
      isPlayer: false,
    };
  });
  slots.push({
    id: 'player',
    name: playerName,
    weightKg: playerWeightKg,
    lot: field.playerLot,
    isPlayer: true,
  });
  return [...slots].sort(comparePlatformOrder);
}

export function namedAttempt(
  field: MeetField,
  attempt: FieldAttemptPlan,
): { readonly name: string; readonly attempt: FieldAttemptPlan } | null {
  for (const card of field.cards) {
    if (card.lifter.id === attempt.lifterId) {
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
  playerName: string,
): string | null {
  const round = namedRound(field, reveal, playerWeightKg, playerName);
  const playerIndex = round.findIndex((slot) => slot.isPlayer);
  if (playerIndex < 0) return null;
  const next = round[playerIndex + 1];
  return next === undefined ? null : next.name;
}

export function whoJustWent(
  field: MeetField,
  reveal: FieldReveal,
  playerWeightKg: number,
  playerName: string,
): string | null {
  const round = namedRound(field, reveal, playerWeightKg, playerName);
  const playerIndex = round.findIndex((slot) => slot.isPlayer);
  if (playerIndex <= 0) return null;
  const previous = round[playerIndex - 1];
  return previous === undefined ? null : previous.name;
}
