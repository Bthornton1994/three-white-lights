#!/usr/bin/env node
/**
 * Checks, IN A BROWSER, WITH A MOUSE, that a player can get from the daily
 * session to a meet and back without touching the URL bar.
 *
 * ===========================================================================
 * WHY THIS EXISTS AND WHY IT IS THE DECISIVE CHECK
 * ===========================================================================
 * The defect this piece closed was invisible to every unit test in the
 * repository, and it had to be: `MeetScreen` was correct, imported, and had
 * hundreds of green tests behind it. What did not exist was a PATH — the app
 * routed on query strings only, so meet day was reachable by typing `?meet=`
 * and by nothing else. 2128 tests passed on that tree.
 *
 * `src/shell/shellRoute.test.ts` proves the route graph says a player can get
 * there. `src/shell/shellWiring.test.ts` proves the shell calls that graph.
 * Neither renders anything: `vitest.config.ts` is `environment: node`, and a
 * sibling piece in this run demonstrated that a component whose clock was
 * frozen left all 2128 green. So the claim "a player can reach meet day" is
 * settled here, by loading the built app, FINDING the control, HIT-TESTING the
 * point a thumb would land on, PRESSING it, and reading what came up.
 *
 * WHAT IT ASSERTS, and why each one can fail:
 *
 *   1. The app opens on the daily session with no query string at all, and the
 *      way to meet day is on screen and pressable. Fails if the shell draws no
 *      control, or draws one something else covers.
 *   2. PRESSING IT REACHES MEET DAY. This is the one. Fails if the route is
 *      not wired, or is wired to something that does not render.
 *   3. The meet it reaches is PLAYED, not a screenshot: the weigh-in confirms,
 *      the openers confirm, and a walk-out begins. Fails if a frozen debug
 *      frame leaked into a player-opened meet.
 *   4. From GDD §6.5's recap the way back is on screen, pressable, and lands on
 *      the daily session. Fails if the meet is a dead end — which it was: the
 *      recap's only action was "see your card", and the card had none at all.
 *   5. From the CLOSE-OUT — the end of a session — the way to meet day is on
 *      screen. That is the "finish a session and reach a meet" path.
 *   6. NO CONTROL IS DRAWN OVER A LIVE SET, or over a walk-out, an attempt or a
 *      verdict. A pill over the mechanic is a mis-tap that costs a rep.
 *   7. All four debug query strings still resolve to the surface their capture
 *      tool expects. Breaking one breaks the run's evidence harness.
 *   8. The shell's chrome shows no Total (GDD §3.2: Total moves on meet day and
 *      no other day) and no fatigue readout (§3.4, §12.3).
 *
 * "ON SCREEN" HERE MEANS DRAWN, NOT MOUNTED. Every positive check above goes
 * through `onScreen`, which measures the element's effective opacity, because
 * Playwright's `isVisible()` and `elementFromPoint` DO NOT CONSIDER OPACITY and
 * this tool has already once reported a control as present at the exact moment
 * it was invisible. The block above `onScreen` has the whole story and the
 * photograph that proves it.
 *
 * The testIDs are written out here rather than imported, on the same principle
 * as `capture-session.mjs`'s moment list: a check that reads its expectations
 * out of the module under test agrees with a broken module. `BOMB_OUT_*` below
 * is restated for the same reason.
 *
 * Usage:
 *   node tools/verify-shell-route.mjs [--url URL] [--settle MS] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/shell'));
// Must exceed SHELL_NAV.FADE_IN_DELAY_MS + FADE_IN_MS (320 + 220 = 540), plus
// whatever the screen underneath takes to assemble. Deliberately generous: this
// tool is proving reachability, not measuring latency.
//
// IT IS NOT ENOUGH FOR EVERY SCREEN, and `BOMB_OUT_SETTLE_MS` below is what
// that costs. One global settle is exactly how this tool came to photograph a
// bomb-out with no exit anywhere on it and report the exit as present.
const settleMs = Number(flag('settle', '2600'));

/**
 * ===========================================================================
 * THE ONE SCREEN THAT TAKES LONGER TO ARRIVE THAN `settleMs`
 * ===========================================================================
 * Restated from `src/game/meetTuning.ts` rather than imported, on the same
 * principle as the testIDs below: a check that reads its deadline out of the
 * module under test agrees with a broken module.
 *
 * GDD §6.3's bomb-out is the slowest beat in the game ON PURPOSE — the silence
 * is what makes it somber — and its way out is the LAST thing to arrive:
 *
 *     BOMB_OUT_SILENCE_MS                             1500
 *   + BOMB_OUT_ROW_ORDER.ACTION (3) x STAGGER (700)   2100
 *   + BOMB_OUT_ROW_FADE_MS                             620
 *   = the exit is fully drawn at                      4220 ms
 *
 * `tools/capture-meet.mjs` already settles 5200 ms for exactly this reason and
 * says so in as many words. This tool settled 2600 and then asserted the exit
 * was "on screen" at a moment when it was at zero opacity. See the block above
 * `onScreen` for why Playwright cheerfully agreed.
 */
