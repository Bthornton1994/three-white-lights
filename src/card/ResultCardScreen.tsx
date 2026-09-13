/**
 * ResultCardScreen.tsx — chrome around the shareable federation sheet.
 *
 * The sheet itself is `ResultCardView`. Everything here is the desk it sits
 * on. GDD §6.5: this beat is a sheet, not a meet-day room — no hall, no emptied
 * platform still. Espresso chrome keeps it in the Iron & Amber world without
 * staging it. The captured image (`recap-card`) is this screen; the object a
 * competitive lifter A/Bs is the paper on it.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MEET_PALETTE } from '../meet/meetPalette';
import type { ResultCard } from '../game/resultCard';
import { ResultCardView } from './ResultCardView';
import { CARD_SCREEN } from './cardTuning';

export interface ResultCardScreenProps {
  readonly card: ResultCard;
  /** Kept for callers; the paper sheet is authored in points, not upscaled. */
  readonly scale?: number;
}

export function ResultCardScreen({ card }: ResultCardScreenProps): React.ReactElement {
  const bombed = card.bombedLift !== null;
  return (
    <View style={styles.root} testID="result-card-screen">
      <Text style={styles.eyebrow}>{bombed ? 'MEET OVER' : 'MEET COMPLETE'}</Text>
      <View style={styles.cardFrame} testID="result-card">
        <ResultCardView card={card} />
      </View>
      <Text style={styles.hint}>{bombed ? 'No total. It happens. Next one.' : 'Share your result'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MEET_PALETTE.ESPRESSO,
    paddingVertical: CARD_SCREEN.PAD_Y,
  },
  eyebrow: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: CARD_SCREEN.EYEBROW_FONT,
    letterSpacing: CARD_SCREEN.EYEBROW_TRACKING,
    marginBottom: CARD_SCREEN.EYEBROW_GAP,
  },
  cardFrame: {
    borderWidth: CARD_SCREEN.FRAME_BORDER,
    borderColor: MEET_PALETTE.ESPRESSO_EDGE,
    backgroundColor: MEET_PALETTE.ESPRESSO,
  },
  hint: {
    color: MEET_PALETTE.TEXT_DIM,
    fontSize: CARD_SCREEN.HINT_FONT,
    marginTop: CARD_SCREEN.HINT_GAP,
  },
});
