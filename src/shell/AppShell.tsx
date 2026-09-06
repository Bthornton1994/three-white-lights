/**
 * AppShell — the navigation layer, and the join that made the loop playable.
 *
 * ```
 *   launch (no URL)
 *     -> SESSION      GDD §3.2's daily loop, straight onto the check-in
 *          [MEET DAY]    -> MEET     GDD §6, weigh-in through recap and result card
 *                              [BACK TO TRAINING] -> SESSION
 *          [GYM EMPIRE]  -> EMPIRE   GDD §5's floor, running on a real clock
 *                              [BACK TO TRAINING] -> SESSION, on the beat it left
 *          [CAREER]      -> CAREER   GDD §2.1's chooser, then §6.1's calendar
 *                              [BACK TO TRAINING] -> SESSION, on the beat it left
 * ```
 *
 * ---------------------------------------------------------------------------
 * THE EMPIRE ROUND TRIP NO LONGER SPENDS THE PLAYER'S SESSION
 * ---------------------------------------------------------------------------
 * It used to. Answer the three readiness questions, press GYM EMPIRE, press
 * BACK TO TRAINING, and the check-in came back blank: this file picked ONE
 * surface out of a ternary, so `SessionScreen` un-mounted and its answers —
 * client state that never reached a server — went with it. Both surfaces of
 * that round trip are now MOUNTED at once, and whichever one is not being
 * looked at is hidden. `shellRoute.ts`'s `PERSISTENT_SURFACES` is the list and
 * carries the argument, including why meet day is deliberately not on it.
 *
 * Hidden means `display: 'none'`: nothing lays it out, nothing paints it,
 * nothing hit-tests it, and Playwright's `isVisible()` reports false — so "the
 * daily session is no longer on screen" still means what it meant when the
 * screen really was gone.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS FILE IS AND IS NOT
 * ---------------------------------------------------------------------------
 * It is a ROUTER and a piece of CHROME, and nothing else. It holds which
 * surface is up, draws the affordances that move between them, and hands frozen
 * debug frames to the screens that were given them. It computes no game state,
 * reads no progression fact, and writes none — every number in the app still
 * comes back through `progression.ts`'s read accessors from a server body, and
 * the shell never sees one. The Empire surface reads idle-local state only; it
 * does not pay into the pooled wallet.
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
 * also why neither had to learn about the other to make this work. Empire is
 * the same shape.
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
 * their beat, and no chrome is drawn while one is. Empire has no cut-in host in
 * this slice; session and meet still do.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE CAREER SURFACE IS, AND WHAT IS STILL DELIBERATELY MISSING (§6.1)
 * ---------------------------------------------------------------------------
 * Sprint 1b wired the Career surface: GDD §2.1's federation chooser, then
 * §6.1's calendar, with every verdict decided by `careerServer.ts` and drawn
 * with the server's own sentence. The qualifying-total gate is therefore read
 * off the server, not a client `if` — the calendar screen filters on
 * `verdict.kind` and computes nothing.
 *
 * BUILT IN SPRINT 1c: ENTERING a meet from the calendar. The seam the 1b
 * version of this header predicted — `CareerMeet -> MeetDefinition` — is
 * `careerMeet.ts`, and it is crossed exactly once, in `enterMeet` below, at
 * the instant an enterable row is pressed. `open-meet` is deleted rather than
 * repointed: the session's chrome offers CAREER, the calendar's rows offer
 * the meets, and the played meet marks itself ALREADY_ENTERED through the
 * banked result's own id (see `careerMeet.ts`'s header for the identity
 * argument). What the prediction got wrong is recorded rather than smoothed
 * over: it said `open-meet` would point at the calendar, and the built shape
 * deletes it instead, because two session pills both opening Career is a
 * worse screen than one.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { CareerScreen } from '../meet/CareerScreen';
import { LifterScreen } from '../meet/LifterScreen';
import { EmpireScreen } from './EmpireScreen';
import { LIFT_PALETTE } from '../lift/liftPalette';
import { LiftScreen } from '../lift/LiftScreen';
import { MeetScreen } from '../meet/MeetScreen';
import { SessionScreen } from '../session/SessionScreen';
import { appCareerPort, appLifterPort, appMeetPort, appSessionPort } from './appServer';
import {
  frozenMeetFor,
  frozenSessionFor,
  isPersistentSurface,
  navigate,
  resolveEntry,
  shellAffordanceFor,
  shellCareerAffordanceFor,
  shellEmpireAffordanceFor,
  shellLifterAffordanceFor,
  type ShellIntent,
} from './shellRoute';
import { MEET_ENTRY, MEET_LOCAL, type KilogramMeetEntry, type MeetDefinition } from '../game/meetTuning';
import type { CareerMeet } from '../career/calendar';
import { CAREER_COPY } from '../career/careerTuning';
import { meetDefinitionFor } from '../game/careerMeet';
import { kilogramMeetEntryFrom } from '../game/lifterEntry';
import { SHELL_COPY, SHELL_LAYOUT, SHELL_NAV, type EmpirePhase } from './shellTuning';
import type { CareerSurfacePhase } from '../meet/careerSurface';
import type { LifterSurfacePhase } from '../meet/lifterSurface';
import type { MeetDayPhaseId } from '../game/meetDay';
import type { SessionPhase } from '../game/session';

const L = SHELL_LAYOUT;

/** What each intent's button says and does for a screen reader. */
const INTENT_COPY: Readonly<Record<ShellIntent, { readonly label: string; readonly hint: string }>> =
  Object.freeze({
    // NO PILL EVER DRAWS THIS ONE. `enter-meet` is fired by an enterable
    // calendar row's own control (`CareerScreen`), which carries this same
    // copy from `CAREER_COPY` — the entry here keeps the record exhaustive
    // over `ShellIntent` and the copy single-sourced, and `shellWiring.test.ts`
    // pins that no affordance function can return it.
    'enter-meet': Object.freeze({
      label: CAREER_COPY.ENTER_MEET_LABEL,
      hint: CAREER_COPY.ENTER_MEET_HINT,
    }),
    'leave-meet': Object.freeze({
      label: SHELL_COPY.LEAVE_MEET_LABEL,
      hint: SHELL_COPY.LEAVE_MEET_HINT,
    }),
    'open-empire': Object.freeze({
      label: SHELL_COPY.EMPIRE_NAV_LABEL,
      hint: SHELL_COPY.EMPIRE_NAV_HINT,
    }),
    'leave-empire': Object.freeze({
      label: SHELL_COPY.LEAVE_EMPIRE_LABEL,
      hint: SHELL_COPY.LEAVE_EMPIRE_HINT,
    }),
    'open-career': Object.freeze({
      label: SHELL_COPY.CAREER_NAV_LABEL,
      hint: SHELL_COPY.CAREER_NAV_HINT,
    }),
    'leave-career': Object.freeze({
      label: SHELL_COPY.LEAVE_CAREER_LABEL,
      hint: SHELL_COPY.LEAVE_CAREER_HINT,
    }),
    'open-lifter': Object.freeze({
      label: SHELL_COPY.LIFTER_NAV_LABEL,
      hint: SHELL_COPY.LIFTER_NAV_HINT,
    }),
    'leave-lifter': Object.freeze({
      label: SHELL_COPY.LEAVE_LIFTER_LABEL,
      hint: SHELL_COPY.LEAVE_LIFTER_HINT,
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
  const [route, setRoute] = useState(() => {
    if (entry.route.source === 'debug') return entry.route;
    if (appLifterPort().openingProfile() === null) {
      return { surface: 'lifter' as const, source: 'player' as const };
    }
    return entry.route;
  });

  // What beat the surface underneath is on. The screens report it; the shell
  // does not derive it, because deriving session or meet state in a `.tsx` is
  // what CLAUDE.md forbids.
  const [sessionPhase, setSessionPhase] = useState<SessionPhase | null>(null);
  const [meetPhase, setMeetPhase] = useState<MeetDayPhaseId | null>(null);
  const [empirePhase, setEmpirePhase] = useState<EmpirePhase | null>(null);
  const [careerPhase, setCareerPhase] = useState<CareerSurfacePhase | null>(null);
  const [lifterPhase, setLifterPhase] = useState<LifterSurfacePhase | null>(null);

  // WHETHER A GDD §7.2 CUT-IN IS UP, reported by whichever `CutInHost` is
  // mounted. The shell draws NO chrome while one is — see `shellAffordanceFor`
  // for the argument, which is the one it already makes about a live set: this
  // pill is a sibling of the surface and paints ABOVE an overlay mounted inside
  // it, so a tap meant to dismiss the interrupt navigates to meet day instead,
  // and §7.2 makes the whole screen the dismiss target.
  //
  // ONE FLAG PER SURFACE, AND THAT CHANGED WHEN THE SESSION STOPPED
  // UN-MOUNTING. A single shared flag was correct while exactly one host was
  // ever mounted. It is not correct now: the daily session's host stays mounted
  // under GDD §5's floor, and a report from a screen nobody is looking at would
  // take the chrome off the floor — leaving the player on a surface whose only
  // way out is the pill that just disappeared. So each surface's host writes its
  // own flag and the gate reads the one belonging to the surface on screen.
  //
  // Derived from nothing here. The gate session lives in the host, and the
  // shell may not compute game state (CLAUDE.md).
  const [sessionCutIn, setSessionCutIn] = useState(false);
  const [meetCutIn, setMeetCutIn] = useState(false);

  // HAS THE PLAYER EVER OPENED THE FLOOR? Once they have, GDD §5's surface stays
  // mounted for the rest of the app run, hidden while they are training. Its gym
  // is opened at mount and advanced from that instant, so an un-mount is a gym
  // thrown away — and a player who stepped back into their session and returned
  // would be strictly worse off than one who stood still, which is the §12.3
  // line this whole piece is shaped around.
  const [empireOpened, setEmpireOpened] = useState(route.surface === 'empire');

  // The same flag for the Career surface, for the same §12.3-shaped reason:
  // once opened it stays mounted for the app run, hidden while the player
  // trains, so an in-flight federation choice settles into a live screen and a
  // return visit is a re-read rather than a fresh mount. No debug entry
  // resolves to 'career', so the initializer is the same expression as
  // Empire's and today starts false on every launch.
  const [careerOpened, setCareerOpened] = useState(route.surface === 'career');
  const [lifterOpened, setLifterOpened] = useState(route.surface === 'lifter');

  // WHICH MEET THE PLAYER ENTERED, adapted the moment the row was pressed
  // (Sprint 1c). Route state carries WHERE, this carries WHAT: `navigate` is a
  // pure walk over string intents and stays that way, so the entered meet
  // travels beside the route rather than inside it. Null whenever the player
  // is not mid-meet — set by `enterMeet` (the only player edge into the meet
  // surface), cleared by `leaveMeet`, so a finished meet's definition can
  // never leak into a later entry.
  const [enteredMeet, setEnteredMeet] = useState<MeetDefinition | null>(null);
  const [enteredEntry, setEnteredEntry] = useState<KilogramMeetEntry | null>(null);

  // THE DESTINATION'S BEAT IS FORGOTTEN ON THE WAY IN, and that is not tidying.
  // The screen being routed to reports its beat in an effect, which lands a
  // commit AFTER the route changes — so a stale phase from a previous visit
  // would be what the gate reads for one frame. Concretely: leave a meet at the
  // recap, open another, and the weigh-in gets a "BACK TO TRAINING" flash. Null
  // means "has not said yet", and `shellAffordanceFor` draws nothing for it.
  //
  // The cut-in flag is cleared for the same reason: the host on the surface
  // being left un-mounts and the one being entered has not reported yet.
  //
  // AND `leaveEmpire` CLEARS NEITHER, WHICH IS THE FIX RATHER THAN AN OMISSION.
  // The session it returns to never un-mounted; its beat is current, not stale,
  // and its host is the same one that has been reporting all along. Nulling the
  // phase there would take every control off a live screen that has no reason to
  // report again — the player lands back on their briefing with nowhere to go.
  // `forgetsBeatOnArrival` in `shellRoute.ts` states that rule and
  // `shellWiring.test.ts` pins it against this file in both directions.
  const enterMeet = useCallback((meet: CareerMeet) => {
    const profile = appLifterPort().openingProfile();
    if (profile === null) return;
    setEnteredMeet(meetDefinitionFor(meet));
    setEnteredEntry(kilogramMeetEntryFrom(profile, meet.federationId, MEET_ENTRY.lot));
    setMeetPhase(null);
    setMeetCutIn(false);
    setRoute((current) => navigate(current, 'enter-meet'));
  }, []);
  const leaveMeet = useCallback(() => {
    setEnteredMeet(null);
    setEnteredEntry(null);
    setSessionPhase(null);
    setSessionCutIn(false);
    setRoute((current) => navigate(current, 'leave-meet'));
  }, []);
  const openEmpire = useCallback(() => {
    setEmpirePhase(null);
    setEmpireOpened(true);
    setRoute((current) => navigate(current, 'open-empire'));
  }, []);
  const leaveEmpire = useCallback(() => {
    setRoute((current) => navigate(current, 'leave-empire'));
  }, []);
  // The Career pair follows Empire's exactly: the destination's beat is
  // forgotten on the way in (`CareerScreen` re-reports — `active` is in its
  // phase effect's dependency list), and `leaveCareer` clears NOTHING, because
  // the session it returns to never un-mounted and its beat is current.
  const openCareer = useCallback(() => {
    setCareerPhase(null);
    setCareerOpened(true);
    setRoute((current) => navigate(current, 'open-career'));
  }, []);
  const leaveCareer = useCallback(() => {
    setRoute((current) => navigate(current, 'leave-career'));
  }, []);
  const openLifter = useCallback(() => {
    setLifterPhase(null);
    setLifterOpened(true);
    setRoute((current) => navigate(current, 'open-lifter'));
  }, []);
  const leaveLifter = useCallback(() => {
    setRoute((current) => navigate(current, 'leave-lifter'));
  }, []);

  const surfacePhase =
    route.surface === 'meet'
      ? meetPhase
      : route.surface === 'session'
        ? sessionPhase
        : route.surface === 'empire'
          ? empirePhase
          : route.surface === 'career'
            ? careerPhase
            : route.surface === 'lifter'
              ? lifterPhase
              : null;
  // The flag belonging to the surface on screen. Empire mounts no host, so a
  // cut-in is never live there and the gate is told so rather than being handed
  // whatever the hidden session last said.
  const cutInLive =
    route.surface === 'session' ? sessionCutIn : route.surface === 'meet' ? meetCutIn : false;
  const cutIn: 'live' | 'none' = cutInLive ? 'live' : 'none';
  const affordance = shellAffordanceFor(route, surfacePhase, cutIn);
  const empireAffordance = shellEmpireAffordanceFor(route, surfacePhase, cutIn);
  const careerAffordance = shellCareerAffordanceFor(route, surfacePhase, cutIn);
  const lifterAffordance = shellLifterAffordanceFor(route, surfacePhase, cutIn);
  const meetFrame = frozenMeetFor(entry, route);

  const pressFor = (intent: ShellIntent): (() => void) => {
    switch (intent) {
      case 'enter-meet':
        // UNREACHABLE FROM A PILL, deliberately: no affordance function
        // returns `enter-meet` (the calendar row is the only presser, and it
        // calls `enterMeet` with its own meet — a pill has no meet to enter).
        // The case exists because this switch is exhaustive over ShellIntent,
        // and it must stay inert rather than guess a meet.
        return () => undefined;
      case 'leave-meet':
        return leaveMeet;
      case 'open-empire':
        return openEmpire;
      case 'leave-empire':
        return leaveEmpire;
      case 'open-career':
        return openCareer;
      case 'leave-career':
        return leaveCareer;
      case 'open-lifter':
        return openLifter;
      case 'leave-lifter':
        return leaveLifter;
    }
  };

  // WHICH SURFACES ARE IN THE TREE AT ALL, which is no longer the same question
  // as which one is on screen. `isPersistentSurface` is the single list; the
  // replay arm is the defensive one the ternary this replaces already had, for a
  // `replay` route that somehow arrived without a frame.
  const sessionMounted =
    isPersistentSurface(route.surface) ||
    (route.surface === 'replay' && entry.replay === undefined);
  const empireMounted =
    route.surface === 'empire' || (isPersistentSurface('empire') && empireOpened);
  const careerMounted =
    route.surface === 'career' || (isPersistentSurface('career') && careerOpened);
  const lifterMounted =
    route.surface === 'lifter' || (isPersistentSurface('lifter') && lifterOpened);

  return (
    <View style={styles.root} testID="app-shell">
      {route.surface === 'meet' && (meetFrame !== undefined || enteredMeet !== null) ? (
        <MeetScreen
          // THE APP'S CONNECTION, or the frozen frame's own stand-in server.
          //
          // `appMeetPort()` IS `appSessionPort()` — the same object, one row —
          // which is what makes the lifter who trains and the lifter who
          // competes one lifter. This screen used to be given no port at all,
          // and `useMeetDay` fabricated a record to have something to read.
          //
          // The `??` reads like the ternary it replaces and is not one:
          // `meetFrame` is `undefined` for every route a player can reach
          // (`frozenMeetFor` requires `source === 'debug'`), and a frame only
          // carries a port when it also carries a scripted state. Both halves
          // are pinned in `shellRoute.test.ts`, and the browser check in
          // `tools/verify-shell-route.mjs` measures the consequence on the
          // played path rather than trusting either.
          serverPort={meetFrame?.serverPort ?? appMeetPort()}
          // THE MEET THE PLAYER ENTERED, adapted at the row press. On every
          // player-reachable path `enteredMeet` is non-null — the only edge
          // into this surface is `enter-meet`, and `enterMeet` sets it before
          // navigating; the surrounding condition makes that structural
          // rather than assumed. `MEET_LOCAL` survives ONLY as the debug
          // frame's fixture (`meetFrame` implies `source === 'debug'`), the
          // same scripted world its preview state already lives in.
          meet={enteredMeet ?? MEET_LOCAL}
          entry={enteredEntry ?? undefined}
          preview={meetFrame?.state}
          showCard={meetFrame?.card ?? false}
          holdWalkoutAtMs={meetFrame?.holdWalkoutAtMs ?? null}
          onLeave={leaveMeet}
          onPhase={setMeetPhase}
          onCutIn={setMeetCutIn}
          cutInSearch={search}
        />
      ) : route.surface === 'replay' && entry.replay !== undefined ? (
        <LiftScreen replay={entry.replay} />
      ) : null}

      {!sessionMounted ? null : (
        <View style={route.surface === 'session' ? styles.surface : styles.hiddenSurface}>
          <SessionScreen
            preview={frozenSessionFor(entry, route)}
            serverPort={appSessionPort()}
            onPhase={setSessionPhase}
            onCutIn={setSessionCutIn}
            cutInSearch={search}
          />
        </View>
      )}

      {!empireMounted ? null : (
        <View style={route.surface === 'empire' ? styles.surface : styles.hiddenSurface}>
          <EmpireScreen onPhase={setEmpirePhase} active={route.surface === 'empire'} />
        </View>
      )}

      {!careerMounted ? null : (
        <View style={route.surface === 'career' ? styles.surface : styles.hiddenSurface}>
          <CareerScreen
            serverPort={appCareerPort()}
            onPhase={setCareerPhase}
            active={route.surface === 'career'}
            onEnterMeet={enterMeet}
            platformName={appLifterPort().openingProfile()?.name ?? null}
          />
        </View>
      )}

      {!lifterMounted ? null : (
        <View style={route.surface === 'lifter' ? styles.surface : styles.hiddenSurface}>
          <LifterScreen
            serverPort={appLifterPort()}
            onPhase={setLifterPhase}
            active={route.surface === 'lifter'}
          />
        </View>
      )}

      {affordance === null &&
      empireAffordance === null &&
      careerAffordance === null &&
      lifterAffordance === null ? null : (
        <View style={styles.navSlot} pointerEvents="box-none">
          {affordance === null ? null : (
            <ShellNav key={affordance} intent={affordance} onPress={pressFor(affordance)} />
          )}
          {empireAffordance === null ? null : (
            <ShellNav
              key={empireAffordance}
              intent={empireAffordance}
              onPress={pressFor(empireAffordance)}
            />
          )}
          {careerAffordance === null ? null : (
            <ShellNav
              key={careerAffordance}
              intent={careerAffordance}
              onPress={pressFor(careerAffordance)}
            />
          )}
          {lifterAffordance === null ? null : (
            <ShellNav
              key={lifterAffordance}
              intent={lifterAffordance}
              onPress={pressFor(lifterAffordance)}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
  /** A mounted surface that is the one on screen. */
  surface: {
    flex: 1,
  },
  /**
   * A mounted surface that is NOT the one on screen.
   *
   * `display: 'none'` rather than zero opacity or an off-screen transform, and
   * the difference is the whole point: a transparent surface is still laid out,
   * still hit-tested, and still reported as visible by Playwright's
   * `isVisible()` and by `document.elementFromPoint` — which is the exact hazard
   * `tools/verify-shell-route.mjs` documents at length about opacity. `none`
   * removes it from layout, from painting, from hit testing and from
   * `isVisible()`, while React keeps the component mounted and its state alive,
   * which is the only property this needs.
   */
  hiddenSurface: {
    display: 'none',
  },
  /**
   * A full-width strip pinned to the bottom, so the pill centres itself without
   * needing to know how wide it is. `box-none` on the strip: only the pill
   * itself takes touches, and the rest of the band stays transparent to the
   * screen underneath. When both meet and Empire are offered, the strip is a
   * row.
   */
  navSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: L.NAV_BOTTOM_INSET,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: L.NAV_GAP,
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
