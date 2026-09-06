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
 * THE SAME GATE COVERS A CUT-IN, and for the same reason rather than a similar
 * one. `CutInHost` mounts GDD §7.2's overlay INSIDE whichever surface is up,
 * and this pill is a sibling drawn after that surface — so the pill paints on
 * top of the interrupt and takes the tap that was meant to dismiss it. §7.2
 * says a cut-in is always skippable and the whole screen is the target. The
 * hosts therefore report whether one is live, exactly as the screens report
 * their beat, and no chrome is drawn while one is.
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

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EMPIRE_TUNING } from '../empire/empireTuning';
import { GymScreen } from '../empire/GymScreen';
import { type EarningsMode } from '../empire/ladder';
import {
  createGymViewState,
  gymViewReduce,
  type GymViewAction,
  type GymViewState,
} from '../empire/ladderView';
import { LIFT_PALETTE } from '../lift/liftPalette';
import { LiftScreen } from '../lift/LiftScreen';
import { MeetScreen, type MeetScreenProps } from '../meet/MeetScreen';
import { SessionScreen } from '../session/SessionScreen';
import {
  appMeetPort,
  appSessionPort,
  debugMeetStandIn,
  meetScreenPort,
  withSportingCreditOnRecord,
} from './appServer';
import {
  frozenMeetFor,
  frozenSessionFor,
  gymAffordanceFor,
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
    'open-gym': Object.freeze({
      label: SHELL_COPY.GYM_NAV_LABEL,
      hint: SHELL_COPY.GYM_NAV_HINT,
    }),
    'leave-gym': Object.freeze({
      label: SHELL_COPY.LEAVE_GYM_LABEL,
      hint: SHELL_COPY.LEAVE_GYM_HINT,
    }),
  });

/**
 * One pill. Fades IN only: the component unmounts the instant its surface
 * leaves a listed beat, because the beat it is leaving for is usually the
 * set, and a control still fading while the bar is unracked is still
 * pressable.
 *
 * CROSSING 6 moved the bottom-anchored POSITIONING out of this component and
 * onto `styles.navSlot`, now rendered once by `AppShell` around a ROW of
 * these rather than by each pill individually — up to two can be on screen
 * together (the session surface's MEET DAY and GYM EMPIRE pills), and two
 * absolutely-positioned, individually-centred pills would draw on top of
 * each other. This component now only fades and draws.
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
    <Animated.View style={style} pointerEvents="box-none">
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

/**
 * CROSSING 6, EXTENDED BY CAREER-EMPIRE-REP-01: the Gym Empire surface's
 * mount point. The `useReducer` hook itself now lives on `AppShell`'s body
 * so a played meet can dispatch `credit-sporting-result` without a ref that
 * can drop a credit. This component still owns the wall-clock anchor and
 * interval, still sits outside `src/empire/` (the same rule `ladder-dev.tsx`
 * follows), and still computes no game math — every second it turns into a
 * dispatch is read off `Date.now()` and handed to the same `advance-clock`
 * action the dev row already used. `GymScreen` stays a pure function of
 * `{ state, dispatch }`.
 *
 * WHY THIS COMPONENT IS NOW ALWAYS MOUNTED, RATHER THAN MOUNTED ONLY WHILE
 * `route.surface === 'gym'`.
 *
 * A CENSUS DISPOSITION. The claim above is checkable — `GymHost` sits in an
 * unconditional JSX position below, not inside the surface-selection
 * ternary, so no branch of that ternary can un-render it — but the tree has
 * no dedicated mutation-tested test for exactly this shape (planting a
 * conditional unmount and watching a named assertion redden). By
 * CLAUDE.md's rule, an unverified structural claim without a named catcher
 * is closer to a pointer than a guarantee, and the honest move is neither
 * to weaken the sentence to dodge the census nor to claim a witness that
 * was not built this round. `src/game/guaranteeTags.test.ts` is barred to
 * this session, so `GUARANTEE_COVERAGE.TREE_WIDE`'s bump is routed rather
 * than taken. A future round should either build the witness (plant the
 * unmount, name the assertion that reddens) or downgrade this paragraph to
 * a plain description once it is clear no test covers it. Before this round, leaving the gym surface
 * unmounted `GymHost` and destroyed its `useReducer` state outright — so
 * "the gym runs while open and away" was impossible to build honestly: there
 * was no state left to catch up when the player came back. `AppShell`
 * (below) now renders this component unconditionally, in a wrapper that is
 * visually absent — zero size, `pointerEvents: 'none'`, taken out of the
 * flex flow with `position: 'absolute'` so it cannot disturb the screen that
 * IS on top — whenever `visible` is false, rather than never rendering it at
 * all. That is what makes the reducer state (money, condition, the review
 * ledger, `bankedOperationSeconds`) survive a round trip through `session` or
 * `meet` and back.
 *
 * THE MECHANISM: REAL ELAPSED TIME, READ ON DEMAND, NEVER MINTED. There is no
 * per-second game-state tick here — CLAUDE.md's "pure logic is separate from
 * UI" rule and this file's own header rule that it computes no game state
 * both cut against a `.tsx` file owning a simulation loop. What this
 * component owns is exactly one thing: a real-time ANCHOR
 * (`lastAnchorMsRef`, a plain `Date.now()` reading, not React state — writing
 * it must never itself cause a render) and a function that reads
 * `Date.now()` again, computes the real gap since the anchor, and — if that
 * gap is at least one whole tick (`EMPIRE_TUNING.TICK_SECONDS`, the "collapse
 * t=0 no-ops" guard) — dispatches `advance-clock` with that gap and moves the
 * anchor forward. `advance-clock` already runs the real accrual, capped
 * exactly as `bankableOfflineSeconds`/`OFFLINE_EARNINGS_CAP_HOURS` always
 * specified (`ladder.ts`, `production.ts`); nothing here re-implements or
 * widens that cap.
 *
 * That one function is called from two places, both required by the brief
 * this round shipped against:
 *
 *   1. On mount, and on every transition of `visible` from false to true —
 *      the effect below re-runs whenever `visible` changes and calls it
 *      immediately when the new value is `true`. This is what "away" means:
 *      not a background timer that has to keep running while the screen is
 *      off, but a correct read of how much real time passed the moment the
 *      screen is looked at again. Real OS backgrounding (the phone's screen
 *      actually locking) is explicitly NOT covered by this — there is no
 *      `AppState` listener here, so a lock-screen absence is invisible until
 *      the app is foregrounded AND the gym surface is the one on screen at
 *      that moment. Stated as a declared limit rather than silently claimed:
 *      "away" here means "navigated to another in-app surface and back",
 *      which is what GDD §5's rewrite (in the same commit as this file)
 *      states plainly.
 *   2. On a real `setInterval`, running only while `visible` is true and
 *      cleared the moment it becomes false or the component unmounts (which,
 *      per the point above, should now only happen at all if `AppShell`
 *      itself unmounts). The interval length is
 *      `EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS`, a named tunable —
 *      this is the literal mechanism behind "open gym, no presses, bucks/
 *      clock have moved": sitting on the screen with the interval running is
 *      what makes that true, without a single tap.
 */
