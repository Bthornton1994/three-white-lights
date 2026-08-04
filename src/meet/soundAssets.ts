/**
 * soundAssets.ts — the one place a cue id becomes a file name.
 *
 * Pure, and separate from the player on purpose: `tools/sound.mjs` writes the
 * files, `meetSound.ts` loads them, and `meetSound.test.ts` compares the two.
 * All three have to agree on the name, and a name agreed on in three places is
 * a name that drifts.
 *
 * DERIVED, NOT TABULATED. `BAR_RATTLE` becomes `bar-rattle.wav` by rule, so a
 * cue added to `MEET_SOUND` cannot be given a file name that nothing looks for.
 */

import { MEET_SOUND_IDS, type MeetSoundId } from '../game/meetTuning';

/** The extension the generator writes and the bundler bundles. */
export const SOUND_FILE_EXTENSION = '.wav';

/** `BAR_RATTLE` -> `bar-rattle.wav`. */
export function fileNameForCue(id: MeetSoundId): string {
  return `${id.toLowerCase().split('_').join('-')}${SOUND_FILE_EXTENSION}`;
}

/** Every file the generator is expected to have produced, in cue order. */
export function everySoundFileName(): readonly string[] {
  return MEET_SOUND_IDS.map(fileNameForCue);
}
