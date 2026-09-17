/**
 * wav.ts — mono 16-bit PCM samples into a RIFF/WAVE file, and nothing else.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 * ---------------------------------------------------------------------------
 * `BUILD_PROMPT_CLAUDE.md`: "all assets generated in code or as sprite data —
 * no placeholder stock art." That rule is why the lifter is rasterised from
 * `lifterSprite.ts` rather than drawn in an editor, and it applies to sound the
 * same way. So the meet's cues are SYNTHESISED (`synth.ts`) from a recipe table
 * (`MEET_SOUND` in `meetTuning.ts`) and encoded here.
 *
 * The alternative — sourced audio files — would be stock art with a different
 * file extension, and nobody could tune it.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS AND IS NOT
 * ---------------------------------------------------------------------------
 * Pure. No React, no I/O, no side effects, no platform API. It takes numbers
 * and returns bytes. `tools/sound.mjs` writes those bytes to disk and the app
 * loads the result as an ordinary bundled asset; neither of those jobs is here.
 *
 * MONO, 16-BIT, 22.05 kHz. Every cue is a rattle, a click, a low tone or a
 * band-limited noise swell — none of them has content near 11 kHz, and none of
 * them is stereo, so a higher rate or a second channel would quadruple the
 * bundle for nothing anyone can hear. This is a format decision, not a knob:
 * see `SOUND_FORMAT`.
 */

/**
 * The container format. NOT GAME FEEL — nobody playtests a sample rate. The
 * cue recipes, which are the tunable part, are in `MEET_SOUND`.
 */
export const SOUND_FORMAT = Object.freeze({
  /** Enough for a click's transient; half of CD rate, a quarter of the bytes. */
  SAMPLE_RATE_HZ: 22050,
  CHANNELS: 1,
  BITS_PER_SAMPLE: 16,
  /** RIFF header length in bytes, before the sample data. */
  HEADER_BYTES: 44,
  /** WAVE format tag for uncompressed PCM. */
  PCM_FORMAT_TAG: 1,
  /** Largest magnitude a signed 16-bit sample can carry. */
  FULL_SCALE: 32767,
});

/**
 * Fixed offsets and widths in the RIFF container. Not knobs either — these are
 * the file format, and the only reason they are named is that the audit is
 * right that a bare `24` in a function body is unreadable whatever it means.
 */
export const WAV_LAYOUT = Object.freeze({
  BITS_PER_BYTE: 8,
  /** Bytes of `RIFF` + size field that the declared RIFF size excludes. */
  RIFF_PREAMBLE_BYTES: 8,
  /** Length of the `fmt ` chunk body for PCM. */
  FMT_CHUNK_BYTES: 16,
  /** Where `decodeWav` finds the fields it reads back. */
  SAMPLE_RATE_AT: 24,
  DATA_SIZE_AT: 40,
  /** Bytes in a 32-bit and a 16-bit little-endian field. */
  U32_BYTES: 4,
  U16_BYTES: 2,
  /** Mask and wrap points for the little-endian writers. */
  BYTE_MASK: 0xff,
  U16_WRAP: 0x10000,
  U16_MASK: 0xffff,
});

const BYTES_PER_SAMPLE = SOUND_FORMAT.BITS_PER_SAMPLE / WAV_LAYOUT.BITS_PER_BYTE;

/** Clamp to the representable range. A cue that clips is a bug in its recipe. */
export function clampSample(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

/**
 * Peak magnitude of a buffer, in [0, 1].
 *
 * Exported because it is what the tests measure: "this cue makes a sound" is
 * `peakOf(...) > 0`, and muting the mix is exactly the mutation that takes it
 * to zero.
 */
export function peakOf(samples: readonly number[] | Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const magnitude = Math.abs(samples[i] ?? 0);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

/** Root-mean-square level of a slice, for envelope shape assertions. */
export function rmsOf(samples: readonly number[] | Float32Array, from: number, to: number): number {
  const start = Math.max(0, Math.trunc(from));
  const end = Math.min(samples.length, Math.trunc(to));
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i += 1) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / (end - start));
}

/**
 * The three writers return the offset AFTER what they wrote, so the header is
 * built as a cursor walk rather than as a column of hard-coded byte positions.
 * Same bytes; nobody has to count to 36 to check it.
 */
