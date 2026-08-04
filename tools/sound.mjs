#!/usr/bin/env node
/**
 * Renders meet day's sound cues to `assets/sound/*.wav`.
 *
 * WHY THE FILES ARE GENERATED AND COMMITTED RATHER THAN SYNTHESISED AT RUNTIME.
 * `BUILD_PROMPT_CLAUDE.md` requires every asset to be generated in code, so
 * there is no sourced audio in this project and there never will be. But a WAV
 * that only exists at runtime has to reach the audio player as a `data:` URI,
 * and AVPlayer on iOS does not load one — the cue would be silent on half the
 * devices the game ships to, which is worse than not building it. Bundling the
 * output as an ordinary asset takes the same code path as every PNG, on every
 * platform.
 *
 * So the source of truth is still the code: `MEET_SOUND` in `meetTuning.ts` is
 * the recipe, `src/audio/synth.ts` renders it, and these files are its OUTPUT.
 * `src/meet/meetSound.test.ts` re-renders every cue and compares byte for byte
 * against the committed file, so a stale asset — or a hand-made one — fails the
 * suite. Editing the table without re-running this tool is a red test, not a
 * silent divergence.
 *
 * TypeScript is loaded through Node's built-in type stripping, the same way
 * `tools/gym.mjs` does it, so the samples written here come from the exact
 * modules the app imports rather than from a transcription.
 *
 * Usage:
 *   node tools/sound.mjs [--out DIR] [--check]
 *
 *   --check  render and compare without writing. Exits non-zero if any file on
 *            disk differs from a fresh render. This is what CI would run.
 */

import { registerHooks } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        const url = new URL(`${specifier}.ts`, context.parentURL ?? import.meta.url);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      } catch {
        /* fall through */
      }
    }
    return nextResolve(specifier, context);
  },
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { MEET_SOUND, MEET_SOUND_IDS } = await load('src/game/meetTuning.ts');
const { renderCue } = await load('src/audio/synth.ts');
const { encodeWav, peakOf, SOUND_FORMAT } = await load('src/audio/wav.ts');
const { fileNameForCue } = await load('src/meet/soundAssets.ts');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const checkOnly = args.includes('--check');
const outDir = path.resolve(ROOT, flag('out', 'assets/sound'));

mkdirSync(outDir, { recursive: true });

let differed = 0;
const written = new Set();

for (const id of MEET_SOUND_IDS) {
  const cue = MEET_SOUND.CUES[id];
  const samples = renderCue(cue, MEET_SOUND.MASTER_GAIN);
  const bytes = encodeWav(samples);
  const file = path.join(outDir, fileNameForCue(id));
  written.add(path.basename(file));

  const existing = existsSync(file) ? readFileSync(file) : null;
  const same = existing !== null && Buffer.compare(existing, Buffer.from(bytes)) === 0;
  if (!same) differed += 1;
  if (!checkOnly && !same) writeFileSync(file, bytes);

  const seconds = samples.length / SOUND_FORMAT.SAMPLE_RATE_HZ;
  console.log(
    `${id.padEnd(18)} ${path.basename(file).padEnd(24)} ` +
      `${seconds.toFixed(3)}s  peak ${peakOf(samples).toFixed(3)}  ${bytes.length} bytes  ` +
      `${same ? 'unchanged' : checkOnly ? 'STALE' : 'written'}`,
  );
}

// A cue removed from the table leaves its file behind, and a leftover file is
// an asset nothing renders — exactly the state the meet venue was in.
for (const entry of readdirSync(outDir)) {
  if (!entry.endsWith('.wav') || written.has(entry)) continue;
  differed += 1;
  console.log(`${'(orphan)'.padEnd(18)} ${entry.padEnd(24)} ${checkOnly ? 'STALE' : 'removed'}`);
  if (!checkOnly) unlinkSync(path.join(outDir, entry));
}

console.log(
  `\n${MEET_SOUND_IDS.length} cue(s) in ${path.relative(ROOT, outDir)}; ` +
    `${differed} file(s) ${checkOnly ? 'out of date' : 'changed'}`,
);
process.exit(checkOnly && differed > 0 ? 1 : 0);
