import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEET_RULES,
  createMeet,
  declareAttempt,
  resolveAttempt,
  type MeetState,
} from './meet';
import { MEET_ENTRY, MEET_FIELD_FIXTURE, MEET_LOCAL } from './meetTuning';
import {
  buildMeetField,
  initialFieldReveal,
  officialTotalKg,
  revealForDeclaration,
} from './meetField';
import {
  PLAYER_ID,
  buildMeetBoard,
  comparePlacing,
  placeSubjects,
  placingForMeet,
  stakesForOption,
  type BoardPlayer,
  type PlacingSubject,
} from './meetBoard';

const WHITE = ['white', 'white', 'white'] as const;
const SEED = 7;

const PLAYER: BoardPlayer = {
  name: MEET_ENTRY.name,
  bodyweightKg: MEET_ENTRY.bodyweight.kilograms,
  lot: MEET_ENTRY.lot,
};

function playerWithSquat(weightKg: number): MeetState {
  let meet = createMeet(DEFAULT_MEET_RULES);
  const declared = declareAttempt(meet, { weight: weightKg });
  if (!declared.ok) throw new Error(declared.error.message);
  const resolved = resolveAttempt(declared.value, { lights: WHITE });
  if (!resolved.ok) throw new Error(resolved.error.message);
  return resolved.value;
}

function subject(partial: Partial<PlacingSubject> & Pick<PlacingSubject, 'id' | 'totalKg'>): PlacingSubject {
  return {
    bodyweightKg: 90,
    achievedSeq: 1,
    lot: 1,
    ...partial,
  };
}

describe('comparePlacing — standings tie-break', () => {
  it('ranks a higher Total first', () => {
    const ranked = placeSubjects([
      subject({ id: 'a', totalKg: 500, lot: 1 }),
      subject({ id: 'b', totalKg: 510, lot: 2 }),
    ]);
    expect(ranked.placeById.get('b')).toBe(1);
    expect(ranked.placeById.get('a')).toBe(2);
  });

  it('same Total, lighter bodyweight ranks first', () => {
    const ranked = placeSubjects([
      subject({ id: 'heavy', totalKg: 500, bodyweightKg: 93, lot: 1 }),
      subject({ id: 'light', totalKg: 500, bodyweightKg: 82, lot: 2 }),
    ]);
    expect(ranked.placeById.get('light')).toBe(1);
    expect(ranked.placeById.get('heavy')).toBe(2);
  });

  it('same Total, heavier bodyweight ranks second', () => {
    expect(
      comparePlacing(
        subject({ id: 'you', totalKg: 500, bodyweightKg: 94, lot: 1 }),
        subject({ id: 'them', totalKg: 500, bodyweightKg: 90, lot: 2 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('same Total + same bodyweight, earlier Total ranks first', () => {
    const ranked = placeSubjects([
      subject({ id: 'later', totalKg: 500, bodyweightKg: 90, achievedSeq: 8, lot: 2 }),
      subject({ id: 'earlier', totalKg: 500, bodyweightKg: 90, achievedSeq: 3, lot: 1 }),
    ]);
    expect(ranked.placeById.get('earlier')).toBe(1);
    expect(ranked.placeById.get('later')).toBe(2);
  });

  it('same Total + same bodyweight, later Total ranks second', () => {
    expect(
      comparePlacing(
        subject({ id: 'later', totalKg: 500, bodyweightKg: 90, achievedSeq: 9, lot: 1 }),
        subject({ id: 'earlier', totalKg: 500, bodyweightKg: 90, achievedSeq: 2, lot: 2 }),
      ),
    ).toBeGreaterThan(0);
  });

  it('a bomb has no place and does not invent a Total of zero', () => {
    const ranked = placeSubjects([
      subject({ id: PLAYER_ID, totalKg: null, lot: 3 }),
      subject({ id: 'npc', totalKg: 500, lot: 1 }),
    ]);
    expect(ranked.placeById.get(PLAYER_ID)).toBeNull();
    expect(ranked.placeById.get('npc')).toBe(1);
    expect(ranked.fieldSize).toBe(2);
  });
});

describe('meetBoard — one competition truth', () => {
  const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED, MEET_ENTRY.lot);

  it('places the player with the same comparator the server uses', () => {
    const meet = createMeet(DEFAULT_MEET_RULES);
    const fromBoard = placingForMeet(meet, PLAYER.bodyweightKg, PLAYER.lot, field);
    expect(fromBoard.fieldSize).toBe(MEET_FIELD_FIXTURE.length + 1);
    expect(fromBoard.place).toBeNull();
  });

  it('only emits stakes that exist on this board', () => {
    const meet = playerWithSquat(160);
    const board = buildMeetBoard(
      PLAYER,
      meet,
      field,
      revealForDeclaration('squat', 2, 165),
      MEET_LOCAL.qualifyingTotalKg,
      MEET_LOCAL.standingRecord,
    );
    const stakes = stakesForOption(board, meet, 'squat', 165, false, 160);
    const kinds = stakes.map((stake) => stake.kind);
    expect(kinds).toContain('projected-total');
    expect(kinds).not.toContain('qualifying');
    expect(stakes.every((stake) => stake.text.length > 0)).toBe(true);
  });

  it('does not manufacture a meet-record stake below the standing record', () => {
    const meet = createMeet(DEFAULT_MEET_RULES);
    const board = buildMeetBoard(
      PLAYER,
      meet,
      field,
      initialFieldReveal(),
      null,
      MEET_LOCAL.standingRecord,
    );
    const stakes = stakesForOption(board, meet, 'squat', 25, false, null);
    expect(stakes.some((stake) => stake.kind === 'meet-record')).toBe(false);
  });

  it('emits a record stake against the standing record, not a future NPC Total', () => {
    const record = MEET_LOCAL.standingRecord;
    expect(record).not.toBeNull();
    const npcMax = Math.max(
      ...field.cards.map((card) => officialTotalKg(card) ?? 0),
    );
    expect(npcMax).toBeGreaterThan(record!.totalKg);

    const meet = createMeet(DEFAULT_MEET_RULES);
    const board = buildMeetBoard(
      PLAYER,
      meet,
      field,
      initialFieldReveal(),
      null,
      record,
    );
    const between = record!.totalKg + DEFAULT_MEET_RULES.declarationIncrement;
    expect(between).toBeLessThan(npcMax);
    const stakes = stakesForOption(board, meet, 'deadlift', between, true, null);
    expect(stakes.some((stake) => stake.kind === 'meet-record')).toBe(true);
  });

  it('ranks the player on the live board, not a second Total', () => {
    const meet = playerWithSquat(162.5);
    const board = buildMeetBoard(
      PLAYER,
      meet,
      field,
      revealForDeclaration('squat', 1, 162.5),
      null,
      MEET_LOCAL.standingRecord,
    );
    const you = board.rows.find((row) => row.isPlayer);
    expect(you?.onTheBoardKg).toBe(162.5);
    expect(you?.place).not.toBeNull();
    expect(board.fieldSize).toBe(MEET_FIELD_FIXTURE.length + 1);
    expect(board.standingRecord).toEqual(MEET_LOCAL.standingRecord);
  });
});
