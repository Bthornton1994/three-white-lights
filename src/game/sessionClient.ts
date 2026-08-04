/**
 * sessionClient.ts — the CLIENT half of the daily session's server boundary.
 *
 * The mirror of `sessionServer.ts`. That file is the Edge Function's body: what
 * the server decides. This one is everything the app is allowed to know, and the
 * only route it may know it by.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS: THE CACHE WAS WRITE-ONLY
 * ---------------------------------------------------------------------------
 * `progression.ts` had a sealed write half and a read half with NO CALLERS.
 * `readTotalKg`, `readBestE1rmKg`, `readStreakDays`, `readBalance`, `readMeets`,
 * `cachedSnapshot` and `inFlightProposal` had zero non-test consumers, while both
 * ends of the real data path went round them:
 *
 *   - IN: `useSession` posted a snapshot into the cache and then built the
 *     session from `todayForLifter(recordRef.current, ...)` — the stored server
 *     ROW, read directly. `SessionContext.e1rmKg`, `bestE1rmKg` and
 *     `streakBefore` were plain numbers that had never been through the door.
 *   - OUT: the close-out rendered `closeOut.newBestE1rmKg` and
 *     `closeOut.streakAfter` — computed on the client at close-out time and never
 *     re-read afterwards. They agreed with the server only because the server
 *     stand-in imported the client's own `nextBestE1rm`. The first real Edge
 *     Function that returned anything else would have been ignored, on screen,
 *     for ever.
 *
 * A boundary read through in exactly zero places is a write-only cache, and the
 * screen it feeds is client-authoritative however well the writes are fenced.
 * CLAUDE.md: "Local state is a cache of server truth, not the truth itself" and
 * "do not write client-authoritative code that will need unwinding later".
 *
 * ---------------------------------------------------------------------------
 * THE SHAPE OF THE FIX: THE APP CANNOT HOLD A `ServerRecord`
 * ---------------------------------------------------------------------------
 * The bypass was possible because the hook held two sources of truth — a
 * `ProgressionCache` and a `ServerRecord` — and reaching for the wrong one
 * typechecked. So the record is gone from the app entirely. It lives behind
 * `SessionServerPort`, whose outputs are:
 *
 *   - a `ProgressionSnapshotWire`, which is plain JSON and can only become facts
 *     through `receiveProgressionSnapshot`, and
 *   - a `SessionBrief`, which is the deliberately-not-progression half (§ below).
 *
 * There is no third output and no accessor for the row. A future bypass is not
 * "don't do that", it is "there is nothing to reach for".
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 * Zero React, zero I/O, no clock, no randomness, explicit return types.
 * `sessionClient.test.ts` scans this source for `Date`, `Math.random` and
 * `fetch` the way `progression.test.ts` scans its own. `SessionServerPort` is an
 * INTERFACE — declaring that somebody else's method returns a promise is not an
 * effect, and no implementation of it lives here.
 *
 * ---------------------------------------------------------------------------
 * THE FATIGUE LEDGER, WHICH IS A §12.3 QUESTION AND IS ANSWERED HERE
 * ---------------------------------------------------------------------------
 * GDD §3.4 and §12.3: never a visible fatigue meter. `ProgressionSnapshotWire`
 * has no `fatigue` field and may not grow one — `sessionServer.ts` says why: "a
 * ledger on the wire is a meter that has not been rendered yet."
 *
 * But the client has to render GDD §3.4's four channels — bar-speed cues, window
 * width, miss chance, readiness feedback — and `fatigue.ts`'s `sessionFeel` is
 * what computes them, from the ledger. So SOMETHING has to cross. What the old
 * path handed over was `todayForLifter(...)`, whose `fatigue` field is the whole
 * stored `FatigueState`, alongside five progression numbers that had their own
 * door and were not using it.
 *
 * Three things narrow that here, and the residual is stated rather than glossed:
 *
 *  1. IT IS A DIFFERENT DOOR, AND IT CARRIES ONE THING. `SessionBrief` is what
 *     the client is given to PLAY today, as against what it is told about its
 *     progression. `SESSION_BRIEF_KEYS` is `['fatigue']` and
 *     `A_SESSION_BRIEF_IS_EXACTLY_ITS_ALLOWLIST` fails `tsc` if a second field
 *     appears. Every number `todayForLifter` also returns now comes from the
 *     cache instead, so the brief cannot become the bypass the row was.
 *  2. IT IS NARROWED TO THE HORIZON. The port hands over
 *     `pruneFatigueState(ledger, day)` — GDD §3.4's "same-day / next-day horizon,
 *     not multi-week arcs" — so what crosses is the days that can still affect
 *     today, not a training history. `fatigue.test.ts` already pins that pruning
 *     changes no signal, so this costs nothing but what it removes.
 *  3. THE NUMBER IS ALREADY BEHIND A SYMBOL. `sessionFeel` returns a qualitative
 *     `SessionFeel` whose one scalar, `burden`, is keyed by a module-private
 *     symbol. Nothing downstream of the brief can print a fatigue level without
 *     re-deriving one from the raw records.
 *
 * THE RESIDUAL, PLAINLY: `SessionContext.fatigue` is still a readable
 * `FatigueState`, so nothing in the type system stops a future `.tsx` from
 * counting `context.fatigue.sessions` and drawing a bar off it. Closing that
 * means making the field opaque the way `SessionFeel`'s internals are — an edit
 * to `session.ts`, which another builder holds this round. What guards it
 * meanwhile is a scan, not a comment: `sessionClient.test.ts` fails if any screen
 * under `src/session/` names the ledger at all. A scan is weaker than a type and
 * this file does not claim otherwise.
 */

