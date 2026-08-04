#!/usr/bin/env node
/**
 * Photographs the daily session loop, beat by beat.
 *
 * WHY A DEBUG ROUTE RATHER THAN POINTER EVENTS. The same reason
 * `capture-lift.mjs` exists: a session's close-out is four work sets and a
 * dozen timing inputs past app launch, and a headless browser on a loaded
 * machine cannot land a press inside the mechanic's window. Driving the loop
 * with clicks to reach its last screen photographs a session that died in the
 * first descent.
 *
 * So the SESSION is scripted through `?session=<moment>` (see
 * `src/session/sessionPreview.ts`), which drives the same `stepSession` the
 * played loop runs on and hands the result to the same components. No mock, no
 * second renderer.
 *
 * `--live` additionally drives the real loop with pointer events — three
 * check-in taps and an RPE choice — and photographs the set screen it reaches.
 * That one proves the touch path is wired; the scripted ones prove what each
 * screen looks like.
 *
 * THE DRIVING ITSELF LIVES IN `tools/sessionDrive.mjs`, shared with
 * `verify-shell-route.mjs`, which carries the same played session all the way
 * to the close-out and one press past it. It used to be hand-rolled here; two
 * copies of a mouse-driven mechanic would drift, and the one that drifted would
 * be the one nobody ran.
 *
 * Usage:
 *   node tools/capture-session.mjs [--url URL] [--out DIR] [--live]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { openSessionToFirstSet, playOneRep } from './sessionDrive.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/session'));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));
const settleMs = Number(flag('settle', '1200'));

/**
 * The beats, in loop order. Restated here rather than imported from the
 * TypeScript module on purpose: this tool is a second, independent statement of
 * what the sequence contains, and a capture that silently agreed with a broken
 * module would be worth nothing.
 */
const MOMENTS = [
  'check-in',
  'check-in-partial',
  'briefing',
  'set',
  'rest',
  'close-out-pr',
  'close-out-held',
  'close-out-empty',
  'close-out-saving',
  'close-out-server-wins',
  'close-out-unsynced',
  'close-out-accessory',
];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const notes = [];

for (const moment of MOMENTS) {
  await page.goto(`${url}?session=${moment}`, { waitUntil: 'load' });
  await page.getByTestId('session-screen').waitFor({ state: 'visible', timeout: 120000 });
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
    return {
      checkIn: document.querySelector('[data-testid="session-check-in"]') !== null,
      briefing: document.querySelector('[data-testid="session-briefing"]') !== null,
      set: document.querySelector('[data-testid="session-set"]') !== null,
      rest: document.querySelector('[data-testid="session-rest"]') !== null,
      closeOut: document.querySelector('[data-testid="session-close-out"]') !== null,
      modifier: text('session-modifier'),
      setLabel: text('session-set-label'),
      weight: text('session-weight'),
      nextSet: text('session-next-set'),
      headline: text('close-out-headline'),
      e1rm: text('close-out-e1rm'),
      // How sure the screen says each number is. Empty when confirmed.
      e1rmTag: (text('close-out-e1rm-tag') ?? '').trim(),
      streakTag: (text('close-out-streak-tag') ?? '').trim(),
      trainingIq: text('close-out-training-iq'),
      streak: text('close-out-streak'),
      reps: text('close-out-reps'),
      feedback: text('close-out-feedback'),
      action: text('close-out-action'),
      bodyText: (document.body.textContent ?? '').slice(0, 4000),
    };
  });
  notes.push({ moment, file: path.basename(file), seen });
  console.log(`${moment.padEnd(18)} -> ${path.basename(file)}`);
  const flat = JSON.stringify(seen);
  if (/\btotal\b/i.test(flat)) {
    console.log(`  !! FRAME MENTIONS A TOTAL (GDD §3.2 forbids it): ${moment}`);
  }
}

if (has('live')) {
  // The played path: three taps, an RPE choice, and whatever the loop does.
  const opened = await openSessionToFirstSet(page, url);
  if (!opened.reached) {
    console.log(`live               -> NOT REACHED: ${opened.why}`);
    notes.push({ moment: 'live', file: null, seen: null, why: opened.why });
  } else {
    await page.screenshot({ path: path.join(outDir, 'live-set.png') });

    // One real rep, driven by holding the stage. The timing is not expected to
    // be good — what this checks is that the touch path reaches the mechanic.
    const rep = await playOneRep(page);
    await page.screenshot({ path: path.join(outDir, 'live-rep.png') });
    const live = await page.evaluate(() => {
      const text = (id) => {
        const node = document.querySelector(`[data-testid="${id}"]`);
        return node === null ? null : node.textContent;
      };
      return { prompt: text('session-prompt'), detail: text('session-detail'), weight: text('session-weight'), setLabel: text('session-set-label') };
    });
    notes.push({
      moment: 'live',
      file: 'live-set.png',
      seen: live,
      msFromFirstTapToSet: opened.msFromFirstTapToSet,
      rep,
    });
    console.log('live               -> live-set.png / live-rep.png', JSON.stringify(live));
  }
}

await writeFile(path.join(outDir, 'frames.json'), `${JSON.stringify(notes, null, 2)}\n`);
if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log('  ', e);
}
await browser.close();
console.log(`wrote ${notes.length} frames to ${outDir}`);
