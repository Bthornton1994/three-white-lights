/**
 * useCareer.ts — the Career surface's loop: one cache, two screens, and the
 * `choose-federation` round trip through the app's one connection.
 *
 * The same shape as `useMeetDay`, one mode over: the port arrives from
 * `AppShell` (`appCareerPort()` — the SAME object as the session's and meet
 * day's, one row behind one port), the cache opens on the port's snapshot, and
 * every state transition is a pure function in `careerSurface.ts` or
 * `progression.ts`. This file sequences; it computes nothing.
 *
 * ---------------------------------------------------------------------------
 * WHAT SURVIVES WHAT
 * ---------------------------------------------------------------------------
 * The surface is PERSISTENT (`shellRoute.ts`'s `PERSISTENT_SURFACES`): once
 * opened it stays mounted while the player trains, so an in-flight choice
 * settles into a live screen rather than a dead closure. The cost is that a
 * mounted calendar could go stale against the row — a meet banked after this
 * screen opened moves verdicts it would keep drawing from its old snapshot —
 * so the cache is RE-READ every time the surface becomes the one on screen,
 * unless a proposal is in flight (clobbering a pending choice would throw away
 * the refusal the player is owed). Same catch-up-on-activation pattern as
 * `EmpireScreen`'s floor.
 *
 * Nothing here writes Total, e1RM, streak, meets or the wallet. The one write
 * this surface can ask for is `choose-federation`, whose reach is the
 * federation fact alone (`ProposalReach`), decided by `careerServer.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CareerServerPort } from '../game/careerClient';
import { asProposalId, type ProgressionCache } from '../game/progression';
import { openingCache } from '../game/sessionClient';
import { asStreakDay, streakDayFromLocalWallClock, type LocalWallClock, type StreakDay } from '../game/streak';
import {
  cacheAfterChoiceResponse,
  cacheWithChoicePending,
  careerCalendarRows,
  careerSurfacePhase,
  federationChoiceOptions,
  federationChoiceProposal,
  refusalSentence,
  type CareerCalendarRow,
  type CareerSurfacePhase,
  type FederationChoiceOption,
} from './careerSurface';
import type { CareerFederationId } from '../career/careerTuning';

/** Reads the one real clock this surface touches. */
function nowWallClock(): LocalWallClock {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
  };
}

export interface CareerLoop {
  readonly cache: ProgressionCache;
  /** Which of the two screens is up. The shell's chrome gate reads this. */
  readonly phase: CareerSurfacePhase;
  /** The day every calendar verdict below was taken on. */
  readonly today: StreakDay;
  /** The chooser's four cards. */
  readonly options: readonly FederationChoiceOption[];
  /** The calendar's rows, or null before the first snapshot. */
  readonly rows: readonly CareerCalendarRow[] | null;
  /** The server's refusal sentence, verbatim, or null. */
  readonly refusal: string | null;
  /** True while a `choose-federation` request is in flight. */
  readonly inFlight: boolean;
  /** Sends the choice. A no-op while one is already in flight. */
  readonly choose: (id: CareerFederationId) => void;
}

export function useCareer(port: CareerServerPort, active: boolean, dayClock?: () => number): CareerLoop {
  const [cache, setCache] = useState<ProgressionCache>(() => openingCache(port));
  const [refusal, setRefusal] = useState<string | null>(null);
  const [today, setToday] = useState<StreakDay>(() =>
    dayClock === undefined ? streakDayFromLocalWallClock(nowWallClock()) : asStreakDay(dayClock()),
  );
  const proposalSeq = useRef<number>(0);

  // THE RE-READ ON ACTIVATION. `openingSnapshot` is synchronous truth from the
  // app's one row, so a surface that was hidden while a meet was banked draws
  // this sitting's verdicts, not its mount-time ones. Skipped while a proposal
  // is pending — the settle handler below owns the cache until it answers.
  useEffect(() => {
    if (!active) return;
    setToday(dayClock === undefined ? streakDayFromLocalWallClock(nowWallClock()) : asStreakDay(dayClock()));
    setCache((current) => (current.status === 'pending' ? current : openingCache(port)));
  }, [active, port, dayClock]);

  // The latest cache, for the tap handler. A callback keyed on `cache` would
  // be rebuilt every settle; a ref reads the same truth without the churn, and
  // the updater below still starts from React's `current` rather than from it.
  const cacheRef = useRef<ProgressionCache>(cache);
  cacheRef.current = cache;

  const choose = useCallback(
    (id: CareerFederationId) => {
      const proposal = federationChoiceProposal(id);
      proposalSeq.current += 1;
      const proposalId = asProposalId(`career-choice-${proposalSeq.current}`);
      // Decided AGAINST THE LATEST CACHE, outside the updater, so the request
      // fires exactly once per accepted proposal — `proposeChange` refuses an
      // empty, stale or already-pending cache, and a second tap during the
      // round trip lands on `pending` and is a no-op.
      const pending = cacheWithChoicePending(cacheRef.current, proposal, proposalId);
      if (pending === null) return;
      setCache(pending);
      setRefusal(null);
      void port.chooseFederation(proposal, proposalId).then((response) => {
        setRefusal(refusalSentence(response));
        setCache((current) =>
          cacheAfterChoiceResponse(current, proposalId, response, port.openingSnapshot()),
        );
      });
    },
    [port],
  );

  const rows = useMemo(() => careerCalendarRows(cache, today), [cache, today]);

  return {
    cache,
    phase: careerSurfacePhase(cache),
    today,
    options: federationChoiceOptions(),
    rows,
    refusal,
    inFlight: cache.status === 'pending',
    choose,
  };
}
