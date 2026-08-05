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
 *   7. NO CONTROL IS DRAWN OVER A LIVE SET, or over a walk-out, an attempt, a
 *      verdict, or a GDD §7.2 CUT-IN. A pill over the mechanic is a mis-tap
 *      that costs a rep; a pill over a cut-in eats the tap that was meant to
 *      dismiss it, and §7.2 makes the whole screen the dismiss target.
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
 * EVERY NUMBER IN THIS FILE THAT A SCREEN IS JUDGED AGAINST IS EITHER DERIVED
 * OR CONTROLLED. That is not a style rule, it is the defect this file keeps
 * finding in itself: `BOMB_OUT_EXIT_DRAWN_AT_MS` is `meetTuning.ts`'s
 * arithmetic rather than a settle somebody liked; the already-trained
 * clearance floor is `SHELL_LAYOUT`'s reserved band divided out, after a typed
 * `24` sat there for a while passing by a factor of thirteen; `PARSER_FIXTURE`
 * and `LINE_BOX_PROBE` exist because a parser and a counter that have stopped
 * working agree with everything they are pointed at.
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
  SESSION_DRIVE,
  SESSION_PROMPTS,
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
/**
 * Must exceed SHELL_NAV.FADE_IN_DELAY_MS + FADE_IN_MS (320 + 220 = 540), plus
 * whatever the screen underneath takes to assemble. Deliberately generous: this
 * tool is proving reachability, not measuring latency.
 *
 * IT IS NOT ENOUGH FOR EVERY SCREEN, and `BOMB_OUT_SETTLE_MS` below is what
 * that costs. One global settle is exactly how this tool came to photograph a
 * bomb-out with no exit anywhere on it and report the exit as present.
 *
 * Named rather than left as a bare literal inside the `flag()` call: it is the
 * number every screen in this file is read at, and an argument list is not a
 * place a playtester looks.
 */
const DEFAULT_SETTLE_MS = 2600;
const settleMs = Number(flag('settle', String(DEFAULT_SETTLE_MS)));

/**
 * THE PHONE THIS TOOL MEASURES ON, in one place.
 *
 * `newContext` renders at it AND the already-trained geometry below is derived
 * from it. Two copies of 844 would let the derivation describe a screen the
 * browser was not drawing.
 */
const VIEWPORT = Object.freeze({ WIDTH: 390, HEIGHT: 844 });

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
 * Which of those beats a browser probe below ACTUALLY VISITED, filled in by the
 * probes themselves as they run.
 *
 * ===========================================================================
 * WHY THE LIST ABOVE NEEDED A CONTROL AT ALL
 * ===========================================================================
 * The only thing that used to be asserted about it was
 * `NEVER_A_PILL_BEAT ∩ SHELL_NAV_EXPECTED = ∅`. EMPTY THE LIST TO `[]` AND
 * THAT IS TRUE. Misspell a row and it is true. `trespassing` comes back `[]`
 * either way and the check goes green — on the one statement this file calls
 * the one a re-tune is not allowed to move, and the only one with no control on
 * it. `shellRoute.test.ts:428-446` writes both halves out explicitly for
 * `SHELL_NAV`; this had neither.
 *
 * The probes below already hard-code their own phase strings, which is what
 * makes the fix cheap and two-way: pin the LIST and the PROBED SET equal, in
 * both directions. Emptying the list is then red (eight beats probed, none
 * listed); misspelling a row is red twice over (one listed and never probed,
 * one probed and not listed); and dropping a probe is red as well, which is the
 * failure that let `deliberation` sit on this list with no browser behind it.
 */
const beatsProbedInTheBrowser = new Set();

/**
 * ===========================================================================
 * THE SHELL'S AND THE SESSION'S GEOMETRY, RESTATED SO THE PINS BELOW CAN BE
 * ARITHMETIC RATHER THAN TYPED NUMBERS
 * ===========================================================================
 * Restated rather than imported, on the same principle as the testIDs and
 * `BOMB_OUT_EXIT_DRAWN_AT_MS` above: a check that reads its expectation out of
 * the module under test agrees with a broken module.
 *
 * WHAT KEEPS THE RESTATEMENT HONEST is not a regex over the source — it is that
 * `NAV_TOP_Y` is asserted against the pill THE BROWSER ACTUALLY DREW, within
 * `NAV_TOP_TOLERANCE_PX`. Re-tune `NAV_BOTTOM_INSET` or `NAV_HEIGHT` in
 * `shellTuning.ts` without touching this and that check names the drift with
 * both numbers in it, which is more than a source scan would have proved.
 */
