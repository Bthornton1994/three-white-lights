import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createMeet, declareAttempt, finalMeetTotal, resolveAttempt, type JudgePanel, type MeetState } from '../../src/game/meet';
import { buildResultCard, type ResultCardFlightRow } from '../../src/game/resultCard';
import { SHEET_COLUMNS, sheetHeading, sheetValue } from './resultSheetModel';

function take(state: MeetState, weight: number, good: boolean): MeetState {
  const declared = declareAttempt(state, { weight });
  if (!declared.ok) throw new Error(declared.error.message);
  const lights: JudgePanel = good ? ['white', 'white', 'white'] : ['red', 'red', 'red'];
  const resolved = resolveAttempt(declared.value, { lights });
  if (!resolved.ok) throw new Error(resolved.error.message);
  return resolved.value;
}

function rowFor(attempts: readonly (readonly [number, boolean])[]): ResultCardFlightRow {
  const state = attempts.reduce((meet, [weight, good]) => take(meet, weight, good), createMeet());
  const lifter = { name: 'Mara Vellum', sex: 'female' as const, bodyweightKg: 63.5, equipment: 'Raw', division: 'Open' };
  const card = buildResultCard({
    meet: { federation: 'Iron Union', name: 'Winter Open', dateIso: '2026-02-14', town: 'Sheffield', country: 'England' },
    lifter,
    state,
    ...(finalMeetTotal(state) === null ? {} : { placing: 1 }),
    field: [{ id: 'player', isPlayer: true, name: lifter.name, sex: lifter.sex, bodyweightKg: lifter.bodyweightKg, lot: 7, state, placing: finalMeetTotal(state) === null ? null : 1 }],
  });
  if (!card.ok) throw new Error(card.error.message);
  const row = card.card.field[0];
  if (row === undefined) throw new Error('The sheet lost its athlete.');
  return row;
}

describe('shared result sheet column mapping', () => {
  it('keeps the athlete, nine signed attempts, each best and the total in their public columns', () => {
    const row = rowFor([[100, true], [110, false], [110, true], [70, true], [75, true], [80, false], [140, true], [150, false], [150, true]]);
    assert.deepEqual(SHEET_COLUMNS.map((id) => sheetValue(row, id)), [
      '1', '7', 'Mara Vellum', '63.50', '100', '-110', '110', '110',
      '70', '75', '-80', '75', '140', '-150', '150', '150', '335', row.dotsText,
    ]);
    assert.deepEqual(SHEET_COLUMNS.map(sheetHeading), ['Place', 'Lot', 'Lifter', 'Wt kg', '1', '2', '3', 'BEST', '1', '2', '3', 'BEST', '1', '2', '3', 'BEST', 'Total', 'DOTS']);
  });

  it('keeps misses and untaken lifts honest on a bomb-out sheet', () => {
    const row = rowFor([[100, false], [100, false], [100, false]]);
    assert.deepEqual(SHEET_COLUMNS.map((id) => sheetValue(row, id)), [
      'DQ', '7', 'Mara Vellum', '63.50', '-100', '-100', '-100', '—',
      '—', '—', '—', '—', '—', '—', '—', '—', '—', '—',
    ]);
  });
});
