#!/usr/bin/env node
/**
 * Proves that meet day actually makes a sound in the running app.
 *
 * WHY THIS EXISTS AND WHAT IT IS WORTH. GDD §12.2 judges the walkout on
 * "pacing AND sound", and a builder can claim sound in a comment as easily as
 * it can claim anything else. Unit tests cover the synthesis (samples are
 * numbers) but they cannot say a screen ever plays one — that was exactly the
 * hole the meet's unused venue sat in for a whole round.
 *
 * So this drives the real Expo web build in headless Chromium and instruments
 * `window.Audio` BEFORE the bundle loads, recording every element the app
 * constructs and every `play()` it calls, with the millisecond it happened at.
 * `expo-audio`'s web backend is `new Audio(uri)`, which is a DETACHED element —
 * `document.querySelectorAll('audio')` finds nothing, which is why an earlier
 * check looked like silence and was really a bad probe.
 *
 * WHAT IT CANNOT DO. It does not listen. Nothing here says a cue sounds right,
 * or lands at the right moment against real broadcast footage; §12.2's sound
 * clause stays a listening judgement. It says the cue reached the audio layer,
 * with the right file, on the right beat, in the shipped build.
 *
 * Usage:
 *   node tools/verify-meet-sound.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { numberInBlock } from './readTuning.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/meet'));
const settleMs = Number(flag('settle', '5200'));

/**
 * READ, NOT TYPED. `MEET_SOUND.VOICES_PER_CUE` is how many copies of one cue
 * may sound at once; a run that stacks deeper than that is back to the defect
 * where a retrigger cuts the sound still playing. Reading it from source means
 * a playtester who changes it gets a tool that moves with them.
 */
const srcRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const meetTuningText = await readFile(path.join(srcRoot, 'src', 'game', 'meetTuning.ts'), 'utf8');
const voicesPerCue = numberInBlock(meetTuningText, 'MEET_SOUND', 'VOICES_PER_CUE');
if (voicesPerCue === null) {
  console.error('!! could not read MEET_SOUND.VOICES_PER_CUE out of meetTuning.ts — refusing to guess');
  process.exit(2);
}

/**
 * Which cue each beat MUST have played, by file name.
 *
 * Restated here rather than imported from `meetDay.ts`, for the same reason
 * `capture-meet.mjs` restates its moment list: this tool is a second,
 * independent statement of what the sequence contains, and a check that
 * silently agreed with a broken module would be worth nothing.
 */
const EXPECTED = [
  {
    moment: 'walkout',
    screen: 'meet-walkout',
    // The bar loads a plate at a time, then the call arrives under a crowd.
    must: ['bar-rattle.wav', 'crowd-swell.wav'],
    mustNot: ['crowd-swell-big.wav'],
  },
  {
    // A third attempt gets the big swell. Same screen, louder room.
    moment: 'walkout-third',
    screen: 'meet-walkout',
    must: ['bar-rattle.wav', 'crowd-swell-big.wav'],
    mustNot: ['crowd-swell.wav'],
  },
  {
    moment: 'verdict-good',
    screen: 'meet-verdict',
    must: ['light-clack-white.wav', 'crowd-cheer.wav'],
    mustNot: ['light-clack-red.wav'],
  },
  {
    // Three reds. The lamps clack; THE HALL DOES NOT CHEER. GDD §6.3 — a
    // no-lift gets silence, not a fail buzzer, and this is where that is
    // checked against the running app rather than against a unit test.
    moment: 'verdict-no-lift',
    screen: 'meet-verdict',
    must: ['light-clack-red.wav'],
    mustNot: ['crowd-cheer.wav', 'light-clack-white.wav'],
  },
  {
    moment: 'verdict-split',
    screen: 'meet-verdict',
    must: ['light-clack-white.wav', 'light-clack-red.wav'],
    mustNot: [],
  },
  {
    // The deliberation beat is silent on purpose: a sound under it would be a
    // metronome telling the lifter to wait.
    moment: 'deliberation',
    screen: 'meet-deliberation',
    must: [],
    mustNot: [
      'light-clack-white.wav',
      'light-clack-red.wav',
      'crowd-cheer.wav',
      'bomb-tone.wav',
    ],
  },
  {
    moment: 'bombed',
    screen: 'meet-bombed',
    must: ['bomb-tone.wav'],
    mustNot: ['crowd-cheer.wav'],
  },
  {
    // A Sim set is not a meet. Nothing on the daily loop plays a meet cue.
    moment: null,
    route: '',
    screen: 'session-screen',
    must: [],
    mustNot: [
      'bar-rattle.wav',
      'crowd-swell.wav',
      'crowd-cheer.wav',
      'bomb-tone.wav',
      'light-clack-white.wav',
    ],
  },
];

