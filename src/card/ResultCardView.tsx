/**
 * ResultCardView.tsx — the shareable federation sheet (GDD §6.5).
 *
 * This is the surface GDD §12.2's Result card bar A/Bs against a real
 * scoresheet, and GDD §7.3 names as a Tier 3 high-fidelity surface: large,
 * static, where type has to read. The 16-bit nearest-neighbour grid still
 * exists in the index-grid renderer beside this file. The GDD does not
 * resolve §7.1 "throughout" against §6.5 / §7.3 / §12.2 for this surface;
 * this file follows the Result card bar. It does not rewrite the GDD. It
 * does not put a hall behind the sheet.
 *
 * WHAT THEY SHARE IS WHAT THEY SEE. Capture tools screenshot this view. Every
 * number comes from `resultCard.ts`. Layout is `PAPER`. Ink is `SHEET_CSS`
 * (the same 5-bit paper bank, expanded to CSS) so the sheet and the grid
 * renderer cannot drift onto two palettes.
 *
 * The body is a flight table, not a one-name plaque. Place is a rank in a
 * field. The committed live-board reference prints a squat+bench subtotal;
 * [R8] published meet pages do not, and this sheet follows [R8].
 *
 * There is no loaded-bar motif here. A published results sheet records
 * attempts, a best, a total, DOTS and place. Plate colours are gameplay
 * language on the platform, not a cartoon on a scoresheet.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ATTEMPT_GRID_HEADINGS,
  NO_VALUE_DISPLAY,
  sheetColumnHeading,
  type AttemptCell,
  type LiftRow,
  type ResultCard,
  type ResultCardFlightRow,
} from '../game/resultCard';
import { CARD_LABELS, FOOTER, PAPER } from './cardTuning';
import { SHEET_CSS } from './sheetPalette';

const P = PAPER;
const F = PAPER.FLIGHT;
const C = SHEET_CSS;

export interface ResultCardViewProps {
  readonly card: ResultCard;
  /**
   * Integer upscale for the §7.1 grid renderer. Ignored here: the paper sheet
   * is authored in logical points (`PAPER.W`), not upscaled sprite pixels.
   */
  readonly scale?: number;
}

function DoubleRule(): React.ReactElement {
  return (
    <View style={styles.doubleRule}>
      <View style={styles.ruleHeavy} />
      <View style={styles.rule} />
    </View>
  );
}

function AttemptFigure({ cell }: { readonly cell: AttemptCell }): React.ReactElement {
  if (cell.text === '') {
    return <View style={styles.cellFill} />;
  }
  const miss = cell.mark === 'no-lift';
  return (
    <View style={[styles.cellFill, miss ? styles.cellMiss : styles.cellGood]}>
      <Text
        style={[
          styles.cellText,
          miss ? styles.cellMissText : styles.cellInk,
          cell.struckThrough ? styles.struck : null,
        ]}
      >
        {cell.text}
      </Text>
    </View>
  );
}

function LiftGroup({ row }: { readonly row: LiftRow }): React.ReactElement {
  return (
    <View style={styles.liftGroup}>
      {row.attempts.map((cell) => (
        <View key={cell.attemptNumber} style={styles.cell}>
          <AttemptFigure cell={cell} />
        </View>
      ))}
    </View>
  );
}

