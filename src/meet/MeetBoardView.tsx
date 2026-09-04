/**
 * MeetBoardView — live flight standings between attempts.
 *
 * Renders `MeetBoard` only. No Total arithmetic, no placing math.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatWeight } from '../game/resultCard';
import { MEET_COPY, MEET_LAYOUT } from '../game/meetTuning';
import type { MeetBoard } from '../game/meetBoard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

export function MeetBoardView({
  board,
  onDeckName,
}: {
  readonly board: MeetBoard;
  readonly onDeckName: string | null;
}): React.ReactElement {
  return (
    <View style={styles.root} testID="meet-board">
      <View style={styles.flight} testID="meet-flight">
        <Text style={styles.flightLabel}>{MEET_COPY.BOARD_UP}</Text>
        <Text style={styles.flightValue}>{MEET_COPY.BOARD_YOU}</Text>
        {onDeckName === null ? null : (
          <>
            <Text style={styles.flightLabel}>{MEET_COPY.BOARD_ON_DECK}</Text>
            <Text style={styles.flightValue} testID="meet-on-deck">
              {onDeckName}
            </Text>
          </>
        )}
      </View>
      <View style={styles.table}>
        {board.rows.map((row) => (
          <View
            key={row.id}
            style={[styles.row, row.isPlayer ? styles.rowYou : null]}
            testID={row.isPlayer ? 'meet-board-you' : `meet-board-${row.id}`}
          >
            <Text style={[styles.place, row.isPlayer ? styles.youText : null]}>
              {row.place === null ? '—' : String(row.place)}
            </Text>
            <Text style={[styles.name, row.isPlayer ? styles.youText : null]} numberOfLines={1}>
              {row.isPlayer ? MEET_COPY.BOARD_YOU : row.name}
            </Text>
            <Text style={[styles.total, row.isPlayer ? styles.youText : null]}>
              {formatWeight(row.onTheBoardKg)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    gap: L.ROW_GAP / 2,
  },
  flight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: L.BOARD_FLIGHT_GAP,
  },
  flightLabel: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  flightValue: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
    marginRight: L.BOARD_FLIGHT_GAP,
  },
  table: {
    alignSelf: 'stretch',
    borderTopWidth: L.DIVIDER_HEIGHT,
    borderBottomWidth: L.DIVIDER_HEIGHT,
    borderColor: MEET_PALETTE.DIVIDER,
    paddingVertical: L.BOARD_ROW_PAD,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: L.DIVIDER_HEIGHT + L.DIVIDER_HEIGHT,
    gap: L.BOARD_FLIGHT_GAP,
  },
  rowYou: {
    backgroundColor: MEET_PALETTE.CARD_SAFE,
  },
  place: {
    width: L.BOARD_PLACE_W,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    color: MEET_PALETTE.TEXT,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  total: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
  },
  youText: {
    color: MEET_PALETTE.WALKOUT_URGENT,
  },
});
