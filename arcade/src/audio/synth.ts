/**
 * synth.ts — turning a cue recipe into samples.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS
 * ---------------------------------------------------------------------------
 * One pure function, `renderCue`, from a `SoundCue` (a list of layers with
 * envelopes) to a mono buffer in [-1, 1]. It is the audio counterpart of
 * `gymScene.ts`: a renderer with no opinions of its own. Every number that
 * decides what a cue SOUNDS like lives in `MEET_SOUND` in `meetTuning.ts`,
 * where a playtester can find it next to the timings and the haptics.
 *
 * ---------------------------------------------------------------------------
 * IT IS A RENDERER AND NOTHING ELSE
 * ---------------------------------------------------------------------------
 *   - No React, no I/O, no side effects, no platform API, no `Math.random`.
 *   - NO UNSEEDED RANDOMNESS. Noise is drawn from `prng.ts`'s mulberry32 with
 *     a seed carried in the layer, for the same reason `gymScene.ts` refuses
 *     randomness: `renderCue` called twice with the same cue returns
 *     byte-identical samples. That is what lets the committed `.wav` assets be
 *     checked against a fresh render, so the shipped audio is provably the
 *     output of the recipe rather than a file somebody dropped in.
 *   - No game state. Nothing here is told the weight on the bar, the lifter's
 *     fatigue, or what the judges said.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DELIBERATELY DOES NOT HAVE
 * ---------------------------------------------------------------------------
 * No reverb, no compressor, no stereo, no FM, no wavetable. A meet hall's
 * ambience would be lovely and is not what §12.2 asks for; four cue families —
 * a bar rattle, a crowd swell, a light clack, a low tone under a bomb-out —
 * are. Every one of those is an envelope over a noise band or a decaying
 * oscillator, and the smallest engine that does them honestly is this one.
 *
 * NONE OF THESE CUES HAS BEEN HEARD BY ANYBODY. The synthesis is checked by
 * tests (they are numbers, so it can be); whether a rattle sounds like a plate
 * landing is a listening judgement and no test in this repository makes it.
 */

import { nextRandom, seedState } from '../game/prng';
import { SOUND_FORMAT, clampSample } from './wav';

/** How a layer's raw signal is generated before its envelope is applied. */
export type Waveform = 'sine' | 'triangle' | 'square' | 'noise';

/**
 * One voice in a cue.
 *
 * `attackMs` / `holdMs` / `releaseMs` are an envelope, not a schedule: a layer
 * starts at `startMs` into the cue, rises over the attack, holds, then falls to
 * silence over the release. `curve` bends the release — 1 is linear, higher
 * values drop away faster, which is what makes a click a click.
 */
export interface SoundLayer {
  readonly wave: Waveform;
  /** Ignored by `'noise'`. */
  readonly freqHz: number;
  /** Linear glide target. Omitted, the pitch holds. */
  readonly freqEndHz?: number;
  readonly gain: number;
  readonly startMs: number;
  readonly attackMs: number;
  readonly holdMs: number;
  readonly releaseMs: number;
  /** Release curve exponent. 1 is linear; 3-6 is a click's decay. */
  readonly curve: number;
  /**
   * One-pole low-pass cutoff in Hz, applied to this layer only. 0 is off.
   * This is what turns white noise into a crowd rather than a hiss.
   */
  readonly lowPassHz: number;
  /** One-pole high-pass cutoff in Hz. 0 is off. */
  readonly highPassHz: number;
  /** Noise seed. Ignored by the oscillators; required for determinism. */
  readonly seed: number;
}

export interface SoundCue {
  readonly durationMs: number;
  /** Applied after the layers are summed, before clipping. */
  readonly gain: number;
  readonly layers: readonly SoundLayer[];
}

/**
 * Arithmetic the synthesis is written in. NOT KNOBS — `TAU` is a circle,
 * `MS_PER_SECOND` is a unit conversion, and the triangle coefficients are the
 * waveform's own definition. What a cue sounds like is `MEET_SOUND`.
 */
const SYNTH_MATH = Object.freeze({
  TAU: Math.PI * 2,
  MS_PER_SECOND: 1000,
  /** `4 * |x - 1/2| - 1` maps a phase in [0,1) onto a triangle in [-1,1]. */
  TRIANGLE_SLOPE: 4,
  TRIANGLE_PIVOT: 0.5,
});