const BOMB_OUT_EXIT_DRAWN_AT_MS = 1500 + 3 * 700 + 620;
/** Slack for a software-rendered browser that drops frames. */
const FADE_GRACE_MS = 1800;
const BOMB_OUT_SETTLE_MS = BOMB_OUT_EXIT_DRAWN_AT_MS + FADE_GRACE_MS;

/**
 * Below this, a control is reported ABSENT however happily the DOM says it is
 * visible. Not a style threshold: a fade that has not finished is a control a
 * thumb cannot find.
 */
const ON_SCREEN_MIN_OPACITY = 0.9;

/** How often `waitUntilDrawn` re-reads an opacity while a fade is running. */
const DRAWN_POLL_MS = 100;

const NAV_OPEN_MEET = 'shell-open-meet';
const NAV_LEAVE_MEET = 'shell-leave-meet';

const failures = [];
const notes = [];
const check = (ok, what, detail) => {
  const line = `${what}${detail === undefined ? '' : ` — ${detail}`}`;
  if (ok) notes.push(`  ok    ${line}`);
  else {
    failures.push(line);
    notes.push(`  FAIL  ${line}`);
  }
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));

await mkdir(outDir, { recursive: true });

async function open(search, waitFor, settle = settleMs) {
  await page.goto(`${url}${search}`, { waitUntil: 'load' });
  if (waitFor !== undefined) {
    await page.getByTestId(waitFor).waitFor({ state: 'visible', timeout: 120000 });
  }
  await page.waitForTimeout(settle);
}

/**
 * MOUNTED AND NOT `visibility: hidden`. That is ALL this means.
 *
 * Used below only for the NEGATIVE checks ("no control is drawn over the
 * mechanic"), where it is the strict direction: a pill that is mounted but
 * transparent still fails them, which is what we want. Every POSITIVE check
 * goes through `onScreen` instead.
 */
const visible = (id) => page.getByTestId(id).isVisible().catch(() => false);

/**
 * ===========================================================================
 * OPACITY IS NOT VISIBILITY, AND PLAYWRIGHT DOES NOT KNOW THE DIFFERENCE
 * ===========================================================================
 * `isVisible()` means "has a non-empty bounding box and is not
 * `visibility: hidden`". IT RETURNS TRUE FOR AN ELEMENT AT `opacity: 0`.
 * `document.elementFromPoint` — which `hitTest` below uses, and which
 * Playwright's own click actionability check uses — ALSO hits an `opacity: 0`
 * element, and `click()` will happily press one. Nothing in the toolkit
 * considers opacity.
 *
 * This is not a theoretical hole; it is a bug this file shipped. The run's own
 * evidence caught it: `.gauntlet/shots/shell/09-bombed-keeps-its-own-exit.png`
 * photographs a screen with NO EXIT ANYWHERE ON IT, sitting in the same run
 * directory as a `route.json` line reading
 *
 *     "ok    the bomb-out beat keeps its own way out"
 *
 * because the check looked at `settleMs` = 2600 ms and `BombOutView`'s action
 * row does not finish fading in until 4220 ms. The app was fine. The CHECK
 * reported "on screen" about something that, at the instant it looked, a human
 * could not see and a thumb could not have found.
 *
 * TWO THINGS FIX THAT AND BOTH ARE NEEDED:
 *
 *   1. `effectiveOpacity` multiplies the computed opacity all the way up the
 *      ancestor chain — React Native Web nests the animated wrapper above the
 *      Pressable, so the control's own opacity is 1 while its parent is 0 — and
 *      `onScreen` refuses anything under `ON_SCREEN_MIN_OPACITY`. That turns
 *      the false PASS into a failure with a measured number attached.
 *   2. THE WAIT HAS TO BE RIGHT. (1) alone would only convert a false pass into
 *      a false failure, which is no more honest. So the deadline for a screen
 *      is computed from the same constants the screen animates on, and
 *      `waitUntilDrawn` waits for the fade the app actually plays instead of a
 *      fixed settle that predates it.
 */
