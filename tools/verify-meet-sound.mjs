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
 * ===========================================================================
 * EVERY BEAT HERE IS OPENED BY A `?meet=` URL, WHICH IS A DIFFERENT SUBJECT
 * ===========================================================================
 * `CLAUDE.md` is explicit that a screen opened by query string is not the screen
 * the player reaches, because `frozenMeetFor` branches on `source === 'debug'`
 * and the two arms are literally different code. That warning applies to this
 * whole file: the walk-out it listens to is the DEBUG walk-out.
 *
 * What that does and does not cost, stated rather than left to the reader:
 *
 *   IT STILL MEASURES THE THING THIS TOOL IS FOR. The cue table, the screens'
 *   `playBeat` calls, `meetSound.ts`'s pool and the bar-load schedule are shared
 *   by both arms — none of them is behind the debug branch. And the coalescing
 *   this tool was pointed at is a property of the BROWSER, not of the arm.
 *
 *   IT DOES NOT PROVE THE PLAYED ARM MAKES A SOUND. Nothing here has ever
 *   pressed a control. `tools/verify-shell-route.mjs` drives whole meets with a
 *   mouse and could carry this probe; that it does not is printed on every run
 *   and written into `sound.json` as `scopeLimits`, so the section cannot read
 *   as complete. It is a NOTE rather than a red check, and the argument for
 *   that is at the line itself: this tool never ATTEMPTS the played arm, so a
 *   permanent failure there would stop the exit code meaning "the sound is
 *   wrong".
 *
 * Usage:
 *   node tools/verify-meet-sound.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { numberInBlock, parserSelfTest } from './readTuning.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/meet'));
const settleMs = Number(flag('settle', '5200'));

const srcRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

/**
 * Every named check this run made, so the record says what was asked as well as
 * what was heard. `reds()` is the single source for both the `failures` array
 * and the exit code, so the file cannot report green beside a process exiting 1.
 */
const checks = [];
function check(ok, what, detail) {
  checks.push({ ok, what, detail: detail ?? null });
  console.log(`${ok ? 'ok   ' : '!!   '}${what}${detail === undefined ? '' : `  — ${detail}`}`);
}
const reds = () => checks.filter((c) => !c.ok);

/**
 * Provenance — the same field `verify-cutin-cap.mjs` and `verify-shell-route.mjs`
 * carry, and required by `tools/evidence.mjs` of any TRACKED shot record: a
 * record with no commit and no instrument digest on it cannot be dated, and a
 * SHA says which app the browser played while saying nothing about the tool
 * that listened. Snapshotted before anything is written.
 */
const capturedFrom = (() => {
  const record = {
    capturedAt: new Date().toISOString(),
    url,
    commit: null,
    branch: null,
    workingTree: 'unknown',
    dirtyPaths: [],
  };
  const git = (...gitArgs) => execFileSync('git', ['-C', srcRoot, ...gitArgs], { encoding: 'utf8' }).trim();
  try {
    record.commit = git('rev-parse', '--short', 'HEAD');
    record.branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const status = git('status', '--porcelain');
    const lines = status === '' ? [] : status.split('\n');
    // Not code the app ran. Kept in step with `verify-cutin-cap.mjs`'s list.
    const notCode = ['.gauntlet/shots/', '.gauntlet/evidence/', '.gauntlet/state.json'];
    const codeLines = lines.filter((line) => {
      const p = line.replace(/^\s*\S+\s+/, '');
      return !notCode.some((prefix) => p.startsWith(prefix));
    });
    record.workingTree = codeLines.length === 0 ? 'clean' : 'DIRTY — this run is not against a commit';
    record.dirtyPaths = lines.slice(0, 40);
  } catch (error) {
    record.workingTree = `unknown — ${String(error).slice(0, 200)}`;
  }
  record.instrument = Object.fromEntries(
    ['verify-meet-sound.mjs', 'readTuning.mjs'].map((name) => {
      const file = path.join(path.dirname(fileURLToPath(import.meta.url)), name);
      try {
        return [name, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16)];
      } catch (error) {
        return [name, `unreadable — ${String(error).slice(0, 80)}`];
      }
    }),
  );
  return record;
})();