function GymHost({
  visible,
  state,
  dispatch,
  search,
  onLeaveGym,
}: {
  readonly visible: boolean;
  readonly state: GymViewState;
  readonly dispatch: React.Dispatch<GymViewAction>;
  readonly search: string | null;
  readonly onLeaveGym: () => void;
}): React.ReactElement {

  // A real-time reading, not React state on purpose — see the header above.
  // Initialised once, at this component's first (and only) mount, which is
  // now effectively "app launch" rather than "the moment the player opened
  // the gym", because `GymHost` stays mounted for the whole app run.
  const lastAnchorMsRef = useRef<number>(Date.now());

  // `mode` distinguishes the two call sites below, and is the whole fix for
  // "chrome shows the nominal rate, the purse banks half of it": a gap the
  // player is watching happen (the interval, while `visible`) pays the
  // nominal rate in full (`'online'`); a gap read on return from elsewhere
  // (the effect's immediate call, on mount and on every false->true
  // transition of `visible`) pays the existing discounted rate (`'offline'`).
  // Nothing about the gap arithmetic below changes with `mode` — same
  // `Date.now()` read, same anchor, same collapse-near-zero guard; only the
  // dispatched action's `mode` field differs, and `ladder.ts`'s
  // `accrueLadderGymBucks` is the one place that reads it.
  const catchUpOnRealTime = useCallback((mode: EarningsMode): void => {
    const nowMs = Date.now();
    const gapSeconds = Math.floor(
      (nowMs - lastAnchorMsRef.current) / EMPIRE_TUNING.MILLISECONDS_PER_SECOND,
    );
    // Collapse a near-zero gap into a no-op: no reducer churn, no zero-value
    // report noise, matching the "collapse t=0 no-ops" ruling this build
    // already follows elsewhere. The anchor is NOT moved on this path, so a
    // sub-tick remainder accumulates toward the next real catch-up rather
    // than being silently dropped.
    if (gapSeconds < EMPIRE_TUNING.TICK_SECONDS) return;
    lastAnchorMsRef.current = nowMs;
    dispatch({ kind: 'advance-clock', gapSeconds, mode });
  }, [dispatch]);

  // A6-4: Developer is not on player More/dock. Explicit web route only:
  // `?empireDev=1` or `#empire-developer`. Native has no URL, so this stays
  // closed there — same as any other debug query this shell already gates.
  useEffect(() => {
    const openIfRequested = (): void => {
      let requested = false;
      if (search !== null && search.length > 0) {
        const raw = search.charAt(0) === '?' ? search.slice(1) : search;
        const params = new URLSearchParams(raw);
        requested = params.get('empireDev') === '1';
      }
      if (
        !requested &&
        typeof window !== 'undefined' &&
        window.location.hash === '#empire-developer'
      ) {
        requested = true;
      }
      if (requested) dispatch({ kind: 'set-gym-surface', surface: 'developer' });
    };
    openIfRequested();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('hashchange', openIfRequested);
    return () => window.removeEventListener('hashchange', openIfRequested);
  }, [dispatch, search]);

  useEffect(() => {
    if (!visible) return;
    // Catch up immediately on becoming visible — including the very first
    // paint, if `visible` starts `true` — rather than waiting for the first
    // tick of the interval below. This is the "returning after a gap" case:
    // 'offline', discounted, exactly as before this round.
    catchUpOnRealTime('offline');
    // The periodic tick, running only while the screen is actually on top:
    // this is genuinely "watching it run", so it pays the nominal rate —
    // 'online', undiscounted.
    const intervalId = setInterval(
      () => catchUpOnRealTime('online'),
      EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS * EMPIRE_TUNING.MILLISECONDS_PER_SECOND,
    );
    return () => clearInterval(intervalId);
  }, [visible, catchUpOnRealTime]);

  return <GymScreen state={state} dispatch={dispatch} onLeaveGym={onLeaveGym} />;
}

