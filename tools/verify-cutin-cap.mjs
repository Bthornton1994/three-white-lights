#!/usr/bin/env node
/**
 * verify-cutin-cap.mjs — GDD §12.3's refusal condition, EXECUTED.
 *
 * ===========================================================================
 * WHAT THIS TOOL IS FOR, AND WHY THE SUITE COULD NOT DO IT
 * ===========================================================================
 * "Cut-ins firing more than once per session" is a refusal condition (GDD
 * §12.3). Everything that enforced it before this tool was one of two things:
 *
 *   - A UNIT TEST OF THE PARTS. `cutInGate.test.ts` proves the gate refuses a
 *     second request; `cutInLedger.test.ts` proves the ledger hands a resumed
 *     sitting back with its slot spent. Both are real and neither mounts a
 *     component — `vitest.config.ts` is `environment: node`.
 *   - A SOURCE SCAN. `cutInWiring.test.ts` reads `CutInHost.tsx` as text and
 *     checks the ledger is named in it.
 *
 * The join between them was pinned by nothing that could fail. `CutInHost.tsx`
 * builds its `useRef` from `resumeCutInSession(...)`; swapping that ONE call
 * for `openCutInSession(...)` and adding the import an editor would add
 * type-checks clean and leaves all 2654 tests green — and a host that is
 * un-mounted and re-mounted inside one sitting then opens a session with
 * `firedCount: 0` and the sitting gets a second cut-in. `AppShell`'s surface
 * ternary does exactly that un-mount in ordinary play. `cutInLedger.test.ts`'s
 * `mount()` is a hand-written second implementation of the host, so it proves
 * the ledger works and says nothing about whether the host uses it: independent
 * in form, identically blind in fact (CLAUDE.md).
 *
 * So this tool does not read anything. It PLAYS, and counts.
 *
 * ===========================================================================
 * ONE PAGE LOAD IS ONE PROCESS AND ONE LEDGER
 * ===========================================================================
 * `cutInLedger.ts` holds the count in module state for the life of the process.
 * A browser tab is that process; a `page.goto` starts a new one. `tools/
 * capture-cutin.mjs` says so about itself and is right to: its `?meet=` shots
 * are separate loads, so they are "does each beat qualify on its own", never
 * "does one sitting spend one slot".
 *
 * THIS TOOL NAVIGATES ONCE, at the top, and never again. Every leg below is
 * reached with a finger on the shell's own control.
 *
 * ===========================================================================
 * NO QUERY STRING, EVER — AND THAT IS ASSERTED, NOT INTENDED
 * ===========================================================================
 * CLAUDE.md: "A screen a player reaches needs a check that reaches it the way a
 * player does... Assert the address bar carries no query string at the moment
 * the screen is read, so the fallback cannot happen silently." `?cutin=` and
 * `?meet=` are both debug arms that mount different code, and `frozenMeetFor`
 * branches on `source === 'debug'`. The in-page recorder stamps
 * `location.search` onto every cut-in it sees and this tool fails on any that
 * carries one.
 *
 * ===========================================================================
 * WHY THE MEET IS DELIBERATELY BOMBED, TWICE
 * ===========================================================================
 * The count has to be a fact about the GATE and not about today's dice.
 * `CUT_IN_TUNING.SESSION_ALLOWANCE` is rolled from `cutInSessionSeed('meet',
 * day)` and `day` is the local wall clock, so on roughly a third of days no
 * completed meet fires anything at all: the walk-out is allowed 0.5 of the
 * time and the recap's PR 0.35, and a run that saw zero cut-ins would report
 * "not more than one" while proving nothing.
 *
 * `SESSION_ALLOWANCE['bomb-out']` is 1, and `rollAllowances` compares a draw in
 * [0, 1) against it — so a bomb-out beat is allowed in EVERY sitting, on every
 * day, by construction. That is the one moment this tool can lean on, and it
 * leans on it twice:
 *
 *   LEG 1  a meet played to make its attempts — nine walk-outs and the recap,
 *          which is GDD §7.2's "one whole meet is one sitting" as the app
 *          composes it. Fires 0 or 1 depending on the day's roll.
 *   LEG 2  leave, re-enter the SAME sitting, and bomb the squat. The bomb-out
 *          beat qualifies and is allowed. A host that re-opened its session
 *          would fire here.
 *   LEG 3  the same again. Two guaranteed-qualifying legs rather than one,
 *          because with only one the mutant's count would be 0 + 1 = 1 on the
 *          third of days leg 1 fires nothing, and the check would pass on the
 *          defect it exists for.
 *
 * The premise is READ FROM SOURCE (`readTuning.mjs`), not typed here. The day a
 * playtester turns the bomb-out rate down, this tool goes red saying its own
 * premise has gone, rather than going quietly vacuous.
 *
 * ===========================================================================
 * THE NON-VACUITY GUARDS, AND WHAT EACH ONE STOPS
 * ===========================================================================
 * "Exactly one" is satisfiable by a build where cut-ins never fire, by a
 * recorder that never ran, and by three legs that were three different
 * sittings. Each of those has a guard, and each guard pins a COUNT:
 *
 *   - the recorder polled at all                    (polls > 0)
 *   - legs 2 and 3 both REACHED the bomb-out screen (exactly 2)
 *   - the host really went away between legs        (exactly 2 teardowns)
 *   - the local calendar day did not change         (one sitting id)
 *   - the bomb-out rate is still 1                  (the beat still qualifies)
 *
 * ===========================================================================
 * THE MUTATION THIS WAS BUILT AGAINST
 * ===========================================================================
 * `CutInHost.tsx`, the `useRef` initialiser, `resumeCutInSession` ->
 * `openCutInSession` (plus the import). Run twice on two machines: the builder
 * measured 1 -> 3, legs 1, 2 and 3 each firing their own; the lead measured
 * 1 -> 2, legs 2 and 3, because on that day leg 1's roll fired nothing.
 *
 * THE MUTANT COUNT IS 2 OR 3 DEPENDING ON THE DAY, AND THAT IS THE POINT
 * RATHER THAN A WOBBLE. Leg 1 is the played meet, whose beats are rolled from
 * `cutInSessionSeed('meet', day)`; legs 2 and 3 lean on the bomb-out, allowed
 * in every sitting. So the mutant is >= 2 on every day and the clean run is
 * exactly 1 on every day, which is why the check compares against the cap and
 * not against a fixed expected count. A single-leg version of this tool would
 * have read 0 + 1 = 1 on the lead's day and passed on the defect it exists for
 * — that run is the empirical reason legs 2 and 3 are both here.
 *
 * The earlier wording of this block quoted "1 to 3" flat, which is a
 * measurement that does not reproduce; two comments in this piece were being
 * corrected for exactly that at the time it was written. `MUTATION_WITNESSES`
 * cannot hold a browser witness (CLAUDE.md), so the witness is recorded in the
 * commit that introduces this file and in the block above `THE_CAP`.
 *
 * Usage:
 *   node tools/verify-cutin-cap.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { numberInBlock, numberInSource, parserSelfTest, stringInSource } from './readTuning.mjs';
import { SESSION_DRIVE, SESSION_PROMPTS, adaptDepthSearch, freshDepthSearch } from './sessionDrive.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/cutin-cap'));
const srcRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));

/**
 * THE CAP, SPELLED OUT AGAINST GDD §7.2'S SENTENCE.
 *
 * "Hard gate: no more than one per session." NOT read out of
 * `CUT_IN_TUNING.MAX_PER_SESSION`: an oracle that restates the constant it is
 * grading cannot disagree with it, and `MAX_PER_SESSION` is a refusal condition
 * wearing a constant's clothes rather than a knob (`cutInTuning.ts` says so in
 * place). Raising that constant to 2 must turn this tool red.
 */
