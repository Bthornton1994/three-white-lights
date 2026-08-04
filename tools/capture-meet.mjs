#!/usr/bin/env node
/**
 * Photographs meet day, beat by beat.
 *
 * WHY A DEBUG ROUTE RATHER THAN POINTER EVENTS. The same reason
 * `capture-session.mjs` and `capture-lift.mjs` exist, only more so: a third
 * attempt is nine attempts and a dozen timing inputs past the weigh-in, a limit
 * attempt is won inside a band of a few ticks, and a headless browser on a
 * loaded machine cannot land a press inside a band that narrow. Driving meet day
 * with clicks to reach its bomb-out beat photographs a meet that bombed the
 * squat by accident.
 *
 * So the MEET is scripted through `?meet=<moment>` (see
 * `src/game/meetPreview.ts`), which drives the same `stepMeetDay` the played
 * loop runs on, plays its reps through the real `runLift`, and hands the result
 * to the same components. No mock, no second renderer.
 *
 * THE PREVIEW IS FROZEN, so a beat holds still to be photographed:
 * `useMeetDay(preview, frozen)` stops the walkout, deliberation and verdict
 * timers. Without it a 1.5 s walkout would have advanced to the rep before the
 * shutter, which is how a run of "different" screenshots becomes three copies of
 * one screen.
 *
 * `--live` additionally drives the real loop with pointer events — confirm the
 * weigh-in, confirm the openers — and photographs the walkout it reaches. That
 * one proves the touch path is wired; the scripted ones prove what each screen
 * looks like.
 *
 * Usage:
 *   node tools/capture-meet.mjs [--url URL] [--out DIR] [--live]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/meet'));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));
// Long enough for the SLOWEST screen to finish assembling. The bomb-out beat
// is the one that decides it: BOMB_OUT_SILENCE_MS (1500) + three rows at
// BOMB_OUT_ROW_STAGGER_MS (700) + BOMB_OUT_ROW_FADE_MS (620) = 4220 ms, and a
// shorter settle photographs it with its last line — the way out — missing.
const settleMs = Number(flag('settle', '5200'));

/**
 * The beats, in loop order. Restated here rather than imported from the
 * TypeScript module on purpose: this tool is a second, independent statement of
 * what the sequence contains, and a capture that silently agreed with a broken
 * module would be worth nothing.
 */
const MOMENTS = [
  'weigh-in',
  'openers',
  'walkout',
  'walkout-third',
  'lift',
  'deliberation',
  'verdict-good',
  'verdict-split',
  'verdict-no-lift',
  'verdict-split-red',
  'select-after-make',
  'select-after-miss',
  'bombed',
  'recap',
  'recap-card',
];

/**
 * Which testID each beat MUST be showing. A hash comparison already let a
 * sequence of three identical frames through once elsewhere in this project; a
 * phase comparison would not have.
 */
