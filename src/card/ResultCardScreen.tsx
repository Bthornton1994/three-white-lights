/**
 * ResultCardScreen.tsx — the post-meet screen the shareable card lives on.
 *
 * NOT WIRED INTO THE APP YET, on purpose. `App.tsx` is Prototype 1's lift
 * mechanic and belongs to another piece of this run; wiring the meet-day flow
 * into it is that piece's call, not this one's. To mount this screen, render
 * `<ResultCardScreen card={card} />` wherever the meet recap lands — it takes a
 * built `ResultCard` and nothing else, so it needs no context, no navigation
 * and no store.
 *
 * The card itself is `ResultCardView`; everything here is the chrome around it,
 * drawn in `LIFT_PALETTE` so the screen belongs to the same app as the lift
 * screen rather than to a second one.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LIFT_PALETTE } from '../lift/liftPalette';
import type { ResultCard } from '../game/resultCard';
import { ResultCardView } from './ResultCardView';
import { CARD, CARD_SCREEN } from './cardTuning';

export interface ResultCardScreenProps {
  readonly card: ResultCard;
  /** Integer upscale for the card. Defaults to the tuned value. */
  readonly scale?: number;
}

export function ResultCardScreen({ card, scale = CARD.DEFAULT_UPSCALE }: ResultCardScreenProps): React.ReactElement {
  const bombed = card.bombedLift !== null;
  return (
    <View style={styles.root} testID="result-card-screen">
      <Text style={styles.eyebrow}>{bombed ? 'MEET OVER' : 'MEET COMPLETE'}</Text>
      <View style={styles.cardFrame} testID="result-card">
        <ResultCardView card={card} scale={scale} />
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
    backgroundColor: LIFT_PALETTE.BACKDROP,
    paddingVertical: CARD_SCREEN.PAD_Y,
  },
  eyebrow: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: CARD_SCREEN.EYEBROW_FONT,
    letterSpacing: CARD_SCREEN.EYEBROW_TRACKING,
    marginBottom: CARD_SCREEN.EYEBROW_GAP,
  },
  cardFrame: {
    borderWidth: CARD_SCREEN.FRAME_BORDER,
    borderColor: LIFT_PALETTE.PANEL_EDGE,
    backgroundColor: LIFT_PALETTE.PANEL,
  },
  hint: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: CARD_SCREEN.HINT_FONT,
    marginTop: CARD_SCREEN.HINT_GAP,
  },
});
