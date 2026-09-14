/**
 * ResultCardScreen.tsx — the shareable federation sheet fills the phone.
 *
 * GDD §6.5: formatted like a real federation result sheet. The captured
 * 390×844 is this screen. A competitive lifter A/Bs the paper, not a game
 * share-card sitting on espresso with "MEET COMPLETE" / "Share your result"
 * around it. The shell still draws the way back (`shell-leave-meet`); this
 * file leaves clearance for that pill and does not restyle it.
 *
 * No hall. No emptied platform still.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResultCard } from '../game/resultCard';
import { ResultCardView } from './ResultCardView';
import { CARD_SCREEN } from './cardTuning';
import { SHEET_CSS } from './sheetPalette';

export interface ResultCardScreenProps {
  readonly card: ResultCard;
  /** Kept for callers; the paper sheet is authored in points, not upscaled. */
  readonly scale?: number;
}

export function ResultCardScreen({ card }: ResultCardScreenProps): React.ReactElement {
  return (
    <View style={styles.root} testID="result-card-screen">
      <View style={styles.sheet} testID="result-card">
        <ResultCardView card={card} />
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
  sheet: {
    width: '100%',
    alignItems: 'center',
  },
});
