/**
 * meetClient.ts — the CLIENT half of MEET DAY's server boundary.
 *
 * The exact mirror of `sessionClient.ts`, one mode over. That file is the daily
 * loop's half; this one is GDD §6's. `meetServer.ts` is the Edge Function's
 * body; this is everything meet day is allowed to know and the only route it may
 * know it by.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS: MEET DAY PLAYED A DIFFERENT LIFTER
 * ---------------------------------------------------------------------------
 * `sessionClient.ts` closed exactly this hole for the daily loop and its header
 * argues the general case: the app cannot hold a `ServerRecord`, because holding
 * two sources of truth means reaching for the wrong one typechecks. That
 * argument was made, applied to `useSession`, and enforced by a source scan —
 * and `useMeetDay` one directory over was still doing all of it:
 *
 *     const recordRef = useRef<ServerRecord>(
 *       frozen ? previewServerRecord() : newServerRecord(SIGNUP_DAY));
 *
 * A row of its own, built on mount, never told about a single training session.
 * The consequences were not subtle, and they were permanent rather than
 * occasional:
 *
 *   - `bestE1rmKg` was always the signup seed, so GDD §6.1's "openers pre-filled
 *     from current e1RM" pre-filled the same three numbers on day 1 and day 400.
 *   - `totalKg` was always `null`, so GDD §6.5's recap said FIRST TOTAL after
 *     every meet a player would ever lift.
 *   - `meets` was always `[]`, so `isPrAttempt` was permanently false and GDD
 *     §6.3's attempt tension — the document calls it "The Real Tension" — was
 *     dead code in the shipped app.
 *   - `MEET_ALREADY_RECORDED`, the guard against banking one meet twice, could
 *     not fire, because the row that would have remembered the first one was
 *     thrown away with the component.
 *
 * Every unit test was green throughout, and had to be: the pure modules were all
 * correct. What was wrong was WHICH LIFTER they were called about.
 *
 * ---------------------------------------------------------------------------
 * THE SHAPE OF THE FIX: ONE ROW, ONE PORT, BOTH MODES
 * ---------------------------------------------------------------------------
 * `appServer.ts` already held the app's one connection and already argued why —
 * "the connection belongs to the app, not to a screen". Meet day now reaches
 * THAT connection:
 *
 *   - IN: `meetDayFactsFromCache` reads the crossing out of a `ProgressionCache`
 *     through `progression.ts`'s read accessors, and hands it to the SAME
 *     `meetServer.ts` `meetDayFacts` the server side calls. Not a second copy of
 *     the arithmetic — the same function, over `MeetDayHistory`.
 *   - OUT: `recordMeetResult` is a promise, like `recordTrainingSession`, and
 *     returns a snapshot wire plus the narrow `RecordedMeet` the recap needs.
 *     The stored row does not come back.
 *
 * This gives `readTotalKg` and `readMeets` their first non-test callers in the
 * app. Both were named in `sessionClient.ts`'s header as accessors with none,
 * which was the tell: a total nothing reads is a total nothing checks.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 * Zero React, zero I/O, no clock, no randomness, explicit return types.
 * `meetClient.test.ts` scans this source for `Date`, `Math.random` and `fetch`
 * the way `sessionClient.test.ts` scans its own. `MeetServerPort` is an
 * INTERFACE — declaring that somebody else's method returns a promise is not an
 * effect, and no implementation of it lives here.
 *
 * IT IMPORTS `meetServer.ts`, WHICH `sessionClient.ts` DELIBERATELY DOES NOT DO
 * FOR ITS OWN SERVER, so the difference is stated rather than left to be
 * noticed. What `sessionClient.ts` is keeping out is the stored ROW, and the two
 * things imported here are not one: `meetDayFacts` now takes `MeetDayHistory` —
 * three fields that are already on the wire and already have read accessors —
 * and `MeetServerError` is a refusal code. Neither gives this file, or anything
 * downstream of it, a way to name a `ServerRecord`.
 */

