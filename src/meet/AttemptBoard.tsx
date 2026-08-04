/**
 * AttemptBoard — one lift's three attempts, as a meet's own attempt board draws
 * them.
 *
 * GDD §6.5 wants an "attempt-by-attempt breakdown" on the recap, and §6.3's
 * bomb-out beat needs the same three cells to show what happened. One component
 * for both, so the two screens cannot disagree about what a missed attempt
 * looks like.
 *
 * THE CONVENTION IS CITED, AND IT IS `resultCard.ts`'S. A made attempt is
 * printed plain; a missed one is struck through. That module's header sources
 * the underlying fact (published results record a miss as the NEGATIVE of the
 * weight — OpenPowerlifting's `WeightKg::is_failed`, OpenLifter's export) and
 * says plainly that the STRIKE is our presentation of it, not a federation's.
 * The committed reference image is a live attempt board using red/green cell
 * fill, which the reference README licenses for exactly this — so this board
 * uses both, because redundancy is cheap.
 *
 * NO LOGIC. Which attempts exist and whether each stood is decided in
 * `meetDay.ts`.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ATTEMPT_NUMBERS, type LiftKind } from '../game/meet';
import { MEET_COPY, MEET_LAYOUT } from '../game/meetTuning';
import type { MeetDayAttempt } from '../game/meetDay';
import { formatWeight } from '../game/resultCard';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

export interface AttemptBoardProps {
  readonly lift: LiftKind;
  /** Every attempt in the meet; this filters to the lift itself. */
  readonly attempts: readonly MeetDayAttempt[];
  /** Shown to the right of the row when the lift set a competition PR. */
  readonly prLabel?: string | undefined;
}

export function AttemptBoard({ lift, attempts, prLabel }: AttemptBoardProps): React.ReactElement {
  const onLift = attempts.filter((attempt) => attempt.lift === lift);
  return (
    <View style={styles.row} testID={`attempt-board-${lift}`}>
      <Text style={styles.label}>{MEET_COPY.LIFT_LABEL[lift]}</Text>
      {ATTEMPT_NUMBERS.map((attemptNumber) => {
        const attempt = onLift.find((candidate) => candidate.attemptNumber === attemptNumber) ?? null;
        return (
          <View
            key={attemptNumber}
            testID={`attempt-cell-${lift}-${attemptNumber}`}
            style={[
              styles.cell,
              attempt === null
                ? styles.cellEmpty
                : attempt.good
                  ? styles.cellGood
                  : styles.cellNoLift,
            ]}
          >
            <Text
              style={[styles.cellText, attempt !== null && !attempt.good ? styles.cellStruck : null]}
            >
              {attempt === null ? '' : formatWeight(attempt.weightKg)}
            </Text>
          </View>
        );
      })}
      {prLabel === undefined ? null : (
        <Text style={styles.pr} testID={`attempt-board-pr-${lift}`}>
          {prLabel}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: L.BOARD_GAP,
  },
  label: {
    width: L.BOARD_LABEL_W,
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: L.LABEL_FONT,
    letterSpacing: L.LETTER_SPACING,
  },
  cell: {
    width: L.BOARD_CELL_W,
    height: L.BOARD_CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: L.DIVIDER_HEIGHT,
    borderRadius: L.BOARD_GAP,
  },
  cellGood: {
    backgroundColor: MEET_PALETTE.BOARD_GOOD,
    borderColor: MEET_PALETTE.BOARD_GOOD_EDGE,
  },
  cellNoLift: {
    backgroundColor: MEET_PALETTE.BOARD_NO_LIFT,
    borderColor: MEET_PALETTE.BOARD_NO_LIFT_EDGE,
  },
  cellEmpty: {
    backgroundColor: MEET_PALETTE.BOARD_EMPTY,
    borderColor: MEET_PALETTE.BOARD_EMPTY_EDGE,
  },
  cellText: {
    color: MEET_PALETTE.TEXT,
    fontSize: L.BODY_FONT,
    fontWeight: '700',
  },
  cellStruck: {
    color: MEET_PALETTE.TEXT_DIM,
    textDecorationLine: 'line-through',
  },
  pr: {
    color: MEET_PALETTE.PR,
    fontSize: L.LABEL_FONT,
    fontWeight: '700',
    letterSpacing: L.LETTER_SPACING,
  },
});
