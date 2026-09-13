/**
 * MeetBookendRoom — emptied hall behind weigh-in, openers, bomb-out, recap.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Platform beats already draw `MeetHallView`. The bomb-out cut-in already
 * uses `meet-empty.jpg`. The player-facing endings — weigh-in, openers,
 * bomb-out, recap — used to be full-screen espresso slabs, so the emptied hall
 * the cut-in showed never became the room those beats ended in.
 *
 * GDD §6.3 asks for a somber, non-punitive bomb-out: the hall has emptied; that
 * empty field IS the beat. A black "NO TOTAL" void is not the emptied hall.
 * GDD §6.1's paperwork and §6.5's recap are not platform attempts; they still
 * happen on meet day, so they dock as a compact espresso card over the same
 * emptied still (check-in / briefing language). The shareable federation sheet
 * (`ResultCardScreen`) stays a sheet — it is not this wrapper.
 *
 * Presentation, not a GDD rewrite. §6.1 still describes weigh-in content
 * (class, flavour, no dieting mechanic). This file does not move those beats
 * onto a loaded platform: `lifter={null}` is `meet-empty.jpg`.
 *
 * NO ARITHMETIC HERE. Scrim and card geometry are `MEET_TUNING.HALL.BOOKEND_SCRIM`
 * and `MEET_LAYOUT.BOOKEND_*`. Untuned (GDD §12.1).
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MEET_LAYOUT, MEET_TUNING } from '../game/meetTuning';
import { MeetHallView } from './MeetHallView';
import { MEET_PALETTE } from './meetPalette';

const L = MEET_LAYOUT;

export interface MeetBookendRoomProps {
  readonly children: React.ReactNode;
  /** The beat's own screen testID — capture tools wait on this node. */
  readonly testID: string;
  /**
   * Pinned under the scroll so the beat's only action stays on first paint.
   * Weigh-in, openers and recap pass their gold button here. Bomb-out keeps
   * its action inside the silence stagger so nothing is tappable through it.
   */
  readonly footer?: React.ReactNode;
}

export function MeetBookendRoom({
  children,
  testID,
  footer,
}: MeetBookendRoomProps): React.ReactElement {
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.hall} pointerEvents="none">
        <MeetHallView lifter={null} scrim={MEET_TUNING.HALL.BOOKEND_SCRIM} />
      </View>
      <View style={styles.body} pointerEvents="box-none">
        <View style={styles.card} testID={`${testID}-card`}>
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer === undefined ? null : <View style={styles.footer}>{footer}</View>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignSelf: 'stretch',
  },
  hall: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: L.SCREEN_PAD,
    paddingBottom: L.BOOKEND_FOOT_CLEARANCE,
  },
  card: {
    maxHeight: L.BOOKEND_CARD_MAX_HEIGHT,
    overflow: 'hidden',
    borderRadius: L.CARD_RADIUS,
    borderWidth: L.CARD_BORDER,
    borderColor: MEET_PALETTE.CARD_EDGE,
    backgroundColor: MEET_PALETTE.CARD,
  },
  cardScroll: {
    maxHeight: L.BOOKEND_SCROLL_MAX_HEIGHT,
  },
  cardContent: {
    padding: L.BOOKEND_CARD_PAD,
    gap: L.BOOKEND_CARD_GAP,
    alignItems: 'stretch',
  },
  footer: {
    paddingHorizontal: L.BOOKEND_CARD_PAD,
    paddingBottom: L.BOOKEND_CARD_PAD,
    paddingTop: L.BOOKEND_CARD_GAP,
  },
});
