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
 *   6. THE SCREEN ONE PRESS PAST THE CLOSE-OUT. A REAL SESSION IS PLAYED with a
 *      mouse, DONE is pressed, and the "already trained today" surface that
 *      comes up is checked with the same three instruments as the recap. This
 *      is the TERMINAL SCREEN OF GDD §3.2'S DAILY LOOP — every player lands on
 *      it, every day — and it draws two lines of text and NO CONTROL OF ITS
 *      OWN, so the shell's pill is the only thing on it a thumb can press. If
 *      the pill fails there the core loop of the game ends on a dead end.
 *   7. NO CONTROL IS DRAWN OVER A LIVE SET, or over a walk-out, an attempt or a
 *      verdict. A pill over the mechanic is a mis-tap that costs a rep.
 *   8. All four debug query strings still resolve to the surface their capture
 *      tool expects. Breaking one breaks the run's evidence harness.
 *   9. The shell's chrome shows no Total (GDD §3.2: Total moves on meet day and
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
 * THE ONE EXPECTATION THAT IS NOT INDEPENDENT, AND WHY. `SHELL_NAV_EXPECTED`
 * below is this tool's own copy of which beats carry the pill, and it is
 * CROSS-CHECKED against `src/shell/shellTuning.ts` rather than left to drift.
 * See the block above it: three hand-written statements of that fact already
 * exist and a re-tune that updates two of them used to leave this one silently
 * wrong, in the only check that runs a browser.
 *
 * Usage:
 *   node tools/verify-shell-route.mjs [--url URL] [--settle MS] [--out DIR]
 *                                     [--src REPO_ROOT]
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  openSessionToFirstSet,
  playSessionToCloseOut,
  pressCloseOutAction,
  waitForCloseOutSettled,
} from './sessionDrive.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/shell'));
/**
 * The checkout whose SOURCE is read for the cross-check below and whose commit
 * is stamped into `route.json`.
 *
 * Derived from this file's own location so a builder in a git worktree reads
 * ITS checkout, the same way `tools/dev-web.sh` derives the tree it serves.
 *
 * THIS IS NOT PROOF THE SERVED APP IS THIS TREE. `--url` can point anywhere,
 * and nothing here can tell that the bundle on the other end was built from
 * these files. What the provenance record buys is that a reader knows WHICH
 * tree the source-level claims were made about, instead of guessing.
 */