const SHELL_LAYOUT_RESTATED = Object.freeze({
  /** src/shell/shellTuning.ts — SHELL_LAYOUT.NAV_BOTTOM_INSET */
  NAV_BOTTOM_INSET: 44,
  /** SHELL_LAYOUT.NAV_HEIGHT */
  NAV_HEIGHT: 38,
});

const SESSION_LAYOUT_RESTATED = Object.freeze({
  /** src/game/sessionTuning.ts — SESSION_LAYOUT.ROW_GAP, the gap `styles.centred` sets */
  ROW_GAP: 10,
  /** SESSION_LAYOUT.HEADLINE_FONT */
  HEADLINE_FONT: 22,
  /** SESSION_LAYOUT.SUBHEAD_FONT */
  SUBHEAD_FONT: 13,
});

/** The top edge of the drawn pill: 844 - 44 - 38 = 762. */
const NAV_TOP_Y =
  VIEWPORT.HEIGHT - SHELL_LAYOUT_RESTATED.NAV_BOTTOM_INSET - SHELL_LAYOUT_RESTATED.NAV_HEIGHT;
/** Sub-pixel rounding and a 1px border. Not a style allowance. */
const NAV_TOP_TOLERANCE_PX = 2;

/**
 * ===========================================================================
 * THE CLEARANCE FLOOR IS NOW A DIVISION, AND IT IS NOT THE COPY PIN
 * ===========================================================================
 * IT USED TO BE `24`, under a comment saying it existed so that lengthening
 * `SESSION_COPY.ALREADY_TRAINED_SUBHEAD` "to three or four lines" would be
 * reported. IT WOULD NOT HAVE BEEN, and the arithmetic is not close. The block
 * is two `<Text>` nodes in `styles.centred` (`flex: 1`,
 * `justifyContent: 'center'`), so it is ~51px tall centred in 844 and its
 * bottom sits at 447.5 against a pill top of 762 — 314.5px of clearance against
 * a 24px floor. For the check to go red the block has to reach ~632px tall,
 * about forty wrapped lines. The three-or-four-line regression its own comment
 * named adds ~15-25px and passes with ~290px to spare. It had become a
 * measurement of something true rather than a pin on anything.
 *
 * TWO DIFFERENT CLAIMS WERE HIDING IN THE ONE NUMBER. They are now two checks:
 *
 * THE FLOOR (here) is a claim about the BOTTOM-ANCHORED CHROME, and it is
 * derived from the promise `SHELL_LAYOUT` writes down in its own comment:
 * "every surface the shell draws over ... centres its content and leaves the
 * bottom sixth of the screen empty, so this is the one band where chrome
 * overlaps nothing." The clearance that promise implies is the distance from
 * the top of the reserved band to the top of the pill:
 *
 *     reserved band top   844 - 844/6     =  703.33
 *     pill top            844 - 44 - 38   =  762
 *     floor                               =   58.67 px
 *
 * Move the pill up or make it taller and the floor drops on its own, which is
 * right: less empty band, less clearance to promise. Nothing here is typed.
 *
 * SAY PLAINLY WHAT IT STILL DOES NOT DO. A floor on the gap beneath a CENTRED
 * block is loose by construction, because the block grows in both directions at
 * once. This guards the chrome's band. It does NOT catch the copy regression
 * its predecessor claimed to catch — the two checks below do, by asserting on
 * the thing that actually moves when the copy changes.
 */
const CHROME_BAND_FRACTION = 6;
const CHROME_BAND_TOP_Y = VIEWPORT.HEIGHT - VIEWPORT.HEIGHT / CHROME_BAND_FRACTION;
const ALREADY_TRAINED_NAV_CLEARANCE_PX = NAV_TOP_Y - CHROME_BAND_TOP_Y;