async function effectiveOpacity(id) {
  const handle = await page
    .getByTestId(id)
    .elementHandle({ timeout: 2000 })
    .catch(() => null);
  if (handle === null) return 0;
  const value = await page
    .evaluate((node) => {
      let el = node;
      let acc = 1;
      while (el !== null && el.nodeType === 1) {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        const own = Number.parseFloat(cs.opacity);
        acc *= Number.isFinite(own) ? own : 1;
        el = el.parentElement;
      }
      return acc;
    }, handle)
    .catch(() => 0);
  await handle.dispose().catch(() => {});
  return value;
}

/** In the DOM, and actually drawn. The measured opacity comes back either way. */
async function onScreen(id) {
  if (!(await visible(id))) return { on: false, why: 'not rendered at all' };
  const o = await effectiveOpacity(id);
  return { on: o >= ON_SCREEN_MIN_OPACITY, why: `opacity ${o.toFixed(3)}` };
}

/** `check` for "X is on screen", reporting the opacity it measured either way. */
async function checkOnScreen(id, what) {
  const { on, why } = await onScreen(id);
  check(on, what, why);
  return on;
}

/**
 * Wait for a control to finish arriving, up to `timeout`, and report what it
 * was at when the clock ran out.
 *
 * A BOUNDED wait, not an unbounded one: "the exit arrives within the time its
 * own animation says it should" is a falsifiable claim, and an unbounded wait
 * would not be one.
 */
async function waitUntilDrawn(id, timeout) {
  const started = Date.now();
  for (;;) {
    const o = await effectiveOpacity(id);
    if (o >= ON_SCREEN_MIN_OPACITY) {
      return { drawn: true, why: `opacity ${o.toFixed(3)} after ${Date.now() - started}ms` };
    }
    if (Date.now() - started >= timeout) {
      return { drawn: false, why: `opacity ${o.toFixed(3)}, still, after ${timeout}ms` };
    }
    await page.waitForTimeout(DRAWN_POLL_MS);
  }
}

/**
 * Is the control not merely in the DOM but the thing a thumb would actually
 * hit? A pill under a transparent full-screen touch layer is present, visible,
 * and unpressable — and that is precisely the failure a `querySelector` misses.
 *
 * NOTE THE LIMIT: `elementFromPoint` ignores opacity too, so this answers "is
 * anything on top of it", NOT "can a human see it". Pair it with `onScreen`.
 */
async function hitTest(id) {
  const box = await page.getByTestId(id).boundingBox().catch(() => null);
  if (box === null) return { hit: false, why: 'no box' };
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const owner = await page.evaluate(
    ([px, py, wanted]) => {
      let node = document.elementFromPoint(px, py);
      while (node !== null) {
        if (node.getAttribute?.('data-testid') === wanted) return 'self';
        node = node.parentElement;
      }
      const top = document.elementFromPoint(px, py);
      return top === null ? 'nothing' : (top.getAttribute?.('data-testid') ?? top.tagName);
    },
    [x, y, id],
  );
  return { hit: owner === 'self', why: owner, box };
}

