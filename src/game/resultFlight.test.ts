import { describe, expect, it } from 'vitest';

import { finalMeetTotal } from './meet';
import { placingForMeet } from './meetBoard';
import { buildMeetRecap, type MeetDayState } from './meetDay';
import { MEET_FIELD_FIXTURE, MEET_PREVIEW } from './meetTuning';
import { previewStateFor } from './meetPreview';
import { WEIGHT_CLASSES_KG, weightClassString } from './resultCard';
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
    expect(card.field.some((row) => row.name === 'M. ASHFORD')).toBe(true);
    const plannedMisses = state.field.cards.reduce(
      (count, cardRow) => count + cardRow.plan.filter((attempt) => !attempt.good).length,
      0,
    );
    const printedMisses = card.field
      .filter((row) => !row.isPlayer)
      .flatMap((row) => row.rows.flatMap((lift) => [...lift.attempts]))
      .filter((cell) => cell.mark === 'no-lift').length;
    expect(printedMisses).toBe(plannedMisses);
  });

  it('keeps every printed bodyweight in the player\'s class', () => {
    const classes = WEIGHT_CLASSES_KG[state.context.entry.sex];
    const playerClass = weightClassString(state.context.entry.bodyweight.kilograms, classes);
    expect(playerClass).toBe('93');
    for (const row of flightEntriesForCard(state, undefined)) {
      expect(weightClassString(row.bodyweightKg, classes), row.name).toBe(playerClass);
    }
  });
});
