/**
 * WHAT MEET DAY SOUNDS LIKE.
 *
 * ===========================================================================
 * WHAT THIS FILE CANNOT SAY, FIRST
 * ===========================================================================
 * IT CANNOT SAY ANY OF THIS SOUNDS GOOD. Nobody has heard it — not a person,
 * not a critic, not a capture. The screenshot harness photographs pixels and
 * there is no equivalent for audio in this environment, and GDD §12.2's
 * reference (broadcast footage of a third-attempt walkout) was unreachable as a
 * matter of egress policy, which is the same refusal `meetTuning.ts` records
 * for the timings. So "a plate landing sounds like this" is a synthesis guess.
 *
 * ===========================================================================
 * WHAT IT CAN SAY, IN NUMBERS
 * ===========================================================================
 * Samples are numbers, so the things that would make the audio a stub rather
 * than a feature ARE testable, and each of these fails if broken:
 *
 *   1. EVERY CUE IS AUDIBLE. A non-zero peak, below full scale so it does not
 *      clip. Muting the mix — `MEET_SOUND.MASTER_GAIN = 0` — takes every peak
 *      to zero and reddens a named test per cue. That is the mute mutation.
 *   2. EVERY CUE IS THE LENGTH IT CLAIMS, to the sample.
 *   3. THE ENVELOPES ARE THE SHAPE THE DESIGN SAYS. A crowd swells and decays;
 *      a clack is a transient. Measured as RMS over thirds of the buffer, not
 *      asserted in prose.
 *   4. A WHITE LIGHT AND A RED LIGHT ARE DIFFERENT SOUNDS.
 *   5. THE SYNTHESIS IS DETERMINISTIC, which is what makes (6) possible.
 *   6. EVERY SHIPPED `.wav` IS BYTE-IDENTICAL TO A FRESH RENDER OF ITS RECIPE.
 *      This is the one that stops the audio being a lie: the committed asset is
 *      provably the output of `MEET_SOUND`, so a tuned recipe with a stale file
 *      is a red test rather than a silent divergence, and a hand-dropped file
 *      cannot masquerade as generated art (`BUILD_PROMPT_CLAUDE.md`).
 *   7. THE SCREENS PLAY THEM, and the player's static asset table covers every
 *      cue. Checked by reading source, because `meetSound.ts` imports
 *      `expo-audio` and the node suite cannot load it.
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { renderCue } from '../audio/synth';
import { SOUND_FORMAT, decodeWav, encodeWav, peakOf, rmsOf } from '../audio/wav';
import { soundForBeat, MEET_BEAT_KINDS, type MeetBeat } from '../game/meetDay';
import { MEET_SOUND, MEET_SOUND_IDS, type MeetSoundId } from '../game/meetTuning';
import { everySoundFileName, fileNameForCue } from './soundAssets';

const ROOT = path.join(__dirname, '..', '..');
const ASSET_DIR = path.join(ROOT, 'assets', 'sound');
const PLAYER = path.join(__dirname, 'meetSound.ts');

function samplesFor(id: MeetSoundId): Float32Array {
  return renderCue(MEET_SOUND.CUES[id], MEET_SOUND.MASTER_GAIN);
}

function expectedFrames(id: MeetSoundId): number {
  return Math.round((MEET_SOUND.CUES[id].durationMs / 1000) * SOUND_FORMAT.SAMPLE_RATE_HZ);
}

// ---------------------------------------------------------------------------
// One named test per cue. This is the mute mutation's landing site.
// ---------------------------------------------------------------------------

describe('every meet-day cue makes a sound', () => {
  it('has cues at all', () => {
    // Without this the loop below passes vacuously on an empty table.
    expect(MEET_SOUND_IDS.length).toBeGreaterThanOrEqual(5);
  });

  for (const id of MEET_SOUND_IDS) {
    it(`renders MEET_SOUND.CUES.${id} as audible, unclipped samples`, () => {
      const samples = samplesFor(id);
      const peak = peakOf(samples);
      // AUDIBLE. `MASTER_GAIN = 0` — or a cue with no layers, or an envelope
      // that never opens — takes this to 0 and fails here.
      expect(peak, `${id} is silent`).toBeGreaterThan(0.05);
      // ...and not slammed into the clipper, which is what a recipe with too
      // much gain sounds like and what a peak pinned at exactly 1 means.
      expect(peak, `${id} clips`).toBeLessThan(1);
      expect(samples.length, `${id} is the wrong length`).toBe(expectedFrames(id));
    });
  }

  it('renders the same samples every time', () => {
    // Determinism is not a nicety here: it is what lets the committed assets be
    // compared against a fresh render below. An unseeded `Math.random()` in the
    // noise generator would fail this and quietly break that check.
    for (const id of MEET_SOUND_IDS) {
      expect(Array.from(samplesFor(id)), id).toEqual(Array.from(samplesFor(id)));
    }
  });

  it('goes silent when the mix is muted, and that is checkable', () => {
    // The positive control for the mute mutation above: this proves the peak
    // assertion is actually sensitive to the master gain rather than to
    // something incidental about the recipe.
    for (const id of MEET_SOUND_IDS) {
      const muted = renderCue(MEET_SOUND.CUES[id], 0);
      expect(peakOf(muted), `${id} still makes noise at gain 0`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The shapes the design claims
// ---------------------------------------------------------------------------

describe('the cues are the shapes the design says they are', () => {
  const thirds = (samples: Float32Array): readonly [number, number, number] => {
    const n = samples.length;
    return [
      rmsOf(samples, 0, n / 3),
      rmsOf(samples, n / 3, (2 * n) / 3),
      rmsOf(samples, (2 * n) / 3, n),
    ];
  };

  it('swells and decays the crowd rather than switching it on', () => {
    for (const id of ['CROWD_SWELL', 'CROWD_SWELL_BIG'] as const) {
      const [first, middle, last] = thirds(samplesFor(id));
      expect(middle, `${id} does not swell`).toBeGreaterThan(first);
      expect(middle, `${id} does not decay`).toBeGreaterThan(last);
    }
  });

  it('makes the light clack a transient, not a beep', () => {
    for (const id of ['LIGHT_CLACK_WHITE', 'LIGHT_CLACK_RED'] as const) {
      const samples = samplesFor(id);
      const [first, , last] = thirds(samples);
      // Front-loaded and essentially over by the end: that is what makes it
      // read as a relay closing rather than as a UI tone.
      expect(first, `${id} is not front-loaded`).toBeGreaterThan(last * 4);
      // ...and short enough to be a click at all.
      expect(MEET_SOUND.CUES[id].durationMs, `${id} is too long to be a clack`).toBeLessThan(250);
    }
  });

  it('lands the bar rattle instantly and lets it ring out', () => {
    const [first, , last] = thirds(samplesFor('BAR_RATTLE'));
    expect(first).toBeGreaterThan(last);
    expect(MEET_SOUND.CUES.BAR_RATTLE.durationMs).toBeLessThan(400);
  });

  it('fades the bomb-out tone IN, so it arrives rather than hits', () => {
    // GDD §6.3: somber, not a sting. A cue with an instant attack would be a
    // buzzer however low its pitch.
    const samples = samplesFor('BOMB_TONE');
    const attackWindow = Math.round(
      (MEET_SOUND.CUES.BOMB_TONE.durationMs / 1000) * SOUND_FORMAT.SAMPLE_RATE_HZ * 0.02,
    );
    expect(rmsOf(samples, 0, attackWindow)).toBeLessThan(rmsOf(samples, 0, samples.length) / 2);
    // ...and it is a long tail. The silence after it is the beat.
    expect(MEET_SOUND.CUES.BOMB_TONE.durationMs).toBeGreaterThan(1500);
  });

  it('does not let a red light sound like a white one', () => {
    const white = Array.from(samplesFor('LIGHT_CLACK_WHITE'));
    const red = Array.from(samplesFor('LIGHT_CLACK_RED'));
    expect(white).not.toEqual(red);
    // Different, and different in the way the design says: the red lamp is
    // pitched lower, so a 2-1 can be HEARD assembling and not just seen.
    const pitchOf = (id: MeetSoundId): number => {
      const tone = MEET_SOUND.CUES[id].layers.find((l) => l.wave !== 'noise');
      return tone === undefined ? 0 : tone.freqHz;
    };
    expect(pitchOf('LIGHT_CLACK_RED')).toBeLessThan(pitchOf('LIGHT_CLACK_WHITE'));
  });
});

// ---------------------------------------------------------------------------
// Which moment plays what
// ---------------------------------------------------------------------------

describe('the cue a beat plays', () => {
  const HEARD: readonly { readonly beat: MeetBeat; readonly cue: MeetSoundId }[] = [
    { beat: { kind: 'bar-plate' }, cue: 'BAR_RATTLE' },
    { beat: { kind: 'walkout-call', urgent: false }, cue: 'CROWD_SWELL' },
    { beat: { kind: 'walkout-call', urgent: true }, cue: 'CROWD_SWELL_BIG' },
    // THE SAME BED AGAIN, LATER — see `soundForBeat`. The walk-out's tail used
    // to be silent from 2,520 ms of a 4,100 ms beat, and `WalkoutView` schedules
    // this one so its release lands on the hush.
    { beat: { kind: 'walkout-brace' }, cue: 'CROWD_SWELL_BIG' },
    { beat: { kind: 'light', light: 'white' }, cue: 'LIGHT_CLACK_WHITE' },
    { beat: { kind: 'light', light: 'red' }, cue: 'LIGHT_CLACK_RED' },
    { beat: { kind: 'verdict', good: true }, cue: 'CROWD_CHEER' },
    { beat: { kind: 'bomb-out' }, cue: 'BOMB_TONE' },
  ];

  for (const { beat, cue } of HEARD) {
    it(`plays ${cue} on the ${JSON.stringify(beat)} beat`, () => {
      expect(soundForBeat(beat)).toBe(cue);
    });
  }

  it('leaves no cue in the table that no beat plays', () => {
    const played = new Set(HEARD.map((h) => h.cue));
    for (const id of MEET_SOUND_IDS) {
      expect(played.has(id), `${id} is never played by anything`).toBe(true);
    }
  });

  it('is silent where silence is the design, and pins each one', () => {
    // These are decisions, not gaps, and each is argued in `soundForBeat`.
    // A NO-LIFT: a real hall goes quiet, and a fail buzzer is the opposite of
    // what GDD §6.3 asks for. THE DELIBERATION BEAT: a sound under it would be
    // a metronome telling the lifter to wait. THE SELECT SCREEN: a menu.
    expect(soundForBeat({ kind: 'verdict', good: false })).toBeNull();
    expect(soundForBeat({ kind: 'deliberation' })).toBeNull();
    expect(soundForBeat({ kind: 'floor', raisedByMiss: true })).toBeNull();
    expect(soundForBeat({ kind: 'floor', raisedByMiss: false })).toBeNull();
    expect(soundForBeat({ kind: 'attempt-declared' })).toBeNull();
  });

  it('answers for every beat kind rather than falling through', () => {
    const covered = new Set([
      ...HEARD.map((h) => h.beat.kind),
      'verdict',
      'deliberation',
      'floor',
      'attempt-declared',
    ]);
    for (const kind of MEET_BEAT_KINDS) {
      expect(covered.has(kind), `nothing decides what the "${kind}" beat sounds like`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The shipped files ARE the recipes
// ---------------------------------------------------------------------------

describe('the committed assets are the output of the recipe table', () => {
  it('has a file for every cue and no others', () => {
    for (const id of MEET_SOUND_IDS) {
      const file = path.join(ASSET_DIR, fileNameForCue(id));
      expect(existsSync(file), `${fileNameForCue(id)} is missing — run tools/sound.mjs`).toBe(true);
    }
    expect(everySoundFileName().length).toBe(MEET_SOUND_IDS.length);
    expect(new Set(everySoundFileName()).size).toBe(MEET_SOUND_IDS.length);
  });

  for (const id of MEET_SOUND_IDS) {
    it(`${fileNameForCue(id)} is byte-identical to a fresh render`, () => {
      // THE CHECK THAT STOPS THE AUDIO BEING A LIE. Editing `MEET_SOUND` — or
      // muting it — without re-running `node tools/sound.mjs` fails here rather
      // than shipping a file that no longer matches the recipe it claims to be.
      const onDisk = new Uint8Array(readFileSync(path.join(ASSET_DIR, fileNameForCue(id))));
      const fresh = encodeWav(samplesFor(id));
      expect(onDisk.length, `${id} is a different size on disk`).toBe(fresh.length);
      expect(Array.from(onDisk), `${id} on disk differs from its recipe`).toEqual(
        Array.from(fresh),
      );
    });
  }

  it('writes a WAV a player will actually accept', () => {
    const bytes = encodeWav(samplesFor('BAR_RATTLE'));
    const ascii = (at: number, n: number): string =>
      String.fromCharCode(...Array.from(bytes.slice(at, at + n)));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');
    const decoded = decodeWav(bytes);
    expect(decoded.sampleRateHz).toBe(SOUND_FORMAT.SAMPLE_RATE_HZ);
    expect(decoded.samples.length).toBe(expectedFrames('BAR_RATTLE'));
    // The round trip survives quantisation to 16 bits.
    expect(peakOf(decoded.samples)).toBeCloseTo(peakOf(samplesFor('BAR_RATTLE')), 3);
  });
});

// ---------------------------------------------------------------------------
// The player is wired to all of them
// ---------------------------------------------------------------------------

describe('the player can reach every cue', () => {
  const source = readFileSync(PLAYER, 'utf8');

  it('imports a file for every cue in the table', () => {
    // Metro resolves asset imports at bundle time, so this table has to be
    // static — which means it can silently miss a cue. It cannot miss one
    // quietly.
    for (const id of MEET_SOUND_IDS) {
      expect(source, `meetSound.ts never imports ${fileNameForCue(id)}`).toContain(
        `assets/sound/${fileNameForCue(id)}`,
      );
      expect(source, `meetSound.ts has no ASSETS entry for ${id}`).toMatch(
        new RegExp(`\\b${id}:\\s`),
      );
    }
  });

  it('routes sound through the one join the screens call', () => {
    const feedback = readFileSync(path.join(__dirname, 'meetFeedback.ts'), 'utf8');
    expect(feedback).toContain('playCue(soundForBeat(beat))');
    expect(feedback).toContain('playHaptic(hapticForBeat(beat))');
  });
});