const bodyText = () => page.evaluate(() => (document.body.textContent ?? '').slice(0, 4000));

/**
 * Press a control and wait for the surface it should produce, REPORTING rather
 * than throwing.
 *
 * A missing control has to come out as a named failed check, not as a Playwright
 * stack trace: the whole point of this tool is that somebody reading its output
 * can tell WHICH property of the app broke. A crash tells them the harness is
 * unhappy and nothing else. (Learned by mutating the phase report out of
 * `SessionScreen` — the tool caught it, and said so unreadably.)
 *
 * It waits for the control to be DRAWN before pressing, not merely present:
 * Playwright will click a control at zero opacity, so a press that succeeded
 * would otherwise be no evidence at all that a player could have made it.
 */
async function press(id, expect, what, drawWithin = settleMs) {
  const arrived = await waitUntilDrawn(id, drawWithin);
  if (!arrived.drawn) {
    check(false, what, `the control ${id} was not drawn to press — ${arrived.why}`);
    return false;
  }
  try {
    await page.getByTestId(id).click({ timeout: 20000 });
  } catch {
    check(false, what, `the control ${id} was never there to press`);
    return false;
  }
  try {
    await page.getByTestId(expect).waitFor({ state: 'visible', timeout: 30000 });
  } catch {
    check(false, what, `pressed ${id}, but ${expect} never came up`);
    return false;
  }
  await page.waitForTimeout(settleMs);
  check(true, what);
  return true;
}

// ---------------------------------------------------------------------------
// 1 + 2. The app opens on the session, and the control reaches meet day
// ---------------------------------------------------------------------------

await open('/', 'session-screen');
await page.screenshot({ path: path.join(outDir, '01-session-with-nav.png') });

await checkOnScreen('session-screen', 'the app opens on the daily session with no query string');
await checkOnScreen(NAV_OPEN_MEET, `the way to meet day is on screen (${NAV_OPEN_MEET})`);
const openHit = await hitTest(NAV_OPEN_MEET);
check(openHit.hit, 'and the point a thumb would land on belongs to it', `elementFromPoint -> ${openHit.why}`);
check(
  !/\btotal\b/i.test(await bodyText()),
  'the session surface shows no Total in the shell chrome (GDD §3.2)',
);
check(
  !/\bfatigue\b/i.test(await bodyText()),
  'and no fatigue readout (GDD §3.4, §12.3)',
);

const reachedMeet = await press(
  NAV_OPEN_MEET,
  'meet-screen',
  'PRESSING IT REACHES MEET DAY — no URL typed, no query string',
);
await page.screenshot({ path: path.join(outDir, '02-meet-from-session.png') });

check(!(await visible('session-screen')), 'and the daily session is no longer on screen');
await checkOnScreen(
  'meet-weigh-in',
  'it lands on GDD §6.1’s weigh-in, which is what meet day opens on',
);

// ---------------------------------------------------------------------------
// 3. The meet a player opened is PLAYED, not a frozen screenshot
// ---------------------------------------------------------------------------

if (!reachedMeet) {
  // Everything below this point is about the meet that was never reached.
  // Reported as skipped rather than left to throw one screen further down.
  check(false, 'SKIPPED: the played-meet checks need a meet to have opened');
  await open('/?meet=live', 'meet-screen');
}
await press(
  'weigh-in-action',
  'meet-openers',
  'the weigh-in confirms and the openers come up — the loop is live, not frozen',
);
await page.getByTestId('openers-action').click();
// The walk-out is a TIMED beat and runs itself out, so it is asserted the
// instant it arrives — settling first would photograph the attempt after it.
// That the beat elapses on its own is itself the proof the meet is played:
// a frozen debug frame has its timers stopped and would sit here for ever.
let walkoutBegan = true;
try {
  await page.getByTestId('meet-walkout').waitFor({ state: 'visible', timeout: 30000 });
} catch {
  walkoutBegan = false;
}
await page.screenshot({ path: path.join(outDir, '03-meet-played-walkout.png') });
check(walkoutBegan, 'the openers confirm and a walk-out begins (GDD §6.2 step 1)');
check(
  !(await visible(NAV_LEAVE_MEET)),
  'NO CONTROL IS DRAWN OVER THE WALK-OUT — a mis-tap here costs the attempt',
);

