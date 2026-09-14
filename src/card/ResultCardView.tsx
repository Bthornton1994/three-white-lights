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
 * The body is a published meet table, not a one-name plaque, not a two-line
 * recap, and not a box-score with a best stacked over an attempt history. One
 * row per lifter. Place is a rank in a field. Each lift is three attempt
 * cells — the scoresheet grid — driven by `RESULT_FLIGHT_TABLE_COLUMNS` and
 * `flightAttemptView`. On 390-wide paper those three sit in a stack under the
 * lift heading so the kilos stay whole. Misses are struck. The made best is
 * the heavier weight, not a fourth column. No squat+bench subtotal.
 *
 * The sheet fills the phone. The table does not stretch with it — six packed
 * rows on a full page of paper, footer rule at the bottom. No gold winner
 * fill; zebra is the same at every place.
 *
 * There is no loaded-bar motif here. Plate colours are gameplay language on
 * the platform, not a cartoon on a scoresheet.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  FLIGHT_LIFT_GROUPS,
  NO_VALUE_DISPLAY,
  RESULT_FLIGHT_TABLE_COLUMNS,
  flightAttemptView,
  flightColumnHeading,
  flightLifterName,
  sheetColumnHeading,
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

function identityCol(id: ResultSheetColumnId): StyleProp<ViewStyle> | null {
  switch (id) {
    case 'place':
      return styles.placeCol;
    case 'lifter':
      return styles.nameCol;
    case 'bodyweight':
      return styles.weightCol;
    case 'total':
      return styles.totalCol;
    case 'dots':
      return styles.dotsCol;
    default:
      return null;
  }
}

function HeadCell({
  id,
  align,
}: {
  readonly id: ResultSheetColumnId;
  readonly align: 'left' | 'right';
}): React.ReactElement {
  const col = identityCol(id);
  if (col === null) return <></>;
  return (
    <View style={[styles.headCell, col]}>
      <Text
        style={[styles.headText, align === 'right' ? styles.headRight : null]}
        numberOfLines={1}
      >
        {flightColumnHeading(id)}
      </Text>
    </View>
  );
}

function FlightHead(): React.ReactElement {
  const identity = RESULT_FLIGHT_TABLE_COLUMNS.filter((id) => identityCol(id) !== null);
  const beforeLifts = identity.filter((id) => id !== 'total' && id !== 'dots');
  const afterLifts = identity.filter((id) => id === 'total' || id === 'dots');
  return (
    <View style={styles.flightHead}>
      {beforeLifts.map((id) => (
        <HeadCell
          key={id}
          id={id}
          align={id === 'place' || id === 'lifter' ? 'left' : 'right'}
        />
      ))}
      {FLIGHT_LIFT_GROUPS.map((group) => (
        <View key={group.headingId} style={styles.liftCol}>
          <Text style={[styles.headText, styles.liftHeadText, styles.headRight]} numberOfLines={1}>
            {sheetColumnHeading(group.headingId)}
          </Text>
        </View>
      ))}
      {afterLifts.map((id) => (
        <HeadCell key={id} id={id} align="right" />
      ))}
    </View>
  );
}

function LiftAttemptStack({
  row,
  attempts,
}: {
  readonly row: ResultCardFlightRow;
  readonly attempts: readonly [ResultSheetColumnId, ResultSheetColumnId, ResultSheetColumnId];
}): React.ReactElement {
  return (
    <View style={styles.liftCol}>
      {attempts.map((id) => {
        const attempt = flightAttemptView(row, id);
        if (attempt === null) {
          return <View key={id} />;
        }
        return (
          <Text
            key={id}
            style={[
              styles.attemptText,
              attempt.struckThrough ? styles.attemptMiss : styles.cellInk,
              attempt.best ? styles.attemptBest : null,
            ]}
            numberOfLines={1}
          >
            {attempt.text}
          </Text>
        );
      })}
    </View>
  );
}