import { pruneFatigueState, type FatigueState } from './fatigue';
import type { LiftKind } from './meet';
import {
  applyServerSnapshot,
  emptyProgressionCache,
  proposeChange,
  readBestE1rmKg,
  readStreakDays,
  readStreakState,
  readingValue,
  receiveProgressionSnapshot,
  type ConfirmedKg,
  type ProgressionCache,
  type ProgressionReading,
  type ProgressionSnapshotWire,
  type ProjectedCount,
  type ProjectedKg,
  type ProposalId,
  type ProposalOfKind,
} from './progression';
import {
  SESSION_PAYOFFS,
  sessionProjection,
  sessionProposal,
  type SessionCloseOut,
  type SessionContext,
  type SessionPayoff,
} from './session';
import { asStreakDay, openDay, type LocalWallClock } from './streak';
import { SESSION_TUNING } from './sessionTuning';

// ---------------------------------------------------------------------------
// The port: everything the app may ask the server for
// ---------------------------------------------------------------------------

/**
 * The not-progression half of what the server tells a client at session start.
 *
 * ONE FIELD, AND THE ALLOWLIST BELOW IS WHY. Everything else `todayForLifter`
 * computes — the e1RM, the best on record, the streak before, the streak if
 * trained today, whether today is already trained — is a progression fact and
 * has its own door. Putting any of them here would rebuild the bypass this file
 * exists to remove.
 */
export interface SessionBrief {
  /**
   * The hidden ledger, pruned to the days that can still affect `day`.
   *
   * Deliberately NOT on `ProgressionSnapshotWire` (GDD §3.4, §12.3). See the
   * header for the full argument and for the residual.
   */
  readonly fatigue: FatigueState;
}

export const SESSION_BRIEF_KEYS = ['fatigue'] as const;

export type SessionBriefKey = (typeof SESSION_BRIEF_KEYS)[number];

/**
 * COMPILE-TIME ASSERTION, not documentation. Adding a field to `SessionBrief`
 * fails `tsc` here until it is written into the allowlist — which is where
 * somebody has to argue that the thing being added is not a progression fact
 * arriving through the side door.
 */
export type SessionBriefIsExactlyItsAllowlist =
  [Exclude<keyof SessionBrief, SessionBriefKey>] extends [never]
    ? [Exclude<SessionBriefKey, keyof SessionBrief>] extends [never]
      ? true
      : never
    : never;

export const A_SESSION_BRIEF_IS_EXACTLY_ITS_ALLOWLIST: SessionBriefIsExactlyItsAllowlist = true;

/** What the `record-training-session` endpoint answered with. */
export type SessionServerResponse =
  /** The response body, exactly as an Edge Function would send it. */
  | { readonly kind: 'snapshot'; readonly wire: ProgressionSnapshotWire }
  /** The server refused. Nothing moved; the proposal is dead. */
  | { readonly kind: 'refused'; readonly message: string };

/**
 * The whole of the app's access to the server.
 *
 * `recordTrainingSession` returns a PROMISE because a real Edge Function is a
 * network call, and the in-flight state has to be a state the app genuinely
 * passes through rather than one it computes and discards inside a single
 * `setState`. The one before this returned everything synchronously, which is
 * why `ProgressionCache`'s `pending` branch — and every `'projected'` reading
 * built on it — could never be rendered by anything.
 *
 * NO METHOD RETURNS A `ServerRecord`, AND THAT IS THE POINT. The stored row is
 * the implementation's business.
 */
