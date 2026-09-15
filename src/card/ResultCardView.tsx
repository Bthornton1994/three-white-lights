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
 * One packed table: Place, Lot, Lifter, Wt kg, then Squat/Bench/Deadlift
 * as grouped 1/2/3 cells, then Total and DOTS. Attempts sit in the placing
 * row. Misses are the called weight struck through. No squat+bench
 * subtotal. No gold winner fill; zebra is the same at every place.
 *
 * Authored wider than a phone. ResultCardScreen scales the page so the
 * whole row is in the 390 frame. Blank form lines fill the page down to
 * the named officials.
 *
 * There is no loaded-bar motif here. Plate colours are gameplay language on
 * the platform, not a cartoon on a scoresheet.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  FLIGHT_LIFT_GROUPS,
  NO_VALUE_DISPLAY,
  RESULT_ATTEMPT_TABLE_COLUMNS,
  RESULT_FLIGHT_TABLE_COLUMNS,
  flightAttemptView,
  flightColumnHeading,
  flightLifterName,
  type ResultCard,
  type ResultCardFlightRow,
  type ResultSheetColumnId,
} from '../game/resultCard';
import { CARD_LABELS, PAPER, PAPER_PAGE_H } from './cardTuning';
import { SHEET_CSS } from './sheetPalette';

const P = PAPER;
const F = PAPER.FLIGHT;
const CERT = PAPER.CERT;
const MARK = PAPER.MARK;
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

function isLiftGroupEnd(id: ResultSheetColumnId): boolean {
  return id === 'squat3' || id === 'bench3' || id === 'deadlift3';
}

function attemptCellStyle(id: ResultSheetColumnId) {
  return [styles.attemptCol, isLiftGroupEnd(id) && styles.attemptColLiftEnd];
}

