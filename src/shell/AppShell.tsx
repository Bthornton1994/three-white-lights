/**
 * AppShell — the navigation layer, and the join that made the loop playable.
 *
 * ```
 *   launch (no URL)
 *     -> SESSION      GDD §3.2's daily loop, straight onto the check-in
 *          [MEET DAY] -> MEET   GDD §6, weigh-in through recap and result card
 *                          [BACK TO TRAINING] -> SESSION
 * ```
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS AND IS NOT
 * ---------------------------------------------------------------------------
 * It is a ROUTER and a piece of CHROME, and nothing else. It holds which
 * surface is up, draws exactly one affordance over it, and hands frozen debug
 * frames to the screens that were given them. It computes no game state, reads
 * no progression fact, and writes none — every number in the app still comes
 * back through `progression.ts`'s read accessors from a server body, and the
 * shell never sees one.
 *
 * In particular THE SHELL SHOWS NO TOTAL and no e1RM. GDD §3.2 and §6.4 put
 * Total on meet day and no other day; a Total in persistent chrome would be on
 * screen during a training session, which is the exact thing §3.2 says spends
 * meet day's payoff. There is no fatigue readout either (§3.4, §12.3) — the
 * shell has no way to reach the ledger and does not import one.
 *
 * ---------------------------------------------------------------------------
 * WHY THE AFFORDANCE IS THE SHELL'S AND NOT THE SCREENS'
 * ---------------------------------------------------------------------------
 * `App.tsx` has said since the meet screen was built that "the way out of a
 * mode is a ROUTE", and put `onLeave` here rather than inside `MeetScreen`. The
 * way IN is the same kind of thing. Keeping both here means `SessionScreen` and
 * `MeetScreen` stay renderers that know nothing about each other — which is
 * also why neither had to learn about the other to make this work.
 *
 * The screens report which BEAT they are on, and the shell draws nothing
 * outside the beats `SHELL_NAV` lists. That gate is the whole reason a
 * navigation control is safe here: no pill is ever drawn over a live set, where
 * a mis-tap costs a rep.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY MISSING: THE CAREER CALENDAR (GDD §6.1)
 * ---------------------------------------------------------------------------
 * §6.1 enters a meet by selecting one from a Career calendar — local, regional,
 * nationals, worlds — GATED BY QUALIFYING TOTALS, after a weigh-in beat. Career
 * mode is zero files, and inventing a fake calendar here would be inventing the
 * gate too. So this is ONE UNGATED DOOR to the ONE local meet that exists.
 *
 * When Career lands, three things change and all three are in this file or the
 * module beside it: `open-meet` points at the calendar instead of `MeetScreen`;
 * the calendar reads the qualifying-total gate off the server (a Total is a
 * server fact, so the gate is a server decision, not a client `if`); and the
 * meet the player picks is passed to `MeetScreen` as context instead of it
 * building `MEET_LOCAL` itself. Nothing about the route graph changes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { LIFT_PALETTE } from '../lift/liftPalette';
import { LiftScreen } from '../lift/LiftScreen';
import { MeetScreen } from '../meet/MeetScreen';
import { SessionScreen } from '../session/SessionScreen';
import { appSessionPort } from './appServer';
import {
  frozenMeetFor,
  frozenSessionFor,
  navigate,
  resolveEntry,
  shellAffordanceFor,
  type ShellIntent,
} from './shellRoute';
import { SHELL_COPY, SHELL_LAYOUT, SHELL_NAV } from './shellTuning';
import type { MeetDayPhaseId } from '../game/meetDay';
import type { SessionPhase } from '../game/session';

const L = SHELL_LAYOUT;

/** What each intent's button says and does for a screen reader. */
const INTENT_COPY: Readonly<Record<ShellIntent, { readonly label: string; readonly hint: string }>> =
  Object.freeze({
    'open-meet': Object.freeze({
      label: SHELL_COPY.MEET_NAV_LABEL,
      hint: SHELL_COPY.MEET_NAV_HINT,
    }),
    'leave-meet': Object.freeze({
      label: SHELL_COPY.LEAVE_MEET_LABEL,
      hint: SHELL_COPY.LEAVE_MEET_HINT,
    }),
  });

/**
 * The one control the shell draws.
 *
 * Bottom-anchored and arriving late, so it never competes with the screen under
 * it for the first look. It fades IN only: the component unmounts the instant
 * its surface leaves a listed beat, because the beat it is leaving for is
 * usually the set, and a control still fading while the bar is unracked is
 * still pressable.
 */