export interface SessionServerPort {
  /** The snapshot the app opens on. Synchronous: there is nothing to wait for. */
  readonly openingSnapshot: () => ProgressionSnapshotWire;
  /** The feel inputs for one session. See `SessionBrief`. */
  readonly sessionBrief: (day: number, lift: LiftKind) => SessionBrief;
  /** `record-training-session`. The only way e1RM and the streak move. */
  readonly recordTrainingSession: (
    day: number,
    proposal: ProposalOfKind<'record-training-session'>,
    proposalId: ProposalId,
  ) => Promise<SessionServerResponse>;
}

/**
 * Narrows a stored ledger to the days that can still affect `day`.
 *
 * Exported so the one place a ledger crosses the boundary is a named call a
 * critic can grep for, rather than a field copy inside a port implementation.
 */
export function briefFatigueFor(ledger: FatigueState, day: number): FatigueState {
  return pruneFatigueState(ledger, day);
}

// ---------------------------------------------------------------------------
// Truth in: wire -> cache
// ---------------------------------------------------------------------------

/**
 * The cache a wire produces, starting from `cache`.
 *
 * TOTAL, AND A REFUSAL LEAVES TRUTH ALONE. A malformed body or a snapshot behind
 * the one already held returns the cache unchanged — never a partially applied
 * one. `progression.ts` owns both refusals; this only declines to paper over
 * them.
 */
export function receiveSnapshot(
  cache: ProgressionCache,
  wire: ProgressionSnapshotWire,
): ProgressionCache {
  const received = receiveProgressionSnapshot(wire);
  if (!received.ok) return cache;
  const applied = applyServerSnapshot(cache, received.value);
  return applied.ok ? applied.value : cache;
}

/** The cache the app opens on. */
export function openingCache(port: SessionServerPort): ProgressionCache {
  return receiveSnapshot(emptyProgressionCache(), port.openingSnapshot());
}

// ---------------------------------------------------------------------------
// Truth out: cache -> what the session machine is started with
// ---------------------------------------------------------------------------

/**
 * What today looks like, read ENTIRELY OUT OF THE CACHE.
 *
 * The replacement for `todayForLifter(record, ...)` on the client side. Every
 * number here comes back through `progression.ts`'s read accessors, so it is a
 * value the server sent or an explicit stand-in for not having heard from the
 * server yet — never a number the client made up and never a field lifted off a
 * stored row.
 *
 * `streak.ts`'s `openDay` is what answers "what does today do" — the free grace,
 * the Recovery Day offer, whether today is already logged. It takes the whole
 * `StreakState`, which is why `readStreakState` exists.
 *
 * BEFORE THE FIRST SNAPSHOT LANDS the readings are `'unknown'` and this reports
 * a lifter with no history: no best on record, no run, and today would start one.
 * With the local stand-in that state lasts zero frames, because its opening
 * snapshot is synchronous. With a real backend it is the loading state, and it is
 * honest rather than a zero dressed up as a fact.
 */
export interface TodayFromCache {
  readonly day: number;
  readonly lift: LiftKind;
  /** The e1RM loads are prescribed from, kg. */
  readonly e1rmKg: number;
  /** Best e1RM on record for this lift, kg, or null. Server truth. */
  readonly bestE1rmKg: number | null;
  readonly streakBefore: number;
  readonly streakIfTrainedToday: number;
  /** True when the server would refuse a second session today (GDD §3.2). */
  readonly alreadyTrainedToday: boolean;
  /** True until a snapshot has landed. Nothing below it is server truth yet. */
  readonly awaitingFirstSnapshot: boolean;
}

