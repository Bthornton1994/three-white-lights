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
 * THIS TOOL LISTENS TO TWO DIFFERENT SUBJECTS AND SAYS WHICH IS WHICH
 * ===========================================================================
 * `CLAUDE.md` is explicit that a screen opened by query string is not the screen
 * the player reaches, because `frozenMeetFor` branches on `source === 'debug'`
 * and the two arms are literally different code.
 *
 * SECTION 1 — THE DEBUG ARM. Eight beats, each opened by a `?meet=` URL. It is
 * how the verdict, deliberation, bomb-out and no-lift cues are reached at all:
 * a played meet gives whichever verdicts the robot's timing earns, so must/
 * must-not lists for those beats are only statable on a scripted frame.
 *
 * SECTION 2 — THE PLAYED ARM, WHICH USED TO BE A `scopeLimits` NOTE SAYING THIS
 * SECTION DID NOT EXIST. It launches on `/`, presses the shell's own way in with
 * a mouse, and drives a real meet through GDD §6.2's beats until it has heard
 * BOTH a calm walk-out and an urgent one — which is the branch `soundForBeat`
 * takes on `walkout-call`, and the beat §12.2 grades this game on. Nothing is
 * typed into the address bar, and every cue it counts carries the value of
 * `location.search` READ AT THE INSTANT `play()` WAS CALLED, so a quiet fallback
 * to a debug URL cannot be reported as the played arm.
 *
 * The drive is `tools/meetDrive.mjs`'s — the same module `verify-shell-route.mjs`
 * plays its two whole meets with — rather than a second copy of it here. See
 * that file's header.
 *
 * A DRIVE THAT DOES NOT REACH THE WALK-OUT IS A NAMED, RED, SKIPPED CHECK, not
 * a note and not a fallback to `?meet=walkout`. The old note argued that a
 * permanent red would stop the exit code meaning "the sound is wrong"; that
 * argument held only while this tool never ATTEMPTED the played arm. Now that it
 * does, an unreachable walk-out means the record is incomplete, which is exactly
 * what `verify-shell-route.mjs` spends a `check(false, 'SKIPPED: …')` on.
 *
 * WHAT THE PLAYED ARM STILL DOES NOT COVER is written into `scopeLimits` and
 * printed on every run. It is smaller than it was and it is not empty.
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
import { freshDepthSearch } from './sessionDrive.mjs';
import {
  MEET_DRIVE,
  MEET_WALKOUT_SAYS,
  driveMeetToItsEnd,
  waitUntilDrawn,
} from './meetDrive.mjs';

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
 * How long a COLD page load gets to draw the screen it was asked for.
 *
 * Deliberately generous and deliberately named: on a first hit Metro is still
 * bundling, and this deadline means "the app never drew it", not "the app was
 * slow". It was a bare 120000 at one call site; the played arm needs the same
 * number and CLAUDE.md's rule about a guard and its sibling applies to a
 * literal as much as to a check. Not game feel — the game's own values are in
 * `src/game/meetTuning.ts`, and the driver's patience is `MEET_DRIVE`.
 */