function FlightHead({ card }: { readonly card: ResultCard }): React.ReactElement {
  return (
    <View style={styles.flightHead}>
      <View style={styles.summaryHead}>
        <Text style={[styles.headText, styles.placeCol]}>{sheetColumnHeading('place')}</Text>
        <Text style={[styles.headText, styles.nameCol]}>{sheetColumnHeading('lifter')}</Text>
        <Text style={[styles.headText, styles.weightCol]}>{sheetColumnHeading('bodyweight')}</Text>
        <Text style={[styles.headText, styles.totalCol]}>{sheetColumnHeading('total')}</Text>
        <Text style={[styles.headText, styles.dotsCol]}>{sheetColumnHeading('dots')}</Text>
      </View>
      <View style={styles.attemptHead}>
        {card.rows.map((row) => (
          <View key={row.lift} style={styles.liftGroupHead}>
            <Text style={styles.liftHead}>{row.label}</Text>
            <View style={styles.attemptNums}>
              {ATTEMPT_GRID_HEADINGS.attempts.map((heading) => (
                <Text key={heading} style={styles.attemptHeadText}>
                  {heading}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function FlightRowView({
  row,
  odd,
}: {
  readonly row: ResultCardFlightRow;
  readonly odd: boolean;
}): React.ReactElement {
  return (
    <View
      style={[styles.flightRow, row.isPlayer ? styles.playerRow : odd ? styles.rowOdd : styles.rowEven]}
      testID={`result-card-flight-row-${row.id}`}
    >
      <View style={styles.summaryRow}>
        <Text style={[styles.placeText, styles.placeCol]}>{row.placeText}</Text>
        <Text style={[styles.nameText, styles.nameCol]} numberOfLines={1}>
          {row.name.toUpperCase()}
        </Text>
        <Text style={[styles.metaText, styles.weightCol]}>{row.bodyweightText}</Text>
        <Text style={[styles.totalText, styles.totalCol, row.totalKg === null ? styles.inkSoft : styles.cellInk]}>
          {row.totalText}
        </Text>
        <Text style={[styles.metaText, styles.dotsCol, row.dotsText === NO_VALUE_DISPLAY ? styles.inkSoft : styles.cellInk]}>
          {row.dotsText}
        </Text>
      </View>
      <View style={styles.attemptRow}>
        {row.rows.map((lift) => (
          <LiftGroup key={lift.lift} row={lift} />
        ))}
      </View>
    </View>
  );
}

export function ResultCardView({ card }: ResultCardViewProps): React.ReactElement {
  const location = card.meet.locationText !== '' ? card.meet.locationText : card.meet.locationShortText;

  return (
    <View style={styles.sheet} testID="result-card-sheet">
      <View style={styles.masthead}>
        <View style={styles.mastheadRow}>
          <Text style={styles.federation}>{card.meet.federation}</Text>
          <Text style={styles.documentKind}>{CARD_LABELS.DOCUMENT_KIND}</Text>
        </View>
        <Text style={styles.meetName}>{card.meet.name.toUpperCase()}</Text>
        <View style={styles.mastheadRow}>
          <Text style={styles.meta}>{card.meet.dateText}</Text>
          <Text style={styles.meta}>{location.toUpperCase()}</Text>
        </View>
      </View>

      <DoubleRule />

      <Text style={styles.section}>{card.lifter.categoryText}</Text>

      <View style={styles.flight} testID="result-card-flight">
        <FlightHead card={card} />
        {card.field.map((row, index) => (
          <FlightRowView key={row.id} row={row} odd={index % 2 === 1} />
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.rule} />
        <Text style={styles.wordmark}>{FOOTER.WORDMARK}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: P.W,
    backgroundColor: C.PAPER,
    paddingHorizontal: P.PAD_X,
    paddingTop: P.PAD_Y,
    paddingBottom: P.PAD_Y,
  },
  masthead: {
    gap: P.MASTHEAD_GAP,
  },
  mastheadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  federation: {
    color: C.INK,
    fontSize: P.FED_SIZE,
    letterSpacing: P.FED_TRACKING,
    fontWeight: '700',
  },
  documentKind: {
    color: C.INK_SOFT,
    fontSize: P.DOCUMENT_SIZE,
    letterSpacing: P.DOCUMENT_TRACKING,
    fontWeight: '700',
  },
  meetName: {
    color: C.INK,
    fontSize: P.MEET_SIZE,
    fontWeight: '700',
  },
  meta: {
    color: C.INK_SOFT,
    fontSize: P.META_SIZE,
    letterSpacing: P.META_TRACKING,
  },
  doubleRule: {
    marginTop: P.SECTION_GAP,
    gap: P.DOUBLE_RULE_GAP,
  },
  rule: {
    height: P.RULE,
    backgroundColor: C.RULE,
  },
  ruleHeavy: {
    height: P.RULE,
    backgroundColor: C.INK,
  },
  section: {
    marginTop: P.SECTION_GAP,
    color: C.INK_SOFT,
    fontSize: F.SECTION_SIZE,
    letterSpacing: F.SECTION_TRACKING,
    fontWeight: '700',
  },
  flight: {
    marginTop: P.NAME_GAP,
    borderTopWidth: P.RULE,
    borderBottomWidth: P.RULE,
    borderColor: C.INK,
  },
  flightHead: {
    backgroundColor: C.PAPER_SHADE,
    borderBottomWidth: P.RULE,
    borderBottomColor: C.INK,
  },
  summaryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    height: F.HEAD_H,
  },
  attemptHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: F.ATTEMPT_PAD,
  },
  headText: {
    color: C.INK_SOFT,
    fontSize: F.HEAD_SIZE,
    letterSpacing: P.GRID_HEAD_TRACKING,
    fontWeight: '700',
  },
  liftHead: {
    color: C.INK_SOFT,
    fontSize: F.LIFT_HEAD_SIZE,
    letterSpacing: P.GRID_HEAD_TRACKING,
    fontWeight: '700',
    textAlign: 'center',
  },
  attemptNums: {
    flexDirection: 'row',
  },
  attemptHeadText: {
    flex: 1,
    color: C.INK_SOFT,
    fontSize: F.LIFT_HEAD_SIZE,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: P.CELL_PAD,
  },
  flightRow: {
    borderBottomWidth: P.RULE,
    borderBottomColor: C.RULE,
  },
  rowEven: {
    backgroundColor: C.PAPER,
  },
  rowOdd: {
    backgroundColor: C.PAPER_ALT,
  },
  playerRow: {
    backgroundColor: C.PAPER_SHADE,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: F.NAME_H,
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: F.ATTEMPT_H,
    paddingBottom: F.ATTEMPT_PAD,
  },
  placeCol: {
    width: F.PLACE_W,
    paddingHorizontal: P.CELL_PAD,
  },
  nameCol: {
    flex: 1,
    paddingHorizontal: P.CELL_PAD,
  },
  weightCol: {
    width: F.WEIGHT_W,
    paddingHorizontal: P.CELL_PAD,
    textAlign: 'right',
  },
  totalCol: {
    width: F.TOTAL_W,
    paddingHorizontal: P.CELL_PAD,
    textAlign: 'right',
  },
  dotsCol: {
    width: F.DOTS_W,
    paddingHorizontal: P.CELL_PAD,
    textAlign: 'right',
  },
  placeText: {
    color: C.INK,
    fontSize: F.NAME_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  nameText: {
    color: C.INK,
    fontSize: F.NAME_SIZE,
    fontWeight: '700',
  },
  metaText: {
    color: C.INK,
    fontSize: F.META_SIZE,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  totalText: {
    fontSize: F.NAME_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  liftGroup: {
    flex: 1,
    flexDirection: 'row',
  },
  liftGroupHead: {
    flex: 1,
  },
  cell: {
    flex: 1,
    justifyContent: 'center',
  },
  cellFill: {
    flex: 1,
    margin: P.CELL_INSET,
    justifyContent: 'center',
    paddingHorizontal: P.CELL_PAD,
  },
  cellGood: {
    backgroundColor: C.GOOD_LIGHT,
  },
  cellMiss: {
    backgroundColor: C.NOLIFT_LIGHT,
  },
  cellText: {
    fontSize: F.ATTEMPT_FONT,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  cellInk: {
    color: C.INK,
  },
  cellMissText: {
    color: C.NOLIFT_DARK,
  },
  inkSoft: {
    color: C.INK_SOFT,
  },
  struck: {
    textDecorationLine: 'line-through',
    textDecorationColor: C.NOLIFT_DARK,
  },
  footer: {
    marginTop: P.SECTION_GAP,
    gap: P.NAME_GAP,
    alignItems: 'center',
  },
  wordmark: {
    color: C.INK_SOFT,
    fontSize: P.FOOTER_SIZE,
    letterSpacing: P.FOOTER_TRACKING,
    fontWeight: '700',
  },
});
