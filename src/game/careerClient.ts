/**
 * careerClient.ts — the CLIENT half of the CAREER's server boundary.
 *
 * The exact mirror of `meetClient.ts`, one subsystem over: `careerServer.ts`
 * is the Edge Function's body and the one derivation of the career read model;
 * this is everything a career screen is allowed to know and the only route it
 * may know it by.
 *
 * ---------------------------------------------------------------------------
 * TRUTH OUT: THE SAME FOLD, CALLED ABOUT THE SAME LIFTER
 * ---------------------------------------------------------------------------
 * `careerLifterFromCache` reads the federation and the meets out of a
 * `ProgressionCache` through `progression.ts`'s read accessors and hands them
 * to the SAME `careerLifterFor` the server side calls — one fold, two callers,
 * no second copy of the arithmetic to drift. `careerCalendarFromCache` does
 * the same for the calendar view, so a calendar screen renders verdicts the
 * eligibility module produced rather than eligibility math it did itself. The
 * client stays a renderer: every number under these views is a value the
 * server sent, read back through an accessor.
 *
 * BEFORE THE FIRST SNAPSHOT LANDS both return `null` rather than a lifter
 * made up on the spot. A career is three server-owned facts, and unlike meet
 * day's opener fallback there is no seed worth inventing for it: a screen
 * with no snapshot has no career to draw, and saying so is the honest state.
 *
 * ---------------------------------------------------------------------------
 * PURITY CONTRACT
 * ---------------------------------------------------------------------------
 * Zero React, zero I/O, no clock, no randomness, explicit return types.
 * `CareerServerPort` is an interface — declaring that somebody else's method
 * returns a promise is not an effect, and no implementation of it lives here.
 * NO METHOD RETURNS A `ServerRecord`, AND THAT IS THE POINT.
 */

import {
  careerCalendarFor,
  careerLifterFor,
  type CareerCalendarView,
  type CareerServerError,
} from './careerServer';
import type { CareerLifter } from '../career/eligibility';
import {
  readFederation,
  readMeets,
  readingValue,
  type ConfirmedFederation,
  type ProgressionCache,
  type ProgressionSnapshotWire,
  type ProposalId,
  type ProposalOfKind,
} from './progression';

// ---------------------------------------------------------------------------
// The port: everything the career surface may ask the server for
// ---------------------------------------------------------------------------

/** What the `choose-federation` endpoint answered with. */
export type CareerServerResponse =
  /** The response body, exactly as an Edge Function would send it. */
  | { readonly kind: 'chosen'; readonly wire: ProgressionSnapshotWire }
  /** The server refused. Nothing moved; the proposal is dead. */
  | { readonly kind: 'refused'; readonly error: CareerServerError };

/**
 * The whole of the career surface's access to the server.
 *
 * `chooseFederation` returns a PROMISE for the reason `recordMeetResult`
 * does: a real Edge Function is a network call, and the in-flight state has
 * to be one the app genuinely passes through. There is no day parameter —
 * what refuses a choice is what is already on the record, never the calendar
 * — and there is no read method, because everything the career renders comes
 * back through the snapshot wire into the cache and out of the accessors
 * below.
 */
export interface CareerServerPort {
  /** The snapshot the app opens on. Shared with both other port halves. */
  readonly openingSnapshot: () => ProgressionSnapshotWire;
  /** `choose-federation`. The only way a federation moves after signup. */
  readonly chooseFederation: (
    proposal: ProposalOfKind<'choose-federation'>,
    proposalId: ProposalId,
  ) => Promise<CareerServerResponse>;
}

// ---------------------------------------------------------------------------
// Truth out: cache -> the career read models a screen renders
// ---------------------------------------------------------------------------

/**
 * The federation as the client has it, or `null` before the first snapshot.
 *
 * This is the 1b choosing screen's gate: `chosen === false` is a lifter still
 * carrying the seeded default, and the screen it gates offers the choice.
 */
export function federationFromCache(cache: ProgressionCache): ConfirmedFederation | null {
  return readingValue(readFederation(cache));
}

/**
 * The career read model as the client has it, or `null` before the first
 * snapshot.
 *
 * The same `careerLifterFor` the server calls, over the confirmed federation
 * and the confirmed meets. Meets are mapped down to the two fields the fold
 * reads rather than passed through, so what crosses is exactly
 * `CareerHistoryView` and not a `ConfirmedMeetResult` with a bodyweight on it.
 */
export function careerLifterFromCache(cache: ProgressionCache): CareerLifter | null {
  const federation = federationFromCache(cache);
  if (federation === null) return null;
  const meets = readingValue(readMeets(cache)) ?? [];
  return careerLifterFor({
    federation: { id: federation.id },
    meets: meets.map((meet) => ({ meetId: meet.meetId, totalKg: meet.totalKg })),
  });
}

/**
 * The calendar view GDD §6.1's screen draws, or `null` before the first
 * snapshot.
 *
 * `today` is the resolved day index the caller already holds — the same day
 * scale every other read in the app uses (GDD §4.1); this module never reads
 * a clock.
 */
export function careerCalendarFromCache(
  cache: ProgressionCache,
  today: number,
  horizonDays?: number,
): CareerCalendarView | null {
  const lifter = careerLifterFromCache(cache);
  if (lifter === null) return null;
  return careerCalendarFor(lifter, today, horizonDays);
}
