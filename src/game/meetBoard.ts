/**
 * meetBoard.ts — one competition truth for the flight: standings and stakes.
 *
 * Totals and bests are `meet.ts` quantities for the player and for NPCs.
 * UI components do not recompute place or Total.
 *
 * PURITY: zero React, zero I/O, no clock.
 */

import {
  LIFT_ORDER,
  bestSuccessfulAttempt,
  finalMeetTotal,
  isBombedOut,
  totalOnTheBoard,
  type LiftKind,
  type MeetState,
} from './meet';
import { formatWeight } from './resultCard';
import { MEET_COPY } from './meetTuning';
import {
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
  readonly bestByLift: Readonly<Record<LiftKind, number | null>>;
  /** Sum of current bests. Live scoreboard, not a final Total. */
  readonly onTheBoardKg: number;
  /** Official Total, null if bombed or the meet is still running for them. */
  readonly totalKg: number | null;
  readonly bombed: boolean;
  /** 1-based among those with a board total; null if bombed with nothing. */
  readonly place: number | null;
}

export interface MeetBoard {
  readonly rows: readonly StandingRow[];
  readonly fieldSize: number;
  readonly playerPlace: number | null;
  readonly playerOnTheBoardKg: number;
  readonly meetRecordTotalKg: number;
  readonly meetRecordHolderName: string;
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

function playerBests(meet: MeetState): Readonly<Record<LiftKind, number | null>> {
  return {
    squat: bestSuccessfulAttempt(meet.lifts.squat),
    bench: bestSuccessfulAttempt(meet.lifts.bench),
    deadlift: bestSuccessfulAttempt(meet.lifts.deadlift),
  };
}

function rankOnBoard(onTheBoardKg: number, boardKg: readonly number[]): number {
  let ahead = 0;
  for (const other of boardKg) {
    if (other > onTheBoardKg) ahead += 1;
  }
  return ahead + 1;
}

function fill(template: string, slots: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(slots)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  return out;
}

export function buildMeetBoard(
  playerName: string,
  playerMeet: MeetState,
  field: MeetField,
  reveal: FieldReveal,
  qualifyingTotalKg: number | null,
): MeetBoard {
  const playerBest = playerBests(playerMeet);
  const playerBoard = totalOnTheBoard(playerMeet);
  const playerBombed = isBombedOut(playerMeet);
  const playerOfficial = playerMeet.phase.kind === 'complete' ? finalMeetTotal(playerMeet) : null;

  const npcRows: StandingRow[] = field.cards.map((card) => {
    const best = visibleBests(card, reveal);
    const board = visibleOnTheBoard(card, reveal);
    const official = officialTotalKg(card);
    const bombed = official === null && card.meet.phase.kind === 'complete';
    return {
      id: card.lifter.id,
      name: card.lifter.name,
      isPlayer: false,
      bestByLift: best,
      onTheBoardKg: board,
      totalKg: official,
      bombed,
      place: null,
    };
  });

  const playerRow: StandingRow = {
    id: PLAYER_ID,
    name: playerName,
    isPlayer: true,
    bestByLift: playerBest,
    onTheBoardKg: playerBoard,
    totalKg: playerOfficial,
    bombed: playerBombed,
    place: null,
  };

  const rowsUnranked = [...npcRows, playerRow];
  const boardKg = rowsUnranked.filter((row) => !row.bombed).map((row) => row.onTheBoardKg);
  const rows = rowsUnranked
    .map((row) => ({
      ...row,
      place: row.bombed && row.onTheBoardKg === 0 ? null : rankOnBoard(row.onTheBoardKg, boardKg),
    }))
    .sort((a, b) => {
      if (a.place === null && b.place === null) return a.name.localeCompare(b.name);
      if (a.place === null) return 1;
      if (b.place === null) return -1;
      if (a.place !== b.place) return a.place - b.place;
      return a.name.localeCompare(b.name);
    });

  const player = rows.find((row) => row.isPlayer);

  return {
    rows,
    fieldSize: rows.length,
    playerPlace: player?.place ?? null,
    playerOnTheBoardKg: playerBoard,
    meetRecordTotalKg: field.meetRecordTotalKg,
    meetRecordHolderName: field.meetRecordHolderName,
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

function sumBests(bests: Readonly<Record<LiftKind, number | null>>): number {
  let sum = 0;
  for (const lift of LIFT_ORDER) {
    const best = bests[lift];
    if (best !== null) sum += best;
  }
  return sum;
}

/**
 * Stakes for one declared option. Only facts that are true of this board.
 * Never manufactures a record attempt from nothing.
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

  const others = board.rows.filter((row) => !row.isPlayer && !row.bombed).map((row) => row.onTheBoardKg);
  const placeMake = rankOnBoard(makeTotal, [...others, makeTotal]);
  const placeMiss = rankOnBoard(missTotal, [...others, missTotal]);

  const stakes: AttemptStake[] = [];
  stakes.push({
    kind: 'projected-total',
    text: fill(MEET_COPY.STAKE_PROJECTED, { total: formatWeight(makeTotal) }),
  });

  if (placeMake !== board.playerPlace) {
    stakes.push({
      kind: 'place-if-make',
      text: fill(MEET_COPY.STAKE_PLACE_MAKE, {
        place: String(placeMake),
        field: String(board.fieldSize),
      }),
    });
  }
  if (placeMiss !== placeMake) {
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

  if (makeTotal > board.meetRecordTotalKg && board.playerOnTheBoardKg <= board.meetRecordTotalKg) {
    stakes.push({
      kind: 'meet-record',
      text: fill(MEET_COPY.STAKE_MEET_RECORD, { kg: formatWeight(board.meetRecordTotalKg) }),
    });
  }

  return stakes;
}

export function placingFromFieldTotals(
  playerTotalKg: number | null,
  npcTotalsKg: readonly (number | null)[],
): { readonly place: number | null; readonly fieldSize: number } {
  const fieldSize = npcTotalsKg.length + 1;
  if (playerTotalKg === null) return { place: null, fieldSize };
  let ahead = 0;
  for (const total of npcTotalsKg) {
    if (total !== null && total > playerTotalKg) ahead += 1;
  }
  return { place: ahead + 1, fieldSize };
}