const TAU = SYNTH_MATH.TAU;

/** Envelope value at `t` ms into a layer, in [0, 1]. */
export function envelopeAt(layer: SoundLayer, tMs: number): number {
  if (tMs < 0) return 0;
  if (tMs < layer.attackMs) return layer.attackMs <= 0 ? 1 : tMs / layer.attackMs;
  const afterAttack = tMs - layer.attackMs;
  if (afterAttack < layer.holdMs) return 1;
  const inRelease = afterAttack - layer.holdMs;
  if (layer.releaseMs <= 0 || inRelease >= layer.releaseMs) return 0;
  return Math.pow(1 - inRelease / layer.releaseMs, Math.max(1, layer.curve));
}

/** Total length of a layer's envelope, in ms. */
export function layerSpanMs(layer: SoundLayer): number {
  return layer.startMs + layer.attackMs + layer.holdMs + layer.releaseMs;
}

function oscillator(wave: Waveform, phase: number): number {
  switch (wave) {
    case 'sine':
      return Math.sin(phase);
    case 'triangle': {
      const x = (phase / TAU) % 1;
      return SYNTH_MATH.TRIANGLE_SLOPE * Math.abs(x - SYNTH_MATH.TRIANGLE_PIVOT) - 1;
    }
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1;
    case 'noise':
      return 0;
    default:
      return 0;
  }
}

/**
 * Render one cue.
 *
 * @param masterGain applied last, to everything. `MEET_SOUND.MASTER_GAIN` is
 * the knob a playtester turns to make the whole meet louder or quieter, and
 * setting it to 0 silences the game — which `meetSound.test.ts` relies on as
 * its mute mutation.
 */
export function renderCue(
  cue: SoundCue,
  masterGain: number,
  sampleRateHz: number = SOUND_FORMAT.SAMPLE_RATE_HZ,
): Float32Array {
  const frames = Math.max(1, Math.round((cue.durationMs / SYNTH_MATH.MS_PER_SECOND) * sampleRateHz));
  const out = new Float32Array(frames);
  const msPerFrame = SYNTH_MATH.MS_PER_SECOND / sampleRateHz;

  for (const layer of cue.layers) {
    let phase = 0;
    let noiseState = seedState(layer.seed);
    // One-pole filter memories, per layer.
    let lowPassed = 0;
    let highPassed = 0;
    let previousRaw = 0;
    const lowAlpha =
      layer.lowPassHz <= 0 ? 1 : 1 - Math.exp((-TAU * layer.lowPassHz) / sampleRateHz);
    const highAlpha =
      layer.highPassHz <= 0
        ? 0
        : 1 / (1 + (TAU * layer.highPassHz) / sampleRateHz);

    const from = Math.max(0, Math.round((layer.startMs / SYNTH_MATH.MS_PER_SECOND) * sampleRateHz));
    const spanMs = layerSpanMs(layer) - layer.startMs;
    const to = Math.min(frames, from + Math.ceil((spanMs / SYNTH_MATH.MS_PER_SECOND) * sampleRateHz));

    for (let i = from; i < to; i += 1) {
      const tMs = (i - from) * msPerFrame;
      const progress = spanMs <= 0 ? 0 : tMs / spanMs;
      const freq =
        layer.freqEndHz === undefined
          ? layer.freqHz
          : layer.freqHz + (layer.freqEndHz - layer.freqHz) * Math.min(1, progress);

      let raw: number;
      if (layer.wave === 'noise') {
        const draw = nextRandom(noiseState);
        noiseState = draw.state;
        raw = draw.value * 2 - 1;
      } else {
        phase += (TAU * freq) / sampleRateHz;
        if (phase > TAU) phase -= TAU;
        raw = oscillator(layer.wave, phase);
      }

      // Low pass first (shapes the band), then high pass (removes the rumble).
      lowPassed += lowAlpha * (raw - lowPassed);
      let shaped = lowPassed;
      if (layer.highPassHz > 0) {
        highPassed = highAlpha * (highPassed + shaped - previousRaw);
        previousRaw = shaped;
        shaped = highPassed;
      }

      out[i] = (out[i] ?? 0) + shaped * layer.gain * envelopeAt(layer, tMs);
    }
  }

  const gain = cue.gain * masterGain;
  for (let i = 0; i < frames; i += 1) out[i] = clampSample((out[i] ?? 0) * gain);
  return out;
}