/**
 * ===========================================================================
 * THE PIN THAT BITES: HOW BIG THE ALREADY-TRAINED COPY MAY GET
 * ===========================================================================
 * `AlreadyTrained` is a headline and a subhead. ONE LINE EACH is the layout it
 * was drawn for, and a subhead that wraps is exactly the change the old comment
 * was worried about — so the LINE COUNT is what gets asserted, measured as line
 * boxes (`Range.getClientRects()`) rather than as leaf elements. The field this
 * file used to report as `lines` counted ELEMENTS and was therefore 2 whatever
 * the copy said, which is why it could be reported and never asserted on.
 *
 * The height ceiling is the second half and catches what a line count cannot:
 * the same two lines at a bigger font. `line-height: normal` measured 26/22 =
 * 1.18 for the headline and 15/13 = 1.15 for the subhead in the browser this
 * was written against. `LINE_BOX_FACTOR` is a deliberately loose upper bound on
 * that, because the line count is the tight half and a pixel ceiling one font
 * metric away from red would be a flaky check rather than a strict one.
 *
 *     22 x 1.35  +  ROW_GAP 10  +  13 x 1.35  =  57.25 px
 *
 * against a block that measures 26 + 10 + 15 = 51.
 */
const ALREADY_TRAINED_LINES = Object.freeze({ HEADLINE: 1, SUBHEAD: 1 });
const ALREADY_TRAINED_MAX_LINE_BOXES =
  ALREADY_TRAINED_LINES.HEADLINE + ALREADY_TRAINED_LINES.SUBHEAD;
const LINE_BOX_FACTOR = 1.35;
const ALREADY_TRAINED_MAX_COPY_HEIGHT_PX =
  ALREADY_TRAINED_LINES.HEADLINE * SESSION_LAYOUT_RESTATED.HEADLINE_FONT * LINE_BOX_FACTOR +
  SESSION_LAYOUT_RESTATED.ROW_GAP +
  ALREADY_TRAINED_LINES.SUBHEAD * SESSION_LAYOUT_RESTATED.SUBHEAD_FONT * LINE_BOX_FACTOR;

/**
 * The probe that proves the line-box counter can count past one.
 *
 * Same job as `PARSER_FIXTURE` below: a counter that has stopped counting
 * reports "one line" about every block it is pointed at, and "<= 2 line boxes"
 * would then be a check that cannot fail — the precise defect this whole block
 * is here to repair, reintroduced one level down. So a detached element of a
 * known width holding a known-wrapping string is measured by THE SAME code path
 * and removed again, and the check fails if it does not come back over
 * `EXPECT_AT_LEAST`. (Measured at 3 line boxes / 48px in the browser this was
 * written against.)
 */
const LINE_BOX_PROBE = Object.freeze({
  WIDTH_PX: 120,
  FONT_PX: 13,
  TEXT: 'one two three four five six seven eight nine ten eleven twelve',
  EXPECT_AT_LEAST: 3,
});

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
 *
 * TAKEN BEFORE THE FIRST SCREENSHOT, NOT AT WRITE TIME, AND IT MATTERS.
 * `provenance()` used to be called inline while assembling `route.json` — i.e.
 * after twelve PNGs had been written into `outDir`. So the tool photographed a
 * tree it had itself just dirtied, and `dirtyPaths` listed its own output:
 * whether a run read "clean" depended on whether the new pixels happened to be
 * byte-identical to the committed ones. That is a coin flip reported as a
 * provenance field. Snapshotting at startup answers the question the field is
 * actually for — WHICH CODE DID THIS BROWSER RUN — because the app was built
 * from the tree as it stood before any of these writes.
 *
 * `outDir` is excluded from the clean/dirty VERDICT for the same reason (a
 * previous run's leftovers are not code the app ran), but is still listed in
 * `dirtyPaths`, so nothing is hidden from a reader — only re-labelled.
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
    const lines = status === '' ? [] : status.split('\n');
    const own = path.relative(srcRoot, outDir);
    const code = lines.filter((line) => !line.replace(/^\s*\S+\s+/, '').startsWith(own));
    record.workingTree =
      code.length === 0 ? 'clean' : 'DIRTY — this run is not against a commit';
    record.dirtyPaths = lines.slice(0, 40);
  } catch (error) {
    record.workingTree = `unknown — ${String(error).slice(0, 200)}`;
  }
  return record;
}

// Snapshot now, before `outDir` is created or written to. See the block above.
const capturedFrom = provenance();

const failures = [];
/**
 * CHECKS AND NOTES ARE NOT THE SAME THING AND NO LONGER SHARE AN ARRAY.
 *
 * They used to, and the summary printed the length of the shared one, so this
 * tool's headline read "PASSED 74 checks" over 72 checks and 2 free-text notes.
 * Small, but a run graded on counted claims cannot have its own count be a
 * different number from the thing it names. `log` keeps them interleaved in the
 * order they happened, for the console and for `route.json`.
 */
