/**
 * MeetHallView — the room behind a meet-day beat.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS FOR
 * ---------------------------------------------------------------------------
 * GDD §12.2 judges meet day against a third-attempt walkout. The hall has to
 * be visible: crowd, platform, the weight on the bar. This layer is a
 * BACKGROUND. It has no button and never decides the meet.
 *
 * Closed-beta Iron & Amber presentation: owned illustrated stills, the same
 * cover-focus system training uses. Sprite rasters stay in `src/lift` (A0
 * harness) and in `meetHall.ts` / `walkout.ts` as the timing sheet. GDD §7.1
 * is unchanged; this file no longer draws that lattice as the primary picture.
 *
 * ---------------------------------------------------------------------------
 * CHANNELS THIS FILE DOES NOT OWN
 * ---------------------------------------------------------------------------
 *   `lifter.pose`     walk-out sheet frame — unrack, steps, settle. Omitted,
 *                     the still is the settled brace.
 *   `crowdRisePx`     scene rows the seating has come up by. Zoom + wash.
 *   `platesLoaded`    discs landed so far. Omitted, the bar is fully loaded.
 *
 * NO ARITHMETIC AND NO GAME MATH HERE. Plate choice and cover-focus are
 * `ironAmberHall.ts`.
 */

import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { IRON_AMBER, SESSION_COPY } from '../game/sessionTuning';
import { MEET_COPY } from '../game/meetTuning';
import type { LiftKind } from '../game/meet';
import { hallPlateCount } from './meetHall';
import { ironAmberHallLayout, ironAmberHallPlateId } from './ironAmberHall';
import type { WalkoutFrame } from './walkout';
import { MEET_PALETTE } from './meetPalette';

import gymBriefing from '../../assets/iron-amber/gym-briefing.jpg';
import squatBrace from '../../assets/iron-amber/squat-brace.jpg';
import squatHole from '../../assets/iron-amber/squat-hole.jpg';
import squatDrive from '../../assets/iron-amber/squat-drive.jpg';
import benchBrace from '../../assets/iron-amber/bench-brace.jpg';
import benchChest from '../../assets/iron-amber/bench-chest.jpg';
import benchPress from '../../assets/iron-amber/bench-press.jpg';
import deadliftFloor from '../../assets/iron-amber/deadlift-floor.jpg';
import deadliftKnee from '../../assets/iron-amber/deadlift-knee.jpg';
import deadliftLockout from '../../assets/iron-amber/deadlift-lockout.jpg';

const PLATE_SOURCE = {
  'gym-briefing': gymBriefing,
  'squat-brace': squatBrace,
  'squat-hole': squatHole,
  'squat-drive': squatDrive,
  'bench-brace': benchBrace,
  'bench-chest': benchChest,
  'bench-press': benchPress,
  'deadlift-floor': deadliftFloor,
  'deadlift-knee': deadliftKnee,
  'deadlift-lockout': deadliftLockout,
} as const;

/** Who is on the platform, and what is on their back. */
export interface MeetHallLifter {
  readonly kind: LiftKind;
  /** Everything on the bar, including bar and collars, kg. */
  readonly totalKg: number;
  /** What the bar and collars weigh on their own, kg. */
  readonly barAndCollarsKg: number;
  /** Attempt weight over the lifter's best single — how hard he is drawn. */
  readonly loadRatio: number;
  /**
   * Discs per side that have landed so far. Omitted, the bar is already loaded,
   * which is what every beat after the walk-out wants.
   */
  readonly platesLoaded?: number | undefined;
  /**
   * One frame of the walk-out's timing sheet. Omitted, he is at the settled
   * brace and does not move.
   */
  readonly pose?: WalkoutFrame | undefined;
}

export interface MeetHallViewProps {
  readonly lifter: MeetHallLifter | null;
  /**
   * How far the room is held back under whatever is drawn over it, 0..1.
   * `MEET_TUNING.HALL` owns the values; a screen names one, never a number.
   */
  readonly scrim: number;
  /**
   * Scene rows the seating has come up by. Omitted or 0, the hall is seated.
   */
  readonly crowdRisePx?: number | undefined;
}

export function MeetHallView({
  lifter,
  scrim,
  crowdRisePx = 0,
}: MeetHallViewProps): React.ReactElement {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const empty = lifter === null;
  const pose = lifter?.pose ?? null;
  const kind = lifter?.kind ?? null;
  const plateId = ironAmberHallPlateId(kind, pose?.stage ?? null, empty);
  const platesShown =
    lifter === null
      ? 0
      : (lifter.platesLoaded ?? hallPlateCount(lifter.totalKg, lifter.barAndCollarsKg));
  const layout = ironAmberHallLayout(
    box.width,
    box.height,
    plateId,
    pose?.bodyDxPx ?? 0,
    crowdRisePx,
    platesShown,
  );
  const riseWash = crowdRisePx * IRON_AMBER.HALL_RISE_WASH;
  const label =
    plateId === 'gym-briefing'
      ? SESSION_COPY.ROOM_LABEL
      : MEET_COPY.LIFT_LABEL[kind ?? 'squat'];

  return (
    <View
      style={styles.root}
      testID="meet-hall"
      onLayout={(event) => {
        const next = event.nativeEvent.layout;
        setBox({ width: next.width, height: next.height });
      }}
    >
      {box.width <= 0 ? null : (
        <Image
          source={PLATE_SOURCE[plateId]}
          style={[
            styles.plate,
            {
              width: layout.width,
              height: layout.height,
              left: layout.left,
              top: layout.top,
            },
          ]}
          resizeMode="stretch"
          accessibilityRole="image"
          accessibilityLabel={label}
          testID={`iron-amber-hall-${plateId}`}
        />
      )}
      {riseWash <= 0 ? null : (
        <View
          style={[styles.wash, { opacity: riseWash }]}
          pointerEvents="none"
          testID="iron-amber-hall-rise"
        />
      )}
      <View style={[styles.scrim, { opacity: scrim }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignSelf: 'stretch',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: MEET_PALETTE.CARD,
  },
  plate: {
    position: 'absolute',
  },
  wash: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: MEET_PALETTE.AMBER,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: MEET_PALETTE.CARD,
  },
});
