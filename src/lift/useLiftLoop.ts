/**
 * useLiftLoop — the clock, and the only place the pure mechanic meets the app.
 *
 * WHAT IT DOES AND DELIBERATELY DOES NOT DO. It advances `stepLift` on a fixed
 * tick, hands it at most one input per tick, keeps the history the bar-path
 * plot draws, and plays the haptic patterns the mechanic asks for. It contains
 * no mechanic logic of its own — no thresholds, no windows, no scoring. If a
 * rule about the lift ever appears in this file it is in the wrong file
 * (CLAUDE.md: "Never inline game math into a component").
 *
 * ---------------------------------------------------------------------------
 * FIXED TIMESTEP, NOT FRAME-RATE-DEPENDENT
 * ---------------------------------------------------------------------------
 * The sim runs at exactly `TICK_MS` per step and the loop catches up by taking
 * whole ticks out of an accumulator. A rep is therefore the same rep on a
 * 120 Hz phone, a 60 Hz phone and a stuttering browser tab, which is the whole
 * reason the mechanic is written as a tick function in the first place.
 *
 * The catch-up is capped at `MAX_CATCH_UP_TICKS`. Without it a tab that was
 * backgrounded for ten seconds returns and runs six hundred ticks in one frame,
 * which resolves the player's rep while they are looking at something else.
 * Capping means a hitch slows the rep down rather than skipping it — the right
 * trade for a timing game, where fast-forwarding is worse than lag.
 *
 * ---------------------------------------------------------------------------
 * INPUT IS EDGE-BASED AND QUEUED
 * ---------------------------------------------------------------------------
 * Presses and releases arrive from the touch system whenever they like, not on
 * tick boundaries. They go into a queue and at most ONE is applied per tick, in
 * order, so a press and a release that land in the same frame still take two
 * ticks to resolve. Collapsing them would let a one-frame tap satisfy a hold.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import {
  createLift,
  hapticFor,
  stepLift,
  type LiftConfig,
  type LiftInputKind,
  type LiftState,
} from '../game/lift';
import { LIFT_TUNING, TICK_MS, type HapticPattern, type HapticStyle } from '../game/liftTuning';

/**
 * Most ticks the loop will run in one frame. See the header — this is a
 * game-feel decision (lag versus fast-forward) and so it lives in the tuning
 * block with the rest of them.
 */
const MAX_CATCH_UP_TICKS = LIFT_TUNING.FEEDBACK.MAX_CATCH_UP_TICKS;

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

const IMPACT: Partial<Record<HapticStyle, Haptics.ImpactFeedbackStyle>> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  soft: Haptics.ImpactFeedbackStyle.Soft,
};

const NOTIFY: Partial<Record<HapticStyle, Haptics.NotificationFeedbackType>> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

/**
 * Play one pattern.
 *
 * WEB IS A NO-OP AND THAT IS NOT A BUG, it is the platform: there is no haptic
 * engine behind a browser tab. Said out loud because the screenshot harness
 * runs on web, so nothing about how this feels can be verified there — GDD
 * §9.1 calls haptics critical to lift feel and budgets device time for exactly
 * this reason.
 */
function playHaptic(pattern: HapticPattern): void {
  if (Platform.OS === 'web') return;
  for (const beat of pattern.beats) {
    const fire = (): void => {
      const impact = IMPACT[beat.style];
      if (impact !== undefined) {
        void Haptics.impactAsync(impact);
        return;
      }
      const notify = NOTIFY[beat.style];
      if (notify !== undefined) {
        void Haptics.notificationAsync(notify);
        return;
      }
      void Haptics.selectionAsync();
    };
    if (beat.delayMs <= 0) fire();
    else setTimeout(fire, beat.delayMs);
  }
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

export interface LiftLoop {
  readonly state: LiftState;
  /** Every tick of the current rep, for the bar-path plot. */
  readonly history: readonly LiftState[];
  readonly onPressIn: () => void;
  readonly onPressOut: () => void;
  /** Discard the rep and start a new one at this load. */
  readonly restart: (loadRatio: number) => void;
}

/**
 * @param paused stops the clock without unmounting anything. Used only by the
 * scripted-replay capture path (`liftReplay.ts`), which supplies its own states
 * and must not have a live rep ticking underneath the frame it is photographing.
 */
export function useLiftLoop(initial: LiftConfig, paused: boolean = false): LiftLoop {
  const [state, setState] = useState<LiftState>(() => createLift(initial));
  const [history, setHistory] = useState<readonly LiftState[]>([]);

  const stateRef = useRef<LiftState>(state);
  const historyRef = useRef<LiftState[]>([]);
  const queueRef = useRef<LiftInputKind[]>([]);
  const seedRef = useRef<number>(initial.seed);
  const runningRef = useRef<boolean>(true);

  const reset = useCallback((config: LiftConfig) => {
    const fresh = createLift(config);
    stateRef.current = fresh;
    historyRef.current = [];
    queueRef.current = [];
    setState(fresh);
    setHistory([]);
  }, []);

  const restart = useCallback(
    (loadRatio: number) => {
      // A new seed per rep, so two reps do not shake identically. The rep is
      // still fully determined by (config, seed, inputs); what changes is which
      // seed this particular attempt got.
      seedRef.current += 1;
      reset({ ...initial, loadRatio, seed: seedRef.current });
    },
    [initial, reset],
  );

  useEffect(() => {
    if (paused) return;
    runningRef.current = true;
    let last = -1;
    let accumulator = 0;
    let raf = 0;

    const frame = (now: number): void => {
      if (!runningRef.current) return;
      if (last < 0) last = now;
      accumulator += now - last;
      last = now;

      let ticks = Math.floor(accumulator / TICK_MS);
      if (ticks > 0) {
        accumulator -= ticks * TICK_MS;
        if (ticks > MAX_CATCH_UP_TICKS) ticks = MAX_CATCH_UP_TICKS;

        let next = stateRef.current;
        let changed = false;
        for (let i = 0; i < ticks; i += 1) {
          if (next.phase === 'RESOLVED') break;
          const queued = queueRef.current.shift();
          next = stepLift(next, queued === undefined ? null : { kind: queued });
          historyRef.current.push(next);
          changed = true;
          for (const event of next.events) {
            const pattern = hapticFor(event);
            if (pattern !== null) playHaptic(pattern);
          }
        }
        if (changed) {
          stateRef.current = next;
          setState(next);
          setHistory(historyRef.current.slice());
        }
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(raf);
    };
  }, [paused]);

  const onPressIn = useCallback(() => {
    if (stateRef.current.phase === 'RESOLVED') return;
    queueRef.current.push('press');
  }, []);

  const onPressOut = useCallback(() => {
    if (stateRef.current.phase === 'RESOLVED') return;
    queueRef.current.push('release');
  }, []);

  return { state, history, onPressIn, onPressOut, restart };
}
