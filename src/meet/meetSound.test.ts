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
import { MEET_SOUND, MEET_SOUND_IDS, MEET_TUNING, type MeetSoundId } from '../game/meetTuning';
import { walkoutMs } from '../game/meetDay';
import { barLoadHitsAt, braceCueDelayMs, buildWalkout, cueDepth, platesLandedAt } from './walkout';
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

describe('MEET_SOUND.VOICES_PER_CUE is enough for the schedule the tuning can produce', () => {
  // THE DEFECT THIS BOUNDS. One AudioPlayer per cue id meant a retrigger did
  // `seekTo(0)` on a player that was still sounding, so the second firing KILLED
  // the first rather than layering over it. The two cues below both retrigger
  // inside their own length at the shipped tuning, and neither was visible to
  // any test: the sound suite checks recipes and bytes, and the browser probe
  // matched on a Set of file names, which cannot see a second fire at all.
  //
  // This does not assert the pool is "big enough to sound right" — nobody has
  // heard it (GDD §12.1). It asserts the pool is not SMALLER than the overlap
  // the schedule provably produces, which is arithmetic and is checkable now.
  //
  // ===========================================================================
  // WHAT "THE SCHEDULE THE TUNING CAN PRODUCE" DOES AND DOES NOT COVER
  // ===========================================================================
  // AN EARLIER VERSION OF THIS BLOCK CALLED ITSELF "DERIVED RATHER THAN TUNED"
  // AND THAT WAS THE WHOLE MISTAKE. It derived the worst overlap from
  // `BAR_LOAD_PLATE_STAGGER_MS` and the cue lengths, got 2, and was green while
  // `tools/verify-meet-sound.mjs` measured 5 in Chromium. The derivation was
  // arithmetically correct about a schedule the browser does not deliver: it
  // assumed timers fire when they are asked to, and the main thread is blocked
  // through the meet transition, so the whole expired queue drains at once.
  //
  // So the coverage, stated rather than implied:
  //
  //   COVERED HERE, exactly. (a) The nominal schedule's own arithmetic, which is
  //   what a tuner turning a constant is changing. (b) The measured Chromium
  //   trace, replayed as data, so the delivered depth is a fact in this file
  //   rather than a number in a tool's output. (c) The DELIVERED depth of the
  //   shipped level-triggered load, over a sweep of blocked-thread and
  //   frame-phase shapes.
  //
  //   NOT COVERED HERE. Whether a real browser's frame delivery is inside the
  //   sweep's shapes. (c) is a model of `requestAnimationFrame`, and a model is
  //   what got this wrong the first time. `tools/verify-meet-sound.mjs` is the
  //   only thing that reads the real one, and it is the check that has to stay
  //   green — this file cannot stand in for it.
  //
  //   NOT COVERED BY ANYTHING. Whether any of it sounds right (GDD §12.1).

  /** How many triggers of one cue land inside one copy of its own duration. */
  const worstOverlap = cueDepth;

  /**
   * THE MEASUREMENT THAT CONTRADICTED THE DERIVATION, kept as data.
   *
   * Read out of `.gauntlet/shots/meet/sound.json` on the run that first measured
   * per-cue depth: `bar-rattle.wav` on the `?meet=walkout` beat, in headless
   * Chromium at 390x844, against the shipped Expo web build. Five starts of a
   * 180 ms cue inside 149 ms, two of them byte-identical, from a loop that asked
   * for one every 90 ms.
   *
   * It is transcribed rather than re-derived on purpose: a derivation is exactly
   * what was wrong, and this is the observation that has to keep being true of
   * the code being replaced rather than of the code that replaced it.
   */
  const MEASURED_COALESCED_STARTS_MS: readonly number[] = Object.freeze([
    16864, 16889, 16889, 16933, 17013,
  ]);

  /**
   * The parameters of the delivery sweep, in one place and named, the way
   * `src/game/streakSweep.ts` holds the streak sweep's. A measurement whose
   * inputs are not written down is an anecdote.
   *
   * NOT GAME FEEL. Nothing here is a knob a playtester turns; these describe the
   * hostile browser the schedule has to survive. The one game-feel value in
   * play is `MEET_TUNING.BAR_LOAD_CATCH_UP_LOOKAHEAD_MS`, which lives in the
   * tuning file with the rest.
   */
  const DELIVERY_SWEEP = Object.freeze({
    /** Discs on one sleeve: an empty bar, a light opener, and the heaviest. */
    PLATE_COUNTS: Object.freeze([0, 1, 3, 5, 8, 10]),
    /** 60 Hz. The grid the frame loop runs on when nothing is in its way. */
    FRAME_MS: 1000 / 60,
    /** Where the grid sits relative to the top of the beat. */
    FRAME_PHASE_MS: Object.freeze([0, 3.1, 7.4, 11.9, 15.6]),
    /** When the thread seizes, relative to the top of the beat. */
    BLOCK_START_MS: Object.freeze([0, 17, 45, 89, 91, 178, 200, 359, 361]),
    /** For how long. 0 is the unblocked control. */
    BLOCK_MS: Object.freeze([0, 20, 55, 130, 271, 400, 900]),
    /** How far past the last disc the sweep keeps looking. */
    TAIL_MS: 400,
  });

  /**
   * The instants the frame loop looked, on a thread that seized once.
   *
   * `useHallStep` runs one `requestAnimationFrame` chain, and a blocked thread
   * does not queue those up: the callbacks that would have run are simply never
   * delivered, and one fires when the thread frees. That is the whole reason the
   * bar load was moved onto it, so the model has to have that property.
   */
  function framesUnder(blockStartMs: number, blockMs: number, phaseMs: number, untilMs: number): number[] {
    const frames: number[] = [];
    for (let at = phaseMs; at <= untilMs; at += DELIVERY_SWEEP.FRAME_MS) {
      if (blockMs > 0 && at >= blockStartMs && at < blockStartMs + blockMs) continue;
      frames.push(at);
    }
    if (blockMs > 0) frames.push(blockStartMs + blockMs);
    return frames.sort((a, b) => a - b);
  }

  it('the nominal schedule: one per plate, staggered inside its own ring-out', () => {
    const rattle = MEET_SOUND.CUES.BAR_RATTLE.durationMs;
    const stagger = MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS;
    // The heaviest bar the meet can load, so the plate count is the app's own
    // worst case rather than a number chosen here.
    const plates = 10;
    const starts = Array.from({ length: plates }, (_, i) => i * stagger);
    const overlap = worstOverlap(rattle, starts);
    // A COUNT: 180ms fired every 90ms is exactly two voices deep, and if either
    // constant moves this reddens naming the new depth rather than drifting.
    //
    // THIS IS THE ASKED-FOR SCHEDULE AND NOT THE DELIVERED ONE. It is what a
    // tuner is choosing when they move either constant, and it is worth pinning
    // for that reason alone — but on its own it is the claim that measured 2
    // while the browser played 5, so it does not license the pool size. The two
    // tests below are what do that.
    expect(overlap, `${rattle}ms fired every ${stagger}ms`).toBe(2);
    expect(overlap).toBeLessThanOrEqual(MEET_SOUND.VOICES_PER_CUE);
  });

  it('the delivery that contradicted it: one timer per disc, replayed from Chromium', () => {
    const rattle = MEET_SOUND.CUES.BAR_RATTLE.durationMs;
    // Non-vacuity first: the trace has to be a trace of the thing that broke.
    // Five starts of a 180ms cue inside 149ms is not a schedule anybody wrote.
    expect(MEASURED_COALESCED_STARTS_MS.length, 'the recorded trace').toBe(5);
    const span =
      MEASURED_COALESCED_STARTS_MS[MEASURED_COALESCED_STARTS_MS.length - 1]! -
      MEASURED_COALESCED_STARTS_MS[0]!;
    expect(span, 'the recorded burst spanned').toBe(149);
    expect(span, 'a burst inside one cue length is what made it a pile-up').toBeLessThan(rattle);

    const measured = worstOverlap(rattle, MEASURED_COALESCED_STARTS_MS);
    expect(measured, 'depth Chromium delivered from a per-disc timer loop').toBe(5);
    // AND IT EXCEEDED THE POOL, which is the sentence the old block could not
    // say. Raising `VOICES_PER_CUE` to 5 would silence this line and change
    // nothing a player hears, which is why the schedule moved instead.
    expect(measured).toBeGreaterThan(MEET_SOUND.VOICES_PER_CUE);
  });

  it('the same block, level-triggered: four missed landings are one arrival', () => {
    // The shape the browser trace above came from, run through the shipped
    // schedule: the thread seizes from the top of the beat until 360 ms — past
    // four of the five discs — and the frame loop resumes at 60 Hz.
    const rattle = MEET_SOUND.CUES.BAR_RATTLE.durationMs;
    const frames: number[] = [];
    for (let at = 360; at <= 900; at += DELIVERY_SWEEP.FRAME_MS) frames.push(at);
    const hits = barLoadHitsAt(frames, 5);

    // Non-vacuity: the block really did cover four landings, so the old scheme
    // had four queued callbacks to drain here.
    expect(platesLandedAt(360, 5), 'discs owed at the instant the thread freed').toBe(5);
    // ONE hit for the whole catch-up, against five in the recorded trace, and
    // the picture had already been showing one jump.
    expect(hits.length, `heard: ${JSON.stringify(hits.map((h) => Math.round(h)))}`).toBe(1);
    expect(worstOverlap(rattle, hits)).toBe(1);
  });

  it('the delivery the level-triggered load produces, swept over a thread that seizes', () => {
    const rattle = MEET_SOUND.CUES.BAR_RATTLE.durationMs;
    const worst: { depth: number; hits: number; case: string }[] = [];
    let cases = 0;
    let casesWithACatchUp = 0;
    let casesWhereTheMergeBit = 0;
    let hitsNeverExceedDiscs = 0;
    let casesAtMaxDepth = 0;
    let unblockedCasesAtMaxDepth = 0;
    let maxDepth = 0;

    for (const plateCount of DELIVERY_SWEEP.PLATE_COUNTS) {
      const untilMs =
        plateCount * MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS + DELIVERY_SWEEP.TAIL_MS;
      for (const phaseMs of DELIVERY_SWEEP.FRAME_PHASE_MS) {
        for (const blockStartMs of DELIVERY_SWEEP.BLOCK_START_MS) {
          for (const blockMs of DELIVERY_SWEEP.BLOCK_MS) {
            cases += 1;
            const frames = framesUnder(blockStartMs, blockMs, phaseMs, untilMs);
            const hits = barLoadHitsAt(frames, plateCount);
            const depth = worstOverlap(rattle, hits);
            // How many times the drawn count changed, which is how many times
            // the eye saw discs arrive. Hits below this is the merge biting.
            let shown = 0;
            let steps = 0;
            for (const at of frames) {
              const landed = platesLandedAt(at, plateCount);
              if (landed > shown) {
                steps += 1;
                shown = landed;
              }
            }
            if (steps > hits.length) casesWhereTheMergeBit += 1;
            if (hits.length > 0 && hits.length < plateCount) casesWithACatchUp += 1;
            if (hits.length <= plateCount) hitsNeverExceedDiscs += 1;
            if (depth > maxDepth) maxDepth = depth;
            if (depth === 3) {
              casesAtMaxDepth += 1;
              if (blockMs === 0) unblockedCasesAtMaxDepth += 1;
            }
            worst.push({
              depth,
              hits: hits.length,
              case: `${plateCount} discs, block ${blockMs}ms at ${blockStartMs}ms, phase ${phaseMs}ms`,
            });
          }
        }
      }
    }

    // NON-VACUITY, AS COUNTS. The sweep has to have run, and it has to have
    // contained the two cases it exists for — a catch-up that carried more than
    // one disc, and an arrival close enough behind another to be merged. A
    // generator that produced neither would pass every line below while
    // measuring nothing.
    expect(cases, 'sweep size').toBe(1890);
    expect(casesWithACatchUp, 'cases where a catch-up carried more than one disc').toBe(558);
    expect(casesWhereTheMergeBit, 'cases where two arrivals were merged into one hit').toBe(40);
    expect(hitsNeverExceedDiscs, 'cases where the hits never outnumbered the discs').toBe(cases);

    // THE DELIVERED DEPTH, PINNED AS A COUNT. Not a bound: a bound lets the
    // number creep back up quietly, and this is the number that was wrong.
    expect(maxDepth, 'deepest the rattle stacks anywhere in the sweep').toBe(3);
    expect(casesAtMaxDepth, 'cases that reach that depth').toBe(624);

    // AND THREE IS NOT THE BLOCK'S FAULT, WHICH IS THE FINDING THIS PIN CARRIES.
    // A 180ms cue every 90ms is two deep with ZERO margin, so an observation
    // grid 16.7ms coarse is enough on its own: 117 of these reach three with the
    // thread never blocked at all — e.g. 3 discs, phase 0, a 20ms block, heard
    // at [20, 100, 183.3]. That is why `VOICES_PER_CUE` is 3 rather than the 2
    // the nominal schedule reports, and why getting the design's two-deep sound
    // back is a TUNING change (a rattle shorter than twice the stagger), not a
    // scheduling one. Nobody has heard either (GDD §12.1).
    expect(unblockedCasesAtMaxDepth, 'cases at that depth with no block at all').toBe(117);
    expect(maxDepth).toBeLessThanOrEqual(MEET_SOUND.VOICES_PER_CUE);

    const over = worst.filter((w) => w.depth > MEET_SOUND.VOICES_PER_CUE);
    expect(over.length, `cases over the pool: ${JSON.stringify(over.slice(0, 3))}`).toBe(0);
  });

  it('two arrivals inside the merge window are one clatter', () => {
    const stagger = MEET_TUNING.BAR_LOAD_PLATE_STAGGER_MS;
    const merge = MEET_TUNING.BAR_LOAD_RATTLE_MERGE_MS;
    // The window has to be inside one disc of the schedule, or it would start
    // eating arrivals the design wants heard separately.
    expect(merge, 'the merge window is off').toBeGreaterThan(0);
    expect(merge).toBeLessThan(stagger);

    // The schedule itself is untouched by it — an earlier version folded the
    // window into `platesLandedAt`, which pulled the SECOND disc 24ms early and
    // made the ordinary unblocked bar stack deeper. These three reads are what
    // went wrong then.
    expect(platesLandedAt(0, 4), 'the first look lands exactly one disc').toBe(1);
    expect(platesLandedAt(stagger - 1, 4), 'a disc landed before its own boundary').toBe(1);
    expect(platesLandedAt(stagger, 4)).toBe(2);

    // A catch-up stopping a millisecond short of a boundary, and the very next
    // frame crossing it: one hit. With the window at zero this is two.
    const straddling = barLoadHitsAt([stagger - 1, stagger + 1], 4);
    expect(straddling, 'a drain and the frame after it were heard twice').toEqual([stagger - 1]);
    // ...and an arrival the window does NOT cover is still heard, so the merge
    // is a merge and not a mute.
    const separated = barLoadHitsAt([stagger - 1, stagger + merge], 4);
    expect(separated).toEqual([stagger - 1, stagger + merge]);
  });

  it('the crowd bed: the walk-out plays it twice, and the second used to cut the first', () => {
    const bed = MEET_SOUND.CUES.CROWD_SWELL_BIG.durationMs;
    // Every walk-out shape the piece can produce, so this is not one case.
    // The four shapes `walkoutMs` can produce, built from its own arithmetic
    // rather than from constants restated here: opener, third, third at a PR,
    // and third at a PR with a bomb on it.
    const shapes = [
      { name: 'opener', beatMs: walkoutMs(1, 100, 200, false) },
      { name: 'third', beatMs: walkoutMs(3, 100, 200, false) },
      { name: 'third at a PR', beatMs: walkoutMs(3, 300, 200, false) },
      { name: 'third at a PR, bomb risk', beatMs: walkoutMs(3, 300, 200, true) },
    ];
    const overlaps = shapes.map((shape) => {
      const sequence = buildWalkout({ loadRatio: 0.9, plateCount: 4, urgent: true, beatMs: shape.beatMs });
      const second = braceCueDelayMs(sequence);
      const starts = second === null
        ? [MEET_TUNING.WALKOUT_WEIGHT_HOLD_MS]
        : [MEET_TUNING.WALKOUT_WEIGHT_HOLD_MS, second];
      return { shape: shape.name, overlap: worstOverlap(bed, starts), starts };
    });
    // NON-VACUITY, AS A COUNT: at least one shape must actually overlap, or this
    // whole test is measuring a schedule where the bug could not have happened.
    const overlapping = overlaps.filter((o: { overlap: number }) => o.overlap > 1);
    expect(overlapping.length, `shapes where the bed retriggers inside itself: ${JSON.stringify(overlaps)}`)
      .toBeGreaterThan(0);
    for (const o of overlaps) {
      expect(o.overlap, `${o.shape} needs ${o.overlap} voices`).toBeLessThanOrEqual(MEET_SOUND.VOICES_PER_CUE);
    }
  });
});