let attemptArrived = true;
try {
  await page.getByTestId('meet-attempt').waitFor({ state: 'visible', timeout: 30000 });
} catch {
  attemptArrived = false;
}
check(
  attemptArrived,
  'and the walk-out ELAPSES on its own into the attempt — clocks running, not a screenshot',
);
check(
  !(await visible(NAV_LEAVE_MEET)),
  'NO CONTROL IS DRAWN OVER THE ATTEMPT ITSELF',
);

// ---------------------------------------------------------------------------
// 4. The way back, off GDD §6.5's recap
// ---------------------------------------------------------------------------

await open('/?meet=recap', 'meet-screen');
await page.screenshot({ path: path.join(outDir, '04-recap-with-way-back.png') });
await checkOnScreen('meet-recap', 'the recap renders');
await checkOnScreen(NAV_LEAVE_MEET, `the way back is on screen (${NAV_LEAVE_MEET})`);
const leaveHit = await hitTest(NAV_LEAVE_MEET);
check(leaveHit.hit, 'and it is what a thumb would hit', `elementFromPoint -> ${leaveHit.why}`);

await press(NAV_LEAVE_MEET, 'session-screen', 'PRESSING IT RETURNS TO THE DAILY SESSION');
await page.screenshot({ path: path.join(outDir, '05-back-on-the-session.png') });
check(!(await visible('meet-screen')), 'and meet day is no longer on screen');

// The result card behind the recap needs a way out too — it is the last screen
// of GDD §6.5 and had none of its own.
await open('/?meet=recap-card', 'result-card-screen');
await page.screenshot({ path: path.join(outDir, '06-card-with-way-back.png') });
await checkOnScreen('result-card-screen', 'the shareable card renders');
await checkOnScreen(NAV_LEAVE_MEET, 'and the card is not a dead end either');

// ---------------------------------------------------------------------------
// 5. From the close-out — finishing a session and reaching a meet
// ---------------------------------------------------------------------------

await open('/?session=close-out-pr', 'session-close-out');
await page.screenshot({ path: path.join(outDir, '07-close-out-with-nav.png') });
await checkOnScreen('session-close-out', 'the close-out renders');
await checkOnScreen(
  NAV_OPEN_MEET,
  'the way to meet day is on the close-out — the end of a session',
);
const closeOutHit = await hitTest(NAV_OPEN_MEET);
check(closeOutHit.hit, 'and it is pressable there', `elementFromPoint -> ${closeOutHit.why}`);

// It must not sit on top of the close-out's own primary action.
const doneBox = await page.getByTestId('close-out-action').boundingBox().catch(() => null);
check(
  doneBox !== null && closeOutHit.box !== undefined && closeOutHit.box.y > doneBox.y + doneBox.height,
  'and it sits clear of the close-out’s DONE button rather than over it',
  doneBox === null ? 'no DONE button' : `nav y=${closeOutHit.box?.y} vs DONE bottom=${doneBox.y + doneBox.height}`,
);
check(
  !/\btotal\b/i.test(await bodyText()),
  'the close-out still shows no Total with the shell over it (GDD §3.2)',
);

await press(NAV_OPEN_MEET, 'meet-screen', 'FINISH A SESSION -> REACH A MEET, in one press');
await checkOnScreen(
  'meet-weigh-in',
  'and it is a fresh meet, not the frozen beat the launch URL named',
);

// ---------------------------------------------------------------------------
// 6. Nothing is drawn over the mechanic
// ---------------------------------------------------------------------------

for (const [search, waitFor, what] of [
  ['/?session=set', 'session-set', 'a live set'],
  ['/?session=rest', 'session-rest', 'the rest between two sets'],
]) {
  await open(search, waitFor);
  await checkOnScreen(waitFor, `${what} renders`);
  check(!(await visible(NAV_OPEN_MEET)), `NO CONTROL IS DRAWN OVER ${what}`);
}
await page.screenshot({ path: path.join(outDir, '08-set-has-no-nav.png') });

