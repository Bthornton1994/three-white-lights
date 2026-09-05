/**
 * appServer.ts — THE APP'S ONE CONNECTION TO THE SESSION SERVER.
 *
 * ===========================================================================
 * WHY THIS EXISTS, AND WHY IT IS NOT BOOKKEEPING
 * ===========================================================================
 * `useSession` builds a `SessionServerPort` on first render and holds it in a
 * ref. That was correct while the app had no navigation: `SessionScreen`
 * mounted once per page load, so the port was built once and the stored row
 * lived as long as the tab.
 *
 * The moment the shell can route AWAY from the session and back, that stops
 * being true. `SessionScreen` unmounts when meet day opens and remounts when
 * the player comes back, and a port built per mount means a brand new server
 * that has never heard of today's session. The consequence is not cosmetic:
 * `alreadyTrainedToday` is read out of what the server said, so a player could
 * train, open meet day, come back, and be offered a SECOND session of the same
 * day — which GDD §3.2 does not allow and which the real Edge Function would
 * refuse, leaving the client showing a session the server was never going to
 * acknowledge.
 *
 * So the connection belongs to the app, not to a screen, and this module is
 * where it lives. That is also what a real client looks like: one Supabase
 * client per app, created at the edge, handed down. When `localSessionServer`
 * is replaced by the actual `record-training-session` Edge Function, this file
 * is the one that changes and the screens do not.
 *
 * ===========================================================================
 * IT IS STILL NOT AUTHORITY
 * ===========================================================================
 * Nothing here computes or stores a progression fact. The row is inside
 * `localSessionServer`'s closure with no accessor, the decision procedure is
 * `sessionServer.ts`, and everything the app reads comes back as a
 * `ProgressionSnapshotWire` through `progression.ts`'s read accessors. This
 * module holds a REFERENCE; it does not hold truth.
 *
 * NOTHING IS PERSISTED. A reload still starts a fresh lifter, because
 * persistence is the server's job (see `localSessionServer.ts`). What survives
 * is navigation within one run of the app, which is exactly the hole the shell
 * would otherwise have opened.
 */

import { localSessionServer, type LocalAppServerPort } from '../session/localSessionServer';
import type { MeetServerPort, RecordedMeet } from '../game/meetClient';
import type { SessionServerPort } from '../game/sessionClient';

let connection: LocalAppServerPort | null = null;

/**
 * The one connection, built on first ask and returned unchanged after that.
 *
 * Module scope rather than a React ref on purpose: a ref only survives as long
 * as the component holding it, and the property that matters here — that
 * navigating away and back cannot reset what the server knows — is exactly a
 * property about components being unmounted. It is also why this is testable
 * without a renderer: two calls returning the same object IS the guarantee.
 */
function appConnection(): LocalAppServerPort {
  if (connection === null) connection = localSessionServer();
  return connection;
}

/**
 * The app's connection, as the DAILY LOOP is allowed to see it.
 *
 * The return type narrows to the session half so a screen cannot reach the
 * other mode's endpoints through the port it was handed. The OBJECT is the same
 * one `appMeetPort` returns; the types are what keep the two surfaces from
 * borrowing each other's methods.
 */
export function appSessionPort(): SessionServerPort {
  return appConnection();
}