const MOMENT_SCREEN = {
  'weigh-in': 'meet-weigh-in',
  openers: 'meet-openers',
  walkout: 'meet-walkout',
  'walkout-third': 'meet-walkout',
  lift: 'meet-attempt',
  deliberation: 'meet-deliberation',
  'verdict-good': 'meet-verdict',
  'verdict-split': 'meet-verdict',
  'verdict-no-lift': 'meet-verdict',
  'verdict-split-red': 'meet-verdict',
  'select-after-make': 'meet-attempt-select',
  'select-after-miss': 'meet-attempt-select',
  bombed: 'meet-bombed',
  recap: 'meet-recap',
  'recap-card': 'result-card-screen',
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const notes = [];
let wrong = 0;

for (const moment of MOMENTS) {
  await page.goto(`${url}?meet=${moment}`, { waitUntil: 'load' });
  const expected = MOMENT_SCREEN[moment];
  let showed = true;
  try {
    await page.getByTestId(expected).waitFor({ state: 'visible', timeout: 120000 });
  } catch {
    showed = false;
  }
  await page.waitForTimeout(settleMs);
  const file = path.join(outDir, `${moment}.png`);
  await page.screenshot({ path: file });

  // What the frame ACTUALLY shows, read off the DOM rather than assumed, so a
  // sequence of shots can be checked as semantically distinct instead of just
  // byte-distinct.
  const seen = await page.evaluate(() => {
    const text = (id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      return node === null ? null : node.textContent;
    };
    const present = (id) => document.querySelector(`[data-testid="${id}"]`) !== null;
    return {
      screens: [
        'meet-weigh-in',
        'meet-openers',
        'meet-attempt-select',
        'meet-walkout',
        'meet-attempt',
        'meet-deliberation',
        'meet-verdict',
        'meet-bombed',
        'meet-recap',
        'result-card-screen',
      ].filter(present),
      walkoutAttempt: text('walkout-attempt'),
      walkoutWeight: text('walkout-weight'),
      walkoutLine: text('walkout-line'),
      selectTitle: text('attempt-select-title'),
      selectBanked: text('attempt-select-banked'),
      floorWeight: text('attempt-select-floor-weight'),
      floorText: text('attempt-select-floor-text'),
      optionSmall: text('attempt-option-weight-small'),
      optionBig: text('attempt-option-weight-big'),
      optionRepeat: text('attempt-option-weight-repeat'),
      bombWarning: text('attempt-select-bomb-warning'),
      verdictCall: text('verdict-call'),
      verdictDeliberating: text('verdict-deliberating'),
      verdictLightsText: text('verdict-lights-text'),
      verdictFeedback: text('verdict-feedback'),
      bombCall: text('bomb-out-call'),
      bombKept: text('bomb-out-kept'),
      recapTotal: text('recap-total'),
      recapPr: text('recap-pr'),
      recapDots: text('recap-dots'),
      recapPlace: text('recap-place'),
      bodyText: (document.body.textContent ?? '').slice(0, 3000),
    };
  });

  const rightScreen = showed && seen.screens.includes(expected);
  if (!rightScreen) wrong += 1;
  notes.push({ moment, file: path.basename(file), expected, rightScreen, seen });
  console.log(`${moment.padEnd(20)} -> ${path.basename(file)}  ${rightScreen ? 'ok' : `!! EXPECTED ${expected}, SAW ${seen.screens.join(',') || 'nothing'}`}`);
}

// Every scripted beat must be a DIFFERENT screen's worth of text. Three copies
// of one frame is the failure this check exists for.
const fingerprints = notes.map((n) => JSON.stringify({ ...n.seen, bodyText: n.seen.bodyText }));
const duplicates = fingerprints.length - new Set(fingerprints).size;

let liveNote = null;
if (has('live')) {
  // THE PLAYED PATH, with the beat timers running. `?meet=live` mounts the same
  // screens with no preview state, so this shows that the walkout, deliberation
  // and verdict beats actually ELAPSE rather than merely having durations — the
  // one thing a frozen capture cannot show.
  await page.goto(`${url}?meet=live`, { waitUntil: 'load' });
  await page.getByTestId('meet-weigh-in').waitFor({ state: 'visible', timeout: 120000 });
  const started = Date.now();
  await page.getByTestId('weigh-in-action').click();
  await page.getByTestId('meet-openers').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'live-openers.png') });

  // Move an opener, so the override path is exercised rather than asserted.
  const before = await page.getByTestId('opener-weight-squat').textContent();
  await page.getByTestId('opener-up-squat').click();
  const after = await page.getByTestId('opener-weight-squat').textContent();

  await page.getByTestId('openers-action').click();
  await page.getByTestId('meet-walkout').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, 'live-walkout.png') });
  const walkoutSeenAt = Date.now();

  // ...and wait for the walkout beat to hand over to the rep ON ITS OWN.
  await page.getByTestId('meet-attempt').waitFor({ state: 'visible', timeout: 20000 });
  const walkoutHeldMs = Date.now() - walkoutSeenAt;
  await page.screenshot({ path: path.join(outDir, 'live-attempt.png') });

  liveNote = {
    moment: 'live',
    msFromWeighInToWalkout: walkoutSeenAt - started,
    walkoutHeldMs,
    openerBefore: before,
    openerAfter: after,
    openerOverrideTook: before !== after,
  };
  notes.push({ moment: 'live', file: 'live-walkout.png', expected: 'meet-walkout', rightScreen: true, seen: liveNote });
  console.log(`live                 -> live-openers.png / live-walkout.png / live-attempt.png ${JSON.stringify(liveNote)}`);
}

await writeFile(path.join(outDir, 'frames.json'), `${JSON.stringify(notes, null, 2)}\n`);
if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log('  ', e);
}
await browser.close();
console.log(`\nwrote ${notes.length} frames to ${outDir}`);
console.log(`${wrong} frame(s) showed the wrong screen; ${duplicates} duplicate frame(s)`);
process.exit(wrong === 0 && duplicates === 0 ? 0 : 1);