function ShellNav({
  intent,
  onPress,
}: {
  readonly intent: ShellIntent;
  readonly onPress: () => void;
}): React.ReactElement {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(
      SHELL_NAV.FADE_IN_DELAY_MS,
      withTiming(1, { duration: SHELL_NAV.FADE_IN_MS }),
    );
  }, [shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  const copy = INTENT_COPY[intent];
  return (
    <Animated.View style={[styles.navSlot, style]} pointerEvents="box-none">
      <Pressable
        style={styles.nav}
        accessibilityRole="button"
        accessibilityLabel={copy.label}
        accessibilityHint={copy.hint}
        hitSlop={L.NAV_HIT_SLOP}
        onPress={onPress}
        testID={`shell-${intent}`}
      >
        <Text style={styles.navLabel}>{copy.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export interface AppShellProps {
  /**
   * `window.location.search`, or `null` where there is no URL.
   *
   * Taken as a prop rather than read here so this component is a pure function
   * of its input and the one platform read lives in `App.tsx`. On native it is
   * always `null` and every debug branch below is correctly dead.
   */
  readonly search?: string | null;
}

export function AppShell({ search = null }: AppShellProps = {}): React.ReactElement {
  // The launch URL, resolved once. Building a meet preview plays a whole
  // scripted meet, so this must not run per render.
  const entry = useMemo(() => resolveEntry(search), [search]);
  const [route, setRoute] = useState(entry.route);

  // What beat the surface underneath is on. The screens report it; the shell
  // does not derive it, because deriving session or meet state in a `.tsx` is
  // what CLAUDE.md forbids.
  const [sessionPhase, setSessionPhase] = useState<SessionPhase | null>(null);
  const [meetPhase, setMeetPhase] = useState<MeetDayPhaseId | null>(null);

  // THE DESTINATION'S BEAT IS FORGOTTEN ON THE WAY IN, and that is not tidying.
  // The screen being routed to reports its beat in an effect, which lands a
  // commit AFTER the route changes — so a stale phase from a previous visit
  // would be what the gate reads for one frame. Concretely: leave a meet at the
  // recap, open another, and the weigh-in gets a "BACK TO TRAINING" flash. Null
  // means "has not said yet", and `shellAffordanceFor` draws nothing for it.
  const openMeet = useCallback(() => {
    setMeetPhase(null);
    setRoute((current) => navigate(current, 'open-meet'));
  }, []);
  const leaveMeet = useCallback(() => {
    setSessionPhase(null);
    setRoute((current) => navigate(current, 'leave-meet'));
  }, []);

  const affordance = shellAffordanceFor(
    route,
    route.surface === 'meet' ? meetPhase : route.surface === 'session' ? sessionPhase : null,
  );
  const meetFrame = frozenMeetFor(entry, route);

  return (
    <View style={styles.root} testID="app-shell">
      {route.surface === 'meet' ? (
        <MeetScreen
          preview={meetFrame?.state}
          showCard={meetFrame?.card ?? false}
          holdWalkoutAtMs={meetFrame?.holdWalkoutAtMs ?? null}
          onLeave={leaveMeet}
          onPhase={setMeetPhase}
        />
      ) : route.surface === 'replay' && entry.replay !== undefined ? (
        <LiftScreen replay={entry.replay} />
      ) : (
        <SessionScreen
          preview={frozenSessionFor(entry, route)}
          serverPort={appSessionPort()}
          onPhase={setSessionPhase}
        />
      )}

      {affordance === null ? null : (
        <ShellNav
          // Remounts when the intent changes, so the fade plays for each
          // affordance rather than only for the first one of the app's life.
          key={affordance}
          intent={affordance}
          onPress={affordance === 'open-meet' ? openMeet : leaveMeet}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
  /**
   * A full-width strip pinned to the bottom, so the pill centres itself without
   * needing to know how wide it is. `box-none` on the strip: only the pill
   * itself takes touches, and the rest of the band stays transparent to the
   * screen underneath.
   */
  navSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: L.NAV_BOTTOM_INSET,
    alignItems: 'center',
  },
  nav: {
    height: L.NAV_HEIGHT,
    paddingHorizontal: L.NAV_PAD_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: L.NAV_RADIUS,
    borderWidth: L.NAV_BORDER,
    borderColor: LIFT_PALETTE.PANEL_EDGE,
    backgroundColor: LIFT_PALETTE.PANEL,
  },
  navLabel: {
    color: LIFT_PALETTE.TEXT_DIM,
    fontSize: L.NAV_FONT,
    fontWeight: '700',
    letterSpacing: L.NAV_LETTER_SPACING,
  },
});