const srcRoot = path.resolve(flag('src', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
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

/**
 * ===========================================================================
 * THE FOURTH STATEMENT OF WHICH BEATS CARRY THE PILL — AND THE ONE THING THAT
 * TIES IT TO THE OTHER THREE
 * ===========================================================================
 * The same fact is now written down four times, on purpose and not by accident:
 *
 *   1. `SHELL_NAV.SESSION_PHASES` / `MEET_PHASES` in `src/shell/shellTuning.ts`
 *      — what the APP reads. The one home the shipping code gets it from.
 *   2. `ON_A_SESSION_BEAT` / `ON_A_MEET_BEAT` in `src/shell/shellRoute.test.ts`
 *      — the hand-written answer sheet, which exists because a test that reads
 *      its expectation out of its own subject passes when the subject is
 *      emptied. That file's header has the argument.
 *   3. `shellWiring.test.ts`'s scan that the already-trained surface renders on
 *      the `check-in` beat, so the pill's phase list covers it.
 *   4. THIS, which is what the browser actually asserts screen by screen.
 *
 * (1) and (2) already fail loudly when they disagree. (4) did not: it hard-coded
 * "pill on the close-out, no pill on set / rest / lift / verdict /
 * attempt-select" as bare literals, so a legitimate re-tune that edited
 * `shellTuning.ts` AND the answer sheet left `npm test` green and broke only
 * when a human happened to run this tool — which the suite does not run.
 *
 * So the table below is this tool's OWN hand-written copy, and
 * `checkNavTableMatchesTuning` reads the two lists straight out of
 * `shellTuning.ts` and fails by name when they differ. Independent enough to be
 * worth writing, tied in tightly enough that it cannot rot in silence.
 */
const SHELL_NAV_EXPECTED = Object.freeze({
  /** GDD §3.2 beats where the player is deciding rather than lifting. */
  SESSION_PHASES: Object.freeze(['check-in', 'briefing', 'close-out']),
  /** GDD §6.5. The meet is over and the way out is a route. */
  MEET_PHASES: Object.freeze(['recap']),
});

/**
 * THE BEATS A PILL MAY NEVER APPEAR ON, whatever anybody tunes.
 *
 * Not derived from the table above and not derived from `shellTuning.ts` — this
 * is the design claim in GDD §3.2 and §6.2/§6.3 that the whole phase gate
 * exists to serve, and it is the one statement here that a re-tune is not
 * allowed to move. A mis-tap on a live set costs a rep; a mis-tap on an attempt
 * costs the attempt; §6.3 asks for the bomb-out to be left alone.
 */
const NEVER_A_PILL_BEAT = Object.freeze([
  'set',
  'rest',
  'walkout',
  'lift',
  'deliberation',
  'verdict',
  'attempt-select',
  'bombed',
]);

/**
 * How much clear space the already-trained copy must leave above the pill.
 *
 * A PIN ON THE COPY LENGTH, measured rather than argued. That surface is
 * `styles.centred` — `flex: 1`, `justifyContent: 'center'` — so its two lines
 * sit in the middle band and the pill is anchored `NAV_BOTTOM_INSET` from the
 * bottom, and today they do not touch. Nothing pins the copy: lengthen
 * `SESSION_COPY.ALREADY_TRAINED_SUBHEAD` enough for it to wrap to three or four
 * lines and the block grows in both directions from the centre until it reaches
 * the pill. Asserting only "they do not overlap" would report that the day it
 * became true by one pixel. This asserts there is still room.
 */
const ALREADY_TRAINED_NAV_CLEARANCE_PX = 24;

/**
 * ===========================================================================
 * WHERE THIS EVIDENCE CAME FROM
 * ===========================================================================
 * `route.json` used to carry a list of checks and nothing else — no time, no
 * commit, no branch. A reader could not tell whether the file post-dated the
 * fix it appeared to vindicate, and could not tie it to a tree at all, so
 * browser evidence had to be discounted rather than used.
 * `.gauntlet/evidence/suite.txt`'s `# Captured <iso> at <sha> on <branch>`
 * header is what made that file checkable; this is the same thing, as JSON
 * fields so the file stays parseable.
 *
 * A DIRTY WORKING TREE IS RECORDED AS SUCH. A run against uncommitted edits
 * must not read like a run against a commit — that is the failure mode this is
 * for, not a tidiness preference.
 */
function provenance() {
  const record = {
    capturedAt: new Date().toISOString(),
    url,
    sourceRoot: srcRoot,
    commit: null,
    branch: null,
    workingTree: 'unknown',
    dirtyPaths: [],
  };
  const git = (...gitArgs) =>
    execFileSync('git', ['-C', srcRoot, ...gitArgs], { encoding: 'utf8' }).trim();
  try {
    record.commit = git('rev-parse', '--short', 'HEAD');
    record.branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const status = git('status', '--porcelain');
    record.workingTree = status === '' ? 'clean' : 'DIRTY — this run is not against a commit';
    record.dirtyPaths = status === '' ? [] : status.split('\n').slice(0, 40);
  } catch (error) {
    record.workingTree = `unknown — ${String(error).slice(0, 200)}`;
  }
  return record;
}

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
 * The smallest rectangle containing every LINE OF TEXT drawn inside `id`.
 *
 * Not the container's box. `styles.centred` is `flex: 1` and therefore fills
 * the screen, so measuring the container against the pill would "prove" a
 * collision that is not there and could never prove its absence. What a player
 * sees is the text, so the text is what gets measured — leaf elements only,
 * with a non-empty box and something in them.
 */
async function drawnTextBox(id) {
  return page.evaluate((wanted) => {
    const root = document.querySelector(`[data-testid="${wanted}"]`);
    if (root === null) return null;
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    let lines = 0;
    let longest = 0;
    for (const node of root.querySelectorAll('*')) {
      if (node.querySelector('*') !== null) continue; // leaves only
      const text = (node.textContent ?? '').trim();
      if (text === '') continue;
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      top = Math.min(top, r.top);
      bottom = Math.max(bottom, r.bottom);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      lines += 1;
      longest = Math.max(longest, text.length);
    }
    return lines === 0 ? null : { top, bottom, left, right, lines, longest };
  }, id);
}

// ---------------------------------------------------------------------------
// The cross-check that ties this tool's phase table to the app's constant
// ---------------------------------------------------------------------------

/**
 * The phase names inside `SHELL_NAV.<name>` in a `shellTuning.ts` source text.
 *
 * A regex over source rather than an import, for the reason the whole file
 * gives: this is a `.mjs` tool and that is a `.ts` module with `as const
 * satisfies` on it. Returns null when the shape is not found at all, which is
 * itself reported — a parser that quietly matched nothing would be the vacuous
 * check this exists to avoid.
 */
function phasesInTuning(source, name) {
  const found = new RegExp(`${name}:\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]`).exec(source);
  if (found === null) return null;
  return [...found[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

/**
 * A source text this parser is KNOWN to read correctly, and one it must not.
 *
 * The positive control. `shellWiring.test.ts` pairs every scan with one of
 * these for the same reason: a regex that has stopped matching agrees with
 * every file it is pointed at.
 */
const PARSER_FIXTURE = `
  DEMO_PHASES: Object.freeze([
    'alpha',
    'beta-two',
  ] as const satisfies readonly Thing[]),
  OTHER_PHASES: Object.freeze(['gamma'] as const satisfies readonly Thing[]),
`;

async function checkNavTableMatchesTuning() {
  // Does the parser work at all?
  const fixtureA = phasesInTuning(PARSER_FIXTURE, 'DEMO_PHASES');
  const fixtureB = phasesInTuning(PARSER_FIXTURE, 'OTHER_PHASES');
  const fixtureC = phasesInTuning(PARSER_FIXTURE, 'ABSENT_PHASES');
  check(
    JSON.stringify(fixtureA) === JSON.stringify(['alpha', 'beta-two']) &&
      JSON.stringify(fixtureB) === JSON.stringify(['gamma']) &&
      fixtureC === null,
    'the phase-list parser can read a list, and reports a missing one as missing',
    `fixture -> ${JSON.stringify(fixtureA)} / ${JSON.stringify(fixtureB)} / ${JSON.stringify(fixtureC)}`,
  );

  const tuningPath = path.join(srcRoot, 'src', 'shell', 'shellTuning.ts');
  let source = null;
  try {
    source = await readFile(tuningPath, 'utf8');
  } catch {
    check(false, 'this tool’s phase table is cross-checked against shellTuning.ts', `could not read ${tuningPath}`);
    return;
  }

  for (const [name, expected] of [
    ['SESSION_PHASES', SHELL_NAV_EXPECTED.SESSION_PHASES],
    ['MEET_PHASES', SHELL_NAV_EXPECTED.MEET_PHASES],
  ]) {
    const inTuning = phasesInTuning(source, name);
    const mine = [...expected].sort();
    check(
      inTuning !== null && JSON.stringify(inTuning) === JSON.stringify(mine),
      `SHELL_NAV.${name} is what this tool checks the browser against`,
      `shellTuning.ts ${JSON.stringify(inTuning)} vs this tool ${JSON.stringify(mine)}`,
    );
  }

  // ...and the beats the design says may never carry one, still do not.
  const listed = [...SHELL_NAV_EXPECTED.SESSION_PHASES, ...SHELL_NAV_EXPECTED.MEET_PHASES];
  const trespassing = NEVER_A_PILL_BEAT.filter((beat) => listed.includes(beat));
  check(
    trespassing.length === 0,
    'no beat of the MECHANIC is in the pill’s phase list (GDD §3.2, §6.2, §6.3)',
    trespassing.length === 0 ? undefined : `would draw a pill over ${trespassing.join(', ')}`,
  );
}

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
//
// ALL THREE INSTRUMENTS, LIKE THE RECAP. This used to be `checkOnScreen` alone,
// under the name "the card is not a dead end either" — which established that a
// control was DRAWN there and nothing whatever about whether a player could
// leave. The card and the already-trained surface are the two screens whose
// ONLY exit is the shell's pill, so they are precisely the two that cannot be
// checked with the weakest instrument.
await open('/?meet=recap-card', 'result-card-screen');
await page.screenshot({ path: path.join(outDir, '06-card-with-way-back.png') });
await checkOnScreen('result-card-screen', 'the shareable card renders');
await checkOnScreen(NAV_LEAVE_MEET, 'the way back is drawn on the card, whose only exit it is');
const cardHit = await hitTest(NAV_LEAVE_MEET);
check(
  cardHit.hit,
  'and the point a thumb would land on belongs to it',
  `elementFromPoint -> ${cardHit.why}`,
);
await press(
  NAV_LEAVE_MEET,
  'session-screen',
  'PRESSING IT LEAVES THE CARD — so the card is not a dead end',
);
check(!(await visible('result-card-screen')), 'and the card is no longer on screen');

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
// 6. ONE PRESS PAST THE CLOSE-OUT: the screen the daily loop actually ends on
// ---------------------------------------------------------------------------
//
// ===========================================================================
// WHY THIS SECTION PLAYS A WHOLE SESSION INSTEAD OF OPENING A URL
// ===========================================================================
// Everything above this point reached its screen with a query string. This one
// cannot: `SessionScreen` renders the already-trained surface only when
// `preview === undefined`, and `?session=<moment>` IS the preview. The surface
// exists solely on the far side of a session the server has recorded.
//
// It was previously recorded as unreachable by this tool for that reason. That
// was wrong about the conclusion, not the premise: the surface does not need a
// `?session=` moment, it needs A SESSION. `capture-session.mjs --live` already
// drove the opening beats with a mouse; `tools/sessionDrive.mjs` is that code,
// shared, and carried through to the close-out.
//
// ===========================================================================
// AND WHY IT IS WORTH ROUGHLY A MINUTE OF WALL CLOCK
// ===========================================================================
// `CloseOutView`'s DONE calls `restartDay`, which rebuilds the day against a
// cache that now records today's training, so `alreadyTrainedToday` is true and
// GDD §3.2's one-session-a-day surface comes up. THAT MAKES IT THE TERMINAL
// SCREEN OF THE DAILY LOOP — not an edge case, not a second-launch curiosity:
// every player who finishes a session lands on it, every day.
//
// And it draws two `<Text>` nodes inside a `<View>`. It has no pressable
// element of its own. The shell's pill is the ONLY thing on it a thumb can
// press, which makes this the screen where "no surface is a dead end" is
// decided — GDD §12.3's "never punish daily engagement", applied to navigation.
//
// It had never been photographed.

const playedOut = { attempted: true };
{
  const startedAt = Date.now();
  const opened = await openSessionToFirstSet(page, url);
  check(
    opened.reached,
    'a real session opens from `/` and reaches its first work set, played with a mouse',
    opened.reached ? `${opened.msFromFirstTapToSet}ms from the first tap` : opened.why,
  );

  let played = { reachedCloseOut: false, reps: [] };
  if (opened.reached) {
    played = await playSessionToCloseOut(page);
    check(
      played.reachedCloseOut,
      'and it plays through to GDD §3.2’s close-out',
      played.reachedCloseOut
        ? `${played.reps.length} reps in ${played.ms}ms`
        : `${played.why} (after ${played.reps.length} reps)`,
    );
  }

  let landed = { landedOn: null, why: 'the session never reached a close-out' };
  if (played.reachedCloseOut) {
    // ---- the payoff beat has to finish arriving before DONE means anything --
    //
    // The close-out prints the session's e1RM and streak with a tag saying how
    // sure each is, and blanks the tag when the server confirms. `restartDay`
    // rebuilds the day out of whatever the cache holds at the instant DONE is
    // pressed, so this is not politeness: it is the difference between pressing
    // a confirmed screen and pressing a provisional one.
    //
    // IT IS ALSO THE CHECK THAT CATCHES A ROUND TRIP THAT NEVER COMPLETES, and
    // that is not hypothetical — the first real run of this section found the
    // close-out stuck on its "SAVING" tag for 22 s against a stand-in server
    // that answers in 550 ms, because the submitting effect listed the cache it
    // wrote in its own dependencies and so cancelled its own request. Every
    // node test passed on that tree.
    const settled = await waitForCloseOutSettled(page);
    check(
      settled.settled,
      'the close-out’s numbers settle — the server’s answer actually lands',
      settled.settled ? `after ${settled.ms}ms` : settled.why,
    );

    // A KNOWN, SEPARATE QUESTION, recorded rather than asserted: DONE is drawn
    // with no stagger, so a player who presses it inside the round trip gets a
    // fresh check-in for a day they have already trained. Whether that wants a
    // disabled button, a settled-only DONE, or nothing at all is a close-out
    // decision, not a shell one. Noted here so it is written down somewhere.
    notes.push(
      '  note  DONE is pressable before the close-out settles; pressing inside the round trip offers a second session of the same day',
    );

    // Measured BEFORE the press, because the button is gone afterwards. Used
    // below to say the pill was clear of it, the same way section 5 does.
    playedOut.doneBox = await page.getByTestId('close-out-action').boundingBox().catch(() => null);
    landed = await pressCloseOutAction(page);
    // Distinguished by testID rather than by the button's label, so a copy edit
    // cannot turn a wrong landing into a right one.
    check(
      landed.landedOn === 'already-trained',
      'PRESSING DONE LANDS ON THE ALREADY-TRAINED SURFACE (GDD §3.2: one session a day)',
      landed.landedOn === 'already-trained'
        ? undefined
        : landed.landedOn === null
          ? landed.why
          : landed.landedOn === 'briefing'
            ? 'it offered a RETRY — the played session banked no reps at all'
            : 'it offered a SECOND SESSION of the same day — the server’s answer never landed',
    );
  } else {
    check(false, 'SKIPPED: the already-trained checks need a session to have been played');
  }

  if (landed.landedOn === 'already-trained') {
    // The pill does not re-fade here: the affordance is `open-meet` on both the
    // close-out and the check-in beat, so `ShellNav`'s `key` does not change and
    // it is already fully drawn. `waitUntilDrawn` inside `press` covers the case
    // where that ever stops being true.
    await page.waitForTimeout(settleMs);
    await page.screenshot({ path: path.join(outDir, '10-already-trained-keeps-the-way-out.png') });

    await checkOnScreen(
      'session-already-trained',
      'the already-trained surface renders — the last screen of the daily loop',
    );
    const drawn = await checkOnScreen(
      NAV_OPEN_MEET,
      'THE WAY TO MEET DAY IS ON IT, and it is the only thing on it to press',
    );
    const alreadyHit = await hitTest(NAV_OPEN_MEET);
    check(
      alreadyHit.hit,
      'and the point a thumb would land on belongs to it',
      `elementFromPoint -> ${alreadyHit.why}`,
    );

    // ---- the layout argument, converted into a measurement -----------------
    // `styles.centred` was an argument that the copy and the pill do not
    // collide. This is the photograph's arithmetic.
    const copy = await drawnTextBox('session-already-trained');
    const navBox = alreadyHit.box ?? null;
    check(
      copy !== null && navBox !== null && navBox.y - copy.bottom >= ALREADY_TRAINED_NAV_CLEARANCE_PX,
      `the already-trained copy leaves >= ${ALREADY_TRAINED_NAV_CLEARANCE_PX}px clear above the pill`,
      copy === null || navBox === null
        ? `no copy (${JSON.stringify(copy)}) or no pill box`
        : `${copy.lines} line(s), longest ${copy.longest} chars, bottom y=${copy.bottom.toFixed(1)}; pill top y=${navBox.y.toFixed(1)}; gap ${(navBox.y - copy.bottom).toFixed(1)}px`,
    );
    if (playedOut.doneBox != null && navBox !== null) {
      check(
        navBox.y > playedOut.doneBox.y + playedOut.doneBox.height,
        'and the pill sat clear of the DONE button it replaced on the screen before',
        `pill y=${navBox.y.toFixed(1)} vs DONE bottom=${(playedOut.doneBox.y + playedOut.doneBox.height).toFixed(1)}`,
      );
    }
    check(
      !/\btotal\b/i.test(await bodyText()),
      'the already-trained surface shows no Total either (GDD §3.2)',
    );

    if (drawn) {
      await press(
        NAV_OPEN_MEET,
        'meet-screen',
        'AND PRESSING IT REACHES MEET DAY — the daily loop does not end on a dead end',
      );
      await page.screenshot({ path: path.join(outDir, '11-already-trained-reaches-meet.png') });
      await checkOnScreen(
        'meet-weigh-in',
        'landing on the weigh-in, from a session that was actually played',
      );
    } else {
      check(false, 'SKIPPED: no drawn control on the already-trained surface to press');
    }
  }
  playedOut.wallClockMs = Date.now() - startedAt;
  playedOut.reps = played.reps.length;
  playedOut.landedOn = landed.landedOn;
  notes.push(`  note  the played-session section cost ${playedOut.wallClockMs}ms of wall clock`);
}

// ---------------------------------------------------------------------------
// 7. Nothing is drawn over the mechanic
// ---------------------------------------------------------------------------

// EACH SCREEN IS NAMED WITH THE BEAT IT LANDS ON, so the expectation comes off
// `SHELL_NAV_EXPECTED` — cross-checked against `shellTuning.ts` above — instead
// of being a bare literal that a re-tune could leave behind. Every one of these
// beats is also in `NEVER_A_PILL_BEAT`, which is what makes the absence a
// design claim and not merely a description of today's constant.
for (const [search, waitFor, phase, what] of [
  ['/?session=set', 'session-set', 'set', 'a live set'],
  ['/?session=rest', 'session-rest', 'rest', 'the rest between two sets'],
]) {
  await open(search, waitFor);
  await checkOnScreen(waitFor, `${what} renders`);
  check(
    !SHELL_NAV_EXPECTED.SESSION_PHASES.includes(phase) && !(await visible(NAV_OPEN_MEET)),
    `NO CONTROL IS DRAWN OVER ${what} (beat '${phase}')`,
  );
}
await page.screenshot({ path: path.join(outDir, '08-set-has-no-nav.png') });

for (const [search, phase, what] of [
  ['/?meet=lift', 'lift', 'a live attempt'],
  ['/?meet=verdict-good', 'verdict', 'the judges’ verdict'],
  ['/?meet=select-after-miss', 'attempt-select', 'GDD §6.3’s attempt choice'],
]) {
  await open(search, 'meet-screen');
  check(
    !SHELL_NAV_EXPECTED.MEET_PHASES.includes(phase) && !(await visible(NAV_LEAVE_MEET)),
    `NO CONTROL IS DRAWN OVER ${what} (beat '${phase}')`,
  );
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
// 8. The evidence harness's four query strings still resolve
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

// ---------------------------------------------------------------------------
// 9. This tool's own expectations still match the app's tuning module
// ---------------------------------------------------------------------------
// Last, because it needs no browser and its failure is about the CHECK rather
// than the app — a reader scanning the output for what broke should meet the
// app's failures first.
await checkNavTableMatchesTuning();

console.log(notes.join('\n'));
if (pageErrors.length > 0) {
  console.log('\nPAGE ERRORS:');
  for (const e of pageErrors.slice(0, 8)) console.log('  ', e);
}
await writeFile(
  path.join(outDir, 'route.json'),
  `${JSON.stringify(
    { capturedFrom: provenance(), played: playedOut, checks: notes, failures, pageErrors },
    null,
    2,
  )}\n`,
);
await browser.close();

console.log('');
if (failures.length > 0) {
  console.log(`FAILED ${failures.length} check(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASSED ${notes.length} checks against the running app.`);