/**
 * Instrumentation, installed before any app code runs.
 *
 * The URI is captured at CONSTRUCTION and closed over, not read off the element
 * at `play()`. `expo-audio`'s web backend builds a detached `new Audio(uri)` and
 * `currentSrc` is empty until the browser has begun fetching, so reading it at
 * play time reports `''` for a cue that is playing perfectly well. That exact
 * mistake made a working build look silent on the first run of this tool.
 */
const PROBE = `
  window.__audioLog = [];
  window.__audioElements = [];
  const RealAudio = window.Audio;
  const started = Date.now();
  function Probed(src) {
    const uri = String(src ?? '');
    const el = new RealAudio(src);
    window.__audioElements.push({ uri, el });
    window.__audioLog.push({ event: 'construct', src: uri, atMs: Date.now() - started });
    const realPlay = el.play.bind(el);
    el.play = function () {
      const at = Date.now() - started;
      window.__audioLog.push({ event: 'play', src: uri, atMs: at });
      const result = realPlay();
      if (result && typeof result.catch === 'function') {
        result.catch((e) => {
          window.__audioLog.push({ event: 'rejected', src: uri, atMs: at, why: String(e && e.name) });
        });
      }
      return result;
    };
    return el;
  }
  Probed.prototype = RealAudio.prototype;
  window.Audio = Probed;
`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
await mkdir(outDir, { recursive: true });

const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(PROBE);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const report = [];
let failures = 0;

