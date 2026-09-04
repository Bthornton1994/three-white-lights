/**
 * meetBoard.ts — one competition truth for the flight: standings and stakes.
 *
 * Totals and bests are `meet.ts` quantities for the player and for NPCs.
 * UI components do not recompute place or Total.
 *
 * A1.1 ranking comparator:
 *   1. higher Total ranks first
 *   2. equal Total → lighter bodyweight ranks first
 *   3. equal Total + equal bodyweight → earlier Total (competition-order seq)
 * Live board and final/server placing call the same comparator.
 *
 * PURITY: zero React, zero I/O, no clock.
 */

import {
  ATTEMPT_NUMBERS,
  LIFT_ORDER,
  bestSuccessfulAttempt,
  finalMeetTotal,
  isBombedOut,
  totalOnTheBoard,
  type AttemptNumber,
  type LiftKind,
  type MeetState,
} from './meet';
import { formatWeight } from './resultCard';
import { MEET_COPY, type StandingMeetRecord } from './meetTuning';
import {
  comparePlatformOrder,
  isAttemptVisible,
  officialTotalKg,
  visibleBests,
  visibleOnTheBoard,
  type FieldReveal,
  type MeetField,
} from './meetField';

export const PLAYER_ID = 'player';

export interface StandingRow {
  readonly id: string;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly bodyweightKg: number;
  readonly lot: number;
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  /** Sum of current bests. Live scoreboard, not a final Total. */
  readonly onTheBoardKg: number;
  /** Official Total, null if bombed or the meet is still running for them. */
  readonly totalKg: number | null;
  readonly bombed: boolean;
  /** Competition-order index at which this row's current score was first reached. */
  readonly achievedSeq: number;
  /** 1-based among those with a board total; null if bombed with nothing. */
  readonly place: number | null;
}

export interface MeetBoard {
  readonly rows: readonly StandingRow[];
  readonly fieldSize: number;
  readonly playerPlace: number | null;
  readonly playerOnTheBoardKg: number;
  readonly standingRecord: StandingMeetRecord | null;
  readonly qualifyingTotalKg: number | null;
}

export type AttemptStakeKind =
  | 'projected-total'
  | 'place-if-make'
  | 'place-if-miss'
  | 'miss-stands'
  | 'qualifying'
  | 'meet-record';

export interface AttemptStake {
  readonly kind: AttemptStakeKind;
  readonly text: string;
}

export interface BoardPlayer {
  readonly name: string;
  readonly bodyweightKg: number;
  readonly lot: number;
}

/**
 * Everything the official ranking comparator is allowed to see.
 * `totalKg` is official Total (or live on-the-board when ranking the live board).
 */
export interface PlacingSubject {
  readonly id: string;
  readonly totalKg: number | null;
  readonly bodyweightKg: number;
  readonly achievedSeq: number;
  readonly lot: number;
}

export function comparePlacing(a: PlacingSubject, b: PlacingSubject): number {
  const aHas = a.totalKg !== null;
  const bHas = b.totalKg !== null;
  if (!aHas && !bHas) {
    if (a.lot !== b.lot) return a.lot - b.lot;
    return 0;
  }
  if (!aHas) return 1;
  if (!bHas) return -1;
  if (a.totalKg !== b.totalKg) return (b.totalKg as number) - (a.totalKg as number);
  if (a.bodyweightKg !== b.bodyweightKg) return a.bodyweightKg - b.bodyweightKg;
  if (a.achievedSeq !== b.achievedSeq) return a.achievedSeq - b.achievedSeq;
  return a.lot - b.lot;
}

export function placeSubjects(
  subjects: readonly PlacingSubject[],
): { readonly placeById: ReadonlyMap<string, number | null>; readonly fieldSize: number } {
  const ranked = [...subjects].sort(comparePlacing);
  const placeById = new Map<string, number | null>();
  let place = 0;
  for (const subject of ranked) {
    if (subject.totalKg === null) {
      placeById.set(subject.id, null);
      continue;
    }
    place += 1;
    placeById.set(subject.id, place);
  }
  return { placeById, fieldSize: subjects.length };
}

