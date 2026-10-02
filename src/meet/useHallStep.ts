/**
 * useHallStep — the clock behind the two moments the meet hall moves.
 *
 * ---------------------------------------------------------------------------
 * WHY A CLOCK AT ALL, AND WHY THIS ONE
 * ---------------------------------------------------------------------------
 * The walk-out beat used to have no clock in it: `MeetHallView` drew one
 * memoised still and held it for the whole beat, so GDD §6.2 step 1's "brief
 * walk-out" contained no walk-out. This is what advances it, and what advances
 * the hall's reaction to three white lights.
 *
 * It is `requestAnimationFrame` and React state, which is the same shape
 * `useLiftLoop` uses for the rep, and deliberately NOT a Reanimated shared
 * value. Reanimated drives values on the UI thread; what changes here is WHICH
 * SPRITE IS RASTERISED, and rasterising is a JavaScript-thread pass over a
 * 96x72 index grid. A shared value cannot carry that across, so a Reanimated
 * clock would have to hop back with `runOnJS` on every frame and would buy
 * nothing but a second scheduler. Reanimated still drives what it is good at on
 * these screens — the copy's opacity in `WalkoutView`, the lamps in
 * `VerdictView` — and this drives the sheet.
 *
 * ---------------------------------------------------------------------------
 * IT REPORTS A STEP, NOT A TIME
 * ---------------------------------------------------------------------------
 * `sampleAt` maps elapsed milliseconds to ONE NUMBER — a frame index, or a row
 * count — and the hook only re-renders when that number changes. The walk-out's
 * sheet is about a dozen drawings over two seconds and the crowd's rise is a
 * handful of rows, so a beat costs a handful of renders rather than sixty a
 * second. Sampling a raw elapsed time here would put every consumer one careless
 * `useMemo` away from re-rasterising a sprite per display frame.
 *
 * ---------------------------------------------------------------------------
 * `holdAtMs` IS WHY THE CAPTURE CAN PHOTOGRAPH MOTION
 * ---------------------------------------------------------------------------
 * Passed a number, there is NO CLOCK: the hook returns the step at that instant
 * and never starts a frame loop. That is what lets `tools/capture-meet.mjs`
 * photograph the walk-out mid-unrack and mid-step rather than only at whatever
 * moment the shutter happened to land on — the same problem, and the same
 * answer, as `useMeetDay`'s `frozen` and `useLiftLoop`'s `paused`.
 *
 * Passed `null` — every played meet — the clock runs from mount and stops once
 * `runForMs` has elapsed, because the sheet holds its last drawing after that
 * and a loop still ticking would be burning frames to compute the same number.
 *
 * PURE-ADJACENT: no game math, no meet state, no tuning value. `sampleAt` and
 * `runForMs` are both the caller's, and both come from pure modules.
 */

import { useEffect, useState } from 'react';

/**
 * @param sampleAt elapsed ms -> the step showing then. MUST be referentially
 * stable (wrap it in `useCallback`/`useMemo`): a new function each render
 * restarts the clock, which would hold the beat on its first frame forever.
 * @param runForMs how long the sampled value can still change. The loop stops
 * after this.
 * @param holdAtMs a fixed instant to sample, or `null` to run the clock.
 */
export function useHallStep(
  sampleAt: (elapsedMs: number) => number,
  runForMs: number,
  holdAtMs: number | null,
): number {
  const [step, setStep] = useState<number>(() => sampleAt(holdAtMs ?? 0));

  useEffect(() => {
    if (holdAtMs !== null) {
      setStep(sampleAt(holdAtMs));
      return undefined;
    }

    let raf = 0;
    let start = -1;
    let running = true;

    // The beat starts NOW, not at whatever the previous one had reached.
    setStep(sampleAt(0));

    const frame = (now: number): void => {
      if (!running) return;
      if (start < 0) start = now;
      const elapsed = now - start;
      // React bails out of a re-render when the state is identical, so this is
      // one comparison per display frame for a drawing that has not changed.
      setStep(sampleAt(elapsed));
      if (elapsed < runForMs) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [sampleAt, runForMs, holdAtMs]);

  return step;
}
