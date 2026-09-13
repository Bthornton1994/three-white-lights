/**
 * IronAmberRoom — the gym photograph is the room.
 *
 * Session A chrome only. The photograph is the surface; espresso cards dock
 * above the shell's pill band, matching Iron & Amber mockup panel 03
 * (facility behind, status card in front). Not a sprite raster and not a
 * second debug backdrop.
 */
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { SESSION_COPY, SESSION_LAYOUT } from '../game/sessionTuning';
import type { LiftKind } from '../game/meet';
import { SESSION_PALETTE } from './sessionPalette';
import {
  ironAmberBriefingPlate,
  ironAmberGymLayout,
  ironAmberPlateLayout,
  type IronAmberBriefingPlateId,
} from './ironAmberPlates';
import gymBriefing from '../../assets/iron-amber/gym-briefing.jpg';
import squatBrace from '../../assets/iron-amber/squat-brace.jpg';
import benchBrace from '../../assets/iron-amber/bench-brace.jpg';
import deadliftFloor from '../../assets/iron-amber/deadlift-floor.jpg';

const BRIEFING_PLATE_SOURCE: Record<IronAmberBriefingPlateId, number> = {
  'squat-brace': squatBrace,
  'bench-brace': benchBrace,
  'deadlift-floor': deadliftFloor,
};

const L = SESSION_LAYOUT;

export interface IronAmberRoomProps {
  readonly children: React.ReactNode;
  readonly testID?: string;
  readonly gymTestID: string;
  /**
   * When set, the room is the day's lifter plate. Check-in, briefing and
   * close-out pass the lift so the athlete stays in frame (panel 03).
   * Omitted, the empty gym — rest, already-trained.
   */
  readonly liftKind?: LiftKind;
  readonly brand?: boolean;
  /**
   * Rest is itself a Pressable. A ScrollView inside it would eat the skip-rest
   * tap. Check-in / briefing / close-out scroll so first-run disclosures and
   * the close-out stack cannot clip on 375×812.
   */
  readonly scroll?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

function BrandMark(): React.ReactElement {
  return (
    <View style={styles.brand} testID="iron-amber-brand" accessibilityRole="header">
      <View style={styles.lights} accessibilityLabel={SESSION_COPY.BRAND_WORDMARK}>
        {Array.from({ length: L.BRAND_LIGHT_COUNT }, (_unused, index) => (
          <View key={index} style={styles.light} importantForAccessibility="no" />
        ))}
      </View>
      <Text style={styles.wordmark}>{SESSION_COPY.BRAND_WORDMARK}</Text>
    </View>
  );
}

export function IronAmberCard({
  children,
  testID,
  dense = false,
  maxHeight,
}: {
  readonly children: React.ReactNode;
  readonly testID?: string;
  /**
   * Check-in / close-out drawer. The briefing card stays padded; these two
   * must leave the gym in frame (Iron & Amber panel 03).
   */
  readonly dense?: boolean;
  /**
   * Check-in only. Caps the drawer so the gym stays the majority of 390×844.
   * Close-out and briefing omit it.
   */
  readonly maxHeight?: number;
}): React.ReactElement {
  return (
    <View
      style={[
        styles.card,
        dense ? styles.cardDense : null,
        maxHeight === undefined ? null : [styles.cardCapped, { maxHeight }],
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

export function IronAmberRoom({
  children,
  testID,
  gymTestID,
  liftKind,
  brand = true,
  scroll = true,
  style,
}: IronAmberRoomProps): React.ReactElement {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const gymLayout =
    liftKind === undefined
      ? ironAmberGymLayout(box.width, box.height)
      : ironAmberPlateLayout(liftKind, box.width, box.height);
  const gymSource =
    liftKind === undefined
      ? gymBriefing
      : BRIEFING_PLATE_SOURCE[ironAmberBriefingPlate(liftKind)];
  const bodyStyle = [
    styles.body,
    brand ? styles.bodyWithBrand : styles.bodyWithoutBrand,
  ];
  const body = <View style={bodyStyle}>{children}</View>;

  return (
    <View
      style={[styles.root, style]}
      testID={testID}
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setBox({ width: next.width, height: next.height });
      }}
    >
      {box.width <= 0 ? null : (
      <Image
        source={gymSource}
        style={[
          styles.gym,
          {
            width: gymLayout.width,
            height: gymLayout.height,
            left: gymLayout.left,
            top: gymLayout.top,
          },
        ]}
        resizeMode="stretch"
        accessible
        accessibilityRole="image"
        accessibilityLabel={SESSION_COPY.ROOM_LABEL}
        testID={gymTestID}
      />
      )}
      <View style={styles.scrim} pointerEvents="none" />
      {brand ? <BrandMark /> : null}
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={bodyStyle}
          keyboardShouldPersistTaps="handled"
          testID={testID === undefined ? undefined : `${testID}-scroll`}
        >
          {children}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: SESSION_PALETTE.CARD,
  },
  gym: {
    position: 'absolute',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SESSION_PALETTE.CARD,
    opacity: L.BRIEFING_SCRIM,
  },
  scroll: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: L.SCREEN_PAD,
    paddingBottom: L.ROOM_FOOT_CLEARANCE,
    gap: L.BRAND_GAP,
  },
  bodyWithBrand: {
    paddingTop: L.ROOM_BODY_PAD_TOP,
  },
  bodyWithoutBrand: {
    paddingTop: L.BRIEFING_CARD_MARGIN_V,
  },
  brand: {
    position: 'absolute',
    top: L.ROOM_BRAND_PAD_TOP,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: L.BRAND_GAP,
    zIndex: 1,
  },
  lights: {
    flexDirection: 'row',
    gap: L.BRAND_LIGHT_GAP,
  },
  light: {
    width: L.BRAND_LIGHT_R * 2,
    height: L.BRAND_LIGHT_R * 2,
    borderRadius: L.BRAND_LIGHT_R,
    backgroundColor: SESSION_PALETTE.IVORY,
  },
  wordmark: {
    color: SESSION_PALETTE.IVORY,
    fontSize: L.TITLE_FONT,
    fontWeight: '700',
    letterSpacing: L.BRAND_TRACK,
  },
  card: {
    padding: L.BRIEFING_CARD_PAD,
    borderRadius: L.BRIEFING_CARD_RADIUS,
    borderWidth: L.BRIEFING_CARD_BORDER,
    borderColor: SESSION_PALETTE.CARD_EDGE,
    backgroundColor: SESSION_PALETTE.CARD,
    gap: L.ROW_GAP,
  },
  cardDense: {
    padding: L.CARD_PAD_DRAWER,
    gap: L.CARD_GAP_DRAWER,
  },
  cardCapped: {
    overflow: 'hidden',
  },
});