for (const [search, what] of [
  ['/?meet=lift', 'a live attempt'],
  ['/?meet=verdict-good', 'the judges’ verdict'],
  ['/?meet=select-after-miss', 'GDD §6.3’s attempt choice'],
]) {
  await open(search, 'meet-screen');
  check(!(await visible(NAV_LEAVE_MEET)), `NO CONTROL IS DRAWN OVER ${what}`);
}

// ---------------------------------------------------------------------------
// GDD §6.3's bomb-out draws its OWN way out, and the shell stays off it.
//
// THE SLOWEST SCREEN IN THE GAME, AND THE ONE THIS TOOL GOT WRONG. Its exit is
// not drawn until BOMB_OUT_EXIT_DRAWN_AT_MS (4220), and the tool looked at
// `settleMs` (2600) and reported it present — because Playwright counts an
// `opacity: 0` element as visible. See the block above `onScreen`.
//
// So: open with NO settle, wait for the fade the screen actually plays, bounded
// by the deadline its own constants imply, and photograph it after that. The
// screenshot is part of the claim — a shot of an empty screen filed under "the
// bomb-out keeps its own way out" is worse than no shot.
// ---------------------------------------------------------------------------
await open('/?meet=bombed', 'meet-bombed', 0);
const bombExit = await waitUntilDrawn('bomb-out-action', BOMB_OUT_SETTLE_MS);
await page.screenshot({ path: path.join(outDir, '09-bombed-keeps-its-own-exit.png') });
check(
  bombExit.drawn,
  `the bomb-out beat keeps its own way out, drawn within ${BOMB_OUT_SETTLE_MS}ms`,
  bombExit.why,
);
check(
  !(await visible(NAV_LEAVE_MEET)),
  'and the shell does not add a second one to it (GDD §6.3: leave that beat somber)',
);
await press(
  'bomb-out-action',
  'session-screen',
  'and pressing it returns to the daily session',
  BOMB_OUT_SETTLE_MS,
);

// ---------------------------------------------------------------------------
// 7. The evidence harness's four query strings still resolve
// ---------------------------------------------------------------------------

const DEBUG_ROUTES = [
  ['/?meet=weigh-in', 'meet-screen'],
  ['/?meet=walkout-third', 'meet-screen'],
  ['/?meet=recap', 'meet-screen'],
  ['/?meet=live', 'meet-screen'],
  ['/?session=check-in', 'session-screen'],
  ['/?session=briefing', 'session-screen'],
  ['/?session=close-out-accessory', 'session-screen'],
  ['/?replay=0.95&moment=hole', 'lift-screen'],
  ['/?replay=0.6&moment=lockout', 'lift-screen'],
];
for (const [search, expected] of DEBUG_ROUTES) {
  let reached = true;
  try {
    await page.goto(`${url}${search}`, { waitUntil: 'load' });
    await page.getByTestId(expected).waitFor({ state: 'visible', timeout: 60000 });
  } catch {
    reached = false;
  }
  check(reached, `${search} still resolves to ${expected}`);
}

// An unrecognised debug string boots the app normally rather than half-applying.
await open('/?meet=nonsense', 'session-screen');
await checkOnScreen(
  'session-screen',
  '/?meet=nonsense boots the daily session rather than a broken meet',
);

console.log(notes.join('\n'));
if (pageErrors.length > 0) {
  console.log('\nPAGE ERRORS:');
  for (const e of pageErrors.slice(0, 8)) console.log('  ', e);
}
await writeFile(
  path.join(outDir, 'route.json'),
  `${JSON.stringify({ checks: notes, failures, pageErrors }, null, 2)}\n`,
);
await browser.close();

console.log('');
if (failures.length > 0) {
  console.log(`FAILED ${failures.length} check(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASSED ${notes.length} checks against the running app.`);