function FlightHead(): React.ReactElement {
  return (
    <View style={styles.tableHead}>
      <View style={[styles.placeCol, styles.headCell]}>
        <Text style={styles.headText} numberOfLines={1}>
          {flightColumnHeading('place')}
        </Text>
      </View>
      <View style={[styles.lotCol, styles.headCell]}>
        <Text style={styles.headText} numberOfLines={1}>
          {CARD_LABELS.LOT}
        </Text>
      </View>
      <View style={[styles.nameCol, styles.headCell]}>
        <Text style={styles.headText} numberOfLines={1}>
          {flightColumnHeading('lifter')}
        </Text>
      </View>
      <View style={[styles.weightCol, styles.headCell]}>
        <Text style={[styles.headText, styles.headRight]} numberOfLines={1}>
          {flightColumnHeading('bodyweight')}
        </Text>
      </View>
      {FLIGHT_LIFT_GROUPS.map((group) => (
        <View key={group.headingId} style={styles.liftGroup}>
          <Text style={[styles.liftHeadText, styles.headRight]} numberOfLines={1}>
            {flightColumnHeading(group.headingId)}
          </Text>
          <View style={styles.liftGroupAttempts}>
            {group.attempts.map((id, index) => (
              <View
                key={id}
                style={[
                  styles.attemptCol,
                  index === F.ATTEMPTS_PER_LIFT - 1 && styles.attemptColGroupEnd,
                ]}
              >
                <Text style={[styles.headText, styles.headRight]} numberOfLines={1}>
                  {flightColumnHeading(id)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <View style={[styles.totalCol, styles.headCell]}>
        <Text style={[styles.headText, styles.headRight]} numberOfLines={1}>
          {flightColumnHeading('total')}
        </Text>
      </View>
      <View style={[styles.dotsCol, styles.headCell]}>
        <Text style={[styles.headText, styles.headRight]} numberOfLines={1}>
          {flightColumnHeading('dots')}
        </Text>
      </View>
    </View>
  );
}

function IdentityCell({
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
  return (
    <View
      style={[styles.tableRow, odd ? styles.rowOdd : styles.rowEven, row.isPlayer ? styles.playerRow : null]}
      testID={`result-card-flight-row-${row.id}`}
    >
      {RESULT_FLIGHT_TABLE_COLUMNS.map((id) => {
        if (id === 'place') {
          return (
            <React.Fragment key={id}>
              <IdentityCell row={row} id="place" />
              <View style={styles.lotCol}>
                <Text style={styles.metaText} numberOfLines={1}>
                  {row.lotText}
                </Text>
              </View>
            </React.Fragment>
          );
        }
        if (id === 'lifter' || id === 'bodyweight' || id === 'total' || id === 'dots') {
          return <IdentityCell key={id} row={row} id={id} />;
        }
        const attempt = flightAttemptView(row, id);
        if (attempt === null) {
          return <View key={id} style={attemptCellStyle(id)} />;
        }
        return (
          <View key={id} style={attemptCellStyle(id)}>
            <Text
              style={[
                styles.attemptText,
                attempt.struckThrough ? styles.attemptMiss : styles.cellInk,
                attempt.best ? styles.attemptBest : null,
                attempt.struckThrough ? styles.attemptStrike : null,
              ]}
              numberOfLines={1}
            >
              {attempt.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function EmptyRow({ odd }: { readonly odd: boolean }): React.ReactElement {
  return (
    <View style={[styles.tableRow, odd ? styles.rowOdd : styles.rowEven]}>
      <View style={styles.placeCol} />
      <View style={styles.lotCol} />
      <View style={styles.nameCol} />
      <View style={styles.weightCol} />
      {RESULT_ATTEMPT_TABLE_COLUMNS.map((id) => (
        <View key={id} style={attemptCellStyle(id)} />
      ))}
      <View style={styles.totalCol} />
      <View style={styles.dotsCol} />
    </View>
  );
}

function SignLine({ role, name }: { readonly role: string; readonly name: string }): React.ReactElement {
  return (
    <View style={styles.signLine}>
      <Text style={styles.certText}>{role}</Text>
      <View style={styles.signRule}>
        <Text style={styles.signName}>{name}</Text>
      </View>
    </View>
  );
}

export function ResultCardView({ card }: ResultCardViewProps): React.ReactElement {
  const location = card.meet.locationText !== '' ? card.meet.locationText : card.meet.locationShortText;
  const filled = card.field.length;

  return (
    <View style={styles.sheet} testID="result-card-sheet">
      <View style={styles.masthead}>
        <View style={styles.mastheadRow}>
          <View style={styles.fedRow}>
            <View style={styles.fedMark}>
              <Text style={styles.fedMarkText}>{CARD_LABELS.FED_MARK}</Text>
            </View>
            <Text style={styles.federation}>{card.meet.federation}</Text>
          </View>
          <Text style={styles.documentKind}>{CARD_LABELS.DOCUMENT_KIND}</Text>
        </View>
        <Text style={styles.meetName}>{card.meet.name.toUpperCase()}</Text>
        <View style={styles.mastheadRow}>
          <Text style={styles.meta}>{card.meet.dateText}</Text>
          <Text style={styles.meta}>{location.toUpperCase()}</Text>
        </View>
        <Text style={styles.meta}>{CARD_LABELS.FLIGHT_META}</Text>
      </View>

      <DoubleRule />

      <Text style={styles.section}>{card.lifter.categoryText}</Text>
      <Text style={styles.section}>{CARD_LABELS.WEIGHTS_IN}</Text>

      <View style={styles.table} testID="result-card-flight">
        <FlightHead />
        {card.field.map((row, index) => (
          <FlightRowView key={row.id} row={row} odd={index % 2 === 1} />
        ))}
      </View>

      <View style={styles.blankBand}>
        {Array.from({ length: F.ATTEMPT_COLS + filled }, (_, index) => (
          <EmptyRow key={`blank-${index}`} odd={(filled + index) % 2 === 1} />
        ))}
      </View>

      <View style={styles.cert}>
        <View style={styles.rule} />
        <Text style={styles.certText}>{CARD_LABELS.POSTED}</Text>
        <View style={styles.signBlock}>
          <SignLine role={CARD_LABELS.REFEREE_1} name={CARD_LABELS.REFEREE_1_NAME} />
          <SignLine role={CARD_LABELS.REFEREE_2} name={CARD_LABELS.REFEREE_2_NAME} />
          <SignLine role={CARD_LABELS.REFEREE_3} name={CARD_LABELS.REFEREE_3_NAME} />
          <SignLine role={CARD_LABELS.TECHNICAL_SECRETARY} name={CARD_LABELS.SECRETARY_NAME} />
        </View>
        <View style={styles.mastheadRow}>
          <Text style={styles.certText}>{CARD_LABELS.UNSIGNED}</Text>
          <Text style={styles.certText}>{CARD_LABELS.PAGE}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: P.W,
    height: PAPER_PAGE_H,
    backgroundColor: C.PAPER,
    paddingHorizontal: P.PAD_X,
    paddingTop: P.PAD_Y,
    paddingBottom: P.PAD_Y,
    borderWidth: P.RULE,
    borderColor: C.INK,
  },
  masthead: {
    gap: P.MASTHEAD_GAP,
  },
  mastheadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  fedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MARK.GAP,
    flexShrink: 1,
  },
  fedMark: {
    borderWidth: P.RULE,
    borderColor: C.INK,
    paddingHorizontal: MARK.PAD_X,
    paddingVertical: MARK.PAD_Y,
  },
  fedMarkText: {
    color: C.INK,
    fontSize: MARK.SIZE,
    fontWeight: '700',
    fontStyle: 'normal',
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
    marginTop: P.NAME_GAP,
    color: C.INK_SOFT,
    fontSize: F.SECTION_SIZE,
    letterSpacing: F.SECTION_TRACKING,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  table: {
    marginTop: P.NAME_GAP,
    borderTopWidth: P.RULE,
    borderBottomWidth: P.RULE,
    borderColor: C.INK,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  liftHeadText: {
    color: C.INK,
    fontSize: F.LIFT_HEAD_SIZE,
    letterSpacing: F.HEAD_TRACKING,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  headRight: {
    textAlign: 'right',
  },
  liftGroup: {
    width: F.ATTEMPT_COL_W * F.ATTEMPTS_PER_LIFT,
    flexShrink: 0,
    justifyContent: 'space-between',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.INK,
  },
  liftGroupAttempts: {
    flexDirection: 'row',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  placeCol: {
    width: F.PLACE_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.RULE,
  },
  lotCol: {
    width: F.LOT_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.RULE,
  },
  nameCol: {
    width: F.NAME_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.RULE,
  },
  weightCol: {
    width: F.WEIGHT_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.INK,
  },
  attemptCol: {
    width: F.ATTEMPT_COL_W,
    flexShrink: 0,
    justifyContent: 'center',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.RULE,
  },
  /**
   * Header: the lift-group wrapper already carries the INK edge, so the
   * last 1/2/3 cell drops its peer rule rather than doubling it.
   */
  attemptColGroupEnd: {
    borderRightWidth: 0,
  },
  /**
   * Body and blank form lines have no lift-group wrapper. The last cell
   * of squat / bench / deadlift takes the INK edge so a made third stays
   * in its own cell against the next zebra row.
   */
  attemptColLiftEnd: {
    borderRightColor: C.INK,
  },
  totalCol: {
    width: F.TOTAL_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
    borderRightWidth: F.CELL_RULE,
    borderRightColor: C.INK,
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
  },
  attemptStrike: {
    textDecorationLine: 'line-through',
  },
  cellInk: {
    color: C.INK,
  },
  inkSoft: {
    color: C.INK_SOFT,
  },
  blankBand: {
    flexGrow: 1,
    overflow: 'hidden',
    borderBottomWidth: P.RULE,
    borderBottomColor: C.INK,
  },
  cert: {
    marginTop: P.SECTION_GAP,
    gap: CERT.LINE_GAP,
  },
  signBlock: {
    gap: CERT.BLOCK_GAP,
    marginTop: CERT.SIGN_GAP - CERT.LINE_GAP,
  },
  signLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: CERT.LINE_GAP,
  },
  signRule: {
    flexGrow: 1,
    borderBottomWidth: P.RULE,
    borderBottomColor: C.INK,
    marginBottom: P.RULE,
    minWidth: CERT.SIGN_RULE_W,
    alignItems: 'flex-end',
  },
  signName: {
    color: C.INK,
    fontSize: CERT.NAME_SIZE,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  certText: {
    color: C.INK_SOFT,
    fontSize: CERT.SIZE,
    letterSpacing: CERT.TRACKING,
    fontWeight: '700',
    fontStyle: 'normal',
  },
});