const checks = [];
const observations = [];
const log = [];
const check = (ok, what, detail) => {
  const line = `${what}${detail === undefined ? '' : ` — ${detail}`}`;
  const entry = `  ${ok ? 'ok  ' : 'FAIL'}  ${line}`;
  if (!ok) failures.push(line);
  checks.push(entry);
  log.push(entry);
};
/** An observation, deliberately NOT a claim. Counted separately. */
const note = (text) => {
  const entry = `  note  ${text}`;
  observations.push(entry);
  log.push(entry);
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
  viewport: { width: VIEWPORT.WIDTH, height: VIEWPORT.HEIGHT },
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
 * The smallest rectangle containing every LINE OF TEXT drawn inside `id`, its
 * height, and HOW MANY LINE BOXES it was laid out into.
 *
 * Not the container's box. `styles.centred` is `flex: 1` and therefore fills
 * the screen, so measuring the container against the pill would "prove" a
 * collision that is not there and could never prove its absence. What a player
 * sees is the text, so the text is what gets measured — leaf elements only,
 * with a non-empty box and something in them.
 *
 * `lineBoxes` IS THE FIELD THAT MOVES WHEN COPY CHANGES, and the reason this
 * function was changed. It used to return `lines`, which counted leaf ELEMENTS:
 * on the already-trained surface that is 2 no matter how long the subhead gets,
 * so it was a number that could be printed and never asserted on.
 *
 * IT COUNTS DISTINCT RECT TOPS, NOT RECTS. A `Range` over a node's contents
 * returns a client rect per laid-out text box, and React Native Web's `<Text>`
 * carries `white-space: pre-wrap`, which splits ONE visual line into several
 * boxes wherever a preserved space sits at a wrap. Measured: a subhead wrapped
 * to four visible lines reported SEVEN rects. Every box on the same line shares
 * a `top`, so collapsing on the rounded top gives the number a reader means by
 * "three or four lines" — and the failure text then says something a human can
 * check against the screenshot beside it instead of a number only this function
 * understands.
 */
async function drawnTextBox(id) {
  return page.evaluate((wanted) => {
    const root = document.querySelector(`[data-testid="${wanted}"]`);
    if (root === null) return null;
    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;
    let leaves = 0;
    let lineBoxes = 0;
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
      leaves += 1;
      const range = document.createRange();
      range.selectNodeContents(node);
      const tops = new Set();
      for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
      // A drawn leaf occupies at least one line even where the range reports
      // no rects at all, so this can never read as fewer lines than there are.
      lineBoxes += Math.max(1, tops.size);
      longest = Math.max(longest, text.length);
    }
    return leaves === 0
      ? null
      : { top, bottom, left, right, height: bottom - top, leaves, lineBoxes, longest };
  }, id);
}

/**
 * Count the line boxes of a block whose answer is known, using the same code
 * path `drawnTextBox` uses, and take it away again.
 *
 * The probe is appended to `document.body` as a SIBLING of the React root and
 * removed in a `finally`, so nothing of the app is touched. See
 * `LINE_BOX_PROBE` for why a counter needs a control at all.
 */
