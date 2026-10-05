/**
 * meetFeedback.ts — one call per moment.
 *
 * GDD §12.2 judges meet day on "pacing AND sound", and CLAUDE.md puts haptic
 * patterns in the same sentence as timing windows. Both are answers to the same
 * question — what happened just now — so the screens ask it once.
 *
 * `playBeat({ kind: 'light', light })` fires the lamp's haptic and the lamp's
 * clack together, from one schedule. Two calls at two call sites would be two
 * schedules, and the first time somebody moved one delay the sound and the
 * buzz would land a frame apart on the beat the whole piece is named after.
 *
 * NO DECISIONS HERE. Which pattern and which cue a beat gets are `hapticForBeat`
 * and `soundForBeat` in `meetDay.ts`; how each reaches the hardware is
 * `haptics.ts` and `meetSound.ts`. This is the join and nothing else.
 */

import { hapticForBeat, soundForBeat, type MeetBeat } from '../game/meetDay';
import { playHaptic } from '../lift/haptics';
import { playCue } from './meetSound';

/**
 * Fire everything a beat is felt and heard as.
 *
 * @returns a cancel function for haptic beats that have not fired yet, so a
 * screen that unmounts mid-pattern does not buzz over whatever replaced it.
 * Sound is not cancelled: a cue is short, and a clack cut off halfway is a
 * worse artefact than one that finishes into the next screen.
 */
export function playBeat(beat: MeetBeat): () => void {
  playCue(soundForBeat(beat));
  return playHaptic(hapticForBeat(beat));
}