function writeAscii(bytes: Uint8Array, offset: number, text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    bytes[offset + i] = text.charCodeAt(i) & WAV_LAYOUT.BYTE_MASK;
  }
  return offset + text.length;
}

function writeUintLE(bytes: Uint8Array, offset: number, value: number, width: number): number {
  let remaining = value;
  for (let i = 0; i < width; i += 1) {
    bytes[offset + i] = remaining & WAV_LAYOUT.BYTE_MASK;
    remaining = Math.floor(remaining / (WAV_LAYOUT.BYTE_MASK + 1));
  }
  return offset + width;
}

function readUintLE(bytes: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let i = width - 1; i >= 0; i -= 1) {
    value = value * (WAV_LAYOUT.BYTE_MASK + 1) + (bytes[offset + i] ?? 0);
  }
  return value;
}

/**
 * Encode samples in [-1, 1] as a complete `.wav` file.
 *
 * Deterministic: the same samples always produce the same bytes. That is what
 * lets `meetSound.test.ts` compare the committed assets against a fresh render
 * and fail when the two disagree — so the shipped audio is provably the output
 * of the recipe table, not a file somebody dropped in.
 */
export function encodeWav(
  samples: readonly number[] | Float32Array,
  sampleRateHz: number = SOUND_FORMAT.SAMPLE_RATE_HZ,
): Uint8Array {
  const frames = samples.length;
  const dataBytes = frames * BYTES_PER_SAMPLE * SOUND_FORMAT.CHANNELS;
  const bytes = new Uint8Array(SOUND_FORMAT.HEADER_BYTES + dataBytes);
  const u32 = WAV_LAYOUT.U32_BYTES;
  const u16 = WAV_LAYOUT.U16_BYTES;

  let at = writeAscii(bytes, 0, 'RIFF');
  at = writeUintLE(
    bytes,
    at,
    SOUND_FORMAT.HEADER_BYTES - WAV_LAYOUT.RIFF_PREAMBLE_BYTES + dataBytes,
    u32,
  );
  at = writeAscii(bytes, at, 'WAVE');

  at = writeAscii(bytes, at, 'fmt ');
  at = writeUintLE(bytes, at, WAV_LAYOUT.FMT_CHUNK_BYTES, u32);
  at = writeUintLE(bytes, at, SOUND_FORMAT.PCM_FORMAT_TAG, u16);
  at = writeUintLE(bytes, at, SOUND_FORMAT.CHANNELS, u16);
  at = writeUintLE(bytes, at, sampleRateHz, u32);
  at = writeUintLE(bytes, at, sampleRateHz * SOUND_FORMAT.CHANNELS * BYTES_PER_SAMPLE, u32);
  at = writeUintLE(bytes, at, SOUND_FORMAT.CHANNELS * BYTES_PER_SAMPLE, u16);
  at = writeUintLE(bytes, at, SOUND_FORMAT.BITS_PER_SAMPLE, u16);

  at = writeAscii(bytes, at, 'data');
  at = writeUintLE(bytes, at, dataBytes, u32);

  for (let i = 0; i < frames; i += 1) {
    const quantised = Math.round(clampSample(samples[i] ?? 0) * SOUND_FORMAT.FULL_SCALE);
    writeUintLE(bytes, at + i * BYTES_PER_SAMPLE, quantised & WAV_LAYOUT.U16_MASK, u16);
  }
  return bytes;
}

/** Read the samples back out. Used by the tests, and to prove the round trip. */
export function decodeWav(bytes: Uint8Array): { readonly sampleRateHz: number; readonly samples: Float32Array } {
  const readI16 = (at: number): number => {
    const raw = readUintLE(bytes, at, WAV_LAYOUT.U16_BYTES);
    return raw > SOUND_FORMAT.FULL_SCALE ? raw - WAV_LAYOUT.U16_WRAP : raw;
  };
  const dataBytes = readUintLE(bytes, WAV_LAYOUT.DATA_SIZE_AT, WAV_LAYOUT.U32_BYTES);
  const frames = Math.floor(dataBytes / BYTES_PER_SAMPLE);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i += 1) {
    samples[i] = readI16(SOUND_FORMAT.HEADER_BYTES + i * BYTES_PER_SAMPLE) / SOUND_FORMAT.FULL_SCALE;
  }
  return {
    sampleRateHz: readUintLE(bytes, WAV_LAYOUT.SAMPLE_RATE_AT, WAV_LAYOUT.U32_BYTES),
    samples,
  };
}
