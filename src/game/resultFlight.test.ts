import { describe, expect, it } from 'vitest';

import { finalMeetTotal } from './meet';
import { placingForMeet } from './meetBoard';
import { buildMeetRecap, type MeetDayState } from './meetDay';
import { MEET_ENTRY, MEET_FIELD_FIXTURE, MEET_PREVIEW } from './meetTuning';
import { SHAREABLE_PREVIEW_NAME, previewStateFor } from './meetPreview';
import {
  RESULT_FLIGHT_TABLE_COLUMNS,
  WEIGHT_CLASSES_KG,
  flightAttemptView,
  flightLifterName,
  signedAttemptText,
  weightClassString,
} from './resultCard';
import { flightEntriesForCard, shareableResultCard } from './resultFlight';

function confirmedForPreview(state: MeetDayState) {
  const placing = placingForMeet(
    state.meet,
    state.context.entry.bodyweight.kilograms,
    state.context.entry.lot,
    state.field,
  );
  return {
    totalKg: finalMeetTotal(state.meet),
    previousBestTotalKg: MEET_PREVIEW.PREVIOUS_BEST_TOTAL_KG,
    isTotalPr: false,
    liftPrs: { squat: false, bench: false, deadlift: false },
    bestByLiftKg: {
      squat: state.meet.lifts.squat.best,
      bench: state.meet.lifts.bench.best,
      deadlift: state.meet.lifts.deadlift.best,
    },
    previousBestByLiftKg: { ...MEET_PREVIEW.PREVIOUS_BEST_BY_LIFT_KG },
    placing: { place: placing.place, fieldSize: placing.fieldSize },
  };
}

describe('the shareable card carries the flight', () => {
  const state = previewStateFor({ moment: 'recap-card' });

  it('includes every named competitor plus the player', () => {
    const entries = flightEntriesForCard(state, undefined);
    expect(entries).toHaveLength(MEET_FIELD_FIXTURE.length + 1);
    expect(entries.some((row) => row.isPlayer && row.name === state.context.entry.name)).toBe(true);
    expect(entries.map((row) => row.name)).toEqual(
      expect.arrayContaining(MEET_FIELD_FIXTURE.map((spec) => spec.name)),
    );
  });

  it('names the player with the produced identity, not the debug job title', () => {
    expect(MEET_ENTRY.name).toBe('A. LIFTER');
    expect(previewStateFor({ moment: 'weigh-in' }).context.entry.name).toBe(MEET_ENTRY.name);
    expect(state.context.entry.name).toBe(SHAREABLE_PREVIEW_NAME);
    expect(previewStateFor({ moment: 'recap' }).context.entry.name).toBe(SHAREABLE_PREVIEW_NAME);
    const player = flightEntriesForCard(state, undefined).find((row) => row.isPlayer);
    expect(player?.name).toBe(SHAREABLE_PREVIEW_NAME);
    expect(flightLifterName(player?.name ?? '')).toBe(SHAREABLE_PREVIEW_NAME);
    expect(flightLifterName(player?.name ?? '')).not.toMatch(/LIFTER/);
  });

  it('uses the same placing comparator as the board, then prints it', () => {
    const placing = placingForMeet(
      state.meet,
      state.context.entry.bodyweight.kilograms,
      state.context.entry.lot,
      state.field,
    );
    const built = buildMeetRecap(state, confirmedForPreview(state));
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error(built.error.message);
    const card = shareableResultCard(state, built.recap);
    expect(card.field.length).toBe(MEET_FIELD_FIXTURE.length + 1);
    const player = card.field.find((row) => row.isPlayer);
    expect(player?.place).toBe(placing.place);
    expect(player?.placeText).toBe(built.recap.placeText);
    expect(player?.bodyweightText).toBe('92.40');
    expect(card.field.some((row) => row.name === 'Cal Wether')).toBe(true);
    for (const row of card.field) {
      expect(
        weightClassString(Number(row.bodyweightText), WEIGHT_CLASSES_KG.male),
        `${row.name} at ${row.bodyweightText} kg`,
      ).toBe(card.lifter.weightClassText);
    }
    const plannedMisses = state.field.cards.reduce(
      (count, cardRow) => count + cardRow.plan.filter((attempt) => !attempt.good).length,
      0,
    );
    const printedMisses = card.field
      .filter((row) => !row.isPlayer)
      .flatMap((row) => row.rows.flatMap((lift) => [...lift.attempts]))
      .filter((cell) => cell.mark === 'no-lift').length;
    expect(printedMisses).toBe(plannedMisses);
    const harrow = card.field.find((row) => row.name === 'Jon Harrow');
    expect(harrow).toBeDefined();
    if (harrow === undefined) throw new Error('Jon Harrow missing from the flight');
    const bench = harrow.rows.find((lift) => lift.lift === 'bench');
    expect(bench?.bestText).toBe('117.5');
    expect(bench?.attempts.map((cell) => signedAttemptText(cell))).toEqual(['107.5', '117.5', '-120']);
    expect(RESULT_FLIGHT_TABLE_COLUMNS).toContain('squat1');
    expect(RESULT_FLIGHT_TABLE_COLUMNS).not.toContain('bestSquat');
    expect(flightAttemptView(harrow, 'bench1')).toEqual({
      text: '107.5',
      struckThrough: false,
      best: false,
    });
    expect(flightAttemptView(harrow, 'bench2')).toEqual({
      text: '117.5',
      struckThrough: false,
      best: true,
    });
    expect(flightAttemptView(harrow, 'bench3')).toEqual({
      text: '120',
      struckThrough: true,
      best: false,
    });
    expect(flightAttemptView(harrow, 'total')).toBeNull();
  });
});
