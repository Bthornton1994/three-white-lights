/**
 * Playing a `HapticPattern`. The one place the app touches the vibration motor.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN FILE
 * ---------------------------------------------------------------------------
 * It used to live inside `useLiftLoop.ts`, which was fine while the rep was the
 * only thing in the game that could be felt. It is not: GDD §6 makes meet day
 * the emotional centrepiece, and the bar loading, the judges' lights and the
 * verdict are physical events in the real sport. Two copies of the
 * style -> platform-API mapping would be two vocabularies that drift, and a
 * playtester rebalancing "heavy" would have to find both.
 *
 * So: `liftTuning.ts` and `meetTuning.ts` own the PATTERNS, `lift.ts` and
 * `meetDay.ts` own WHICH pattern an event gets, and this file owns nothing but
 * how to make the phone do it.
 *
 * ---------------------------------------------------------------------------
 * WEB IS A NO-OP AND THAT IS NOT A BUG
 * ---------------------------------------------------------------------------
 * It is the platform: there is no haptic engine behind a browser tab. Said out
 * loud because the screenshot harness runs on web, so NOTHING ABOUT HOW ANY OF
 * THIS FEELS CAN BE VERIFIED THERE — not by a capture, not by a critic reading
 * pixels. GDD §9.1 calls haptics critical to lift feel and budgets device time
 * for exactly this reason, and GDD §12.1 is explicit that a one-shot run cannot
 * close this gap. The patterns are a starting vocabulary, not tuned values.
 *
 * NO TIMING VALUES HERE. Every delay comes from the pattern it is playing.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { HapticPattern, HapticStyle } from '../game/liftTuning';

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
 * Play one pattern. A `null` pattern is silence, which is a real choice on meet
 * day rather than a missing case — see `MEET_TUNING.HAPTICS`.
 *
 * Returns a cancel function for the beats that have not fired yet. A screen
 * that unmounts mid-pattern must not buzz over whatever replaced it; the rep
 * loop never needs it and ignores the return.
 */
export function playHaptic(pattern: HapticPattern | null): () => void {
  if (pattern === null || Platform.OS === 'web') return () => undefined;
  const timers: ReturnType<typeof setTimeout>[] = [];
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
    else timers.push(setTimeout(fire, beat.delayMs));
  }
  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
