/**
 * meetSound.ts — playing a cue. The one place the app touches the speaker.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS AND IS NOT HERE
 * ---------------------------------------------------------------------------
 * This file knows how to make a sound come out. It does not know what any cue
 * sounds like (`MEET_SOUND` in `meetTuning.ts`), how one is synthesised
 * (`src/audio/synth.ts`), or which moment plays which (`soundForBeat` in
 * `meetDay.ts`). Same split as `haptics.ts` / `LIFT_TUNING.HAPTICS` /
 * `hapticFor`, for the same reason.
 *
 * NO TIMING VALUES AND NO GAIN VALUES. The gain is baked into the samples by
 * `renderCue` at generation time, so `MEET_SOUND.MASTER_GAIN` is a real knob
 * that a playtester turns and re-runs `tools/sound.mjs` for, rather than a
 * number scattered into a player call.
 *
 * ---------------------------------------------------------------------------
 * THE ASSETS ARE GENERATED, AND THE TABLE BELOW IS WHY IT IS STATIC
 * ---------------------------------------------------------------------------
 * Metro resolves asset imports at bundle time; a computed path cannot be
 * bundled. So every cue is imported by name here and `meetSound.test.ts` checks
 * this table against `MEET_SOUND_IDS` — a cue added to the recipe table without
 * a line here is a red test, not a silent nothing.
 *
 * The files are OUTPUT, not source: `tools/sound.mjs` renders them from the
 * recipes and the same test re-renders and compares byte for byte.
 *
 * ---------------------------------------------------------------------------
 * WHAT HAS NOT BEEN VERIFIED, PLAINLY
 * ---------------------------------------------------------------------------
 * NOBODY HAS HEARD ANY OF THIS. The synthesis is checked by tests because
 * samples are numbers; whether a rattle sounds like a plate landing, and
 * whether the crowd swell lands under the walk-out call at the right moment, is
 * a listening judgement and nothing in this repository makes it. GDD §12.2
 * judges this piece on "pacing AND sound" and the second half is now built and
 * untuned rather than absent — that is the whole of the claim.
 *
 * ON DEVICE it is additionally unverified: this type-checks against the
 * installed `expo-audio` types and follows its documented asset path, and the
 * only thing that has actually run is the web bundle. Same status
 * `LifterSpriteView.tsx` records for Skia and `haptics.ts` records for the
 * motor.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { MEET_SOUND_IDS, type MeetSoundId } from '../game/meetTuning';

import barRattle from '../../assets/sound/bar-rattle.wav';
import bombTone from '../../assets/sound/bomb-tone.wav';
import crowdCheer from '../../assets/sound/crowd-cheer.wav';
import crowdSwell from '../../assets/sound/crowd-swell.wav';
import crowdSwellBig from '../../assets/sound/crowd-swell-big.wav';
import lightClackRed from '../../assets/sound/light-clack-red.wav';
import lightClackWhite from '../../assets/sound/light-clack-white.wav';

/**
 * Every cue's bundled asset. Total, so a cue added to `MEET_SOUND` without a
 * line here is a compile error rather than a silent moment.
 */
const ASSETS: Readonly<Record<MeetSoundId, number>> = Object.freeze({
  BAR_RATTLE: barRattle,
  BOMB_TONE: bombTone,
  CROWD_CHEER: crowdCheer,
  CROWD_SWELL: crowdSwell,
  CROWD_SWELL_BIG: crowdSwellBig,
  LIGHT_CLACK_RED: lightClackRed,
  LIGHT_CLACK_WHITE: lightClackWhite,
});

/**
 * A meet is not a music app.
 *
 * `mixWithOthers` so the game never stops whatever the player already had on —
 * a lifter training to their own playlist should not have it cut by a plate
 * sound — and the iOS silent switch is respected, because a phone on silent in
 * a public gym means it. Both are product decisions rather than knobs, and both
 * are stated here rather than left to the platform default.
 */
let audioModeSet = false;
function ensureAudioMode(): void {
  if (audioModeSet) return;
  audioModeSet = true;
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
    interruptionModeAndroid: 'duckOthers',
  }).catch(() => undefined);
}

/**
 * One player per cue, built on first use and kept.
 *
 * Rebuilding a player per plate would decode the same file six times during one
 * bar load. Keeping them means a cue retriggers by seeking to zero, which is
 * also what makes the rattle able to fire faster than it decays.
 */
const players = new Map<MeetSoundId, AudioPlayer | null>();

function playerFor(id: MeetSoundId): AudioPlayer | null {
  const existing = players.get(id);
  if (existing !== undefined) return existing;
  let player: AudioPlayer | null = null;
  try {
    ensureAudioMode();
    player = createAudioPlayer(ASSETS[id]);
  } catch {
    // A device with no audio route, a web tab that has not been touched yet, a
    // platform that refuses. Sound is not load-bearing for play; losing it must
    // never take a screen down with it.
    player = null;
  }
  players.set(id, player);
  return player;
}

/**
 * Play one cue. `null` is silence, and on meet day that is often deliberate —
 * see `soundForBeat`.
 */
export function playCue(id: MeetSoundId | null): void {
  if (id === null) return;
  const player = playerFor(id);
  if (player === null) return;
  try {
    player.seekTo(0);
    player.play();
  } catch {
    /* see above: never take a screen down for a sound */
  }
}

/** Warm every player, so the first plate of the meet is not the slow one. */
export function preloadMeetSound(): void {
  for (const id of MEET_SOUND_IDS) playerFor(id);
}
