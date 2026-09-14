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
 * Two published tables, one competitor per row on each. The class table is
 * the [R8] meet page (bests). The attempt table is S1..D3 ([R6]). Misses
 * are struck. No squat+bench subtotal. No gold winner fill; zebra is the
 * same at every place.
 *
 * The sheet hugs the tables. Leftover cream on a tall phone is outside the
 * document, not empty page inside it.
 *
 * There is no loaded-bar motif here. Plate colours are gameplay language on
 * the platform, not a cartoon on a scoresheet.
 */

import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  NO_VALUE_DISPLAY,
  RESULT_ATTEMPT_TABLE_COLUMNS,
  RESULT_CLASS_TABLE_COLUMNS,
  flightAttemptView,
  flightBestText,
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
const CERT = PAPER.CERT;
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

function classCol(id: ResultSheetColumnId): StyleProp<ViewStyle> | null {
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
      return styles.bestCol;
    case 'total':
      return styles.totalCol;
    case 'dots':
      return styles.dotsCol;
    default:
      return null;
  }
}

function ClassHead(): React.ReactElement {
  return (
    <View style={styles.tableHead}>
      {RESULT_CLASS_TABLE_COLUMNS.map((id) => (
        <View key={id} style={[styles.headCell, classCol(id)]}>
          <Text
            style={[
              styles.headText,
              id === 'place' || id === 'lifter' ? null : styles.headRight,
            ]}
            numberOfLines={1}
          >
            {flightColumnHeading(id)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ClassCell({
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
  const best = flightBestText(row, id);
  if (best !== null) {
    return (
      <View style={styles.bestCol}>
        <Text
          style={[styles.bestText, best === NO_VALUE_DISPLAY ? styles.inkSoft : styles.cellInk]}
          numberOfLines={1}
        >
          {best}
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

function ClassRowView({
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
      {RESULT_CLASS_TABLE_COLUMNS.map((id) => (
        <ClassCell key={id} row={row} id={id} />
      ))}
    </View>
  );
}

function AttemptHead(): React.ReactElement {
  return (
    <View style={styles.tableHead}>
      <View style={styles.attemptNameCol}>
        <Text style={styles.headText} numberOfLines={1}>
          {flightColumnHeading('lifter')}
        </Text>
      </View>
      {RESULT_ATTEMPT_TABLE_COLUMNS.map((id) => (
        <View key={id} style={styles.attemptCol}>
          <Text style={[styles.headText, styles.headRight]} numberOfLines={1}>
            {sheetColumnHeading(id)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function AttemptRowView({
  row,
  odd,
}: {
  readonly row: ResultCardFlightRow;
  readonly odd: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.attemptRow, odd ? styles.rowOdd : styles.rowEven, row.isPlayer ? styles.playerRow : null]}>
      <View style={styles.attemptNameCol}>
        <Text style={styles.nameText} numberOfLines={1}>
          {flightLifterName(row.name)}
        </Text>
      </View>
      {RESULT_ATTEMPT_TABLE_COLUMNS.map((id) => {
        const attempt = flightAttemptView(row, id);
        if (attempt === null) {
          return <View key={id} style={styles.attemptCol} />;
        }
        const printed = attempt.struckThrough ? `-${attempt.text}` : attempt.text;
        return (
          <View key={id} style={styles.attemptCol}>
            <Text
              style={[
                styles.attemptText,
                attempt.struckThrough ? styles.attemptMiss : styles.cellInk,
                attempt.best ? styles.attemptBest : null,
              ]}
              numberOfLines={1}
            >
              {printed}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function SignLine({ label }: { readonly label: string }): React.ReactElement {
  return (
    <View style={styles.signLine}>
      <Text style={styles.certText}>{label}</Text>
      <View style={styles.signRule} />
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

      <View style={styles.table} testID="result-card-flight">
        <ClassHead />
        {card.field.map((row, index) => (
          <ClassRowView key={row.id} row={row} odd={index % 2 === 1} />
        ))}
      </View>

      <Text style={styles.section}>{CARD_LABELS.ATTEMPTS_SECTION}</Text>

      <View style={styles.table} testID="result-card-attempts">
        <AttemptHead />
        {card.field.map((row, index) => (
          <AttemptRowView key={row.id} row={row} odd={index % 2 === 1} />
        ))}
      </View>

      <View style={styles.cert}>
        <View style={styles.rule} />
        <Text style={styles.certText}>{CARD_LABELS.POSTED}</Text>
        <View style={styles.signBlock}>
          <SignLine label={CARD_LABELS.REFEREE_1} />
          <SignLine label={CARD_LABELS.REFEREE_2} />
          <SignLine label={CARD_LABELS.REFEREE_3} />
          <SignLine label={CARD_LABELS.TECHNICAL_SECRETARY} />
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
  table: {
    marginTop: P.NAME_GAP,
    borderTopWidth: P.RULE,
    borderBottomWidth: P.RULE,
    borderColor: C.INK,
  },
  tableHead: {
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
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: P.RULE,
    borderBottomColor: C.RULE,
    paddingTop: F.ROW_PAD_Y,
    paddingBottom: F.ROW_PAD_Y,
    minHeight: F.ROW_H,
  },
  attemptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: P.RULE,
    borderBottomColor: C.RULE,
    paddingTop: F.ROW_PAD_Y,
    paddingBottom: F.ROW_PAD_Y,
    minHeight: F.ATTEMPT_ROW_H,
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
  },
  nameCol: {
    width: F.NAME_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  attemptNameCol: {
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
  bestCol: {
    width: F.BEST_COL_W,
    flexShrink: 0,
    paddingHorizontal: P.CELL_PAD,
    justifyContent: 'center',
  },
  attemptCol: {
    width: F.ATTEMPT_COL_W,
    flexShrink: 0,
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
  bestText: {
    fontSize: F.BEST_SIZE,
    fontWeight: '700',
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
  cellInk: {
    color: C.INK,
  },
  inkSoft: {
    color: C.INK_SOFT,
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
    height: P.RULE,
    backgroundColor: C.RULE,
    marginBottom: P.RULE,
    minWidth: CERT.SIGN_RULE_W,
  },
  certText: {
    color: C.INK_SOFT,
    fontSize: CERT.SIZE,
    letterSpacing: CERT.TRACKING,
    fontWeight: '700',
    fontStyle: 'normal',
  },
});