function playerBests(meet: MeetState): Readonly<Record<LiftKind, number | null>> {
  return {
    squat: bestSuccessfulAttempt(meet.lifts.squat),
    bench: bestSuccessfulAttempt(meet.lifts.bench),
    deadlift: bestSuccessfulAttempt(meet.lifts.deadlift),
  };
}

function fill(template: string, slots: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(slots)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  return out;
}

function playerWeightOn(
  meet: MeetState,
  lift: LiftKind,
  attemptNumber: AttemptNumber,
): { readonly weightKg: number; readonly good: boolean } | null {
  const attempt = meet.lifts[lift].attempts.find((row) => row.attemptNumber === attemptNumber);
  if (attempt === undefined || attempt.status === 'passed') return null;
  return { weightKg: attempt.weight, good: attempt.status === 'good' };
}

/**
 * Walk the platform in competition order. Each lifter's `achievedSeq` is the
 * step at which their running on-the-board last increased to its current value.
 *
 * `reveal === null` counts every fixture attempt (official placing).
 * Otherwise only attempts already visible, plus the player's completed ones.
 */
export function achievedSeqByLifter(
  field: MeetField,
  playerMeet: MeetState,
  playerLot: number,
  reveal: FieldReveal | null,
): Readonly<Record<string, number>> {
  const ids = [PLAYER_ID, ...field.cards.map((card) => card.lifter.id)];
  const bests: Record<string, Record<LiftKind, number | null>> = {};
  const seqAt: Record<string, number> = {};
  for (const id of ids) {
    bests[id] = { squat: null, bench: null, deadlift: null };
    seqAt[id] = 0;
  }

  let seq = 0;
  for (const lift of LIFT_ORDER) {
    for (const attemptNumber of ATTEMPT_NUMBERS) {
      const slots: { id: string; weightKg: number; lot: number; good: boolean; lift: LiftKind }[] = [];
      for (const card of field.cards) {
        const attempt = card.plan.find(
          (row) => row.lift === lift && row.attemptNumber === attemptNumber,
        );
        if (attempt === undefined) continue;
        if (reveal !== null && !isAttemptVisible(attempt, reveal, playerLot)) {
          continue;
        }
        slots.push({
          id: card.lifter.id,
          weightKg: attempt.weightKg,
          lot: card.lifter.lot,
          good: attempt.good,
          lift,
        });
      }
      const playerAttempt = playerWeightOn(playerMeet, lift, attemptNumber);
      if (playerAttempt !== null) {
        slots.push({
          id: PLAYER_ID,
          weightKg: playerAttempt.weightKg,
          lot: playerLot,
          good: playerAttempt.good,
          lift,
        });
      }
      slots.sort(comparePlatformOrder);
      for (const slot of slots) {
        seq += 1;
        if (!slot.good) continue;
        const held = bests[slot.id];
        if (held === undefined) continue;
        const previous = held[slot.lift];
        if (previous !== null && slot.weightKg <= previous) continue;
        held[slot.lift] = slot.weightKg;
        seqAt[slot.id] = seq;
      }
    }
  }
  return seqAt;
}

function sumBests(bests: Readonly<Record<LiftKind, number | null>>): number {
  let sum = 0;
  for (const lift of LIFT_ORDER) {
    const best = bests[lift];
    if (best !== null) sum += best;
  }
  return sum;
}

