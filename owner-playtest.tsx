/**
 * owner-playtest.tsx — VL-3's OWNER ROUTE: a standalone web entry that opens
 * DIRECTLY into the persistent Gym Empire Play surface, with the real
 * `GymScreen`, no shell chrome, no test cards, no diagnostics, no developer
 * prose in view.
 *
 *     npm ci
 *     npx vite --config vite.owner.config.ts --open /owner-playtest.html?scenario=capacity
 *
 * which serves http://localhost:5173/owner-playtest.html?scenario=capacity
 * (Vite's default port; `--port <n>` moves it). Without the query string the
 * same page opens the gym unfunded, exactly as a fresh install does.
 *
 * WHY THIS IS A ROOT ENTRY AND NOT A SHELL ROUTE. `src/shell/` is Session A's
 * (CLAUDE.md "VL-3": "the owner route is a standalone web entry, not a shell
 * edit"), so this file follows the shape `ladder-dev.tsx` set for the stage
 * gates: the one stateful hook lives here, outside `src/empire/`, and
 * everything of substance is imported. Nothing in `src/` reads this file.
 *
 * WHAT IT COPIES FAITHFULLY: `src/shell/AppShell.tsx`'s `GymHost`. Same
 * `useReducer(gymViewReduce, undefined, createGymViewState)`, same real-time
 * anchor (a `Date.now()` reading held in a ref, never React state), same
 * `advance-clock` dispatch computed from genuine elapsed seconds — `'offline'`
 * on mount (the "returning after a gap" read, discounted) and `'online'` on
 * the `WALL_CLOCK_TICK_INTERVAL_SECONDS` interval (the "watching it run"
 * read, undiscounted) — so the gym keeps earning while the owner watches it.
 * The gap is floored to whole seconds and a gap under `TICK_SECONDS` is a
 * no-op that leaves the anchor where it was, as `GymHost` does. `GymHost`'s
 * `visible` prop is always true here: this page has no other surface.
 *
 * THE ONE QUERY PARAMETER, READ HERE AND NOWHERE IN `src/empire/`.
 * `?scenario=capacity` dispatches, once on mount, the SAME action the More
 * drawer's largest "away" dev button dispatches — `advance-clock` with the
 * largest `'offline'` step `ladderDevTimeSteps()` offers (the +3d away /
 * 72-hour button, `gymscreen-advance-offline-259200`) — so the gym is funded
 * for the Capacity purchase through the real reducer. No new mint, no new
 * action, no economy change: the step is read from the same table the
 * button reads, never typed here. Any other value of `scenario`, or none,
 * dispatches nothing.
 *
 * This file carries no numeric literal on purpose: `src/tuning/audit.ts`'s
 * walk includes the repository root, and a number here would be a bare knob
 * outside every tuning home.
 */

import { StrictMode, useCallback, useEffect, useReducer, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { EMPIRE_TUNING } from './src/empire/empireTuning';
import { GymScreen } from './src/empire/GymScreen';
import { type EarningsMode, ladderDevTimeSteps } from './src/empire/ladder';
import { createGymViewState, gymViewReduce } from './src/empire/ladderView';

/** The one scenario name this route understands. */
const CAPACITY_SCENARIO = 'capacity';

/** `?scenario=<name>` from the address bar, or null. Read once, here only. */
function scenarioFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('scenario');
}

/**
 * The largest `'offline'` dev step — the More drawer's +3d away button. Read
 * from the same table the drawer maps over, so the two cannot drift.
 */
function largestAwayDevStepSeconds(): number | null {
  let largest: number | null = null;
  for (const step of ladderDevTimeSteps()) {
    if (step.mode !== 'offline') continue;
    if (largest === null || step.seconds > largest) largest = step.seconds;
  }
  return largest;
}

function OwnerPlaytestApp({ scenario }: { readonly scenario: string | null }) {
  const [state, dispatch] = useReducer(gymViewReduce, undefined, createGymViewState);
  const lastAnchorMsRef = useRef<number>(Date.now());
  const scenarioDispatchedRef = useRef<boolean>(false);

  // `GymHost`'s catch-up, verbatim in shape: read the real gap since the
  // anchor, collapse a sub-tick gap into a no-op without moving the anchor,
  // otherwise move the anchor and dispatch the gap in the given mode.
  const catchUpOnRealTime = useCallback((mode: EarningsMode): void => {
    const nowMs = Date.now();
    const gapSeconds = Math.floor(
      (nowMs - lastAnchorMsRef.current) / EMPIRE_TUNING.MILLISECONDS_PER_SECOND,
    );
    if (gapSeconds < EMPIRE_TUNING.TICK_SECONDS) return;
    lastAnchorMsRef.current = nowMs;
    dispatch({ kind: 'advance-clock', gapSeconds, mode });
  }, []);

  useEffect(() => {
    // The scenario's one dispatch, before the first catch-up, guarded so
    // StrictMode's double-invoked effect cannot fund the gym twice.
    if (scenario === CAPACITY_SCENARIO && !scenarioDispatchedRef.current) {
      const seconds = largestAwayDevStepSeconds();
      if (seconds !== null) {
        scenarioDispatchedRef.current = true;
        dispatch({ kind: 'advance-clock', gapSeconds: seconds, mode: 'offline' });
      }
    }
    catchUpOnRealTime('offline');
    const intervalId = setInterval(
      () => catchUpOnRealTime('online'),
      EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS * EMPIRE_TUNING.MILLISECONDS_PER_SECOND,
    );
    return () => clearInterval(intervalId);
  }, [scenario, catchUpOnRealTime]);

  return <GymScreen state={state} dispatch={dispatch} />;
}

const mount = document.getElementById('owner-root');
if (mount === null) {
  throw new Error('owner-playtest.html must carry an element with id owner-root');
}
createRoot(mount).render(
  <StrictMode>
    <OwnerPlaytestApp scenario={scenarioFromLocation()} />
  </StrictMode>,
);
