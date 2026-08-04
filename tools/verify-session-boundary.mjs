#!/usr/bin/env node
/**
 * Checks, in a browser, that the close-out renders the PROGRESSION BOUNDARY and
 * not the client's own arithmetic.
 *
 * WHY THIS EXISTS RATHER THAN A UNIT TEST. The defect this guards against was
 * never a wrong number: every pure module was correct and the whole suite was
 * green while `progression.ts`'s read accessors had zero callers and the screen
 * showed figures the client had computed. The only check that could have seen it
 * is one that looks at what is actually on the screen. This project has no DOM
 * test runner (`vitest.config.ts` is `environment: node`), so that check is here,
 * against the built app, the same way `verify-lift-shots.mjs` is.
 *
 * WHAT IT ASSERTS, and why each one can fail:
 *
 *   1. A CONFIRMED number carries no caption.
 *   2. An IN-FLIGHT number is captioned SAVING and is drawn dimmer. Both halves,
 *      because a caption with no dimming is a label and dimming with no caption
 *      is a mystery.
 *   3. THE SERVER WINS. `close-out-saving` shows the client's projection;
 *      `close-out-pr` shows the server agreeing with it; `close-out-server-wins`
 *      shows a server answer the client did not predict. The first two must be
 *      the same number and the third must be a different one. If the screen were
 *      rendering `closeOut.newBestE1rmKg` again, all three would read the same
 *      and this fails.
 *   4. A STALE number is captioned NOT SYNCED and shows the last confirmed truth.
 *   5. ACCESSORY DAY has no e1RM node at all — not a zero, not the previous best.
 *
 * The expected captions are written out here rather than imported, on the same
 * principle as `capture-session.mjs`'s moment list: a check that reads its
 * expectations out of the module under test agrees with a broken module.
 *
 * Usage:
 *   node tools/verify-session-boundary.mjs [--url URL] [--settle MS]
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const settleMs = Number(flag('settle', '1600'));

const PROJECTED_TAG = 'SAVING';
const STALE_TAG = 'NOT SYNCED';
const UNKNOWN_VALUE = '—';

const failures = [];
const notes = [];
const check = (ok, what, detail) => {
  if (ok) {
    notes.push(`  ok    ${what}${detail === undefined ? '' : ` — ${detail}`}`);
  } else {
    failures.push(`${what}${detail === undefined ? '' : ` — ${detail}`}`);
    notes.push(`  FAIL  ${what}${detail === undefined ? '' : ` — ${detail}`}`);
  }
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));

async function readMoment(moment) {
  await page.goto(`${url}?session=${moment}`, { waitUntil: 'load' });
  await page.getByTestId('session-close-out').waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(settleMs);
  return page.evaluate(() => {
    const node = (id) => document.querySelector(`[data-testid="${id}"]`);
    const text = (id) => {
      const n = node(id);
      return n === null ? null : (n.textContent ?? '').trim();
    };
    // Effective opacity: every ancestor multiplies in, so a dimmed number cannot
    // be faked by a wrapper that is itself faded.
    const opacityOf = (id) => {
      let n = node(id);
      if (n === null) return null;
      let o = 1;
      while (n !== null && n !== document.body) {
        const v = Number(getComputedStyle(n).opacity);
        if (Number.isFinite(v)) o *= v;
        n = n.parentElement;
      }
      return Number(o.toFixed(3));
    };
    const colourOf = (id) => {
      const n = node(id);
      return n === null ? null : getComputedStyle(n).color;
    };
    return {
      headline: text('close-out-headline'),
      headlineColour: colourOf('close-out-headline'),
      e1rm: text('close-out-e1rm'),
      e1rmColour: colourOf('close-out-e1rm'),
      e1rmTag: text('close-out-e1rm-tag'),
      e1rmOpacity: opacityOf('close-out-e1rm'),
      streak: text('close-out-streak'),
      streakTag: text('close-out-streak-tag'),
      streakOpacity: opacityOf('close-out-streak'),
      trainingIq: text('close-out-training-iq'),
      accessoryNote: text('close-out-accessory-note'),
      hasE1rmNode: node('close-out-e1rm') !== null,
      body: (document.body.textContent ?? '').slice(0, 2000),
    };
  });
}

const pr = await readMoment('close-out-pr');
const saving = await readMoment('close-out-saving');
const serverWins = await readMoment('close-out-server-wins');
const unsynced = await readMoment('close-out-unsynced');
const accessory = await readMoment('close-out-accessory');

console.log('read off the running app:');
for (const [name, seen] of [
  ['close-out-pr', pr],
  ['close-out-saving', saving],
  ['close-out-server-wins', serverWins],
  ['close-out-unsynced', unsynced],
  ['close-out-accessory', accessory],
]) {
  console.log(`  ${name.padEnd(24)} ${JSON.stringify({
    headline: seen.headline,
    e1rm: seen.e1rm,
    e1rmTag: seen.e1rmTag,
    e1rmOpacity: seen.e1rmOpacity,
    streak: seen.streak,
    streakTag: seen.streakTag,
    trainingIq: seen.trainingIq,
  })}`);
}
console.log('');

// 1. confirmed
check(pr.e1rmTag === '', 'a confirmed e1RM carries no caption', JSON.stringify(pr.e1rmTag));
check(pr.streakTag === '', 'a confirmed streak carries no caption', JSON.stringify(pr.streakTag));
check(pr.e1rmOpacity > 0.95, 'a confirmed e1RM is drawn at full weight', `${pr.e1rmOpacity}`);

// 2. projected
check(saving.e1rmTag === PROJECTED_TAG, `an in-flight e1RM is captioned ${PROJECTED_TAG}`, JSON.stringify(saving.e1rmTag));
check(saving.streakTag === PROJECTED_TAG, `an in-flight streak is captioned ${PROJECTED_TAG}`, JSON.stringify(saving.streakTag));
check(
  saving.e1rmOpacity < pr.e1rmOpacity,
  'an in-flight e1RM is drawn dimmer than a confirmed one',
  `${saving.e1rmOpacity} < ${pr.e1rmOpacity}`,
);
check(
  saving.streakOpacity < pr.streakOpacity,
  'an in-flight streak is drawn dimmer than a confirmed one',
  `${saving.streakOpacity} < ${pr.streakOpacity}`,
);

// 3. the server wins
check(
  saving.e1rm === pr.e1rm,
  'the client projection and the agreeing server answer are the same number',
  `${saving.e1rm} === ${pr.e1rm}`,
);
check(
  serverWins.e1rm !== saving.e1rm,
  'THE SERVER WINS: an answer the client did not predict is what is on screen',
  `server ${serverWins.e1rm} !== client ${saving.e1rm}`,
);
check(
  Number(serverWins.e1rm) < Number(saving.e1rm),
  'and it is the server answer, in the direction the scripted server sent',
  `${serverWins.e1rm} < ${saving.e1rm}`,
);
check(
  serverWins.e1rmTag === '',
  'the corrected number is confirmed, not still provisional',
  JSON.stringify(serverWins.e1rmTag),
);
// The PR call follows the record too: the scripted answer is under the previous
// best, so the gold has to go. Colours compared to each other rather than to a
// literal, so a palette change does not silently pass this.
check(
  saving.e1rmColour === pr.e1rmColour,
  'the projected PR and the confirmed PR are drawn in the same colour',
  `${saving.e1rmColour} === ${pr.e1rmColour}`,
);
check(
  serverWins.e1rmColour !== pr.e1rmColour,
  'THE GOLD FOLLOWS THE SERVER: a corrected number is no longer drawn as a PR',
  `${serverWins.e1rmColour} !== ${pr.e1rmColour}`,
);
// AND THE RESIDUAL, ASSERTED RATHER THAN LEFT TO BE DISCOVERED. The words are
// still the client's call (GDD §11): the headline over the corrected number
// still reads as a PR. This check exists so the day somebody fixes that, this
// line fails and the open question gets closed with it.
check(
  serverWins.headline === pr.headline,
  'KNOWN RESIDUAL (GDD §11): the headline is still the client’s call, uncorrected',
  `${JSON.stringify(serverWins.headline)} === ${JSON.stringify(pr.headline)}`,
);

// 4. stale
check(unsynced.e1rmTag === STALE_TAG, `a refused proposal is captioned ${STALE_TAG}`, JSON.stringify(unsynced.e1rmTag));
check(
  unsynced.e1rm !== saving.e1rm,
  'a refused proposal shows the last CONFIRMED truth, not the discarded projection',
  `${unsynced.e1rm} !== ${saving.e1rm}`,
);

// 5. accessory
check(
  accessory.hasE1rmNode === false,
  'accessory day renders NO e1RM node at all (GDD §3.2, ruled)',
  `hasE1rmNode=${accessory.hasE1rmNode}`,
);
check(
  accessory.trainingIq === UNKNOWN_VALUE,
  'accessory day shows an absent Training IQ rather than a zero',
  JSON.stringify(accessory.trainingIq),
);
check(
  accessory.accessoryNote !== null && accessory.accessoryNote.length > 0,
  'accessory day says why there is no estimate',
  JSON.stringify(accessory.accessoryNote),
);
check(
  accessory.streak !== null && accessory.streak !== UNKNOWN_VALUE,
  'accessory day still moves the streak — a trained day is a trained day',
  JSON.stringify(accessory.streak),
);

// GDD §3.2: no Total, on any of them.
for (const [name, seen] of [
  ['close-out-pr', pr],
  ['close-out-saving', saving],
  ['close-out-server-wins', serverWins],
  ['close-out-unsynced', unsynced],
  ['close-out-accessory', accessory],
]) {
  check(!/\btotal\b/i.test(seen.body), `${name} shows no Total (GDD §3.2)`);
}

console.log(notes.join('\n'));
if (pageErrors.length > 0) {
  console.log('\nPAGE ERRORS:');
  for (const e of pageErrors.slice(0, 5)) console.log('  ', e);
}
await browser.close();

console.log('');
if (failures.length > 0) {
  console.log(`FAILED ${failures.length} check(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASSED ${notes.length} checks against the running app.`);
