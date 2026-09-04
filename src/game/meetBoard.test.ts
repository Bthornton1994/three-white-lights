import { describe, expect, it } from 'vitest';

import { DEFAULT_MEET_RULES, createMeet, declareAttempt, resolveAttempt } from './meet';
import { MEET_ENTRY, MEET_FIELD_FIXTURE, MEET_LOCAL } from './meetTuning';
import { buildMeetField, fieldTotalsKg, initialFieldReveal, revealForDeclaration } from './meetField';
import { buildMeetBoard, placingFromFieldTotals, stakesForOption } from './meetBoard';

const WHITE = ['white', 'white', 'white'] as const;
const SEED = 7;

function playerWithSquat(weightKg: number) {
  let meet = createMeet(DEFAULT_MEET_RULES);
  const declared = declareAttempt(meet, { weight: weightKg });
  if (!declared.ok) throw new Error(declared.error.message);
  const resolved = resolveAttempt(declared.value, { lights: WHITE });
  if (!resolved.ok) throw new Error(resolved.error.message);
  return resolved.value;
}

describe('meetBoard — one competition truth', () => {
  const field = buildMeetField(MEET_FIELD_FIXTURE, DEFAULT_MEET_RULES, SEED);

  it('places the player among fixture Totals using meet.ts quantities', () => {
    const totals = fieldTotalsKg(field);
    const placing = placingFromFieldTotals(500, totals);
    expect(placing.fieldSize).toBe(MEET_FIELD_FIXTURE.length + 1);
    expect(placing.place).not.toBeNull();
    const ahead = totals.filter((total) => total !== null && total > 500).length;
    expect(placing.place).toBe(ahead + 1);
  });

  it('a bomb has no place and does not invent a Total of zero', () => {
    const placing = placingFromFieldTotals(null, fieldTotalsKg(field));
    expect(placing.place).toBeNull();
    expect(placing.fieldSize).toBe(MEET_FIELD_FIXTURE.length + 1);
  });

  it('only emits stakes that exist on this board', () => {
    const meet = playerWithSquat(160);
    const board = buildMeetBoard(
      MEET_ENTRY.name,
      meet,
      field,
      revealForDeclaration('squat', 2, 165),
      MEET_LOCAL.qualifyingTotalKg,
    );
    const stakes = stakesForOption(board, meet, 'squat', 165, false, 160);
    const kinds = stakes.map((stake) => stake.kind);
    expect(kinds).toContain('projected-total');
    expect(kinds).not.toContain('qualifying');
    expect(stakes.every((stake) => stake.text.length > 0)).toBe(true);
  });

  it('does not manufacture a meet-record stake below the fixture record', () => {
    const meet = createMeet(DEFAULT_MEET_RULES);
    const board = buildMeetBoard(
      MEET_ENTRY.name,
      meet,
      field,
      initialFieldReveal(),
      null,
    );
    const stakes = stakesForOption(board, meet, 'squat', 25, false, null);
    expect(stakes.some((stake) => stake.kind === 'meet-record')).toBe(false);
  });

  it(' ranks the player on the live board, not a second Total', () => {
    const meet = playerWithSquat(162.5);
    const board = buildMeetBoard(
      MEET_ENTRY.name,
      meet,
      field,
      revealForDeclaration('squat', 1, 162.5),
      null,
    );
    const player = board.rows.find((row) => row.isPlayer);
    expect(player?.onTheBoardKg).toBe(162.5);
    expect(player?.place).not.toBeNull();
    expect(board.fieldSize).toBe(MEET_FIELD_FIXTURE.length + 1);
  });
});