export function buildMeetBoard(
  player: BoardPlayer,
  playerMeet: MeetState,
  field: MeetField,
  reveal: FieldReveal,
  qualifyingTotalKg: number | null,
  standingRecord: StandingMeetRecord | null,
): MeetBoard {
  const playerBest = playerBests(playerMeet);
  const playerBoard = totalOnTheBoard(playerMeet);
  const playerBombed = isBombedOut(playerMeet);
  const playerOfficial = playerMeet.phase.kind === 'complete' ? finalMeetTotal(playerMeet) : null;
  const seqAt = achievedSeqByLifter(field, playerMeet, player.lot, reveal);

  const npcRows: StandingRow[] = field.cards.map((card) => {
    const best = visibleBests(card, reveal, field.playerLot);
    const board = visibleOnTheBoard(card, reveal, field.playerLot);
    const official = officialTotalKg(card);
    const bombed = official === null && card.meet.phase.kind === 'complete';
    return {
      id: card.lifter.id,
      name: card.lifter.name,
      isPlayer: false,
      bodyweightKg: card.lifter.bodyweightKg,
      lot: card.lifter.lot,
      bestByLift: best,
      onTheBoardKg: board,
      totalKg: official,
      bombed,
      achievedSeq: seqAt[card.lifter.id] ?? 0,
      place: null,
    };
  });

  const playerRow: StandingRow = {
    id: PLAYER_ID,
    name: player.name,
    isPlayer: true,
    bodyweightKg: player.bodyweightKg,
    lot: player.lot,
    bestByLift: playerBest,
    onTheBoardKg: playerBoard,
    totalKg: playerOfficial,
    bombed: playerBombed,
    achievedSeq: seqAt[PLAYER_ID] ?? 0,
    place: null,
  };

  const rowsUnranked = [...npcRows, playerRow];
  const subjects: PlacingSubject[] = rowsUnranked.map((row) => ({
    id: row.id,
    totalKg: row.bombed && row.onTheBoardKg === 0 ? null : row.onTheBoardKg,
    bodyweightKg: row.bodyweightKg,
    achievedSeq: row.achievedSeq,
    lot: row.lot,
  }));
  const { placeById } = placeSubjects(subjects);

  const rows = rowsUnranked
    .map((row) => ({
      ...row,
      place: placeById.get(row.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.place === null && b.place === null) return a.name.localeCompare(b.name);
      if (a.place === null) return 1;
      if (b.place === null) return -1;
      if (a.place !== b.place) return a.place - b.place;
      return a.name.localeCompare(b.name);
    });

  const you = rows.find((row) => row.isPlayer);

  return {
    rows,
    fieldSize: rows.length,
    playerPlace: you?.place ?? null,
    playerOnTheBoardKg: playerBoard,
    standingRecord,
    qualifyingTotalKg,
  };
}

function projectedBestsIf(
  meet: MeetState,
  lift: LiftKind,
  weightKg: number,
  made: boolean,
): Readonly<Record<LiftKind, number | null>> {
  const bests = { ...playerBests(meet) };
  if (made) {
    const held = bests[lift];
    if (held === null || weightKg > held) bests[lift] = weightKg;
  }
  return bests;
}

/**
 * Stakes for one declared option. Only facts that are true of this board.
 * Never manufactures a record attempt from a future opponent Total.
 */
export function stakesForOption(
  board: MeetBoard,
  playerMeet: MeetState,
  lift: LiftKind,
  weightKg: number,
  isLastAttempt: boolean,
  bankedKg: number | null,
): readonly AttemptStake[] {
  const makeBests = projectedBestsIf(playerMeet, lift, weightKg, true);
  const missBests = projectedBestsIf(playerMeet, lift, weightKg, false);
  const makeTotal = sumBests(makeBests);
  const missTotal = sumBests(missBests);

  const others = board.rows.filter((row) => !row.isPlayer);
  let maxSeq = 0;
  for (const row of board.rows) {
    if (row.achievedSeq > maxSeq) maxSeq = row.achievedSeq;
  }
  const nowSeq = maxSeq + 1;
  const player = board.rows.find((row) => row.isPlayer);
  const playerLot = player?.lot ?? 0;
  const playerBw = player?.bodyweightKg ?? 0;

  const subjectFor = (id: string, totalKg: number | null, bodyweightKg: number, achievedSeq: number, lot: number): PlacingSubject => ({
    id,
    totalKg,
    bodyweightKg,
    achievedSeq,
    lot,
  });

  const otherSubjects = others.map((row) =>
    subjectFor(
      row.id,
      row.bombed && row.onTheBoardKg === 0 ? null : row.onTheBoardKg,
      row.bodyweightKg,
      row.achievedSeq,
      row.lot,
    ),
  );

  const placeMake = placeSubjects([
    ...otherSubjects,
    subjectFor(PLAYER_ID, makeTotal, playerBw, makeTotal > board.playerOnTheBoardKg ? nowSeq : (player?.achievedSeq ?? 0), playerLot),
  ]).placeById.get(PLAYER_ID) ?? null;
  const placeMiss = placeSubjects([
    ...otherSubjects,
    subjectFor(PLAYER_ID, missTotal, playerBw, player?.achievedSeq ?? 0, playerLot),
  ]).placeById.get(PLAYER_ID) ?? null;

  const stakes: AttemptStake[] = [];
  stakes.push({
    kind: 'projected-total',
    text: fill(MEET_COPY.STAKE_PROJECTED, { total: formatWeight(makeTotal) }),
  });

  if (placeMake !== null && placeMake !== board.playerPlace) {
    stakes.push({
      kind: 'place-if-make',
      text: fill(MEET_COPY.STAKE_PLACE_MAKE, {
        place: String(placeMake),
        field: String(board.fieldSize),
      }),
    });
  }
  if (placeMiss !== null && placeMiss !== placeMake) {
    stakes.push({
      kind: 'place-if-miss',
      text: fill(MEET_COPY.STAKE_PLACE_MISS, {
        place: String(placeMiss),
        field: String(board.fieldSize),
      }),
    });
  } else if (isLastAttempt && lift === 'deadlift' && bankedKg !== null) {
    stakes.push({ kind: 'miss-stands', text: MEET_COPY.STAKE_MISS_STANDS });
  }

  const qualifying = board.qualifyingTotalKg;
  if (qualifying !== null && makeTotal >= qualifying && board.playerOnTheBoardKg < qualifying) {
    stakes.push({
      kind: 'qualifying',
      text: fill(MEET_COPY.STAKE_QUALIFYING, { kg: formatWeight(qualifying) }),
    });
  }

  const record = board.standingRecord;
  if (
    record !== null &&
    makeTotal > record.totalKg &&
    board.playerOnTheBoardKg <= record.totalKg
  ) {
    stakes.push({
      kind: 'meet-record',
      text: fill(MEET_COPY.STAKE_MEET_RECORD, { kg: formatWeight(record.totalKg) }),
    });
  }

  return stakes;
}

/**
 * Official placing after a completed meet. Same comparator as the live board.
 */
export function placingForMeet(
  playerMeet: MeetState,
  playerBodyweightKg: number,
  playerLot: number,
  field: MeetField,
): { readonly place: number | null; readonly fieldSize: number } {
  const seqAt = achievedSeqByLifter(field, playerMeet, playerLot, null);
  const playerTotal = finalMeetTotal(playerMeet);
  const subjects: PlacingSubject[] = [
    {
      id: PLAYER_ID,
      totalKg: playerTotal,
      bodyweightKg: playerBodyweightKg,
      achievedSeq: seqAt[PLAYER_ID] ?? 0,
      lot: playerLot,
    },
    ...field.cards.map((card) => ({
      id: card.lifter.id,
      totalKg: officialTotalKg(card),
      bodyweightKg: card.lifter.bodyweightKg,
      achievedSeq: seqAt[card.lifter.id] ?? 0,
      lot: card.lifter.lot,
    })),
  ];
  const placed = placeSubjects(subjects);
  return {
    place: placed.placeById.get(PLAYER_ID) ?? null,
    fieldSize: placed.fieldSize,
  };
}
