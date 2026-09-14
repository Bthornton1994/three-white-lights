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
 * The body is a published flight table, not a one-name plaque and not a
 * two-line recap. One row per lifter. Place is a rank in a field. Squat,
 * bench and deadlift bests are first-class columns. Missed attempts are
 * signed negatives, struck and tinted; good attempts are ink on paper, not
 * scoreboard pills. The committed live-board reference paints every cell and a
 * squat+bench subtotal; [R8] published meet pages do not. This sheet follows
 * [R8] for the subtotal. It keeps the three attempts visible inside each lift
 * cell so a miss is still a recorded fact, not a vanished chip.
 *
 * There is no loaded-bar motif here. A published results sheet records
 * attempts, a best, a total, DOTS and place. Plate colours are gameplay
 * language on the platform, not a cartoon on a scoresheet.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  NO_VALUE_DISPLAY,
  RESULT_FLIGHT_TABLE_COLUMNS,
  flightColumnHeading,
  signedAttemptText,
  type AttemptCell,
  type LiftRow,
  type ResultCard,
  type ResultCardFlightRow,
  type ResultSheetColumnId,
} from '../game/resultCard';
import { CARD_LABELS, PAPER } from './cardTuning';
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

function colStyle(id: ResultSheetColumnId): StyleProp<ViewStyle> {
  switch (id) {
    case 'place':
      return styles.placeCol;
    case 'lifter':
      return styles.nameCol;
    case 'bodyweight':
      return styles.weightCol;
    case 'bestSquat':
    case 'bestBench':
    case 'bestDeadlift':
      return styles.liftCol;
    case 'total':
      return styles.totalCol;
    case 'dots':
      return styles.dotsCol;
    default:
      return styles.liftCol;
  }
}

function SignedAttempt({ cell }: { readonly cell: AttemptCell }): React.ReactElement {
  const text = signedAttemptText(cell);
  if (text === '') {
    return <View style={styles.attemptLine} />;
  }
  const miss = cell.mark === 'no-lift';
  return (
    <View style={[styles.attemptLine, miss ? styles.attemptMiss : null]}>
      <Text
        style={[
          styles.attemptText,
          miss ? styles.cellMissText : styles.cellInk,
          cell.struckThrough ? styles.struck : null,
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function LiftBestCell({ row }: { readonly row: LiftRow }): React.ReactElement {
  return (
    <View style={styles.liftCol}>
      <Text
        style={[styles.bestText, row.bestKg === null ? styles.inkSoft : styles.cellInk]}
        numberOfLines={1}
      >
        {row.bestText}
      </Text>
      {row.attempts.map((cell) => (
        <SignedAttempt key={cell.attemptNumber} cell={cell} />
      ))}
    </View>
  );
}

function HeadCell({
  id,
  align,
}: {
  readonly id: ResultSheetColumnId;
  readonly align: 'left' | 'right';
}): React.ReactElement {
  const liftHead = id === 'bestSquat' || id === 'bestBench' || id === 'bestDeadlift';
  return (
    <View style={[styles.headCell, colStyle(id)]}>
      <Text
        style={[
          styles.headText,
          liftHead ? styles.liftHeadText : null,
          align === 'right' ? styles.headRight : null,
        ]}
        numberOfLines={2}
      >
        {flightColumnHeading(id)}
      </Text>
    </View>
  );
}

function FlightHead(): React.ReactElement {
  return (
    <View style={styles.flightHead}>
      {RESULT_FLIGHT_TABLE_COLUMNS.map((id) => (
        <HeadCell
          key={id}
          id={id}
          align={id === 'place' || id === 'lifter' ? 'left' : 'right'}
        />
      ))}
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
      <View style={styles.placeCol}>
        <Text style={styles.placeText} numberOfLines={1}>
          {row.placeText}
        </Text>
      </View>
      <View style={styles.nameCol}>
        <Text style={styles.nameText} numberOfLines={1}>
          {row.name.toUpperCase()}
        </Text>
      </View>
      <View style={styles.weightCol}>
        <Text style={styles.metaText} numberOfLines={1}>
          {row.bodyweightText}
        </Text>
      </View>
      {row.rows.map((lift) => (
        <LiftBestCell key={lift.lift} row={lift} />
      ))}
      <View style={styles.totalCol}>
        <Text
          style={[styles.totalText, row.totalKg === null ? styles.inkSoft : styles.cellInk]}
          numberOfLines={1}
        >
          {row.totalText}
        </Text>
      </View>
      <View style={styles.dotsCol}>
        <Text
          style={[styles.metaText, row.dotsText === NO_VALUE_DISPLAY ? styles.inkSoft : styles.cellInk]}
          numberOfLines={1}
        >
          {row.dotsText}
        </Text>
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
        <FlightHead />
        {card.field.map((row, index) => (
          <FlightRowView key={row.id} row={row} odd={index % 2 === 1} />
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.rule} />
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: C.PAPER_SHADE,
    borderBottomWidth: P.RULE,
    borderBottomColor: C.INK,
    minHeight: F.HEAD_H,
    paddingBottom: F.ROW_PAD_Y,
    paddingTop: F.ROW_PAD_Y,
  },
  headCell: {
    justifyContent: 'flex-end',
  },
  headText: {
    color: C.INK_SOFT,
    fontSize: F.HEAD_SIZE,
    letterSpacing: F.HEAD_TRACKING,
    fontWeight: '700',
  },
  headRight: {
    textAlign: 'right',
  },
  liftHeadText: {
    fontSize: F.LIFT_HEAD_SIZE,
  },
  flightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: P.RULE,
    borderBottomColor: C.RULE,
    paddingTop: F.ROW_PAD_Y,
    paddingBottom: F.ROW_PAD_Y,
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
  placeCol: {
    width: F.PLACE_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'flex-start',
  },
  nameCol: {
    width: F.NAME_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'flex-start',
  },
  weightCol: {
    width: F.WEIGHT_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'flex-start',
  },
  liftCol: {
    flex: 1,
    paddingHorizontal: F.LIFT_PAD,
    justifyContent: 'flex-start',
  },
  totalCol: {
    width: F.TOTAL_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'flex-start',
  },
  dotsCol: {
    width: F.DOTS_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'flex-start',
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
    fontSize: F.BEST_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  bestText: {
    fontSize: F.BEST_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    marginBottom: P.CELL_INSET,
  },
  attemptLine: {
    height: F.ATTEMPT_LINE_H,
    justifyContent: 'center',
    paddingHorizontal: P.CELL_INSET,
  },
  attemptMiss: {
    backgroundColor: C.NOLIFT_LIGHT,
  },
  attemptText: {
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
  },
});