const COLD_LOAD_TIMEOUT_MS = 120000;

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
    // `meetDrive.mjs` and `sessionDrive.mjs` are in here because the played-arm
    // section is only as good as the drive that reached the beat, and a record
    // that names the tool but not the driver cannot be dated against a change to
    // the driver.
    ['verify-meet-sound.mjs', 'readTuning.mjs', 'meetDrive.mjs', 'sessionDrive.mjs'].map((name) => {
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
 * ===========================================================================
 * WHICH CROWD SWELL A WALK-OUT MUST HAVE PLAYED, BY THE LINE IT WAS SHOWING
 * ===========================================================================
 * The played arm cannot be addressed by moment name — there is no `?meet=` to
 * ask for a third attempt — so a walk-out is identified by what it says, which
 * is what the player reads. `WalkoutView` picks the line bomb-risk first, then
 * PR, then third, then the prompt, and `isUrgentAttempt` is true for exactly the
 * first three. So the line is a total, exact discriminator for the branch
 * `soundForBeat` takes on `walkout-call`:
 *
 *   'WALK IT OUT'                        not urgent  -> CROWD_SWELL
 *   'LAST ONE' / a PR / nothing banked   urgent      -> CROWD_SWELL_BIG
 *
 * ONE TABLE, TWO INDEPENDENT VERIFIERS. The lines are `MEET_WALKOUT_SAYS` in
 * `meetDrive.mjs`, which `verify-shell-route.mjs` also sorts its hall shots by;
 * the `must` / `mustNot` mapping is this tool's own statement and is deliberately
 * NOT imported from `meetDay.ts`, on the same principle as `EXPECTED` above. The
 * four lines are cross-checked against `src/game/meetTuning.ts` below, so a copy
 * edit reddens instead of silently matching nothing.
 */
const PLAYED_WALKOUT_CUES = Object.freeze([
  Object.freeze({
    line: MEET_WALKOUT_SAYS.WALK_IT_OUT,
    tuningName: 'WALKOUT_PROMPT',
    urgent: false,
    // The bar loads a plate at a time, then the call arrives under a crowd.
    must: Object.freeze(['bar-rattle.wav', 'crowd-swell.wav']),
    mustNot: Object.freeze(['crowd-swell-big.wav']),
  }),
  Object.freeze({
    line: MEET_WALKOUT_SAYS.LAST_ONE,
    tuningName: 'WALKOUT_THIRD',
    urgent: true,
    must: Object.freeze(['bar-rattle.wav', 'crowd-swell-big.wav']),
    mustNot: Object.freeze(['crowd-swell.wav']),
  }),
  Object.freeze({
    line: MEET_WALKOUT_SAYS.A_PR,
    tuningName: 'WALKOUT_PR',
    urgent: true,
    must: Object.freeze(['bar-rattle.wav', 'crowd-swell-big.wav']),
    mustNot: Object.freeze(['crowd-swell.wav']),
  }),
  Object.freeze({
    line: MEET_WALKOUT_SAYS.NOTHING_BANKED,
    tuningName: 'WALKOUT_BOMB_RISK',
    urgent: true,
    must: Object.freeze(['bar-rattle.wav', 'crowd-swell-big.wav']),
    mustNot: Object.freeze(['crowd-swell.wav']),
  }),
]);

/**
 * COUNTED, NOT MERELY FOUND, and that is CLAUDE.md's instruction rather than
 * fussiness: "the tell is that the pattern's match count is never asserted —
 * pinning counts rather than presence is the fix this file already demands of
 * sweeps, and it applies to source scans identically". A pattern with two
 * witnesses in the file survives the edit that breaks the one that matters.
 * Exactly one of each today.
 */
const occurrencesOf = (text, needle) => text.split(needle).length - 1;
for (const rule of PLAYED_WALKOUT_CUES) {
  const needle = `${rule.tuningName}: '${rule.line}'`;
  const found = occurrencesOf(meetTuningText, needle);
  check(
    found === 1,
    `CONTROL: MEET_COPY.${rule.tuningName} is the line the played arm reads ${rule.urgent ? 'an URGENT' : 'a CALM'} walk-out off`,
    `${found} occurrence(s) of ${needle} in meetTuning.ts, want exactly 1`,
  );
}

/**
 * Instrumentation, installed before any app code runs.
 *
 * The URI is captured at CONSTRUCTION and closed over, not read off the element
 * at `play()`. `expo-audio`'s web backend builds a detached `new Audio(uri)` and
 * `currentSrc` is empty until the browser has begun fetching, so reading it at
 * play time reports `''` for a cue that is playing perfectly well. That exact
 * mistake made a working build look silent on the first run of this tool.
 *
 * ===========================================================================
 * AND WHERE THE PAGE WAS, READ SYNCHRONOUSLY INSIDE `play()`
 * ===========================================================================
 * THIS IS THE ATTRIBUTION, AND IT IS EXACT BECAUSE IT IS NOT A POLL. The obvious
 * way to say which beat a cue belonged to is to have the driver mark the log
 * when it SEES the walk-out arrive — and the driver polls every
 * `MEET_DRIVE.POLL_MS`, while `platesLandedAt(0, n)` puts the first disc on the
 * sleeve at elapsed 0, so the first rattle of every bar load fires about one
 * animation frame after `WalkoutView` mounts and lands on the wrong side of a
 * 25 ms boundary as often as not. Every fix for that is a guessed lead window.
 *
 * Reading `location.search` and the mounted screens INSIDE the intercepted
 * `play()` needs no window at all: the DOM at that instant is the DOM the cue
 * sounded over. It is also what makes the address-bar claim CLAUDE.md asks for
 * stronger than the one it asks for — the query string is read at the moment of
 * the SOUND, not at the moment the screen was later inspected.
 *
 * The probe below is a template literal, so it contains no interpolation syntax
 * at all — one would be evaluated by node instead of by the browser, which is
 * why the selectors are built by string concatenation.
 */
const PROBE = `
  window.__audioLog = [];
  window.__audioElements = [];
  var MEET_SCREEN_IDS = [
    'meet-weigh-in', 'meet-openers', 'meet-attempt-select', 'meet-walkout',
    'meet-attempt', 'meet-deliberation', 'meet-verdict', 'meet-recap',
    'meet-recap-waiting', 'meet-recap-placeholder', 'meet-bombed', 'session-screen',
  ];
  function whereTheCueSounded() {
    var one = function (id) { return document.querySelector('[data-testid="' + id + '"]'); };
    var text = function (id) { var n = one(id); return n === null ? null : n.textContent; };
    return {
      search: window.location.search,
      screens: MEET_SCREEN_IDS.filter(function (id) { return one(id) !== null; }),
      walkoutAttempt: text('walkout-attempt'),
      walkoutLine: text('walkout-line'),
    };
  }
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
      const where = whereTheCueSounded();
      window.__audioLog.push({
        event: 'play',
        src: uri,
        atMs: at,
        search: where.search,
        screens: where.screens,
        walkoutAttempt: where.walkoutAttempt,
        walkoutLine: where.walkoutLine,
      });
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

/**
 * HOW DEEP EACH CUE STACKS ON ITSELF, WHICH A SET OF FILE NAMES CANNOT SEE.
 *
 * A `Set` of file names cannot tell a cue that fired twice inside its own length
 * from one that fired once — presence, not count, which is the shape this
 * repository has now been bitten by three times. That blindness hid a real
 * defect: the walk-out plays CROWD_SWELL_BIG twice, and with one player per cue
 * the second `seekTo(0)` KILLED the first instead of layering. Nothing here
 * could see it and a human had to read timestamps by hand.
 *
 * The oracle is the file's OWN DECODED LENGTH, not a restated constant: two
 * starts overlap when the second lands before the first has finished. Depth is
 * the most that are sounding at any one instant.
 *
 * ONE FUNCTION, CALLED BY BOTH ARMS. It was inline in the debug loop and the
 * played arm needs exactly the same arithmetic, which is the point at which
 * CLAUDE.md's rule about a guard and its sibling applies: a second copy here
 * would be two answers to "did the pool overflow", and the one that drifted
 * would be the one that mattered.
 */
function overlapsIn(played, decoded) {
  const durationMsOf = (file) => {
    const hit = decoded.find((d) => d.file === file && typeof d.durationSec === 'number');
    return hit === undefined ? null : hit.durationSec * 1000;
  };
  const files = new Set(played.map((p) => p.file));
  return [...files]
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
}

/** Every cue file name out of a URI, however it was bundled. */
const nameOf = (uri) => decodeURIComponent(uri).split('?').pop().split('/').pop();

/**
 * What the probe recorded, as this tool reads it. One shape for both arms.
 *
 * `screens`, `search`, `walkoutAttempt` and `walkoutLine` come off the play
 * event itself — see the block above `PROBE` for why they are read inside
 * `play()` and not polled.
 */
async function readTheProbe(thePage) {
  const seen = await thePage.evaluate(() => ({
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
  return {
    played: seen.log
      .filter((e) => e.event === 'play')
      .map((e) => ({
        file: nameOf(e.src),
        atMs: e.atMs,
        search: e.search ?? null,
        screens: e.screens ?? [],
        walkoutAttempt: e.walkoutAttempt ?? null,
        walkoutLine: e.walkoutLine ?? null,
      })),
    rejected: seen.log.filter((e) => e.event === 'rejected').map((e) => nameOf(e.src)),
    decoded: seen.loaded.map((l) => ({ file: nameOf(l.uri), ...l, uri: undefined })),
  };
}

const report = [];
let failures = 0;

for (const beat of EXPECTED) {
  const route = beat.moment === null ? (beat.route ?? '') : `?meet=${beat.moment}`;
  await page.goto(`${url}${route}`, { waitUntil: 'load' });
  // WHETHER THE SCREEN ARRIVED IS THE WHOLE DIFFERENCE ON A SILENT BEAT, and
  // for a round this `catch` swallowed it under a comment claiming otherwise.
  //
  // Two rows here are silent BY DESIGN and carry `must: []` — `deliberation`,
  // where a cue would be a metronome telling the lifter to wait, and the Sim
  // session, where no meet cue belongs at all. For those rows every component
  // of `ok` is a filter over an empty list the moment nothing plays:
  // `missing` is `must` filtered, `forbidden` and `undecoded` need a play to
  // find, and `overlaps` needs two. So a screen that NEVER RENDERED produced
  // `ok: true`, indistinguishable from the silence being correct — CLAUDE.md's
  // empty domain, on the two rows that consist of nothing but an empty domain.
  //
  // The old comment here read "recorded below as a missing screen". Nothing
  // below recorded it: the pushed row had no screen field of any kind. That is
  // the first rule in CLAUDE.md — a comment asserting a guarantee with nothing
  // that can redden — sitting inside the instrument written to close a gap.
  let screenDrew = true;
  try {
    await page.getByTestId(beat.screen).waitFor({ state: 'visible', timeout: COLD_LOAD_TIMEOUT_MS });
  } catch {
    screenDrew = false;
  }
  await page.waitForTimeout(settleMs);

  const { played, rejected, decoded } = await readTheProbe(page);
  const files = new Set(played.map((p) => p.file));

  const missing = beat.must.filter((f) => !files.has(f));
  const forbidden = beat.mustNot.filter((f) => files.has(f));
  // A cue that was asked to play but never decoded is silence with extra steps.
  const undecoded = decoded.filter((d) => files.has(d.file) && d.durationSec === null).map((d) => d.file);

  const overlaps = overlapsIn(played, decoded);
  const tooDeep = overlaps.filter((o) => o.depth !== null && o.depth > voicesPerCue);
  const undated = overlaps.filter((o) => o.depth === null).map((o) => o.file);

  const ok =
    screenDrew &&
    missing.length === 0 &&
    forbidden.length === 0 &&
    undecoded.length === 0 &&
    tooDeep.length === 0 &&
    undated.length === 0;
  if (!ok) failures += 1;

  report.push({
    overlaps,
    tooDeep,
    // Recorded, not merely consulted: a reader of the JSON can now tell a beat
    // that was correctly silent from one whose screen never arrived, which is
    // the distinction the row could not previously express at all.
    screenDrew,
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
  const heard = !screenDrew
    ? `THE SCREEN NEVER DREW — ${beat.screen} was not visible within ${COLD_LOAD_TIMEOUT_MS}ms, so this beat measured nothing`
    : played.length === 0
      ? 'silence'
      : played.map((p) => `${p.file}@${p.atMs}ms`).join(' ');
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

// ###########################################################################
// ###  2. THE PLAYED ARM — a meet opened with a mouse, listened to           #
// ###########################################################################
//
// ===========================================================================
// NOTHING BELOW THIS LINE TYPES A URL, AND THAT IS THE WHOLE OF THE POINT
// ===========================================================================
// `frozenMeetFor` returns a frame only when `route.source === 'debug'`, so every
// beat above ran on `previewMeetPort()`'s scripted lifter and everything below
// runs on `appMeetPort()` — the app's own connection, the same object the daily
// loop trains on. CLAUDE.md calls those different subjects, and until this
// section existed this file's own `scopeLimits` said in as many words that no
// cue in its record had ever been heard on a meet a player opened.
//
// WHAT IS CLAIMED HERE IS THE WALK-OUT AND NOTHING ELSE. The verdict a driven
// meet produces is whatever the robot's timing earns, so a must/must-not list
// for `meet-verdict` is not statable on this arm; those cues are RECORDED below
// and not graded. The walk-out is different: every attempt has one, its cue
// depends only on `isUrgentAttempt`, and the line on screen says which branch
// that took.
const PLAYED = {
  reachedMeet: false,
  drive: null,
  walkoutsDriverSaw: [],
  beats: [],
  played: [],
  decoded: [],
  rejected: [],
};

/** The eyebrows of walk-outs the DRIVER watched begin and end, in order. */
const walkoutsEndedCalm = new Set();
const walkoutsEndedUrgent = new Set();
/** Which rule a line matches, or null for a line this tool does not know. */
const ruleForLine = (line) =>
  PLAYED_WALKOUT_CUES.find((r) => (line ?? '').includes(r.line)) ?? null;

await page.goto(url, { waitUntil: 'load' });
let openedOnSession = true;
try {
  // The same cold-start deadline every beat in section 1 waits on. A first load
  // has to bundle before it can draw anything.
  await page.getByTestId('session-screen').waitFor({ state: 'visible', timeout: COLD_LOAD_TIMEOUT_MS });
} catch {
  openedOnSession = false;
}
// The shell's pill fades in; pressing it before it is drawn presses nothing.
// `waitUntilDrawn` is `meetDrive.mjs`'s, so this waits the way the meet driver's
// own three presses wait rather than on a settle somebody liked.
const entryDrawn = openedOnSession
  ? await waitUntilDrawn(page, 'shell-open-meet', MEET_DRIVE.BEAT_TIMEOUT_MS)
  : { drawn: false, why: 'the app never drew the daily session' };
if (entryDrawn.drawn) {
  // `MEET_DRIVE.BEAT_TIMEOUT_MS` for both, so this section introduces no
  // deadline of its own: the driver's own three presses use the same one, and a
  // second number here would be a second answer to "the app has stopped
  // advancing". It is a robot's patience, not game feel — see `MEET_DRIVE`.
  await page
    .getByTestId('shell-open-meet')
    .click({ timeout: MEET_DRIVE.BEAT_TIMEOUT_MS })
    .catch(() => {});
  try {
    await page
      .getByTestId('meet-screen')
      .waitFor({ state: 'visible', timeout: MEET_DRIVE.BEAT_TIMEOUT_MS });
    PLAYED.reachedMeet = true;
  } catch {
    PLAYED.reachedMeet = false;
  }
}

if (PLAYED.reachedMeet) {
  PLAYED.drive = await driveMeetToItsEnd(page, {
    search: freshDepthSearch(),
    // No recap deadline is derived here because this section never intends to
    // reach one: `shouldStop` leaves as soon as both arms of the walk-out branch
    // have been heard. `driveMeetToItsEnd` reports that as `'stopped'`, which is
    // not one of the four endings the app can produce.
    recapSettleMs: null,
    onWalkoutEnded: (state) => {
      const rule = ruleForLine(state.walkoutLine);
      PLAYED.walkoutsDriverSaw.push({
        eyebrow: state.walkoutEyebrow,
        line: state.walkoutLine,
        urgent: rule === null ? null : rule.urgent,
      });
      if (rule === null || state.walkoutEyebrow === null) return;
      (rule.urgent ? walkoutsEndedUrgent : walkoutsEndedCalm).add(state.walkoutEyebrow);
    },
    // BOTH ARMS, THEN LEAVE. One calm walk-out makes `mustNot: crowd-swell-big`
    // non-vacuous; one urgent one makes `mustNot: crowd-swell` non-vacuous.
    // Neither alone does, which is why the condition is a conjunction and not a
    // count of walk-outs.
    shouldStop: () => walkoutsEndedCalm.size > 0 && walkoutsEndedUrgent.size > 0,
  });
}

const probe = await readTheProbe(page);
PLAYED.played = probe.played;
PLAYED.decoded = probe.decoded;
PLAYED.rejected = probe.rejected;

/**
 * WHICH CUES BELONGED TO WHICH WALK-OUT, off the probe's own per-play tag.
 *
 * A play is a walk-out's if `meet-walkout` was in the DOM at the instant
 * `play()` ran — read there, not polled — and the eyebrow it carries names WHICH
 * walk-out. The nine eyebrows of a meet are distinct, so it is a key.
 */
const playedOnWalkout = PLAYED.played.filter((p) => p.screens.includes('meet-walkout'));
const playedElsewhere = PLAYED.played.filter((p) => !p.screens.includes('meet-walkout'));
const byWalkout = new Map();
for (const p of playedOnWalkout) {
  const key = p.walkoutAttempt ?? '(no eyebrow on screen)';
  if (!byWalkout.has(key)) byWalkout.set(key, []);
  byWalkout.get(key).push(p);
}

if (!PLAYED.reachedMeet) {
  check(
    false,
    'SKIPPED: the played arm needs a meet opened with a mouse, and the shell’s own way in was never pressed',
    `session-screen drawn: ${openedOnSession}; shell-open-meet: ${entryDrawn.why}`,
  );
} else if (byWalkout.size === 0) {
  check(
    false,
    'SKIPPED: the played meet was opened but no cue was heard on a walk-out, so nothing on this arm was measured',
    `drive ended '${PLAYED.drive?.ended}' after ${PLAYED.drive?.attempts.length} attempt(s) — ${PLAYED.drive?.why}; ` +
      `${PLAYED.played.length} play(s) heard, none with meet-walkout in the DOM`,
  );
} else {
  for (const [eyebrow, plays] of byWalkout) {
    const line = plays.find((p) => p.walkoutLine !== null)?.walkoutLine ?? null;
    const rule = ruleForLine(line);
    const files = new Set(plays.map((p) => p.file));
    const missing = rule === null ? [] : rule.must.filter((f) => !files.has(f));
    const forbidden = rule === null ? [] : rule.mustNot.filter((f) => files.has(f));
    const undecoded = PLAYED.decoded
      .filter((d) => files.has(d.file) && d.durationSec === null)
      .map((d) => d.file);
    const overlaps = overlapsIn(plays, PLAYED.decoded);
    const tooDeep = overlaps.filter((o) => o.depth !== null && o.depth > voicesPerCue);
    const undated = overlaps.filter((o) => o.depth === null).map((o) => o.file);
    // EVERY CUE ON THIS BEAT SOUNDED WITH AN EMPTY QUERY STRING, read inside
    // `play()`. CLAUDE.md asks for the address bar to be asserted at the moment
    // the screen is read so a fallback to a debug URL cannot pass as the played
    // arm; this is that, one step stronger — at the moment of the SOUND.
    const typedInTheBar = plays.filter((p) => p.search !== '');
    const ok =
      rule !== null &&
      missing.length === 0 &&
      forbidden.length === 0 &&
      undecoded.length === 0 &&
      tooDeep.length === 0 &&
      undated.length === 0 &&
      typedInTheBar.length === 0;

    PLAYED.beats.push({
      eyebrow,
      line,
      urgent: rule === null ? null : rule.urgent,
      expected: rule === null ? null : [...rule.must],
      forbidden: rule === null ? null : [...rule.mustNot],
      plays,
      overlaps,
      tooDeep,
      missing,
      unexpectedlyPlayed: forbidden,
      undecoded,
      queryStrings: [...new Set(plays.map((p) => p.search))],
      ok,
    });

    const heard = plays.map((p) => `${p.file}@${p.atMs}ms`).join(' ');
    const depths = overlaps
      .filter((o) => o.plays > 1)
      .map((o) => `${o.file} x${o.plays} depth ${o.depth ?? '?'}`)
      .join(', ');
    check(
      ok,
      `PLAYED ARM — ${eyebrow} (${rule === null ? 'UNKNOWN LINE' : rule.urgent ? 'urgent' : 'calm'}): the walk-out’s cues, on a meet opened with a mouse`,
      `line ${JSON.stringify(line)}; ${plays.length} play(s): ${heard}` +
        `${depths === '' ? '' : `; retriggers: ${depths}`}` +
        `${rule === null ? '; THE LINE ON SCREEN MATCHES NONE OF PLAYED_WALKOUT_CUES' : ''}` +
        `${missing.length > 0 ? `; MISSING: ${missing.join(', ')}` : ''}` +
        `${forbidden.length > 0 ? `; SHOULD NOT HAVE PLAYED: ${forbidden.join(', ')}` : ''}` +
        `${undecoded.length > 0 ? `; NEVER DECODED: ${undecoded.join(', ')}` : ''}` +
        `${undated.length > 0 ? `; UNDATABLE: ${undated.join(', ')}` : ''}` +
        `${tooDeep.length > 0 ? `; PAST THE POOL OF ${voicesPerCue}: ${JSON.stringify(tooDeep)}` : ''}` +
        `${typedInTheBar.length > 0 ? `; HEARD AT A QUERY STRING: ${JSON.stringify([...new Set(typedInTheBar.map((p) => p.search))])}` : ''}`,
    );
  }

  // -------------------------------------------------------------------------
  // The played arm's own non-vacuity, as counts
  // -------------------------------------------------------------------------

  /**
   * BOTH ARMS OF THE URGENCY BRANCH, WHICH IS WHAT MAKES THE TWO `mustNot`
   * LISTS BITE. On a run with only calm walk-outs "crowd-swell-big never
   * played" is true of a build that has deleted the big swell entirely; on a
   * run with only urgent ones "crowd-swell never played" is true of a build
   * that has deleted the small one. Counts rather than a bound, so a run whose
   * domain quietly shrinks says so instead of printing a column of ok.
   */
  const calmBeats = PLAYED.beats.filter((b) => b.urgent === false);
  const urgentBeats = PLAYED.beats.filter((b) => b.urgent === true);
  check(
    calmBeats.length > 0 && urgentBeats.length > 0,
    'NON-VACUITY: both arms of the walk-out’s urgency branch were heard on the played arm',
    `${calmBeats.length} calm (${calmBeats.map((b) => b.eyebrow).join(', ') || 'none'}) and ` +
      `${urgentBeats.length} urgent (${urgentBeats.map((b) => b.eyebrow).join(', ') || 'none'}) ` +
      `of ${PLAYED.beats.length} walk-out(s) measured`,
  );

  /**
   * THE PER-PLAY SCREEN TAG DISCRIMINATES, rather than answering `meet-walkout`
   * to everything. A tag that had stopped working — a renamed testID, a probe
   * reading a stale document — would file every cue in the meet under the
   * walk-out and every check above would still pass. The verdict's lamps are the
   * control: they are cues this run definitely produced on a DIFFERENT screen,
   * so a run in which nothing was filed anywhere else is a broken instrument.
   */
  const screensSeen = new Set(PLAYED.played.flatMap((p) => p.screens));
  check(
    playedElsewhere.length > 0,
    'NON-VACUITY: the probe’s per-play screen tag is a reading, not a constant — cues were filed on other screens too',
    `${playedOnWalkout.length} play(s) on meet-walkout, ${playedElsewhere.length} elsewhere ` +
      `(${[...new Set(playedElsewhere.map((p) => `${p.file}:${p.screens.join('+') || 'nothing'}`))].join(', ')}); ` +
      `screens seen at play time: ${[...screensSeen].join(', ')}`,
  );

  /**
   * EVERY WALK-OUT THE DRIVER WATCHED END HAS CUES IN THE RECORD.
   *
   * Two instruments, and this is where they are made to agree: the driver saw
   * the beats by polling `readMeetLoop`, the probe filed the cues from inside
   * `play()`. A beat the driver watched and the probe heard nothing on is a
   * silent walk-out, which is the failure this whole tool exists for.
   *
   * THEY SHARE ONE BLIND SPOT AND IT IS NAMED RATHER THAN LEFT: both read
   * `walkout-attempt` out of the DOM, so a walk-out that draws no eyebrow at all
   * is invisible to both. That is why a null eyebrow is a FAILURE here instead
   * of being skipped as unmatched.
   */
  const driverEyebrows = PLAYED.walkoutsDriverSaw.map((w) => w.eyebrow);
  const nameless = driverEyebrows.filter((e) => e === null).length;
  const heardNothing = driverEyebrows.filter((e) => e !== null && !byWalkout.has(e));
  check(
    nameless === 0 && heardNothing.length === 0,
    'CONTROL: every walk-out the DRIVER watched end has cues filed against it by the PROBE',
    `driver saw ${driverEyebrows.length} walk-out(s) [${driverEyebrows.map((e) => JSON.stringify(e)).join(', ')}]; ` +
      `probe filed cues on ${byWalkout.size} [${[...byWalkout.keys()].map((e) => JSON.stringify(e)).join(', ')}]` +
      `${nameless > 0 ? `; ${nameless} walk-out(s) drew NO eyebrow, which both instruments are blind to` : ''}` +
      `${heardNothing.length > 0 ? `; SILENT: ${heardNothing.map((e) => JSON.stringify(e)).join(', ')}` : ''}`,
  );

  /**
   * AND THE DEPTH MEASUREMENT HAD A SUBJECT ON THIS ARM TOO. The played arm is
   * where the main thread is genuinely busy — a real screen transition rather
   * than a page load that has already settled — so its retrigger count is the
   * one worth reporting beside `VOICES_PER_CUE`.
   */
  const playedOverlaps = PLAYED.beats.flatMap((b) => b.overlaps);
  const playedRetriggering = playedOverlaps.filter((o) => o.plays > 1);
  const playedStacking = playedOverlaps.filter((o) => o.depth !== null && o.depth > 1);
  const playedDeepest = playedOverlaps.reduce((worst, o) => Math.max(worst, o.depth ?? 0), 0);
  check(
    playedRetriggering.length > 0,
    'NON-VACUITY: a cue fired more than once on the played arm, so its depth check had a subject',
    `${playedRetriggering.length} cue/beat pair(s) retriggered: ${playedRetriggering
      .map((o) => `${o.file} x${o.plays}`)
      .join(', ')}; ${playedStacking.length} pair(s) stacked; deepest ${playedDeepest} against a pool of ${voicesPerCue}`,
  );
  PLAYED.totals = {
    walkoutsMeasured: PLAYED.beats.length,
    calmWalkouts: calmBeats.length,
    urgentWalkouts: urgentBeats.length,
    playsOnWalkout: playedOnWalkout.length,
    playsElsewhere: playedElsewhere.length,
    retriggeringPairs: playedRetriggering.length,
    stackingPairs: playedStacking.length,
    deepest: playedDeepest,
  };
}

/**
 * WHAT IS STILL NOT MEASURED, DECLARED RATHER THAN IMPLIED ABSENT.
 *
 * The first entry here used to say that NO cue in this record had ever been
 * heard on a meet a player opened. Section 2 above is what deleted it. What
 * replaces it is smaller and is not nothing: the played arm claims the walk-out
 * and only the walk-out, and the reason is in section 2's banner.
 *
 * These are NOTES, not red checks, because they describe claims this tool does
 * not attempt. A claim it DOES attempt and fails to reach is a `check(false,
 * 'SKIPPED: …')` instead — see the two above.
 */
const scopeLimits = [
  'NOT MEASURED ON THE PLAYED ARM: the verdict, deliberation and bomb-out beats. A driven meet gives ' +
    'whichever verdicts the robot’s timing earns, so a must/must-not list for those is only statable on a ' +
    'scripted `?meet=` frame — which is what section 1 is. Their cues ARE recorded on the played arm under ' +
    '`playedArm.playsElsewhere` and are not graded there.',
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
      playedArm: {
        reachedMeet: PLAYED.reachedMeet,
        entry: entryDrawn,
        drive:
          PLAYED.drive === null
            ? null
            : {
                ended: PLAYED.drive.ended,
                why: PLAYED.drive.why,
                ms: PLAYED.drive.ms,
                attempts: PLAYED.drive.attempts,
                holdMs: PLAYED.drive.search?.holdMs ?? null,
              },
        walkoutsDriverSaw: PLAYED.walkoutsDriverSaw,
        walkouts: PLAYED.beats,
        playsElsewhere: PLAYED.played.filter((p) => !p.screens.includes('meet-walkout')),
        decoded: PLAYED.decoded,
        rejected: PLAYED.rejected,
        totals: PLAYED.totals ?? null,
      },
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
  `\n${checks.length} checks, ${reds().length} failed. ${totalPlays} cue play(s) across ${report.length} debug beat(s); ` +
    `${failures} beat(s) wrong; deepest stack ${deepest} against a pool of ${voicesPerCue}`,
);
console.log(
  PLAYED.totals === undefined
    ? 'PLAYED ARM: no walk-out measured — see the SKIPPED check above'
    : `PLAYED ARM: ${PLAYED.totals.walkoutsMeasured} walk-out(s) on a meet opened with a mouse ` +
      `(${PLAYED.totals.calmWalkouts} calm, ${PLAYED.totals.urgentWalkouts} urgent), ` +
      `${PLAYED.totals.playsOnWalkout} cue play(s) on them and ${PLAYED.totals.playsElsewhere} elsewhere; ` +
      `deepest stack ${PLAYED.totals.deepest} against a pool of ${voicesPerCue}; ` +
      `drive ended '${PLAYED.drive?.ended}' after ${PLAYED.drive?.attempts.length} attempt(s) in ${PLAYED.drive?.ms}ms`,
);
console.log(`wrote ${path.join(outDir, 'sound.json')}`);
process.exit(reds().length === 0 ? 0 : 1);
