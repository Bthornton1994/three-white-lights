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

import { localSessionServer } from '../session/localSessionServer';
import type { SessionServerPort } from '../game/sessionClient';

let connection: SessionServerPort | null = null;

/**
 * The one port, built on first ask and returned unchanged after that.
 *
 * Module scope rather than a React ref on purpose: a ref only survives as long
 * as the component holding it, and the property that matters here — that
 * navigating away and back cannot reset what the server knows — is exactly a
 * property about components being unmounted. It is also why this is testable
 * without a renderer: two calls returning the same object IS the guarantee.
 */
export function appSessionPort(): SessionServerPort {
  if (connection === null) connection = localSessionServer();
  return connection;
}