async function lineBoxProbe() {
  return page.evaluate((spec) => {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;left:-99999px;top:0;width:${spec.WIDTH_PX}px;font-size:${spec.FONT_PX}px;`;
    probe.textContent = spec.TEXT;
    // `pre-wrap` too, so the probe is measured through the same quirk the
    // surface is. A control that took an easier path than the reading it
    // vouches for is not a control.
    probe.style.whiteSpace = 'pre-wrap';
    document.body.appendChild(probe);
    try {
      const range = document.createRange();
      range.selectNodeContents(probe);
      const tops = new Set();
      for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
      return Math.max(1, tops.size);
    } finally {
      probe.remove();
    }
  }, LINE_BOX_PROBE);
}

// ---------------------------------------------------------------------------
// The cross-check that ties this tool's phase table to the app's constant
// ---------------------------------------------------------------------------

/**
 * The phase names inside a frozen list called `<name>` in a `.ts` source text.
 *
 * A regex over source rather than an import, for the reason the whole file
 * gives: this is a `.mjs` tool and those are `.ts` modules with `as const
 * satisfies` on them. Returns null when the shape is not found at all, which is
 * itself reported — a parser that quietly matched nothing would be the vacuous
 * check this exists to avoid.
 *
 * TWO SHAPES, because two different kinds of list are read through it: the
 * PROPERTY form (`SESSION_PHASES: Object.freeze([...])`, inside `SHELL_NAV`)
 * and the EXPORT form (`export const MEET_DAY_PHASES = Object.freeze([...])`,
 * which is how `session.ts` and `meetDay.ts` write the game's own phase unions
 * down). Both are in the fixture below.
 */
function phaseListInSource(source, name) {
  const found = new RegExp(`${name}\\s*[:=]\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]`).exec(source);
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
  export const EXPORTED_PHASES = Object.freeze([
    'delta',
  ] as const satisfies readonly Thing[]);
`;

/**
 * Where the game writes down every beat it actually has.
 *
 * Read so that a row of `NEVER_A_PILL_BEAT` naming a phase that does not exist
 * — a typo, or a beat that was renamed out from under it — is reported instead
 * of quietly passing every negative check it appears in. `shellRoute.test.ts`
 * gets this from the type checker; a `.mjs` tool cannot, so it reads the same
 * two lists the type is spelled out in.
 */
const GAME_PHASE_LISTS = Object.freeze([
  Object.freeze({ file: ['src', 'game', 'session.ts'], name: 'SESSION_PHASES' }),
  Object.freeze({ file: ['src', 'game', 'meetDay.ts'], name: 'MEET_DAY_PHASES' }),
]);

async function checkNavTableMatchesTuning() {
  // Does the parser work at all?
  const fixtureA = phaseListInSource(PARSER_FIXTURE, 'DEMO_PHASES');
  const fixtureB = phaseListInSource(PARSER_FIXTURE, 'OTHER_PHASES');
  const fixtureC = phaseListInSource(PARSER_FIXTURE, 'ABSENT_PHASES');
  const fixtureD = phaseListInSource(PARSER_FIXTURE, 'EXPORTED_PHASES');
  check(
    JSON.stringify(fixtureA) === JSON.stringify(['alpha', 'beta-two']) &&
      JSON.stringify(fixtureB) === JSON.stringify(['gamma']) &&
      JSON.stringify(fixtureD) === JSON.stringify(['delta']) &&
      fixtureC === null,
    'the phase-list parser reads both list shapes, and reports a missing one as missing',
    `fixture -> ${JSON.stringify(fixtureA)} / ${JSON.stringify(fixtureB)} / ${JSON.stringify(fixtureD)} / ${JSON.stringify(fixtureC)}`,
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
    const inTuning = phaseListInSource(source, name);
    const mine = [...expected].sort();
    check(
      inTuning !== null && JSON.stringify(inTuning) === JSON.stringify(mine),
      `SHELL_NAV.${name} is what this tool checks the browser against`,
      `shellTuning.ts ${JSON.stringify(inTuning)} vs this tool ${JSON.stringify(mine)}`,
    );
  }

  // -------------------------------------------------------------------------
  // ...and the beats the design says may never carry one, still do not.
  //
  // FOUR STATEMENTS, NOT ONE. Only the last of them used to be here, and it is
  // the only one of the four that an EMPTY `NEVER_A_PILL_BEAT` satisfies. See
  // the block above `beatsProbedInTheBrowser`.
  // -------------------------------------------------------------------------
  check(
    NEVER_A_PILL_BEAT.length > 0,
    'the list of beats a pill may never appear on is not empty — the mutation the check below passes',
    `${NEVER_A_PILL_BEAT.length} beat(s): ${NEVER_A_PILL_BEAT.join(', ')}`,
  );

  const gamePhases = [];
  let unreadable = null;
  for (const { file, name } of GAME_PHASE_LISTS) {
    const where = path.join(srcRoot, ...file);
    const text = await readFile(where, 'utf8').catch(() => null);
    const found = text === null ? null : phaseListInSource(text, name);
    if (found === null) unreadable = `${name} in ${where}`;
    else gamePhases.push(...found);
  }
  const notARealBeat = NEVER_A_PILL_BEAT.filter((beat) => !gamePhases.includes(beat));
  check(
    unreadable === null && notARealBeat.length === 0,
    'every beat on that list is a beat the game actually has (session.ts, meetDay.ts)',
    unreadable !== null
      ? `could not read ${unreadable}`
      : notARealBeat.length === 0
        ? `all ${NEVER_A_PILL_BEAT.length} found among the ${gamePhases.length} phases the game declares`
        : `not phases at all: ${notARealBeat.join(', ')}`,
  );

  const probed = [...beatsProbedInTheBrowser].sort();
  const forbidden = [...NEVER_A_PILL_BEAT].sort();
  check(
    JSON.stringify(probed) === JSON.stringify(forbidden),
    'and every one of them was PROBED in a browser above, with nothing probed that is not on it',
    `listed ${JSON.stringify(forbidden)} vs probed ${JSON.stringify(probed)}`,
  );

  const pillBeats = [...SHELL_NAV_EXPECTED.SESSION_PHASES, ...SHELL_NAV_EXPECTED.MEET_PHASES];
  const trespassing = NEVER_A_PILL_BEAT.filter((beat) => pillBeats.includes(beat));
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
// Reported rather than thrown, for the reason `press` gives at length: a
// Playwright stack trace tells a reader the harness is unhappy and nothing
// about WHICH property of the app broke — and it takes the whole run down with
// it, so every check after this line goes unreported too. (Found by mutating an
// occluding layer over the shell's chrome: the tool died here instead of naming
// the eleven things that had stopped working.)
try {
  await page.getByTestId('openers-action').click({ timeout: 20000 });
} catch {
  check(false, 'the openers screen has an action to confirm with');
}
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
    // `drove` is in the detail, both ways, because WITHOUT IT THE TWO FAILURES
    // READ THE SAME AND THE TEXT BLAMES THE APP. "The driver stopped
    // recognising the DRIVE cue" and "the app stopped banking reps" produce the
    // identical "the loop left the sets without closing out"; the count of reps
    // that got past a drive press is what separates them.
    const drove = played.reps.filter((rep) => rep.drove === true).length;
    check(
      played.reachedCloseOut,
      'and it plays through to GDD §3.2’s close-out',
      played.reachedCloseOut
        ? `${played.reps.length} reps in ${played.ms}ms, ${drove} of them past a DRIVE cue`
        : `${played.why} — ${played.reps.length} reps, ${drove} past a DRIVE cue (0 there means THIS DRIVER stopped recognising ${JSON.stringify(SESSION_PROMPTS.DRIVE)}, not that the app stopped banking)`,
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
    //
    // THE CONTROL COMES FIRST, because the check under it has a way of passing
    // without watching anything. `waitForCloseOutSettled` counts an ABSENT tag
    // as settled — deliberately, and rightly: the accessory close-out has no
    // e1RM row and "no number to be unsure about" is not "unsure". But rename
    // `close-out-e1rm-tag` and `close-out-streak-tag` and the ONE check written
    // to catch the 22-second SAVING defect returns `settled: true` at 0ms and
    // passes over an empty DOM. So the wait now reports which tags it ever saw,
    // and seeing one is its own claim.
    const settled = await waitForCloseOutSettled(page);
    check(
      settled.sawAnyTag,
      'CONTROL: the close-out has a certainty tag for that wait to watch',
      settled.sawAnyTag
        ? `${settled.tagsSeen.join(', ')} in the DOM`
        : `neither ${Object.values(SESSION_DRIVE.CLOSE_OUT_TAG_IDS).join(' nor ')} is in the DOM, so "settled" was decided at ${settled.ms}ms over nothing`,
    );
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
    note(
      'DONE is pressable before the close-out settles; pressing inside the round trip offers a second session of the same day, which the server then refuses',
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

    // ---- the layout argument, converted into measurements ------------------
    //
    // `styles.centred` was an ARGUMENT that the copy and the pill do not
    // collide. What stood here was one measurement of the gap between them
    // against a typed 24px, which was true, was 13x looser than it read, and
    // could not fail on the copy change its own comment named. These are the
    // photograph's arithmetic, split into the claims that were tangled in it:
    // the COPY may not grow (line count, then height) and the CHROME's reserved
    // band stays clear. See the block above `ALREADY_TRAINED_NAV_CLEARANCE_PX`.
    const copy = await drawnTextBox('session-already-trained');
    const navBox = alreadyHit.box ?? null;

    // The control on the instrument, before either reading taken with it.
    const probeLineBoxes = await lineBoxProbe();
    check(
      probeLineBoxes >= LINE_BOX_PROBE.EXPECT_AT_LEAST,
      'CONTROL: the line-box counter reports a wrapped block as more than one line',
      `a ${LINE_BOX_PROBE.WIDTH_PX}px-wide probe -> ${probeLineBoxes} line box(es), expected >= ${LINE_BOX_PROBE.EXPECT_AT_LEAST}`,
    );

    check(
      copy !== null && copy.lineBoxes <= ALREADY_TRAINED_MAX_LINE_BOXES,
      `the already-trained copy is still ${ALREADY_TRAINED_MAX_LINE_BOXES} lines — one headline, one subhead`,
      copy === null
        ? 'no drawn copy to measure on the already-trained surface'
        : `${copy.lineBoxes} line box(es) across ${copy.leaves} text node(s), longest ${copy.longest} chars`,
    );

    check(
      copy !== null && copy.height <= ALREADY_TRAINED_MAX_COPY_HEIGHT_PX,
      `and no taller than ${ALREADY_TRAINED_MAX_COPY_HEIGHT_PX.toFixed(2)}px, the height that line budget implies`,
      copy === null
        ? 'no drawn copy to measure on the already-trained surface'
        : `${copy.height.toFixed(1)}px tall, y ${copy.top.toFixed(1)}..${copy.bottom.toFixed(1)}`,
    );

    // The pill really is where SHELL_LAYOUT puts it, so the floor derived from
    // those two numbers is a floor on THIS screen and not on a stale copy.
    check(
      navBox !== null && Math.abs(navBox.y - NAV_TOP_Y) <= NAV_TOP_TOLERANCE_PX,
      `the pill’s top is where SHELL_LAYOUT puts it (y=${NAV_TOP_Y}), so the floor below is derived from the drawn screen`,
      navBox === null
        ? 'no pill to measure'
        : `drawn at y=${navBox.y.toFixed(1)} against a derived ${NAV_TOP_Y}`,
    );

    check(
      copy !== null && navBox !== null && navBox.y - copy.bottom >= ALREADY_TRAINED_NAV_CLEARANCE_PX,
      `and it stays out of the band SHELL_LAYOUT reserves for chrome — >= ${ALREADY_TRAINED_NAV_CLEARANCE_PX.toFixed(2)}px clear above the pill`,
      copy === null
        ? 'no drawn copy to measure on the already-trained surface'
        : navBox === null
          ? `copy measured (bottom y=${copy.bottom.toFixed(1)}) but there is no pill to measure it against`
          : `copy bottom y=${copy.bottom.toFixed(1)}; pill top y=${navBox.y.toFixed(1)}; gap ${(navBox.y - copy.bottom).toFixed(1)}px`,
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
  } else if (played.reachedCloseOut) {
    // A MARKER, because the branch above is a dozen checks and without one the
    // total silently drops by a dozen on the run that most needs explaining.
    // The `reachedCloseOut` branch already emits its own, which is why this is
    // conditional on that having succeeded rather than on nothing.
    check(
      false,
      'SKIPPED: DONE did not land on the already-trained surface, so its checks did not run',
      landed.landedOn === null ? landed.why : `landed on ${landed.landedOn}`,
    );
  }
  playedOut.wallClockMs = Date.now() - startedAt;
  playedOut.landedOn = landed.landedOn;
  playedOut.finalDepthHoldMs = played.holdMs;
  // Every rep, with the hold it was played on and what the mechanic called it.
  // The evidence for "the played path is reliable" is this list, not an
  // assertion about it: a reader can see whether the driver converged or got
  // lucky.
  //
  // `drove` IS KEPT. It was computed by the driver and dropped here, and it is
  // the one field that tells a reader which side a bad run came from: reps
  // played with `drove: false` throughout mean the driver never saw the DRIVE
  // cue, which is a fact about `SESSION_PROMPTS`, not about the app.
  playedOut.reps = played.reps.map((rep) => ({
    set: rep.setLabel ?? null,
    holdMs: rep.holdMs ?? null,
    outcome: rep.outcome ?? null,
    detail: rep.detail ?? null,
    drove: rep.drove ?? null,
    ...(rep.played === false ? { notPlayed: rep.why } : {}),
  }));
  note(`the played-session section cost ${playedOut.wallClockMs}ms of wall clock`);
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
  beatsProbedInTheBrowser.add(phase);
  await checkOnScreen(waitFor, `${what} renders`);
  check(
    !SHELL_NAV_EXPECTED.SESSION_PHASES.includes(phase) && !(await visible(NAV_OPEN_MEET)),
    `NO CONTROL IS DRAWN OVER ${what} (beat '${phase}')`,
  );
}
await page.screenshot({ path: path.join(outDir, '08-set-has-no-nav.png') });

// `walkout` is also checked LIVE in section 3, on a meet a player opened, which
// is the stronger evidence. It is repeated here on a frozen frame so the beat
// has a probe that does not depend on a played meet having got that far — the
// set-equality check at the end is only as good as the probes it counts.
//
// `deliberation` had NO probe at all. It sat on `NEVER_A_PILL_BEAT` with three
// hand-written statements behind it and nothing that had ever looked at the
// screen, which is exactly the gap the set-equality check now makes loud.
for (const [search, phase, what] of [
  ['/?meet=walkout-third', 'walkout', 'GDD §6.2’s walk-out, held on a third attempt'],
  ['/?meet=lift', 'lift', 'a live attempt'],
  ['/?meet=deliberation', 'deliberation', 'GDD §6.2 step 4’s deliberation — the judges taking a beat'],
  ['/?meet=verdict-good', 'verdict', 'the judges’ verdict'],
  ['/?meet=select-after-miss', 'attempt-select', 'GDD §6.3’s attempt choice'],
]) {
  await open(search, 'meet-screen');
  beatsProbedInTheBrowser.add(phase);
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
beatsProbedInTheBrowser.add('bombed');
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
// 7b. NO CHROME OVER A CUT-IN — GDD §7.2's whole screen is the dismiss target
// ---------------------------------------------------------------------------
//
// The same rule as "no control over a live set", and it was broken the same
// way. `CutInHost` mounts the overlay INSIDE whichever surface is up and the
// shell draws its pill as a SIBLING after that surface, so the pill painted on
// top of the interrupt and `elementFromPoint` at its own centre came back with
// the pill. §7.2 says a cut-in is "always skippable — tap to dismiss"; a tap
// that navigates to meet day instead is a hole in that, and it is the same
// class of mis-tap this piece already refuses over the mechanic.
//
// The overlay cannot fix it from its side, so the fix is the shell's gate and
// this is where it gets photographed.
{
  // THE POSITIVE CONTROL FIRST, and on the SAME screen. `?cutin=nonsense` boots
  // the daily session with no overlay — which is the check-in beat, where the
  // pill belongs. If it is not there and hit-testable here, the probe below is
  // blind and its "the pill is gone" reading would mean nothing.
  await open('/?cutin=nonsense', 'session-screen');
  const control = await checkOnScreen(
    NAV_OPEN_MEET,
    'CONTROL: with no cut-in up, the pill is on the same screen the probe looks at',
  );
  const controlHit = await hitTest(NAV_OPEN_MEET);
  check(
    control && controlHit.hit,
    'CONTROL: and it is hit-testable there, so the probe below can see a pill',
    `elementFromPoint -> ${controlHit.why}`,
  );
  check(
    !(await visible('cut-in')),
    '?cutin=nonsense puts no cut-in on screen — an unrecognised debug route is inert',
  );

  // ...and now with one up. `?cutin=<moment>` is FROZEN — the host does not
  // start the auto-dismiss timer — so there is no race with the shutter.
  await open('/?cutin=personal-record', 'cut-in');
  await page.screenshot({ path: path.join(outDir, '12-cutin-has-no-shell-chrome.png') });
  const { on: pillDrawn, why: pillWhy } = await onScreen(NAV_OPEN_MEET);
  check(
    !pillDrawn,
    'NO SHELL CHROME IS DRAWN OVER A CUT-IN (GDD §7.2: the whole screen dismisses it)',
    pillWhy,
  );
  const pillHit = await hitTest(NAV_OPEN_MEET);
  check(
    !pillHit.hit,
    'and nothing of the shell’s takes the tap that was meant to skip it',
    `elementFromPoint at the pill’s own centre -> ${pillHit.why}`,
  );
  await checkOnScreen('cut-in', 'the cut-in itself is up, so this was not measured on an empty screen');
}

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

console.log(log.join('\n'));
if (pageErrors.length > 0) {
  console.log('\nPAGE ERRORS:');
  for (const e of pageErrors.slice(0, 8)) console.log('  ', e);
}
await writeFile(
  path.join(outDir, 'route.json'),
  `${JSON.stringify(
    {
      capturedFrom,
      played: playedOut,
      checks,
      notes: observations,
      failures,
      pageErrors,
    },
    null,
    2,
  )}\n`,
);
await browser.close();

console.log('');
if (failures.length > 0) {
  console.log(`FAILED ${failures.length} of ${checks.length} check(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(
  `PASSED ${checks.length} checks against the running app (and ${observations.length} note(s), which are not checks).`,
);
