/**
 * ResultCardScreen.tsx — the shareable federation sheet on the phone.
 *
 * GDD §6.5: formatted like a real federation result sheet. The captured
 * 390×844 is this screen. A competitive lifter A/Bs the paper, not a game
 * share-card sitting on espresso with "MEET COMPLETE" / "Share your result"
 * around it. The shell still draws the way back (`shell-leave-meet`); this
 * file leaves clearance for that pill and does not restyle it.
 *
 * The sheet is authored wider than a phone so one packed scoresheet row
 * can hold unclipped kilos. This screen scales that page to PHONE_W.
 * Height is the share frame. The table sits under the letterhead; leftover
 * cream is unused letter below a six-lifter class, with a page tail at
 * the foot. No espresso chrome.
 *
 * No hall. No emptied platform still.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResultCard } from '../game/resultCard';
import { ResultCardView } from './ResultCardView';
import { CARD_SCREEN, PAPER, PAPER_PAGE_H, PAPER_SCALE, paperSheetHeight } from './cardTuning';
import { SHEET_CSS } from './sheetPalette';

export interface ResultCardScreenProps {
  readonly card: ResultCard;
  /** Kept for callers; the paper sheet is authored in points, not upscaled. */
  readonly scale?: number;
}

export function ResultCardScreen({ card }: ResultCardScreenProps): React.ReactElement {
  const authoredH = Math.min(paperSheetHeight(card.field.length), PAPER_PAGE_H);
  return (
    <View style={styles.root} testID="result-card-screen">
      <View style={[styles.slot, { height: authoredH * PAPER_SCALE }]} testID="result-card">
        <View style={[styles.scaled, { height: authoredH }]}>
          <ResultCardView card={card} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: SHEET_CSS.PAPER,
    paddingTop: CARD_SCREEN.PAD_Y,
    paddingBottom: CARD_SCREEN.LEAVE_CLEARANCE,
  },
  slot: {
    width: CARD_SCREEN.PHONE_W,
    overflow: 'hidden',
  },
  scaled: {
    width: PAPER.W,
    transform: [{ scale: PAPER_SCALE }],
    transformOrigin: 'top left',
  },
});