const THE_CAP = 1;

/**
 * EVERY NUMBER THE ROBOT MOVES ON, IN ONE PLACE.
 *
 * None of these are game feel — the game's feel values are in `src/game/` and
 * `src/cutin/cutInTuning.ts`, and the four this tool actually compares against
 * are READ from there rather than restated. These are a robot's reaction times
 * and deadlines, and they are here rather than inline for the same reason
 * `sessionDrive.mjs`'s `SESSION_DRIVE` is: somebody re-tuning the mechanic has
 * one place to look when the robot stops keeping up with it.
 */
const CAP_DRIVE = Object.freeze({
  /** How often this tool re-reads which beat the app is on. */
  POLL_MS: 40,
  /**
   * How often the IN-PAGE recorder looks for the overlay.
   *
   * It has to be well inside the whole beat (`ENTER_MS + HOLD_MS`, read below),
   * because a cut-in that arrived and left between two polls would be a cut-in
   * this tool did not count — which is the one error that makes the whole
   * measurement read low, i.e. green. One frame at 60 Hz.
   */
  RECORDER_POLL_MS: 16,
  /** First paint, on a cold Metro bundle. */
  BOOT_TIMEOUT_MS: 120000,
  /** One beat-to-beat transition: bar load, walk-out, judges, cards. */
  BEAT_TIMEOUT_MS: 40000,
  BRACE_TIMEOUT_MS: 20000,
  ASCENT_TIMEOUT_MS: 25000,
  /** One whole meet. Nine attempts have been measured at ~112 s elsewhere. */
  MEET_TIMEOUT_MS: 360000,
  /** GDD §6.2: three lifts x three attempts. Past this the loop is stuck. */
  MAX_ATTEMPTS: 9,
  /**
   * How long the finger stays down on a DELIBERATE MISS.
   *
   * Long enough that the press is seen, far too short to reach legal depth — so
   * the bar reverses at the top, the ascent is trivial, and `stepLift` calls it
   * `no-depth` at lockout. Three of these on one lift is GDD §6.3's bomb-out.
   * This is the robot being deliberately bad, and it is the only reason this
   * tool can promise a qualifying beat on any day.
   */
  MISS_RELEASE_MS: 80,
  /** After a deliberate miss: same weight again, so the lift bombs on three. */
  MISS_OPTIONS: Object.freeze(['repeat', 'small', 'big']),
  /** Playing to MAKE: the lightest legal call every time. */
  SAFEST_OPTIONS: Object.freeze(['repeat', 'small', 'big']),
  /** How long the finger stays down after the drive press, through lockout. */
  DRIVE_HOLD_EXTRA_MS: SESSION_DRIVE.DRIVE_HOLD_EXTRA_MS,
  /**
   * How long the bomb-out screen gets to draw its own way out.
   *
   * `BombOutView` staggers four lines behind `BOMB_OUT_SILENCE_MS`, and the way
   * out is the last of them — `capture-meet.mjs` settles 5200 ms for the same
   * reason. Generous rather than derived: this tool is not grading that pacing.
   */
  BOMB_OUT_EXIT_TIMEOUT_MS: 20000,
  /**
   * Slack added to the cut-in's own hold before this tool decides the overlay
   * is not going to leave.
   *
   * The overlay is a full-screen `Pressable` and the shell draws no chrome
   * while it is up (`shellAffordanceFor`), so a robot that pressed through one
   * would either dismiss it or miss its target. Every press below waits for the
   * screen to be clear first.
   */
  CUT_IN_CLEAR_SLACK_MS: 3000,
  /** A beat to let a surface settle after a navigation press. */
  SETTLE_MS: 1200,
  /**
   * "Drawn" rather than "mounted". A leg-3 screenshot was a flat dark
   * rectangle while `bomb-out-action` was already in the DOM — `BombOutView`
   * opens with a deliberate silence and fades its rows in, the exit last. This
   * is the line between present and visible, and it is the whole reason that
   * frame was blank.
   */
  DRAWN_MIN_OPACITY: 0.9,
});

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

