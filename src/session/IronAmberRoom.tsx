/**
 * IronAmberRoom — the gym photograph is the room.
 *
 * Session A chrome only. The photograph is the surface; espresso cards dock
 * above the shell's pill band, matching Iron & Amber mockup panel 03
 * (facility behind, status card in front). Not a sprite raster and not a
 * second debug backdrop.
 */
import React from 'react';
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
import { SESSION_PALETTE } from './sessionPalette';
import gymBriefing from '../../assets/iron-amber/gym-briefing.jpg';

const L = SESSION_LAYOUT;

export interface IronAmberRoomProps {
  readonly children: React.ReactNode;
  readonly testID?: string;
  readonly gymTestID: string;
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
}: {
  readonly children: React.ReactNode;
  readonly testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  );
}

export function IronAmberRoom({
  children,
  testID,
  gymTestID,
  brand = true,
  scroll = true,
  style,
}: IronAmberRoomProps): React.ReactElement {
  const bodyStyle = [
    styles.body,
    brand ? styles.bodyWithBrand : styles.bodyWithoutBrand,
  ];
  const body = <View style={bodyStyle}>{children}</View>;

  return (
    <View style={[styles.root, style]} testID={testID}>
      <Image
        source={gymBriefing}
        style={styles.gym}
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={SESSION_COPY.ROOM_LABEL}
        testID={gymTestID}
      />
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
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
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
});