for (const check of EXPECTED) {
  const route = check.moment === null ? (check.route ?? '') : `?meet=${check.moment}`;
  await page.goto(`${url}${route}`, { waitUntil: 'load' });
  try {
    await page.getByTestId(check.screen).waitFor({ state: 'visible', timeout: 120000 });
  } catch {
    /* recorded below as a missing screen */
  }
  await page.waitForTimeout(settleMs);

  const seen = await page.evaluate(() => ({
    log: window.__audioLog ?? [],
    // Whether the browser actually FETCHED AND DECODED each file, rather than
    // merely being handed a URL. `duration` is NaN for a file that never
    // loaded, so a broken asset path cannot pass as a played cue.
    loaded: (window.__audioElements ?? []).map((entry) => ({
      uri: entry.uri,
      readyState: entry.el.readyState,
      durationSec: Number.isFinite(entry.el.duration) ? entry.el.duration : null,
    })),
  }));
  const nameOf = (uri) => decodeURIComponent(uri).split('?').pop().split('/').pop();
  const played = seen.log
    .filter((e) => e.event === 'play')
    .map((e) => ({ file: nameOf(e.src), atMs: e.atMs }));
  const rejected = seen.log.filter((e) => e.event === 'rejected').map((e) => nameOf(e.src));
  const decoded = seen.loaded.map((l) => ({ file: nameOf(l.uri), ...l, uri: undefined }));
  const files = new Set(played.map((p) => p.file));

  const missing = check.must.filter((f) => !files.has(f));
  const forbidden = check.mustNot.filter((f) => files.has(f));
  // A cue that was asked to play but never decoded is silence with extra steps.
  const undecoded = decoded.filter((d) => files.has(d.file) && d.durationSec === null).map((d) => d.file);

  /**
   * HOW DEEP EACH CUE STACKS ON ITSELF, WHICH A SET OF FILE NAMES CANNOT SEE.
   *
   * `files` above is a Set, so a cue that fired twice inside its own length is
   * indistinguishable from one that fired once — presence, not count, which is
   * the shape this repository has now been bitten by three times. That blindness
   * hid a real defect: the walk-out plays CROWD_SWELL_BIG twice, and with one
   * player per cue the second `seekTo(0)` KILLED the first instead of layering.
   * Nothing here could see it and a human had to read timestamps by hand.
   *
   * The oracle is the file's OWN DECODED LENGTH, not a restated constant: two
   * starts overlap when the second lands before the first has finished. Depth
   * is the most that are sounding at any one instant.
   */
  const durationMsOf = (file) => {
    const hit = decoded.find((d) => d.file === file && typeof d.durationSec === 'number');
    return hit === undefined ? null : hit.durationSec * 1000;
  };
  const overlaps = [...files]
    .map((file) => {
      const ms = durationMsOf(file);
      const starts = played.filter((p) => p.file === file).map((p) => p.atMs).sort((a, b) => a - b);
      if (ms === null) return { file, plays: starts.length, durationMs: null, depth: null, starts };
      let depth = 0;
      for (const start of starts) {
        const live = starts.filter((other) => other <= start && other + ms > start).length;
        if (live > depth) depth = live;
      }
      return { file, plays: starts.length, durationMs: Math.round(ms), depth, starts };
    })
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));
  const tooDeep = overlaps.filter((o) => o.depth !== null && o.depth > voicesPerCue);
  const undated = overlaps.filter((o) => o.depth === null).map((o) => o.file);

  const ok =
    missing.length === 0 &&
    forbidden.length === 0 &&
    undecoded.length === 0 &&
    tooDeep.length === 0 &&
    undated.length === 0;
  if (!ok) failures += 1;

  report.push({
    overlaps,
    tooDeep,
    moment: check.moment ?? '(session)',
    screen: check.screen,
    played,
    decoded,
    rejected,
    expected: check.must,
    forbidden: check.mustNot,
    missing,
    unexpectedlyPlayed: forbidden,
    undecoded,
    ok,
  });
  const label = (check.moment ?? '(session)').padEnd(18);
  const heard = played.length === 0 ? 'silence' : played.map((p) => `${p.file}@${p.atMs}ms`).join(' ');
  console.log(`${label} ${ok ? 'ok ' : '!! '} ${heard}`);
  if (missing.length > 0) console.log(`${' '.repeat(19)}   MISSING: ${missing.join(', ')}`);
  if (forbidden.length > 0) console.log(`${' '.repeat(19)}   SHOULD NOT HAVE PLAYED: ${forbidden.join(', ')}`);
  if (undecoded.length > 0) console.log(`${' '.repeat(19)}   NEVER DECODED: ${undecoded.join(', ')}`);
  if (rejected.length > 0) console.log(`${' '.repeat(19)}   play() rejected: ${rejected.join(', ')}`);
  for (const d of decoded) {
    console.log(`${' '.repeat(19)}   loaded ${d.file} readyState=${d.readyState} duration=${d.durationSec}`);
  }
}

await writeFile(path.join(outDir, 'sound.json'), `${JSON.stringify(report, null, 2)}\n`);
if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log('  ', e);
}
await browser.close();

const totalPlays = report.reduce((n, r) => n + r.played.length, 0);
console.log(`\n${totalPlays} cue play(s) observed across ${report.length} beat(s); ${failures} beat(s) wrong`);
console.log(`wrote ${path.join(outDir, 'sound.json')}`);
process.exit(failures === 0 && totalPlays > 0 ? 0 : 1);
