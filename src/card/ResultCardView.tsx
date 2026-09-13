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
 * There is no loaded-bar motif here. A published results sheet records
 * attempts, a best, a total, DOTS and place. Plate colours are gameplay
 * language on the platform, not a cartoon on a scoresheet.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ATTEMPT_GRID_HEADINGS,
  NO_VALUE_DISPLAY,
  type AttemptCell,
  type LiftRow,
  type ResultCard,
  type ResultCardSummaryRow,
} from '../game/resultCard';
import { CARD_LABELS, FOOTER, LIFTER_STRIP, PAPER } from './cardTuning';
import { SHEET_CSS } from './sheetPalette';

const P = PAPER;
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

function LiftLine({ row, odd }: { readonly row: LiftRow; readonly odd: boolean }): React.ReactElement {
  return (
    <View style={[styles.gridRow, odd ? styles.rowOdd : styles.rowEven]}>
      <View style={styles.liftCol}>
        <Text style={styles.liftLabel}>{row.label}</Text>
      </View>
      {row.attempts.map((cell) => (
        <View key={cell.attemptNumber} style={styles.cell}>
          <AttemptFigure cell={cell} />
        </View>
      ))}
      <View style={styles.cell}>
        <View style={styles.bestFill}>
          <Text
            style={[
              styles.cellText,
              row.bestText === NO_VALUE_DISPLAY ? styles.inkSoft : styles.cellInk,
            ]}
          >
            {row.bestText}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ScoreCell({ row }: { readonly row: ResultCardSummaryRow }): React.ReactElement {
  return (
    <View style={styles.scoreCell}>
      <Text style={styles.scoreLabel}>{row.label}</Text>
      <Text style={[styles.scoreValue, row.hasValue ? styles.cellInk : styles.inkSoft]}>{row.value}</Text>
    </View>
  );
}

export function ResultCardView({ card }: ResultCardViewProps): React.ReactElement {
  const [total, dots, place] = card.summary;
  const location = card.meet.locationText !== '' ? card.meet.locationText : card.meet.locationShortText;
  const category = `${card.lifter.categoryText}${LIFTER_STRIP.META_SEPARATOR}${card.lifter.bodyweightText}${CARD_LABELS.BODYWEIGHT_SUFFIX}`;
  const totalValue = total.hasValue ? `${total.value} ${CARD_LABELS.UNIT}` : total.value;

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

      <View style={styles.lifter}>
        <Text style={styles.lifterName}>{card.lifter.name.toUpperCase()}</Text>
        <Text style={styles.category}>{category}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridHead}>
          <Text style={styles.liftHead}>{ATTEMPT_GRID_HEADINGS.lift}</Text>
          {ATTEMPT_GRID_HEADINGS.attempts.map((heading) => (
            <Text key={heading} style={styles.cellHead}>
              {heading}
            </Text>
          ))}
          <Text style={styles.cellHead}>{ATTEMPT_GRID_HEADINGS.best}</Text>
        </View>
        {card.rows.map((row, index) => (
          <LiftLine key={row.lift} row={row} odd={index % 2 === 1} />
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{total.label}</Text>
        <Text style={[styles.totalValue, total.hasValue ? styles.cellInk : styles.inkSoft]}>{totalValue}</Text>
      </View>

      <View style={styles.scoreRow}>
        <ScoreCell row={dots} />
        <View style={styles.scoreSplit} />
        <ScoreCell row={place} />
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
  lifter: {
    marginTop: P.SECTION_GAP,
    gap: P.NAME_GAP,
  },
  lifterName: {
    color: C.INK,
    fontSize: P.NAME_SIZE,
    fontWeight: '700',
  },
  category: {
    color: C.INK_SOFT,
    fontSize: P.CATEGORY_SIZE,
    letterSpacing: P.CATEGORY_TRACKING,
  },
  grid: {
    marginTop: P.SECTION_GAP,
    borderTopWidth: P.RULE,
    borderBottomWidth: P.RULE,
    borderColor: C.INK,
  },
  gridHead: {
    flexDirection: 'row',
    alignItems: 'center',
    height: P.CELL_H,
    backgroundColor: C.PAPER_SHADE,
    borderBottomWidth: P.RULE,
    borderBottomColor: C.INK,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: P.CELL_H,
    borderBottomWidth: P.RULE,
    borderBottomColor: C.RULE,
  },
  rowEven: {
    backgroundColor: C.PAPER,
  },
  rowOdd: {
    backgroundColor: C.PAPER_ALT,
  },
  liftHead: {
    width: P.LIFT_COL_W,
    paddingHorizontal: P.CELL_PAD,
    color: C.INK_SOFT,
    fontSize: P.GRID_HEAD_SIZE,
    letterSpacing: P.GRID_HEAD_TRACKING,
    fontWeight: '700',
  },
  cellHead: {
    flex: 1,
    paddingHorizontal: P.CELL_PAD,
    color: C.INK_SOFT,
    fontSize: P.GRID_HEAD_SIZE,
    letterSpacing: P.GRID_HEAD_TRACKING,
    fontWeight: '700',
    textAlign: 'right',
  },
  liftCol: {
    width: P.LIFT_COL_W,
    justifyContent: 'center',
    paddingHorizontal: P.CELL_PAD,
  },
  liftLabel: {
    color: C.INK,
    fontSize: P.LIFT_LABEL_SIZE,
    fontWeight: '700',
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
  bestFill: {
    flex: 1,
    margin: P.CELL_INSET,
    backgroundColor: C.PAPER_SHADE,
    justifyContent: 'center',
    paddingHorizontal: P.CELL_PAD,
  },
  cellText: {
    fontSize: P.CELL_FONT,
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
  totalRow: {
    marginTop: P.SECTION_GAP,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    color: C.INK_SOFT,
    fontSize: P.TOTAL_LABEL_SIZE,
    letterSpacing: P.FED_TRACKING,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: P.TOTAL_VALUE_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scoreRow: {
    marginTop: P.SECTION_GAP,
    flexDirection: 'row',
    height: P.SCORE_H,
    borderTopWidth: P.RULE,
    borderBottomWidth: P.RULE,
    borderColor: C.RULE,
  },
  scoreCell: {
    flex: 1,
    justifyContent: 'center',
  },
  scoreSplit: {
    width: P.RULE,
    backgroundColor: C.RULE,
  },
  scoreLabel: {
    color: C.INK_SOFT,
    fontSize: P.SCORE_LABEL_SIZE,
    letterSpacing: P.FED_TRACKING,
    fontWeight: '700',
  },
  scoreValue: {
    fontSize: P.SCORE_VALUE_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