export interface AppShellProps {
  /**
   * `window.location.search`, or `null` where there is no URL.
   *
   * Taken as a prop rather than read here so this component is a pure function
   * of its input and the one platform read lives in `App.tsx`. On native it is
   * always `null` and every debug branch below is correctly dead.
   *
   * ---------------------------------------------------------------------------
   * REQUIRED, AND IT USED TO BE OPTIONAL WITH A DEFAULT OF `null`
   * ---------------------------------------------------------------------------
   * That default made the app's ONE link from the browser into this route graph
   * deletable in silence. `<AppShell />` typechecked, and then `resolveEntry`
   * saw `null` for every URL, so `?meet=recap`, `?meet=live`, `?meet=bombed`,
   * `?session=set`, `?replay=` and `?cutin=` ALL booted the daily check-in —
   * while `npx tsc --noEmit` was clean, all 2457 node tests were green, and the
   * committed browser record still read 82 ok lines beside twelve screenshots of
   * the check-in, because a capture tool photographs whatever is on screen.
   *
   * Making it required puts the type checker on that deletion: `<AppShell />` is
   * now `Property 'search' is missing`. It does NOT cover `<AppShell
   * search={null} />`, which typechecks and is the same defect — that half is
   * pinned in `shellWiring.test.ts`, which parses the entry file and requires
   * some prop of this element to carry a real `location.search` read. Two
   * instruments, because the type checker can only see the shape.
   */
  readonly search: string | null;
}