export function todayFromCache(cache: ProgressionCache, day: number, lift: LiftKind): TodayFromCache {
  const best = readingValue(readBestE1rmKg(cache, lift));
  const streak = readStreakState(cache);
  const streakDays = readingValue(readStreakDays(cache));

  let streakBefore = 0;
  let streakIfTrainedToday = 1;
  let alreadyTrainedToday = false;
  if (streak.kind !== 'unknown') {
    const opening = openDay(streak.value, asStreakDay(day));
    streakBefore = streak.value.currentStreak;
    alreadyTrainedToday = opening.kind === 'already-trained-today';
    streakIfTrainedToday =
      opening.kind === 'streak-alive' || opening.kind === 'gap-covered-by-grace'
        ? opening.streakIfTrainedToday
        : opening.kind === 'already-trained-today'
          ? opening.currentStreak
          : 1;
  }

  return {
    day,
    lift,
    // Loads are prescribed from the best e1RM on record. Before a snapshot has
    // landed the client has no server number to read, so the seed stands in —
    // the same fallback `sessionServer.ts` uses.
    //
    // AND IT IS PROGRESSION, which this comment used to deny in as many words
    // ("onboarding data rather than progression"). `newServerRecord()` writes
    // the same seed into `bestE1rmKg`, which is protected, on the wire, and
    // monotone through `nextBestE1rm` — so it is the permanent floor under the
    // lifter's e1RM, not a placeholder that stops mattering once a real number
    // arrives. What this line does is show the client the number the server
    // already holds, one revision early; the unit is proven where the WRITE is
    // (`sessionServer.ts`'s `PROVEN_STARTING_E1RM`), because a client is a
    // renderer and nothing it computes here is banked.
    e1rmKg: best ?? SESSION_TUNING.STARTING_E1RM.kilograms[lift],
    bestE1rmKg: best,
    // Kept as a separate read from `readStreakState` so the number a screen
    // prints and the state the rules run on cannot silently be two different
    // revisions: if they ever disagree, the reading is the one that is rendered.
    streakBefore: streakDays ?? streakBefore,
    streakIfTrainedToday,
    alreadyTrainedToday,
    awaitingFirstSnapshot: streak.kind === 'unknown',
  };
}

/** The context `createSession` is started with, entirely from the cache + brief. */
export function sessionContextFrom(
  cache: ProgressionCache,
  brief: SessionBrief,
  day: number,
  lift: LiftKind,
): SessionContext {
  const today = todayFromCache(cache, day, lift);
  return {
    day,
    lift,
    e1rmKg: today.e1rmKg,
    bestE1rmKg: today.bestE1rmKg,
    streakBefore: today.streakBefore,
    streakIfTrainedToday: today.streakIfTrainedToday,
    fatigue: brief.fatigue,
  };
}

// ---------------------------------------------------------------------------
// The proposal
// ---------------------------------------------------------------------------

/**
 * What a finished session asks the server for, and what the screen may show
 * while it waits. `null` when the session banked nothing.
 */
export interface SessionSubmission {
  readonly proposal: ProposalOfKind<'record-training-session'>;
  readonly cache: ProgressionCache;
}

/**
 * Moves the cache to `pending` for a finished session.
 *
 * Returns `null` when there is nothing to send, or when `progression.ts` refuses
 * the pairing — a stale cache, a proposal already in flight, a projection out of
 * reach. A refusal leaves the cache alone; it never half-applies.
 */
export function submitCloseOut(
  cache: ProgressionCache,
  closeOut: SessionCloseOut,
  deviceWallClock: LocalWallClock,
  proposalId: ProposalId,
): SessionSubmission | null {
  const proposal = sessionProposal(closeOut, deviceWallClock);
  if (proposal === null) return null;
  const pending = proposeChange(cache, proposalId, proposal, sessionProjection(closeOut));
  if (!pending.ok) return null;
  return { proposal, cache: pending.value };
}

// ---------------------------------------------------------------------------
// What the payoff beat renders
// ---------------------------------------------------------------------------

/**
 * What today's session pays. TWO KINDS (GDD §3.2, ruled).
 *
 * `'e1rm'` — a competition lift was trained and the record's best for it moves.
 * `'training-iq'` — accessory day. There is no fourth `LiftKind` and there never
 * will be, because `LiftKind` is the meet (§6.2), so an accessory session has no
 * e1RM to show and the close-out must not invent one.
 *
 * RE-EXPORTED FROM `session.ts` RATHER THAN DECLARED TWICE. It used to be a
 * second copy of the same two strings, which was survivable while the tag was
 * optional and read structurally, and is not now that `SessionCloseOut.payoff`
 * is a real field: two spellings of one union is two places for a third payoff
 * to be added to only one of.
 */
export const SESSION_PAYOFF_KINDS = SESSION_PAYOFFS;

export type SessionPayoffKind = SessionPayoff;