import type { FatigueState } from './fatigue';
import { LIFT_ORDER, type LiftKind } from './meet';
import type { ConfirmedMeetFacts } from './meetDay';
import {
  meetDayFacts,
  type MeetDayFacts,
  type MeetDayHistory,
  type MeetServerError,
} from './meetServer';
import type { MeetDefinition } from './meetTuning';
import {
  readBestE1rmKg,
  readMeets,
  readTotalKg,
  readingValue,
  type KilogramStartingE1rm,
  type ProgressionCache,
  type ProgressionSnapshotWire,
  type ProposalId,
  type ProposalOfKind,
} from './progression';

// ---------------------------------------------------------------------------
// The port: everything meet day may ask the server for
// ---------------------------------------------------------------------------

/**
 * The not-progression half of what the server tells a client at the start of a
 * meet.
 *
 * ONE FIELD, AND THE ALLOWLIST BELOW IS WHY — the same argument `SessionBrief`
 * makes, for the same reason, and kept as its own declaration rather than an
 * alias so that widening one mode's brief does not silently widen the other's.
 * Everything else meet day needs — the best e1RM per lift, the best total, the
 * per-lift competition bests — is a progression fact and comes through the
 * snapshot wire into the cache. Putting any of them here would rebuild the
 * bypass this file exists to remove.
 */
export interface MeetBrief {
  /**
   * The hidden ledger, pruned to the days that can still affect `day`.
   *
   * Deliberately NOT on `ProgressionSnapshotWire` (GDD §3.4, §12.3):
   * `sessionServer.ts` says why — "a ledger on the wire is a meter that has not
   * been rendered yet."
   */
  readonly fatigue: FatigueState;
}

export const MEET_BRIEF_KEYS = ['fatigue'] as const;

export type MeetBriefKey = (typeof MEET_BRIEF_KEYS)[number];

/**
 * COMPILE-TIME ASSERTION, not documentation. Adding a field to `MeetBrief` fails
 * `tsc` here until it is written into the allowlist — which is where somebody
 * has to argue that the thing being added is not a progression fact arriving
 * through the side door.
 */
export type MeetBriefIsExactlyItsAllowlist =
  [Exclude<keyof MeetBrief, MeetBriefKey>] extends [never]
    ? [Exclude<MeetBriefKey, keyof MeetBrief>] extends [never]
      ? true
      : never
    : never;

export const A_MEET_BRIEF_IS_EXACTLY_ITS_ALLOWLIST: MeetBriefIsExactlyItsAllowlist = true;

/**
 * What the server says about a meet it accepted, AS MUCH OF IT AS THE CLIENT MAY
 * SEE.
 *
 * `AppliedMeetResult` minus `record` and `wire`. The row does not come back —
 * that is the whole discipline — and the wire is handed over separately, because
 * it is the thing that may only become facts through
 * `receiveProgressionSnapshot`.
 *
 * IT EXTENDS `ConfirmedMeetFacts`, which is what `buildMeetRecap` takes, so the
 * recap is built from the server's answer and cannot quietly be built from the
 * client's card.
 */
export interface RecordedMeet extends ConfirmedMeetFacts {
  /**
   * Which lift ended the meet, or `null` when it did not end in one.
   *
   * `bestByLiftKg` and `previousBestByLiftKg` used to be declared here and are
   * now inherited: `buildMeetRecap` needs both to tell a beaten record from a
   * first one, so they belong to the facts the recap is built from rather than
   * to this narrowing of them.
   */
  readonly bombedLift: LiftKind | null;
}

/** What the `record-meet-result` endpoint answered with. */
export type MeetServerResponse =
  /** The response body, exactly as an Edge Function would send it. */
  | {
      readonly kind: 'recorded';
      readonly wire: ProgressionSnapshotWire;
      readonly result: RecordedMeet;
    }
  /** The server refused. Nothing moved; the proposal is dead. */
  | { readonly kind: 'refused'; readonly error: MeetServerError };

/**
 * The whole of meet day's access to the server.
 *
 * `recordMeetResult` returns a PROMISE for the same reason
 * `recordTrainingSession` does: a real Edge Function is a network call, and the
 * in-flight state has to be one the app genuinely passes through rather than one
 * it computes and discards inside a single `setState`. `useMeetDay` used to
 * apply the result synchronously inside a `setCache` updater, so the optimistic
 * `ProjectionWithinReach<'record-meet-result'>` it built — the one thing a meet
 * is allowed to show while the request is in flight, its Total — existed for
 * zero frames and no screen could ever render it.
 *
 * NO METHOD RETURNS A `ServerRecord`, AND THAT IS THE POINT.
 *
 * `openingSnapshot` is declared here as well as on `SessionServerPort` on
 * purpose: it is the same method, and the app's one connection implements both
 * interfaces with one function, so a port that can answer a meet's opening read
 * is the same object that answers the session's.
 */