const checks = [];
let failed = 0;
function check(ok, what, detail) {
  checks.push({ ok, what, detail: detail ?? null });
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : '!!  '}${what}${detail === undefined ? '' : `  — ${detail}`}`);
}

/** The reds, computed rather than tallied. See `failures` in `writeRecord`. */
const reds = () => checks.filter((c) => !c.ok);

// ---------------------------------------------------------------------------
// The premise, read from source
// ---------------------------------------------------------------------------

/**
 * Provenance — the same field `capture-cutin.mjs` and `verify-shell-route.mjs`
 * carry, and for the same reason: a record with no commit on it cannot be
 * dated. Snapshotted BEFORE anything is written, so it records the tree the
 * browser was served from.
 */
const capturedFrom = (() => {
  const record = { capturedAt: new Date().toISOString(), url, commit: null, branch: null, workingTree: 'unknown', dirtyPaths: [] };
  const git = (...gitArgs) => execFileSync('git', ['-C', srcRoot, ...gitArgs], { encoding: 'utf8' }).trim();
  try {
    record.commit = git('rev-parse', '--short', 'HEAD');
    record.branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const status = git('status', '--porcelain');
    const lines = status === '' ? [] : status.split('\n');
    // Not code the app ran. Kept in step with `capture-cutin.mjs`'s list.
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
  /**
   * WHICH MEASURING DEVICE PRODUCED THIS RECORD, and it is not optional.
   *
   * `tools/evidence.mjs` refuses a tracked shot record that carries no
   * instrument digest, and it refused this one the first time it was tracked —
   * the guard biting on its own first use rather than a round later. A commit
   * SHA says which app the browser played; it says nothing about the tool, and
   * the tool is half of what "1 cut-in across 3 legs" means. Turn
   * `CAP_DRIVE.RECORDER_POLL_MS` up past the whole beat here and the count
   * silently becomes "cut-ins the poller happened to catch", with the same SHA
   * and every committed "ok" line intact.
   *
   * `readTuning.mjs` is in the list because the premise controls read the
   * bomb-out allowance and the hold through it: a regression in that parser
   * takes the guards with it, and the tool's own self-test is the only thing
   * standing there.
   */
  record.instrument = Object.fromEntries(
    ['verify-cutin-cap.mjs', 'sessionDrive.mjs', 'readTuning.mjs'].map((name) => {
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

const parserComplaints = parserSelfTest();
check(
  parserComplaints.length === 0,
  'CONTROL: the source readers still read their own fixture',
  parserComplaints.length === 0 ? 'readTuning.mjs parses the shapes it claims to' : parserComplaints.join('; '),
);

const tuningText = await readFile(path.join(srcRoot, 'src', 'cutin', 'cutInTuning.ts'), 'utf8');
const meetTuningText = await readFile(path.join(srcRoot, 'src', 'game', 'meetTuning.ts'), 'utf8');
const sessionTuningText = await readFile(path.join(srcRoot, 'src', 'game', 'sessionTuning.ts'), 'utf8');

const bombOutAllowance = numberInBlock(tuningText, 'SESSION_ALLOWANCE', 'bomb-out');
const enterMs = numberInSource(tuningText, 'ENTER_MS');
const holdMs = numberInSource(tuningText, 'HOLD_MS');
const latencyMs = numberInSource(sessionTuningText, 'LOCAL_SERVER_LATENCY_MS');
const feedbackHigh = stringInSource(meetTuningText, 'FEEDBACK_DEPTH_HIGH');
const feedbackBuried = stringInSource(meetTuningText, 'FEEDBACK_BURIED');

/**
 * WHEN THE BOMB-OUT SCREEN HAS FINISHED ARRIVING, out of the app's own numbers.
 *
 * `BombOutView` delays row `i` by `SILENCE + i * STAGGER` and fades it over
 * `FADE`; the exit is the last row, `BOMB_OUT_ROW_ORDER.ACTION`. Computed here
 * rather than typed, so a playtester who lengthens the silence gets a tool that
 * still waits long enough instead of a tool that starts photographing the
 * silence again.
 */
const bombOutSilenceMs = numberInSource(meetTuningText, 'BOMB_OUT_SILENCE_MS');
const bombOutStaggerMs = numberInSource(meetTuningText, 'BOMB_OUT_ROW_STAGGER_MS');
const bombOutFadeMs = numberInSource(meetTuningText, 'BOMB_OUT_ROW_FADE_MS');
const bombOutRowOrderAction = numberInBlock(meetTuningText, 'BOMB_OUT_ROW_ORDER', 'ACTION');
const bombOutLastRowMs =
  bombOutSilenceMs === null || bombOutStaggerMs === null || bombOutFadeMs === null || bombOutRowOrderAction === null
    ? null
    : bombOutSilenceMs + bombOutRowOrderAction * bombOutStaggerMs + bombOutFadeMs;
check(
  bombOutLastRowMs !== null,
  "CONTROL: the bomb-out screen's own arrival arithmetic was READ, not guessed — a blank photograph is what a failed read used to look like",
  bombOutLastRowMs === null
    ? `COULD NOT READ one of BOMB_OUT_SILENCE_MS / BOMB_OUT_ROW_STAGGER_MS / BOMB_OUT_ROW_FADE_MS / BOMB_OUT_ROW_ORDER.ACTION out of meetTuning.ts`
    : `${bombOutSilenceMs} + ${bombOutRowOrderAction} x ${bombOutStaggerMs} + ${bombOutFadeMs} = ${bombOutLastRowMs}ms`,
);

check(
  bombOutAllowance === 1,
  "CONTROL: this tool's premise — SESSION_ALLOWANCE['bomb-out'] is 1, so the beat legs 2 and 3 lean on qualifies in EVERY sitting",
  bombOutAllowance === null
    ? "SESSION_ALLOWANCE['bomb-out'] was not found in src/cutin/cutInTuning.ts"
    : `read ${bombOutAllowance} from src/cutin/cutInTuning.ts; anything below 1 makes the roll seed-dependent and this tool can no longer promise a qualifying beat`,
);
const readEverything =
  enterMs !== null && holdMs !== null && latencyMs !== null && feedbackHigh !== null && feedbackBuried !== null;
check(
  readEverything,
  'CONTROL: the four values this tool steers and waits by came out of the app, not out of this file',
  `ENTER_MS ${enterMs}, HOLD_MS ${holdMs}, LOCAL_SERVER_LATENCY_MS ${latencyMs}, ` +
    `FEEDBACK_DEPTH_HIGH ${JSON.stringify(feedbackHigh)}, FEEDBACK_BURIED ${JSON.stringify(feedbackBuried)}`,
);
if (!readEverything || bombOutAllowance !== 1) {
  console.log('\n!! the premise did not hold, so nothing below would mean anything. Not driving.');
  await writeRecord(null, []);
  process.exit(1);
}

/** The whole cut-in beat, enter to gone, out of `cutInTuning.ts`. */
const WHOLE_BEAT_MS = enterMs + holdMs;
/** How long the recap's round trip gets before this tool calls the meet stuck. */
const RECAP_SETTLE_MS = latencyMs + CAP_DRIVE.BEAT_TIMEOUT_MS;

// ---------------------------------------------------------------------------
// The browser
// ---------------------------------------------------------------------------

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text());
});

/**
 * THE INSTRUMENT: an in-page recorder, not a polling loop out here.
 *
 * The cut-in is up for `ENTER_MS + HOLD_MS` and then un-mounts itself. A driver
 * that looked for it between its own presses would miss one that arrived while
 * it was inside `page.mouse.down()` or a `waitForTimeout` — and a MISSED cut-in
 * makes the count read LOW, which is the direction that looks like a pass. So
 * the page watches itself, continuously, and this tool reads the log afterwards.
 *
 * `addInitScript` runs before any app code on every navigation. There is only
 * one navigation, which is the point of the whole file.
 */
await page.addInitScript(
  ({ pollMs, beats }) => {
    window.__cutInCap = { log: [], polls: 0, up: false, leg: 0, startedDay: new Date().toDateString() };
    window.__cutInCapLeg = (n) => {
      window.__cutInCap.leg = n;
    };
    setInterval(() => {
      const s = window.__cutInCap;
      s.polls += 1;
      const node = document.querySelector('[data-testid="cut-in"]');
      const up = node !== null;
      if (up && !s.up) {
        s.log.push({
          leg: s.leg,
          at: Math.round(performance.now()),
          line: document.querySelector('[data-testid="cut-in-line"]')?.textContent ?? null,
          hint: document.querySelector('[data-testid="cut-in-skip-hint"]')?.textContent ?? null,
          over: beats.filter((id) => document.querySelector(`[data-testid="${id}"]`) !== null),
          search: window.location.search,
          goneAt: null,
        });
      }
      if (!up && s.up) {
        const last = s.log[s.log.length - 1];
        if (last !== undefined && last.goneAt === null) last.goneAt = Math.round(performance.now());
      }
      s.up = up;
    }, pollMs);
  },
  {
    pollMs: CAP_DRIVE.RECORDER_POLL_MS,
    beats: [
      'session-check-in',
      'meet-weigh-in',
      'meet-openers',
      'meet-attempt-select',
      'meet-walkout',
      'meet-attempt',
      'meet-deliberation',
      'meet-verdict',
      'meet-bombed',
      'meet-recap',
      'meet-recap-waiting',
      'meet-recap-placeholder',
      'result-card-screen',
    ],
  },
);

/** Which beat of the app is on screen, and what the mechanic is saying. */
async function read() {
  return page.evaluate(() => {
    const has = (id) => document.querySelector(`[data-testid="${id}"]`) !== null;
    const text = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;
    return {
      checkIn: has('session-check-in'),
      meetScreen: has('meet-screen'),
      weighIn: has('meet-weigh-in'),
      openers: has('meet-openers'),
      select: has('meet-attempt-select'),
      walkout: has('meet-walkout'),
      attempt: has('meet-attempt'),
      deliberation: has('meet-deliberation'),
      verdict: has('meet-verdict'),
      bombed: has('meet-bombed'),
      recap: has('meet-recap'),
      waiting: has('meet-recap-waiting'),
      placeholder: has('meet-recap-placeholder'),
      cutIn: has('cut-in'),
      openMeet: has('shell-open-meet'),
      leaveMeet: has('shell-leave-meet'),
      bombExit: has('bomb-out-action'),
      prompt: text('attempt-prompt'),
      attemptLabel: text('attempt-label'),
      feedback: text('verdict-feedback'),
      search: window.location.search,
      options: [...document.querySelectorAll('[data-testid]')]
        .map((n) => n.getAttribute('data-testid'))
        .filter((id) => /^attempt-option-(repeat|small|big)$/.test(id)),
    };
  });
}

/**
 * The computed opacity multiplied all the way up the tree, so a parent fading a
 * subtree in cannot report a child as drawn. Presence is not visibility, which
 * is the distinction a blank committed frame was made of.
 */
async function effectiveOpacity(id) {
  return page
    .evaluate((testId) => {
      let el = document.querySelector(`[data-testid="${testId}"]`);
      if (el === null) return 0;
      let acc = 1;
      while (el !== null) {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        const own = Number.parseFloat(cs.opacity);
        acc *= Number.isFinite(own) ? own : 1;
        el = el.parentElement;
      }
      return acc;
    }, id)
    .catch(() => 0);
}

async function until(done, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const state = await read();
    if (done(state)) return { ok: true, state, ms: Date.now() - started };
    if (Date.now() - started >= timeoutMs) return { ok: false, state, ms: Date.now() - started };
    await page.waitForTimeout(CAP_DRIVE.POLL_MS);
  }
}

const meetIsOver = (s) => s.recap || s.waiting || s.placeholder || s.bombed;
const saying = (s, phrase) => s.prompt !== null && s.prompt.includes(phrase);

/**
 * Wait until nothing is interrupting, then press.
 *
 * A cut-in is a full-screen dismiss target and the shell hides its chrome under
 * one, so a press aimed at a control while an interrupt is up either dismisses
 * the interrupt or lands on nothing. Both would be this tool fighting the
 * feature it is measuring.
 */
async function pressWhenClear(testId, timeoutMs) {
  const clear = await until((s) => !s.cutIn, WHOLE_BEAT_MS + CAP_DRIVE.CUT_IN_CLEAR_SLACK_MS);
  if (!clear.ok) return { pressed: false, why: `a cut-in was still up after ${clear.ms}ms, so ${testId} could not be pressed` };
  try {
    await page.getByTestId(testId).click({ timeout: timeoutMs });
    return { pressed: true };
  } catch (error) {
    return { pressed: false, why: `${testId} did not take a press — ${String(error).split('\n')[0]}` };
  }
}

/**
 * Play one attempt.
 *
 * `intent: 'make'` runs `sessionDrive.mjs`'s depth search — the same bisection
 * the session harness uses, imported rather than copied.
 * `intent: 'miss'` releases at the top on purpose. See `MISS_RELEASE_MS`.
 */
async function playOneAttempt(intent, holdMsIn) {
  const braced = await until((s) => saying(s, SESSION_PROMPTS.BRACE) || !s.attempt, CAP_DRIVE.BRACE_TIMEOUT_MS);
  if (!braced.ok || !saying(braced.state, SESSION_PROMPTS.BRACE)) {
    return { played: false, why: `no brace to press — prompt was ${JSON.stringify(braced.state.prompt)}` };
  }
  const box = await page.getByTestId('attempt-touch').boundingBox().catch(() => null);
  if (box === null) return { played: false, why: 'the attempt has no touch stage' };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await page.mouse.down();
  await page.waitForTimeout(intent === 'miss' ? CAP_DRIVE.MISS_RELEASE_MS : holdMsIn);
  await page.mouse.up();

  const drive = await until((s) => saying(s, SESSION_PROMPTS.DRIVE) || !s.attempt, CAP_DRIVE.ASCENT_TIMEOUT_MS);
  if (saying(drive.state, SESSION_PROMPTS.DRIVE)) {
    await page.mouse.down();
    await until((s) => !s.attempt, CAP_DRIVE.ASCENT_TIMEOUT_MS);
    await page.waitForTimeout(CAP_DRIVE.DRIVE_HOLD_EXTRA_MS);
    await page.mouse.up();
  }

  const judged = await until((s) => s.feedback !== null || s.select || meetIsOver(s), CAP_DRIVE.BEAT_TIMEOUT_MS);
  return { played: true, intent, holdMs: intent === 'miss' ? CAP_DRIVE.MISS_RELEASE_MS : holdMsIn, feedback: judged.state.feedback };
}

/** The depth search, steered by the judges' line, using the shared bisection. */
function adaptFromMeet(search, feedbackText) {
  const said = feedbackText ?? '';
  const detail = said.includes(feedbackHigh)
    ? SESSION_PROMPTS.MISS_TOO_HIGH
    : said.includes(feedbackBuried)
      ? SESSION_PROMPTS.MISS_BURIED
      : '';
  return adaptDepthSearch(search, { detail });
}

/**
 * Drive whatever meet is on screen to whatever it ends on. NEVER TOUCHES THE
 * URL — the caller got here with a finger and so does everything below.
 */
async function driveMeet(intent, searchIn) {
  const startedAt = Date.now();
  const attempts = [];
  let search = searchIn;
  for (;;) {
    const state = await read();

    if (meetIsOver(state)) {
      const settled = await until((s) => s.recap || s.placeholder || s.bombed, RECAP_SETTLE_MS);
      const end = settled.state;
      return {
        ended: end.bombed ? 'bombed' : end.recap ? 'recap' : end.placeholder ? 'placeholder' : 'waiting',
        attempts,
        search,
        ms: Date.now() - startedAt,
      };
    }
    if (Date.now() - startedAt >= CAP_DRIVE.MEET_TIMEOUT_MS) {
      return { ended: 'timeout', attempts, search, ms: Date.now() - startedAt, why: 'the meet ran past its deadline' };
    }
    if (attempts.length > CAP_DRIVE.MAX_ATTEMPTS) {
      return { ended: 'overrun', attempts, search, ms: Date.now() - startedAt, why: `played ${attempts.length} attempts` };
    }

    if (state.weighIn) {
      const pressed = await pressWhenClear('weigh-in-action', CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.pressed) return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: pressed.why };
      await until((s) => !s.weighIn, CAP_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }
    if (state.openers) {
      const pressed = await pressWhenClear('openers-action', CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.pressed) return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: pressed.why };
      await until((s) => !s.openers, CAP_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }
    if (state.select) {
      const offered = await until((s) => !s.select || s.options.length > 0, CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!offered.state.select) continue;
      const order = intent === 'miss' ? CAP_DRIVE.MISS_OPTIONS : CAP_DRIVE.SAFEST_OPTIONS;
      const want = order.find((id) => offered.state.options.includes(`attempt-option-${id}`));
      if (want === undefined) {
        return {
          ended: 'stuck',
          attempts,
          search,
          ms: Date.now() - startedAt,
          why: `the attempt choice offered none of ${order.join('/')} — on screen: ${JSON.stringify(offered.state.options)}`,
        };
      }
      const pressed = await pressWhenClear(`attempt-option-${want}`, CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.pressed) return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: pressed.why };
      await until((s) => !s.select, CAP_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }
    if (state.walkout || state.deliberation || state.verdict) {
      // Three TIMED beats that run themselves out. The walk-out is also where
      // GDD §7.2's first firing moment is offered, so nothing is pressed here.
      const moved = await until((s) => s.attempt || s.select || meetIsOver(s), CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!moved.ok) return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: 'a timed beat never handed on' };
      continue;
    }
    if (state.attempt) {
      const rep = await playOneAttempt(intent, search.holdMs);
      attempts.push({ attempt: state.attemptLabel, ...rep });
      if (!rep.played) return { ended: 'stuck', attempts, search, ms: Date.now() - startedAt, why: rep.why };
      if (intent === 'make') search = adaptFromMeet(search, rep.feedback);
      continue;
    }
    await page.waitForTimeout(CAP_DRIVE.POLL_MS);
  }
}

// ---------------------------------------------------------------------------
// The run: one goto, three legs, a finger on every transition
// ---------------------------------------------------------------------------

/**
 * WHAT EACH LEG IS FOR. Read the header's "WHY THE MEET IS DELIBERATELY BOMBED"
 * block before changing the intents: legs 2 and 3 are the ones whose qualifying
 * beat does not depend on the day's seed, and there are two of them on purpose.
 */
const LEGS = Object.freeze([
  Object.freeze({ n: 1, intent: 'make', why: 'a played meet — nine walk-outs and the recap, GDD §7.2’s "one meet is one sitting"' }),
  Object.freeze({ n: 2, intent: 'miss', why: "the same sitting again after the host went away — GDD §6.3's bomb-out, allowed in every sitting" }),
  Object.freeze({ n: 3, intent: 'miss', why: 'and once more, so the count bites on a day when leg 1 fires nothing' }),
]);

const legRecords = [];
let teardowns = 0;
let drive = null;

await page.goto(url, { waitUntil: 'load' });
const booted = await until((s) => s.checkIn, CAP_DRIVE.BOOT_TIMEOUT_MS);
check(booted.ok, "the app opens on GDD §3.2's daily session with no query string", `search=${JSON.stringify(booted.state.search)} after ${booted.ms}ms`);
check(booted.state.search === '', 'CONTROL: the address bar carries no query string — this is the played arm, not a debug frame', JSON.stringify(booted.state.search));

let search = freshDepthSearch();
if (booted.ok) {
  for (const leg of LEGS) {
    await page.evaluate((n) => window.__cutInCapLeg(n), leg.n);

    const opened = await pressWhenClear('shell-open-meet', CAP_DRIVE.BEAT_TIMEOUT_MS);
    if (!opened.pressed) {
      check(false, `leg ${leg.n}: the shell's own control opens meet day`, opened.why);
      break;
    }
    const onMeet = await until((s) => s.meetScreen || s.weighIn, CAP_DRIVE.BEAT_TIMEOUT_MS);
    check(onMeet.ok, `leg ${leg.n}: meet day was reached with a finger, not a URL — ${leg.why}`, `search=${JSON.stringify(onMeet.state.search)}`);
    if (!onMeet.ok) break;

    drive = await driveMeet(leg.intent, search);
    search = drive.search;
    legRecords.push({
      n: leg.n,
      intent: leg.intent,
      whatItIsFor: leg.why,
      ended: drive.ended,
      attempts: drive.attempts,
      ms: drive.ms,
      stuckBecause: drive.why ?? null,
    });
    console.log(
      `leg ${leg.n} (${leg.intent})  ${drive.attempts.length} attempts in ${drive.ms}ms -> '${drive.ended}'` +
        (drive.why === undefined ? '' : `  (${drive.why})`),
    );
    /**
     * WAIT UNTIL THE ENDING IS ACTUALLY DRAWN, WHICH IS NOT WHEN IT MOUNTS.
     *
     * `leg-3-bombed.png` was a FLAT DARK RECTANGLE — 7KB of nothing — filed
     * beside a record saying the leg reached GDD §6.3's bomb-out screen and
     * offered its beat. Two wrong diagnoses before the right one, both worth
     * recording because each looked sufficient:
     *
     *   1. "The shutter fires before the view mounts." It does not. `bombExit`
     *      is in the DOM 2ms after `driveMeet` returns. Waiting on presence
     *      changed nothing and produced a byte-identical blank frame, now with
     *      a GREEN CHECK claiming the photograph was of something — a check
     *      asserting a falsehood is worse than no check.
     *   2. "The bomb-out screen renders nothing on a repeat leg." Also wrong,
     *      and it would have been a real app defect.
     *
     * THE APP IS CORRECT AND THE INSTRUMENT WAS NAIVE. `BombOutView` opens
     * with `BOMB_OUT_SILENCE_MS` of a deliberately almost-empty screen — its
     * own header calls that beat out — and then fades four rows in, staggered.
     * The exit is the LAST row. So the element is present, transparent, and
     * the photograph was of a real screen at a real moment: the silence.
     *
     * The wait is therefore computed from the app's own stagger arithmetic,
     * read from source rather than transcribed, and the check reads EFFECTIVE
     * OPACITY rather than presence — the distinction the blank frame is
     * entirely made of.
     */
    let arrivedMs = 0;
    let drawn = 1;
    if (drive.ended === 'bombed') {
      arrivedMs = bombOutLastRowMs === null ? CAP_DRIVE.BOMB_OUT_EXIT_TIMEOUT_MS : bombOutLastRowMs;
      await until((s) => s.bombExit, CAP_DRIVE.BOMB_OUT_EXIT_TIMEOUT_MS);
      await page.waitForTimeout(arrivedMs);
      drawn = await effectiveOpacity('bomb-out-action');
    } else if (drive.ended === 'recap') {
      const seen = await until((s) => s.leaveMeet, CAP_DRIVE.BEAT_TIMEOUT_MS);
      arrivedMs = seen.ms;
      drawn = await effectiveOpacity('meet-recap');
    }
    check(
      drawn >= CAP_DRIVE.DRAWN_MIN_OPACITY,
      `leg ${leg.n}: the '${drive.ended}' screen is DRAWN, not merely mounted, before the shutter`,
      `effective opacity ${drawn.toFixed(3)} after ${arrivedMs}ms` +
        (drive.ended === 'bombed'
          ? ` (BOMB_OUT_SILENCE_MS + ${bombOutRowOrderAction} x BOMB_OUT_ROW_STAGGER_MS + BOMB_OUT_ROW_FADE_MS, read from meetTuning.ts)`
          : ''),
    );
    await page.screenshot({ path: path.join(outDir, `leg-${leg.n}-${drive.ended}.png`) });

    if (leg.n === LEGS.length) break;

    // ...and OUT, the way the screen offers. A bomb-out draws its own exit
    // (`SHELL_NAV` gives that beat no chrome); every other ending uses the
    // shell's pill.
    const exitId = drive.ended === 'bombed' ? 'bomb-out-action' : 'shell-leave-meet';
    if (drive.ended === 'bombed') {
      await until((s) => s.bombExit, CAP_DRIVE.BOMB_OUT_EXIT_TIMEOUT_MS);
    }
    const left = await pressWhenClear(exitId, CAP_DRIVE.BEAT_TIMEOUT_MS);
    if (!left.pressed) {
      check(false, `leg ${leg.n}: the way out of the meet took a press`, left.why);
      break;
    }
    const back = await until((s) => s.checkIn && !s.meetScreen, CAP_DRIVE.BEAT_TIMEOUT_MS);
    // THE TEARDOWN IS THE WHOLE POINT. `AppShell`'s surface ternary un-mounts
    // `MeetScreen`, and `CutInHost` goes with it — which is the moment a host
    // that re-opened its own gate session would mint a second slot.
    if (back.ok) teardowns += 1;
    check(back.ok, `leg ${leg.n}: the meet surface really went away — CutInHost un-mounted`, `back on the check-in after ${back.ms}ms, meet-screen present: ${back.state.meetScreen}`);
    if (!back.ok) break;
    await page.waitForTimeout(CAP_DRIVE.SETTLE_MS);
  }
}

