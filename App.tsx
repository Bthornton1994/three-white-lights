import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { LiftScreen } from './src/lift/LiftScreen';
import { LIFT_PALETTE } from './src/lift/liftPalette';
import { replayRequestFrom } from './src/lift/replayRoute';
import { MeetScreen } from './src/meet/MeetScreen';
import {
  isLiveMeetRequest,
  meetPreviewFrom,
  previewStateFor as meetPreviewStateFor,
  showsCard,
} from './src/game/meetPreview';
import { SessionScreen } from './src/session/SessionScreen';
import { previewStateFor, sessionPreviewFrom } from './src/session/sessionPreview';

// THE APP OPENS INTO THE DAILY SESSION LOOP (GDD §3.2): readiness check-in ->
// modifier -> the work sets, on the lift mechanic -> close-out. There is no
// splash and no home screen in front of it, because GDD §12.2 measures this
// piece on time-to-first-input.
//
// `index.ts` must not import this module until `LoadSkiaWeb` has resolved:
// Skia's web build binds `global.CanvasKit` at module-evaluation time, and
// everything below transitively imports Skia.
//
// ALL ROUTING IN THE APP IS THREE DEBUG QUERY STRINGS, and all three are here
// rather than inside a screen so the screens stay renderers. On native `window`
// does not exist and every branch is dead, which is correct — they exist so the
// screenshot harness can photograph the web build at moments a wall clock
// cannot reliably hit.
//
//   ?replay=<load>&moment=<id>   one beat of a scripted REP. The Prototype-1
//                                lift screen, unchanged, and still the thing
//                                `tools/verify-lift-shots.mjs` photographs.
//   ?session=<moment>            one beat of a scripted SESSION.
//   ?meet=<moment>               one beat of a scripted MEET (GDD §6), frozen.
//   ?meet=live                   the same meet PLAYED, with its clock running.
//
// WHY MEET DAY IS BEHIND A QUERY STRING AND NOT THE DEFAULT SCREEN. GDD §6.1
// enters a meet from the Career calendar, which is out of scope for this piece,
// and §3.2's daily session is what the app is supposed to open on. Wiring meet
// day in front of the daily loop would spend the retention core's
// time-to-first-input on a screen a player sees a few times a season. Whoever
// builds the calendar owns the real entry point; until then a meet is reachable
// and photographable without changing what the app opens on.
function replayFromLocation() {
  if (typeof window === 'undefined') return undefined;
  return replayRequestFrom(window.location.search) ?? undefined;
}

function sessionPreviewFromLocation() {
  if (typeof window === 'undefined') return undefined;
  const request = sessionPreviewFrom(window.location.search);
  return request === null ? undefined : previewStateFor(request);
}

function meetPreviewFromLocation() {
  if (typeof window === 'undefined') return undefined;
  if (isLiveMeetRequest(window.location.search)) {
    // A played meet: no preview state, so the loop builds its own and the beat
    // timers run.
    return { state: undefined, card: false };
  }
  const request = meetPreviewFrom(window.location.search);
  if (request === null) return undefined;
  return { state: meetPreviewStateFor(request), card: showsCard(request.moment) };
}

/**
 * Leaving meet day. GDD §6.3's bomb-out beat and §6.5's recap both offer a way
 * out, and the way out of a mode is a ROUTE — so it is here, with the other two
 * query strings, rather than inside a screen.
 *
 * The destination is the daily session, because that is what this app opens on
 * (GDD §3.2) and there is no Career calendar yet to return to. On native there
 * is no `window` and this is a no-op, which leaves the screens' own fallback —
 * restarting the meet — in place until the calendar exists.
 */
function leaveMeet() {
  if (typeof window === 'undefined') return;
  window.location.search = '';
}

export default function App() {
  const replay = replayFromLocation();
  const meet = meetPreviewFromLocation();
  return (
    <View style={styles.container}>
      {meet !== undefined ? (
        <MeetScreen preview={meet.state} showCard={meet.card} onLeave={leaveMeet} />
      ) : replay === undefined ? (
        <SessionScreen preview={sessionPreviewFromLocation()} />
      ) : (
        <LiftScreen replay={replay} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIFT_PALETTE.BACKDROP,
  },
});
