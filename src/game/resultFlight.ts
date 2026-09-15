/**
 * resultFlight.ts — the shareable sheet's flight, as DATA.
 *
 * GDD §6.5's card is a federation result sheet. A placing is a rank in a
 * field (GDD §6.6 local NPC flights). `meetBoard.ts` already ranks that
 * field; this module does not invent a second comparator. It asks
 * `placingForMeet` / `placeSubjects` for places, reads official totals from
 * `meet.ts`, and hands rows to `buildResultCard`.
 *
 * WHY THIS FILE EXISTS AT ALL. `meetDay.ts` and `meetBoard.ts` are A1
 * competition authorities (see `a2LifterFreeze.test.ts`). Attaching the flight
 * to the sheet cannot edit those modules. The recap still builds a one-lifter
 * card; `MeetScreen` hands that card plus the finished `MeetDayState` through
 * `shareableResultCard` before `ResultCardView` draws.
 *
 * PURITY: zero React, zero I/O, no clock. Ranking stays in `meetBoard.ts`.
 */

import { finalMeetTotal } from './meet';
import { officialTotalKg } from './meetField';
import {
  PLAYER_ID,
  achievedSeqByLifter,
  placeSubjects,
  type PlacingSubject,
} from './meetBoard';
import {
  buildResultCard,
  type ResultCard,
  type ResultCardFlightEntry,
} from './resultCard';
import type { MeetDayState, MeetRecap } from './meetDay';

function integerPlace(value: string): number | undefined {
  if (!/^[1-9][0-9]*$/.test(value)) return undefined;
  return Number(value);
}

export function flightEntriesForCard(
  state: MeetDayState,
  playerPlacing: number | undefined,
): readonly ResultCardFlightEntry[] {
  const entry = state.context.entry;
  const seqAt = achievedSeqByLifter(state.field, state.meet, entry.lot, null);
  const subjects: PlacingSubject[] = [
    {
      id: PLAYER_ID,
      totalKg: finalMeetTotal(state.meet),
      bodyweightKg: entry.bodyweight.kilograms,
      achievedSeq: seqAt[PLAYER_ID] ?? 0,
      lot: entry.lot,
    },
    ...state.field.cards.map((card) => ({
      id: card.lifter.id,
      totalKg: officialTotalKg(card),
      bodyweightKg: card.lifter.bodyweightKg,
      achievedSeq: seqAt[card.lifter.id] ?? 0,
      lot: card.lifter.lot,
    })),
  ];
  const placed = placeSubjects(subjects);
  const playerPlace = playerPlacing ?? placed.placeById.get(PLAYER_ID) ?? null;
  return [
    {
      id: PLAYER_ID,
      name: entry.name,
      sex: entry.sex,
      bodyweightKg: entry.bodyweight.kilograms,
      isPlayer: true,
      state: state.meet,
      placing: playerPlace,
      lot: entry.lot,
    },
    ...state.field.cards.map((card) => ({
      id: card.lifter.id,
      name: card.lifter.name,
      sex: entry.sex,
      bodyweightKg: card.lifter.bodyweightKg,
      isPlayer: false,
      state: card.meet,
      placing: placed.placeById.get(card.lifter.id) ?? null,
      lot: card.lifter.lot,
    })),
  ];
}

/**
 * The card a player can screenshot. Rebuilds the recap's card with the
 * flight attached. If the rebuild refuses or the total disagrees with the
 * recap (server truth), the recap's card is returned unchanged.
 */
export function shareableResultCard(state: MeetDayState, recap: MeetRecap): ResultCard {
  const entry = state.context.entry;
  const definition = state.context.meet;
  const placing = recap.card.placed ? integerPlace(recap.card.summary[2].value) : undefined;
  const built = buildResultCard({
    meet: {
      federation: definition.federation,
      name: definition.name,
      dateIso: definition.dateIso,
      town: definition.town,
      state: definition.state,
      country: definition.country,
    },
    lifter: {
      name: entry.name,
      sex: entry.sex,
      bodyweightKg: entry.bodyweight.kilograms,
      division: entry.division,
      equipment: entry.equipment,
    },
    state: state.meet,
    field: flightEntriesForCard(state, placing),
    ...(placing === undefined ? {} : { placing }),
  });
  if (!built.ok) return recap.card;
  if (built.card.totalKg !== recap.totalKg) return recap.card;
  return built.card;
}