/**
 * A PARSER THAT HAS STOPPED MATCHING AGREES WITH EVERY FILE. `readTuning.mjs`'s
 * own header requires every consumer to run this and fail on it; this tool read
 * a constant through it for a round without doing so.
 */
const parserComplaints = parserSelfTest();
check(
  parserComplaints.length === 0,
  'CONTROL: the source readers still read their own fixture',
  parserComplaints.length === 0 ? 'readTuning.mjs parses the shapes it claims to' : parserComplaints.join('; '),
);

/**
 * READ, NOT TYPED. `MEET_SOUND.VOICES_PER_CUE` is how many copies of one cue
 * may sound at once; a run that stacks deeper than that is back to the defect
 * where a retrigger cuts the sound still playing. Reading it from source means
 * a playtester who changes it gets a tool that moves with them.
 */
const meetTuningText = await readFile(path.join(srcRoot, 'src', 'game', 'meetTuning.ts'), 'utf8');
const voicesPerCue = numberInBlock(meetTuningText, 'MEET_SOUND', 'VOICES_PER_CUE');
if (voicesPerCue === null || parserComplaints.length > 0) {
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

for (const beat of EXPECTED) {
  const route = beat.moment === null ? (beat.route ?? '') : `?meet=${beat.moment}`;
  await page.goto(`${url}${route}`, { waitUntil: 'load' });
  try {
    await page.getByTestId(beat.screen).waitFor({ state: 'visible', timeout: 120000 });
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

  const missing = beat.must.filter((f) => !files.has(f));
  const forbidden = beat.mustNot.filter((f) => files.has(f));
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
    moment: beat.moment ?? '(session)',
    screen: beat.screen,
    played,
    decoded,
    rejected,
    expected: beat.must,
    forbidden: beat.mustNot,
    missing,
    unexpectedlyPlayed: forbidden,
    undecoded,
    ok,
  });
  const label = (beat.moment ?? '(session)').padEnd(18);
  const heard = played.length === 0 ? 'silence' : played.map((p) => `${p.file}@${p.atMs}ms`).join(' ');
  const depths = overlaps
    .filter((o) => o.plays > 1)
    .map((o) => `${o.file} x${o.plays} depth ${o.depth ?? '?'}`)
    .join(', ');
  // THE ADDRESS BAR IS ASSERTED, so a beat cannot be quietly read off a screen
  // it did not open. Every beat here is a debug URL BY DESIGN (see the header);
  // what must not happen is one of them being read at a route it did not ask
  // for, which is how a section stays green while measuring something else.
  const address = page.url().replace(/\/$/, '').replace(/\/(?=\?)/, '');
  const wanted = `${url}${route}`.replace(/\/$/, '');
  const addressOk = address === wanted;
  check(
    ok && addressOk,
    `${label.trim()} — cues reached the audio layer, none stacked past the pool of ${voicesPerCue}`,
    `${heard}${depths === '' ? '' : `; retriggers: ${depths}`}` +
      `${missing.length > 0 ? `; MISSING: ${missing.join(', ')}` : ''}` +
      `${forbidden.length > 0 ? `; SHOULD NOT HAVE PLAYED: ${forbidden.join(', ')}` : ''}` +
      `${undecoded.length > 0 ? `; NEVER DECODED: ${undecoded.join(', ')}` : ''}` +
      `${undated.length > 0 ? `; UNDATABLE: ${undated.join(', ')}` : ''}` +
      `${tooDeep.length > 0 ? `; PAST THE POOL: ${JSON.stringify(tooDeep)}` : ''}` +
      `${rejected.length > 0 ? `; play() rejected: ${rejected.join(', ')}` : ''}` +
      `${addressOk ? '' : `; READ AT ${address}, NOT ${wanted}`}`,
  );
  for (const d of decoded) {
    console.log(`${' '.repeat(21)} loaded ${d.file} readyState=${d.readyState} duration=${d.durationSec}`);
  }
}

// ---------------------------------------------------------------------------
// NON-VACUITY, AS COUNTS RATHER THAN BOUNDS
// ---------------------------------------------------------------------------