/**
 * Which payoff a close-out has.
 *
 * A FIELD READ, NOW THAT THERE IS A FIELD. This used to reach through a
 * structural `{ payoff?: unknown }` view because `session.ts` carried no
 * discriminant — accessory day was ruled but unbuilt, and this side branched on
 * a tag the preview stapled on. The cost showed up one field over: the client
 * branched on the tag for the NUMBERS while `headline` and `subhead` were chosen
 * in `session.ts` before anything knew what kind of day it was, so an accessory
 * close-out rendered a Training IQ row under an "NEW e1RM" call.
 *
 * `session.ts`'s `closeOutCopyFor` now picks the words from the same field this
 * reads.
 */
export function payoffKindFor(closeOut: SessionCloseOut): SessionPayoffKind {
  return closeOut.payoff;
}

/**
 * The e1RM half of the payoff, as read back through the boundary.
 *
 * `reading` is the whole point: `'confirmed'`, `'projected'`, `'stale'` and
 * `'unknown'` are four different things to say to a player and the renderer
 * cannot get at the number without saying which one it has.
 */
export interface E1rmPayoff {
  readonly kind: 'e1rm';
  readonly lift: LiftKind;
  readonly reading: ProgressionReading<ConfirmedKg | null, ProjectedKg>;
  /** The number to print, or `null` when there is none to print. */
  readonly valueKg: number | null;
  /** Where a count-up starts. `null` when there is nothing to count from. */
  readonly countFromKg: number | null;
  /**
   * Whether this is a PR, RE-DERIVED against whatever the reading actually says
   * rather than trusted from the close-out.
   *
   * This is the difference between a screen that reports the server and one that
   * reports its own arithmetic. `closeOut.isPr` is the CLIENT's prediction; if
   * the server comes back with a number that is not above the previous best,
   * this is false and the gold goes away.
   */
  readonly isPr: boolean;
}

/** The accessory-day payoff (GDD §3.2, ruled). */
export interface TrainingIqPayoff {
  readonly kind: 'training-iq';
  /**
   * ALWAYS `null` TODAY, AND THAT IS THE HONEST VALUE RATHER THAN A STUB.
   * Training IQ is a GDD §2 currency and is not yet a `ProgressionFactKey`, so
   * the boundary has nothing to read: there is no `readTrainingIq` to call. The
   * screen renders the absence — never a zero, never yesterday's e1RM — and the
   * builder who adds the fact fills this in.
   */
  readonly pointsGained: number | null;
}

export type CloseOutPayoff = E1rmPayoff | TrainingIqPayoff;

/** Everything the close-out screen prints, and how sure each number is. */
export interface CloseOutReadings {
  readonly payoff: CloseOutPayoff;
  readonly streakDays: ProgressionReading<number, ProjectedCount>;
  /** The number to print for the streak, or `null` when nothing is known. */
  readonly streakValue: number | null;
}

/**
 * The close-out, read back through the boundary.
 *
 * THE NUMBERS COME FROM THE CACHE, NOT FROM THE CLOSE-OUT. `closeOut` supplies
 * what the session DID — the lift, the reps, the previous best to count up from —
 * and the cache supplies what the record now IS. When the two disagree the cache
 * wins, which is the only arrangement in which a real Edge Function can ever
 * correct a client.
 */
export function closeOutReadings(
  cache: ProgressionCache,
  closeOut: SessionCloseOut,
): CloseOutReadings {
  const streakDays = readStreakDays(cache);
  const streakProjected = closeOut.canPropose ? closeOut.streakAfter : null;
  return {
    payoff: payoffFrom(cache, closeOut),
    streakDays,
    // Before the first snapshot there is nothing confirmed to print. The
    // close-out's own projection stands in only while the cache is `'unknown'`,
    // because a session that has just been played and has nowhere to report to
    // still happened.
    streakValue: readingValue(streakDays) ?? streakProjected,
  };
}

function payoffFrom(cache: ProgressionCache, closeOut: SessionCloseOut): CloseOutPayoff {
  if (payoffKindFor(closeOut) === 'training-iq') {
    return { kind: 'training-iq', pointsGained: null };
  }
  const reading = readBestE1rmKg(cache, closeOut.lift);
  const previous = closeOut.previousBestE1rmKg;
  const value = readingValue(reading);
  const countFrom =
    reading.kind === 'projected'
      ? (reading.lastConfirmed ?? previous)
      : previous;
  return {
    kind: 'e1rm',
    lift: closeOut.lift,
    reading,
    valueKg: value,
    countFromKg: countFrom ?? value,
    isPr: value !== null && (countFrom === null || value > countFrom),
  };
}
