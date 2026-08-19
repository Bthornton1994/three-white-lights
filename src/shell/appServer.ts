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
 * THE ROW SURVIVES A RELOAD NOW (Sprint 2 — GDD §10.0's "Nothing Is Lost").
 * Persistence stayed the server's job: `localSessionServer` writes the row
 * through `saveGame.ts`'s schema after every accepted mutation, and what THIS
 * module adds is only the two things a server cannot decide for itself —
 * WHERE a save lives on this platform (the web store below), and WHAT DAY a
 * brand-new lifter's account begins (the real wall-clock day, so a fresh
 * install's absences are charged from the day the account actually began
 * rather than from a test constant — GDD §4.2's anchor, made real the moment
 * saves were).
 */

import { localSessionServer, type LocalAppServerPort, type SaveStore } from '../session/localSessionServer';
import type { CareerServerPort } from '../game/careerClient';
import type { MeetServerPort } from '../game/meetClient';
import type { SessionServerPort } from '../game/sessionClient';
import type { SaveRefusalCode } from '../game/saveGame';
import { streakDayFromLocalWallClock } from '../game/streak';

/** One key, versioned by the schema INSIDE the string rather than the name. */
const SAVE_KEY = 'three-white-lights.save';

/**
 * Where a refused save's bytes go, keyed by why they were refused, so the
 * first accepted mutation of the fresh lifter cannot overwrite the one copy
 * of a save this build could not read. A FUTURE_VERSION quarantine is a
 * player's newer lifter waiting for the app to catch up — the most important
 * bytes this store will ever hold.
 */
const QUARANTINE_KEY = (code: SaveRefusalCode): string => `three-white-lights.save.refused.${code}`;

/**
 * The web store. `null` where there is no `localStorage` (a native build, a
 * worker) — the server treats a null store as "nothing persists", which is
 * yesterday's shipped behavior rather than a new failure mode.
 */
function webSaveStore(): SaveStore | null {
  if (typeof localStorage === 'undefined') return null;
  return {
    load: () => localStorage.getItem(SAVE_KEY),
    save: (text) => {
      localStorage.setItem(SAVE_KEY, text);
    },
    quarantine: (text, code) => {
      localStorage.setItem(QUARANTINE_KEY(code), text);
    },
  };
}

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
  if (connection === null) {
    const now = new Date();
    connection = localSessionServer({
      store: webSaveStore() ?? undefined,
      freshSignupDay: streakDayFromLocalWallClock({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hour: now.getHours(),
      }),
    });
  }
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
 * The app's connection, as the CAREER surface is allowed to see it.
 *
 * The same object as the other two accessors return, narrowed to the career
 * half — one row behind one port, extended to the third mode that reads it.
 * A federation chosen through this port is on the snapshot the session half
 * opens, and a meet banked through the meet half is on the career record this
 * half's calendar reads, because all three are one `ServerRecord` in one
 * closure. `shellWiring.test.ts` drives both directions.
 */
export function appCareerPort(): CareerServerPort {
  return appConnection();
}