await page.waitForTimeout(WHOLE_BEAT_MS + CAP_DRIVE.CUT_IN_CLEAR_SLACK_MS);
const recorder = await page.evaluate(() => ({
  ...window.__cutInCap,
  endedDay: new Date().toDateString(),
}));

// ---------------------------------------------------------------------------
// The non-vacuity guards, and then the assertion
// ---------------------------------------------------------------------------

check(
  recorder.polls > 0,
  'CONTROL: the in-page recorder ran at all',
  `${recorder.polls} polls at ${CAP_DRIVE.RECORDER_POLL_MS}ms; without this, "no second cut-in" is what a dead instrument reports`,
);
check(
  recorder.startedDay === recorder.endedDay,
  'CONTROL: the local calendar day did not turn over mid-run, so all three legs are ONE sitting',
  `${recorder.startedDay} -> ${recorder.endedDay}; cutInSessionId('meet', day) is a function of this`,
);
check(
  teardowns === LEGS.length - 1,
  `CONTROL: the host was torn down between legs — exactly ${LEGS.length - 1} times`,
  `saw ${teardowns}; a run where the surface never went away would not have exercised the remount at all`,
);
const bombedLegs = legRecords.filter((l) => l.intent === 'miss' && l.ended === 'bombed').length;
const wantBombed = LEGS.filter((l) => l.intent === 'miss').length;
check(
  bombedLegs === wantBombed,
  `CONTROL: the ${wantBombed} deliberately-bombed legs each reached GDD §6.3's bomb-out screen and OFFERED the beat`,
  `${bombedLegs} of ${wantBombed}; endings were ${JSON.stringify(legRecords.map((l) => `${l.n}:${l.ended}`))}. ` +
    'Without this, "exactly one cut-in" is also what a run that never offered a second qualifying beat reports.',
);
const withQueryString = recorder.log.filter((c) => c.search !== '');
check(
  withQueryString.length === 0,
  'CONTROL: every cut-in counted was on the played arm — no query string in the address bar',
  `${withQueryString.length} of ${recorder.log.length} carried one`,
);