function FlightCell({
  row,
  id,
}: {
  readonly row: ResultCardFlightRow;
  readonly id: ResultSheetColumnId;
}): React.ReactElement | null {
  if (id === 'place') {
    return (
      <View style={styles.placeCol}>
        <Text style={styles.placeText} numberOfLines={1}>
          {row.placeText}
        </Text>
      </View>
    );
  }
  if (id === 'lifter') {
    return (
      <View style={styles.nameCol}>
        <Text style={styles.nameText} numberOfLines={1}>
          {flightLifterName(row.name)}
        </Text>
      </View>
    );
  }
  if (id === 'bodyweight') {
    return (
      <View style={styles.weightCol}>
        <Text style={styles.metaText} numberOfLines={1}>
          {row.bodyweightText}
        </Text>
      </View>
    );
  }
  if (id === 'total') {
    return (
      <View style={styles.totalCol}>
        <Text
          style={[styles.totalText, row.totalKg === null ? styles.inkSoft : styles.cellInk]}
          numberOfLines={1}
        >
          {row.totalText}
        </Text>
      </View>
    );
  }
  if (id === 'dots') {
    return (
      <View style={styles.dotsCol}>
        <Text
          style={[styles.metaText, row.dotsText === NO_VALUE_DISPLAY ? styles.inkSoft : styles.cellInk]}
          numberOfLines={1}
        >
          {row.dotsText}
        </Text>
      </View>
    );
  }
  return null;
}

function FlightRowView({
  row,
  odd,
}: {
  readonly row: ResultCardFlightRow;
  readonly odd: boolean;
}): React.ReactElement {
  const identity = RESULT_FLIGHT_TABLE_COLUMNS.filter((id) => identityCol(id) !== null);
  const beforeLifts = identity.filter((id) => id !== 'total' && id !== 'dots');
  const afterLifts = identity.filter((id) => id === 'total' || id === 'dots');
  return (
    <View
      style={[
        styles.flightRow,
        odd ? styles.rowOdd : styles.rowEven,
        row.isPlayer ? styles.playerRow : null,
      ]}
      testID={`result-card-flight-row-${row.id}`}
    >
      {beforeLifts.map((id) => (
        <FlightCell key={id} row={row} id={id} />
      ))}
      {FLIGHT_LIFT_GROUPS.map((group) => (
        <LiftAttemptStack key={group.headingId} row={row} attempts={group.attempts} />
      ))}
      {afterLifts.map((id) => (
        <FlightCell key={id} row={row} id={id} />
      ))}
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

      <View style={styles.pageFill} />

      <View style={styles.footer}>
        <View style={styles.rule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
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
    fontStyle: 'normal',
  },
  documentKind: {
    color: C.INK_SOFT,
    fontSize: P.DOCUMENT_SIZE,
    letterSpacing: P.DOCUMENT_TRACKING,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  meetName: {
    color: C.INK,
    fontSize: P.MEET_SIZE,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  meta: {
    color: C.INK_SOFT,
    fontSize: P.META_SIZE,
    letterSpacing: P.META_TRACKING,
    fontStyle: 'normal',
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
    fontStyle: 'normal',
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
    fontStyle: 'normal',
  },
  headRight: {
    textAlign: 'right',
  },
  liftHeadText: {
    fontSize: F.LIFT_HEAD_SIZE,
  },
  flightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: P.RULE,
    borderBottomColor: C.RULE,
    paddingTop: F.ROW_PAD_Y,
    paddingBottom: F.ROW_PAD_Y,
    minHeight: F.ROW_H,
  },
  rowEven: {
    backgroundColor: C.PAPER,
  },
  rowOdd: {
    backgroundColor: C.PAPER_ALT,
  },
  playerRow: {
    // Same zebra as every other place. A gold #1 fill is souvenir-poster
    // language; a published meet table does not shade the winner. Untuned.
  },
  pageFill: {
    flex: 1,
  },
  placeCol: {
    width: F.PLACE_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  nameCol: {
    width: F.NAME_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  weightCol: {
    width: F.WEIGHT_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  liftCol: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: F.LIFT_PAD,
    justifyContent: 'center',
  },
  totalCol: {
    width: F.TOTAL_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  dotsCol: {
    width: F.DOTS_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  placeText: {
    color: C.INK,
    fontSize: F.NAME_SIZE,
    fontWeight: '700',
    fontStyle: 'normal',
    fontVariant: ['tabular-nums'],
  },
  nameText: {
    color: C.INK,
    fontSize: F.NAME_SIZE,
    fontWeight: '500',
    fontStyle: 'normal',
  },
  metaText: {
    color: C.INK,
    fontSize: F.META_SIZE,
    fontStyle: 'normal',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  totalText: {
    fontSize: F.BEST_SIZE,
    fontWeight: '700',
    fontStyle: 'normal',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  attemptText: {
    fontSize: F.ATTEMPT_SIZE,
    fontWeight: '400',
    fontStyle: 'normal',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  attemptBest: {
    fontWeight: '700',
  },
  attemptMiss: {
    color: C.INK_SOFT,
    textDecorationLine: 'line-through',
  },
  cellInk: {
    color: C.INK,
  },
  inkSoft: {
    color: C.INK_SOFT,
  },
  footer: {
    marginTop: P.SECTION_GAP,
  },
});