/**
 * The app's connection, as MEET DAY is allowed to see it.
 *
 * ===========================================================================
 * THE SAME OBJECT, AND THAT IS THE WHOLE FIX
 * ===========================================================================
 * `appSessionPort() === appMeetPort()`. Not "an equivalent port", not "a port
 * built from the same seed" — the identical object, holding one `ServerRecord`
 * in one closure. That is the entire content of "the four modes are one game
 * because they are one lifter", and it is the thing that was false.
 *
 * @guarantee one-row-behind-one-port
 *
 * The consequence a player meets, stated separately because it is a separate
 * claim and needed a separate test: a total banked through `recordMeetResult`
 * on this port comes back out of the snapshot `appSessionPort()` opens on. The
 * identity above is structural and could hold over a server that kept two rows;
 * this one is driven — a meet is played and recorded through these accessors and
 * the total read back through the other half.
 *
 * @guarantee a-meet-total-reaches-the-session-half
 *
 * Before this, `AppShell` handed `SessionScreen` a port and handed `MeetScreen`
 * nothing, and `useMeetDay` called `newServerRecord(...)` on mount to have
 * something to read. So the lifter who trained and the lifter who competed were
 * two different people, permanently and by construction: the same three openers
 * on day 1 and day 400, FIRST TOTAL after every meet, and GDD §6.3's PR attempt
 * — "The Real Tension" — unreachable. `meetClient.ts`'s header has the full
 * account.
 *
 * WHEN THIS BECOMES A REAL BACKEND, both halves keep pointing at the one client
 * the block at the top of this file describes, because that is what a client app
 * has: one connection, many queries. Two clients would be the same defect with a
 * network in the middle.
 *
 * (Worded to avoid naming the vendor a second time: `realIp.ts` pins the
 * real-name inventory per file, and adding a mention is a human's call.)
 */
export function appMeetPort(): MeetServerPort {
  return appConnection();
}

/**
 * A played-route VIEW of a meet port, owned by AppShell.
 *
 * Crossing 9 stays the MeetScreen report (`onRecorded` on `loop.applied`).
 * That effect dies with the screen, and leave-meet is already available
 * while `recordMeetResult` is in flight. This view credits from the same
 * promise the screen used, on a parent that outlives MeetScreen.
 *
 * It does not replace the singleton. `appSessionPort() === appMeetPort()`
 * is still the one row. Only the object handed to the production played
 * MeetScreen is this view. Every `?meet=` debug frame — including
 * `?meet=live` — uses a non-crediting stand-in and stays off this view.
 * `meetScreenPort` is the selection that keeps that true.
 */
export function withSportingCreditOnRecord(
  port: MeetServerPort,
  onRecorded: (meetId: string, recorded: RecordedMeet) => void,
): MeetServerPort {
  return {
    openingSnapshot: () => port.openingSnapshot(),
    meetBrief: (day) => port.meetBrief(day),
    recordMeetResult: async (day, meet, proposal, proposalId) => {
      const response = await port.recordMeetResult(day, meet, proposal, proposalId);
      if (response.kind === 'recorded') {
        onRecorded(meet.id, response.result);
      }
      return response;
    },
  };
}

/**
 * DEBUG ONLY. A throwaway meet server for a `?meet=` frame that carries
 * no stand-in of its own — today that is only `?meet=live`.
 *
 * Not the app singleton (`appMeetPort`) and not the sporting-credit
 * view. Scripted moments already bring `previewMeetPort()` on the
 * frame; live must not reuse that fabricated lifter, and must not fall
 * back onto the played-route wrapper. A fresh `localSessionServer` is
 * the same factory the scripted stand-in uses, without the preview row.
 */
export function debugMeetStandIn(): MeetServerPort {
  return localSessionServer();
}

/**
 * Which port AppShell hands MeetScreen.
 *
 * Credit is AppShell-owned and only for the production played path
 * (`meetFrame` absent). Every `?meet=` frame uses a non-crediting
 * stand-in — the frame's own port when present, otherwise
 * `debugMeetStandIn`. `?meet=live` is a defined frame whose
 * `serverPort` is undefined; `meetFrame?.serverPort ?? playedMeetPort`
 * would have selected the view for live, and `?? appMeetPort()` would
 * have recorded onto the singleton. Selection keys on frame presence.
 */
export function meetScreenPort(
  meetFrame: { readonly serverPort: MeetServerPort | undefined } | undefined,
  playedMeetPort: MeetServerPort,
  debugStandIn: MeetServerPort,
): MeetServerPort {
  if (meetFrame === undefined) return playedMeetPort;
  return meetFrame.serverPort ?? debugStandIn;
}