export function AppShell({ search }: AppShellProps): React.ReactElement {
  // The launch URL, resolved once. Building a meet preview plays a whole
  // scripted meet, so this must not run per render.
  const entry = useMemo(() => resolveEntry(search), [search]);
  const [route, setRoute] = useState(entry.route);

  // CROSSING 6, EXTENDED. The gym reducer lives here so MeetScreen's
  // optional onRecorded can dispatch onto the same tree GymHost renders.
  // The wall-clock anchor stays on GymHost. No dispatch-ref.
  const [gymState, dispatch] = useReducer(gymViewReduce, undefined, createGymViewState);
  const creditSportingResult = useCallback<NonNullable<MeetScreenProps['onRecorded']>>(
    (meetId, recorded) => {
      dispatch({ kind: 'credit-sporting-result', meetId, facts: recorded });
    },
    [],
  );
  // P1: AppShell-owned view of the played meet port. Memoised so the hook
  // does not rebuild the meet on every shell render. Crossing 9 onRecorded
  // stays the mounted report; this view credits if the screen unmounts
  // while the save is still in flight.
  const playedMeetPort = useMemo(
    () => withSportingCreditOnRecord(appMeetPort(), creditSportingResult),
    [creditSportingResult],
  );
  // P2: non-crediting stand-in for `?meet=` frames that carry no port
  // of their own (`?meet=live`). Memoised so the live loop is not
  // rebuilt on every shell render. Never the sporting-credit view.
  const liveMeetStandIn = useMemo(() => debugMeetStandIn(), []);

  // What beat the surface underneath is on. The screens report it; the shell
  // does not derive it, because deriving session or meet state in a `.tsx` is
  // what CLAUDE.md forbids.
  const [sessionPhase, setSessionPhase] = useState<SessionPhase | null>(null);
  const [meetPhase, setMeetPhase] = useState<MeetDayPhaseId | null>(null);

  // WHETHER A GDD §7.2 CUT-IN IS UP, reported by whichever `CutInHost` is
  // mounted. The shell draws NO chrome while one is — see `shellAffordanceFor`
  // for the argument, which is the one it already makes about a live set: this
  // pill is a sibling of the surface and paints ABOVE an overlay mounted inside
  // it, so a tap meant to dismiss the interrupt navigates to meet day instead,
  // and §7.2 makes the whole screen the dismiss target.
  //
  // Derived from nothing here. The gate session lives in the host, and the
  // shell may not compute game state (CLAUDE.md).
  const [cutInLive, setCutInLive] = useState(false);

  // THE DESTINATION'S BEAT IS FORGOTTEN ON THE WAY IN, and that is not tidying.
  // The screen being routed to reports its beat in an effect, which lands a
  // commit AFTER the route changes — so a stale phase from a previous visit
  // would be what the gate reads for one frame. Concretely: leave a meet at the
  // recap, open another, and the weigh-in gets a "BACK TO TRAINING" flash. Null
  // means "has not said yet", and `shellAffordanceFor` draws nothing for it.
  //
  // The cut-in flag is cleared for the same reason: the host on the surface
  // being left un-mounts and the one being entered has not reported yet.
  const openMeet = useCallback(() => {
    setMeetPhase(null);
    setCutInLive(false);
    setRoute((current) => navigate(current, 'open-meet'));
  }, []);
  const leaveMeet = useCallback(() => {
    setSessionPhase(null);
    setCutInLive(false);
    setRoute((current) => navigate(current, 'leave-meet'));
  }, []);

  // CROSSING 6. `openGym` clears no destination phase because `gym` has none
  // to clear — see `shellAffordanceFor`'s own comment on why its gym arm
  // reads no phase at all. `leaveGym` clears `sessionPhase` for the same
  // reason `leaveMeet` clears it: the surface being ENTERED is `session`, and
  // a stale phase from before the gym visit is what the gate would read for
  // one frame otherwise. Both clear the cut-in flag, matching `openMeet` /
  // `leaveMeet` exactly, even though neither gym surface can itself have set
  // it live — Gym Empire mounts no `CutInHost` — because the flag still
  // belongs to whichever surface is about to draw, and clearing it on every
  // transition is one rule instead of one rule plus an argued exception.
  const openGym = useCallback(() => {
    setCutInLive(false);
    setRoute((current) => navigate(current, 'open-gym'));
  }, []);
  const leaveGym = useCallback(() => {
    setSessionPhase(null);
    setCutInLive(false);
    setRoute((current) => navigate(current, 'leave-gym'));
  }, []);

  const affordance = shellAffordanceFor(
    route,
    route.surface === 'meet' ? meetPhase : route.surface === 'session' ? sessionPhase : null,
    cutInLive ? 'live' : 'none',
  );
  // CROSSING 6's second, independently-gated pill — see `gymAffordanceFor`'s
  // own header for why this is a second function rather than a wider
  // `shellAffordanceFor`. Only ever non-null on the session surface, so it is
  // never on screen at the same time as `leave-meet` or `leave-gym`.
  const gymAffordance = gymAffordanceFor(
    route,
    route.surface === 'session' ? sessionPhase : null,
    cutInLive ? 'live' : 'none',
  );
  const meetFrame = frozenMeetFor(entry, route);

  const ON_PRESS: Readonly<Record<ShellIntent, () => void>> = {
    'open-meet': openMeet,
    'leave-meet': leaveMeet,
    'open-gym': openGym,
    'leave-gym': leaveGym,
  };

  return (
    <View style={styles.root} testID="app-shell">
      {route.surface === 'meet' ? (
        <MeetScreen
          // THE APP'S CONNECTION, or a non-crediting debug stand-in.
          //
          // `appMeetPort()` IS `appSessionPort()` — the same object, one row —
          // which is what makes the lifter who trains and the lifter who
          // competes one lifter. The production played route is handed a view
          // of that object (`playedMeetPort`) so sporting credit lives on
          // AppShell if MeetScreen unmounts mid-save. Every `?meet=` frame —
          // including `?meet=live`, whose frame port is intentionally
          // undefined — uses a non-crediting stand-in and stays off that
          // view. Selection keys on frame presence, not on `serverPort ??`,
          // because live is a defined frame with no stand-in of its own.
          //
          // `meetFrame` is `undefined` for every route a player can reach
          // (`frozenMeetFor` requires `source === 'debug'`). A frame only
          // carries a port when it also carries a scripted state; live uses
          // `liveMeetStandIn`, never the wrapper and never the singleton.
          // Both halves are pinned in `shellRoute.test.ts`, and the browser
          // check in `tools/verify-shell-route.mjs` measures the consequence
          // on the played path rather than trusting either.
          serverPort={meetScreenPort(meetFrame, playedMeetPort, liveMeetStandIn)}
          preview={meetFrame?.state}
          showCard={meetFrame?.card ?? false}
          holdWalkoutAtMs={meetFrame?.holdWalkoutAtMs ?? null}
          onLeave={leaveMeet}
          onPhase={setMeetPhase}
          onRecorded={meetFrame === undefined ? creditSportingResult : undefined}
          onCutIn={setCutInLive}
          cutInSearch={search}
        />
      ) : route.surface === 'gym' ? null : route.surface === 'replay' &&
        entry.replay !== undefined ? (
        <LiftScreen replay={entry.replay} />
      ) : (
        <SessionScreen
          preview={frozenSessionFor(entry, route)}
          serverPort={appSessionPort()}
          onPhase={setSessionPhase}
          onCutIn={setCutInLive}
          cutInSearch={search}
        />
      )}

      {/*
        CROSSING 6, EXTENDED. `GymHost` is ALWAYS mounted now — not rendered
        conditionally into the slot above — so its reducer state survives a
        round trip through `session` or `meet` and back; see `GymHost`'s own
        header for why that is what "the gym runs while open and away"
        actually requires. No preview, no server port, no cut-in host: Gym
        Empire's local reducer state stays local to this component tree, pays
        into no wallet and reads no debug frame — there is no debug query
        string for it entry, so `entry` never carries one to hand over.

        The wrapper is visually absent whenever the gym is not the surface on
        top: zero size, `pointerEvents: 'none'`, and taken out of the flex
        flow with `position: 'absolute'` so a zero-size sibling cannot perturb
        whichever screen IS laid out above. `GymHost` itself reads `visible`
        to decide whether to run its real-time catch-up at all — see that
        component's header.
      */}
      <View
        style={route.surface === 'gym' ? styles.gymVisible : styles.gymHidden}
        pointerEvents={route.surface === 'gym' ? 'auto' : 'none'}
      >
        <GymHost
          visible={route.surface === 'gym'}
          state={gymState}
          dispatch={dispatch}
          search={search}
          onLeaveGym={leaveGym}
        />
      </View>

      {affordance === null && gymAffordance === null ? null : (
        <View style={styles.navSlot} pointerEvents="box-none">
          <View style={styles.navRow} pointerEvents="box-none">
            {affordance === null ? null : (
              <ShellNav
                // Remounts when the intent changes, so the fade plays for each
                // affordance rather than only for the first one of the app's
                // life.
                key={affordance}
                intent={affordance}
                onPress={ON_PRESS[affordance]}
              />
            )}
            {gymAffordance === null ? null : (
              <ShellNav key={gymAffordance} intent={gymAffordance} onPress={ON_PRESS[gymAffordance]} />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
  /** `GymHost`'s wrapper while the gym IS the surface on top: fills the slot exactly like every other screen. */
  gymVisible: {
    flex: 1,
  },
  /**
   * `GymHost`'s wrapper while the gym is NOT on top. `position: 'absolute'`
   * takes it out of the flex flow entirely, so its zero size cannot perturb
   * the sibling screen laid out above it — a plain `{ width: 0, height: 0 }`
   * inside the same flex column would still reserve a flex basis and could
   * shift layout depending on platform flex quirks; taking it out of flow
   * removes that risk rather than relying on it staying zero.
   */
  gymHidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
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
  /**
   * CROSSING 6: up to two pills side by side (the session surface's MEET DAY
   * and GYM EMPIRE). `navSlot` above still does the bottom-anchored centring
   * of the ROW as a whole; this only lays out what is inside it.
   */
  navRow: {
    flexDirection: 'row',
    columnGap: L.NAV_GAP,
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