/**
 * THE DEPTH CHECK PASSES TRIVIALLY ON A RUN WHERE NOTHING RETRIGGERED, and that
 * is not hypothetical: the reason depth exists at all is that a `Set` of file
 * names could not see a second fire. A run in which no cue ever fired twice has
 * an EMPTY DOMAIN for the measurement and has to say so rather than printing a
 * column of `ok`.
 *
 * Counts, not bounds, per `CLAUDE.md`: these are what this run actually saw, so
 * a build that quietly stops retriggering reports itself.
 */
const everyOverlap = report.flatMap((r) => r.overlaps);
const retriggering = everyOverlap.filter((o) => o.plays > 1);
const stacking = everyOverlap.filter((o) => o.depth !== null && o.depth > 1);
const deepest = everyOverlap.reduce((worst, o) => Math.max(worst, o.depth ?? 0), 0);
check(
  retriggering.length > 0,
  'NON-VACUITY: some cue fired more than once, so the depth measurement had a subject',
  `${retriggering.length} cue/beat pair(s) retriggered: ${retriggering
    .map((o) => `${o.file} x${o.plays}`)
    .join(', ')}`,
);
check(
  stacking.length > 0,
  'NON-VACUITY: some cue was sounding over itself, so the pool was actually asked for',
  `${stacking.length} pair(s) stacked; deepest ${deepest} against a pool of ${voicesPerCue}`,
);

/**
 * THE PLAYED ARM, DECLARED MISSING RATHER THAN IMPLIED PRESENT.
 *
 * A NOTE AND NOT A `check(false)`, and the distinction is deliberate.
 * `verify-shell-route.mjs` spends `check(false, 'SKIPPED: …')` on a section that
 * TRIED to reach the played arm and could not — a real red, because the claim it
 * was about went unmade. This tool never tries: it has no drive, and every beat
 * it reports is a debug URL on purpose. Spending a permanent red on that would
 * make the exit code stop meaning "the sound is wrong", which is the only thing
 * it is useful for.
 *
 * So it is recorded as a scope limit, loudly, in the console AND in the record,
 * where a reader who never runs the tool still meets it.
 */
const scopeLimits = [
  'NOT MEASURED: every beat above was opened by a `?meet=` debug URL. No cue in this record was heard on ' +
    'a meet a PLAYER opened. `CLAUDE.md` treats those as different subjects because `frozenMeetFor` ' +
    'branches on `source === \'debug\'`. What this tool checks — the cue table, the screens\' playBeat calls, ' +
    'the voice pool and the bar-load schedule — is shared by both arms, and browser timer coalescing is a ' +
    'property of the browser rather than of the arm; but the played arm itself is unmeasured for sound.',
  'NOT MEASURED: nobody has LISTENED. Nothing here says a cue sounds right or lands at the right moment ' +
    'against broadcast footage (GDD §12.1, §12.2).',
];
for (const limit of scopeLimits) console.log(`note  ${limit}`);

const totalPlays = report.reduce((n, r) => n + r.played.length, 0);
check(
  totalPlays > 0,
  'the run heard anything at all',
  `${totalPlays} cue play(s) across ${report.length} beat(s), ${failures} beat(s) wrong`,
);

await writeFile(
  path.join(outDir, 'sound.json'),
  `${JSON.stringify(
    {
      capturedFrom,
      voicesPerCue,
      scopeLimits,
      beats: report,
      totals: {
        plays: totalPlays,
        beatsWrong: failures,
        retriggeringPairs: retriggering.length,
        stackingPairs: stacking.length,
        deepest,
      },
      checks,
      /**
       * THE RED LINES. Required, not decorative: `tools/evidence.mjs` refuses a
       * tracked record whose `failures` array is non-empty, and it skips that
       * gate entirely for a record with no such key — so a red run would commit
       * and verify as green. Derived from `reds()`, which is also the exit code,
       * so this file cannot say green beside a process exiting 1.
       */
      failures: reds(),
      pageErrors: errors.slice(0, 20),
    },
    null,
    2,
  )}\n`,
);
if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log('  ', e);
}
await browser.close();

console.log(
  `\n${checks.length} checks, ${reds().length} failed. ${totalPlays} cue play(s) across ${report.length} beat(s); ` +
    `${failures} beat(s) wrong; deepest stack ${deepest} against a pool of ${voicesPerCue}`,
);
console.log(`wrote ${path.join(outDir, 'sound.json')}`);
process.exit(reds().length === 0 ? 0 : 1);