const fired = recorder.log.length;
const roll = (c) =>
  `leg ${c.leg} @${c.at}ms ${JSON.stringify(c.line)} over ${c.over.join(',') || 'nothing'}` +
  `${c.goneAt === null ? ' (still up)' : ` gone at ${c.goneAt}ms after ${c.goneAt - c.at}ms`}`;
check(
  fired === THE_CAP,
  `GDD §7.2 / §12.3: ONE SITTING, ONE CUT-IN — ${LEGS.length} legs of one meet-day sitting fired exactly ${THE_CAP}`,
  fired === THE_CAP
    ? roll(recorder.log[0])
    : fired > THE_CAP
      ? `${fired} CUT-INS IN ONE SITTING. §12.3 refuses more than ${THE_CAP}. They were:\n` +
        recorder.log.map((c) => `        ${roll(c)}`).join('\n')
      : `NONE. The guards above say the beat qualified and the recorder was alive, so this is not a scarcity roll — ` +
        `the cut-in did not reach the screen. Legs: ${JSON.stringify(legRecords.map((l) => `${l.n}:${l.ended}`))}`,
);

// ---------------------------------------------------------------------------

async function writeRecord(rec, legs) {
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'cap.json'),
    `${JSON.stringify(
      {
        capturedFrom,
        theCap: THE_CAP,
        premise: { bombOutAllowance, enterMs, holdMs, wholeBeatMs: enterMs === null || holdMs === null ? null : enterMs + holdMs },
        legs,
        cutIns: rec === null ? [] : rec.log,
        recorderPolls: rec === null ? 0 : rec.polls,
        checks,
        /**
         * THE RED LINES. Required, not decorative: `tools/evidence.mjs` refuses
         * a tracked record whose `failures` array is non-empty, and it can only
         * do that if the array EXISTS — a record with no `failures` key is
         * skipped by that gate entirely, so a red run would commit and verify
         * as green. This record was tracked without one and the gate caught it
         * on its first use.
         *
         * `reds()` is the single source for both this array and the exit code
         * below, so the file cannot report green beside a process exiting 1.
         * That is arranged by construction rather than asserted, because a
         * check comparing two counters that are incremented together is a check
         * nothing can redden.
         */
        failures: reds(),
        pageErrors,
      },
      null,
      2,
    )}\n`,
  );
}

await writeRecord(recorder, legRecords);

if (pageErrors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of pageErrors.slice(0, 10)) console.log('  ', e);
}
await browser.close();

console.log(`\n${checks.length} checks, ${failed} failed. ${fired} cut-in(s) across ${legRecords.length} leg(s) of one sitting.`);
process.exit(reds().length === 0 ? 0 : 1);