export interface MeetServerPort {
  /** The snapshot the app opens on. Synchronous: there is nothing to wait for. */
  readonly openingSnapshot: () => ProgressionSnapshotWire;
  /** The feel inputs for a meet. See `MeetBrief`. */
  readonly meetBrief: (day: number) => MeetBrief;
  /** `record-meet-result`. The only way a Total moves. */
  readonly recordMeetResult: (
    day: number,
    meet: MeetDefinition,
    proposal: ProposalOfKind<'record-meet-result'>,
    proposalId: ProposalId,
  ) => Promise<MeetServerResponse>;
}

// ---------------------------------------------------------------------------
// Truth out: cache -> what the meet-day machine is started with
// ---------------------------------------------------------------------------

/**
 * The lifter's history AS THE CLIENT HAS IT, read entirely out of the cache.
 *
 * Every number here comes back through `progression.ts`'s read accessors, so it
 * is a value the server sent or an explicit stand-in for not having heard from
 * the server yet — never a number the client made up and never a field lifted
 * off a stored row.
 *
 * A PROJECTED READING IS TAKEN AT ITS VALUE, AND THAT IS THE RIGHT CALL HERE
 * rather than a shortcut. `readingValue` returns the projection while a proposal
 * is in flight; the alternative is to open a meet against a number the player
 * can see is out of date on the close-out they just left. The meet is not banked
 * off these numbers — `applyMeetResult` replays the attempts server-side — so
 * the worst a projection can do is suggest an opener a kilo or two off, and the
 * server corrects the record either way.
 *
 * BEFORE THE FIRST SNAPSHOT LANDS every reading is `'unknown'` and this reports a
 * lifter with no history: no e1RM on record, no total, no meets. `meetDayFacts`
 * then falls back to the seed, which is the same number `newServerRecord` writes,
 * so the honest empty state and the old fabricated one agree — for a lifter who
 * genuinely has no history, and only for them.
 */
export function meetDayHistoryFromCache(cache: ProgressionCache): MeetDayHistory {
  const bestE1rmKg: Record<LiftKind, number | null> = { squat: null, bench: null, deadlift: null };
  for (const lift of LIFT_ORDER) {
    bestE1rmKg[lift] = readingValue(readBestE1rmKg(cache, lift));
  }
  const meets = readingValue(readMeets(cache)) ?? [];
  return {
    bestE1rmKg,
    totalKg: readingValue(readTotalKg(cache)),
    // Mapped rather than passed through, so what crosses is the one field
    // `previousBestByLift` reads and not a `ConfirmedMeetResult` with a meet id,
    // a day index and a bodyweight on it.
    meets: meets.map((meet) => ({ bestByLift: meet.bestByLift })),
  };
}

/**
 * WHAT THE LIFTER BRINGS TO THE PLATFORM, and the only route the played app has
 * to it.
 *
 * The meet-day twin of `sessionClient.ts`'s `todayFromCache`. It does no
 * arithmetic of its own: it reads the cache into a `MeetDayHistory` and hands
 * that to `meetServer.ts`'s `meetDayFacts`, which is the same call the server
 * side makes about the same lifter. Two callers, one function, so the two halves
 * cannot report different openers for one e1RM.
 *
 * AND WHAT IT READS IS THE LIFTER'S OWN TRAINING, which is the claim GDD §6.1
 * makes — "opening attempts pre-filled from current Sim-mode e1RM data" — and
 * which was false of the shipped app for six waves.
 *
 * @guarantee the-opener-follows-the-lifter
 */
export function meetDayFactsFromCache(
  cache: ProgressionCache,
  day: number,
  fallbackE1rm: KilogramStartingE1rm,
): MeetDayFacts {
  return meetDayFacts(meetDayHistoryFromCache(cache), day, fallbackE1rm);
}
