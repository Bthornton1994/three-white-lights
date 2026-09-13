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
 * IT COUNTS THE REFUSAL, NOT ONLY THE SCREEN — AND THAT WAS THE HOLE
 * ===========================================================================
 * COUNTING OVERLAYS CANNOT TELL THE TWO INTERESTING BUILDS APART, and this
 * tool's own guard used to say so in place: "this sees the screen, not the
 * offer". Legs 2 and 3 only ever had to REACH the bomb-out screen. A build
 * where `BombOutView` stopped offering its beat — the `useOfferCutIn` line
 * deleted, or `bombedOut` arriving `false` — produces a byte-identical green
 * record, because the one cut-in the run counts came from leg 1 and nothing
 * downstream ever asked the gate for a second. The committed record shows leg 1
 * firing, so the committed record is exactly that case. "A gate that happens to
 * fire once because no caller asks twice has not met the bar."
 *
 * `src/cutin/cutInObserver.ts` closes it FOR LEGS 2 AND 3, AND THE FIRST
 * VERSION OF THIS SENTENCE SAID "closes it" FLAT. That was wrong and a critic
 * caught it one round later: the ASK and REFUSAL checks below filter the gate
 * log to `moment === 'bomb-out'` on the missed legs, so LEG 1 — the played
 * meet, which is where §7.2's FIRST firing moment (the third-attempt walk-out
 * §12.2 grades this game on) and BOTH PR sub-moments are reported — had no
 * offer assertion at all. Deleting `useOfferCutIn` from `WalkoutView` or
 * `RecapView` left every check in this file green.
 *
 * Leg 1 is now asserted too, below. What each half covers is stated where it is
 * asserted rather than summarised here, because a summary is what went stale. `CutInHost.offer` hands EVERY
 * decision — fires and refusals — to a bounded in-app log, published as a
 * read-only getter on `globalThis` under a name this tool READS FROM SOURCE
 * rather than types. The in-page recorder drains it on the same 16 ms poll it
 * watches the DOM on and stamps each entry with the leg and the address bar, so
 * the record can say:
 *
 *   - THE ASK      exactly two `meet-over` beats reached the gate, on legs 2
 *                  and 3, and the gate recognised both as §7.2's bomb-out.
 *   - THE REFUSAL  every one of them that did not take the slot was refused for
 *                  `session-cap-reached` — §12.3's rule by name, not
 *                  `held-back-for-scarcity` and not `no-qualifying-moment`.
 *   - THE GRANT    the gate granted exactly one across the whole sitting, and
 *                  that number equals the number of overlays that reached the
 *                  screen.
 *
 * The observer QUOTES the decision; it calls `momentsFor` nowhere and re-derives
 * nothing, so it cannot disagree with the gate about a verdict — it can only
 * fail to have one. What it therefore does not catch is a gate that is wrong in
 * the same way twice; that is `cutInGate.test.ts`'s job.
 *
 * ===========================================================================
 * THE GRANT COUNT AND THE OVERLAY COUNT ARE TWO INSTRUMENTS, ON PURPOSE
 * ===========================================================================
 * The DOM recorder logs a `false -> true` transition of `[data-testid="cut-in"]`.
 * `CutInHost` renders from `live !== null` and `CutInView`'s `Pressable` is
 * RECONCILED IN PLACE when `live` changes A -> B, so two cut-ins with no gap
 * between them would be counted as ONE — the same undercount direction this
 * header calls "the one error that makes the whole measurement read low, i.e.
 * green", guarded for a stalled poller and not for its sibling.
 *
 * Today's app cannot produce that overlap. Two things now stand where nothing
 * did: the gate-side grant count is immune to it and is pinned equal to the
 * overlay count, and every overlay's on-screen span is compared against one
 * whole beat, so a merged pair reads as a double-length overlay rather than as
 * a single one.
 *
 * ===========================================================================
 * THE NON-VACUITY GUARDS, AND WHAT EACH ONE STOPS
 * ===========================================================================
 * "Exactly one" is satisfiable by a build where cut-ins never fire, by a
 * recorder that never ran, and by three legs that were three different
 * sittings. Each of those has a guard, and each guard pins a COUNT:
 *
 *   - the recorder polled, AND never stalled longer  (worst gap < one beat)
 *     than one whole cut-in. `polls > 0` alone was a
 *     BOUND that pinned nothing: a recorder that ran
 *     9000 times and stalled once for two seconds
 *     reports a healthy count and a LOW fire count,
 *     and low is the direction that looks like a pass.
 *   - legs 2 and 3 both REACHED the bomb-out screen (exactly 2)
 *   - ...and both OFFERED it to the gate            (exactly 2 asks)
 *   - the gate's own log did not overflow           (exactly 0 dropped)
 *   - the host really went away between legs        (exactly 2 teardowns)
 *   - the local calendar day did not change         (one sitting id)
 *   - the bomb-out rate is still 1                  (the beat still qualifies)
 *   - one cut-in was PHOTOGRAPHED with its art at   (exactly 1 frame)
 *     full opacity, so the run's central claim does
 *     not rest entirely on a presence poll
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
 * cannot hold a browser witness (CLAUDE.md), so the witnesses are recorded in
 * `BROWSER_MUTATION_WITNESSES` below — verbatim mutant, verbatim reddened check
 * — and in the merge commit that introduces them.
 *
 * THE PREVIOUS SENTENCE HERE WAS FALSE AS WRITTEN. It said the witness was
 * recorded "in the block above `THE_CAP`", and that block held a paragraph of
 * prose with no mutant text and no reddened check text in it. It is the shape
 * CLAUDE.md has now caught nine times: a sentence written while it was true,
 * kept after the thing it pointed at moved. The array below is the correction.
 *
 * Usage:
 *   node tools/verify-cutin-cap.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { enterMeetFromCalendar, completeCreateIfNeeded } from './enterMeetFromCalendar.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  constStringInSource,
  numberInBlock,
  numberInSource,
  parserSelfTest,
  stringInSource,
} from './readTuning.mjs';
import { SESSION_DRIVE, SESSION_PROMPTS, adaptDepthSearch, freshDepthSearch } from './sessionDrive.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
// Refuses (with the reason and the fix named) unless tools/dev-web.sh started the
// server this URL names and it is still that process on that port — see
// devServerSentinel.mjs's header. UNMANAGED_DEV_SERVER=1 skips it, loudly.
gateDevServer({ url });
const outDir = path.resolve(flag('out', '.gauntlet/shots/cutin-cap'));
const srcRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));

/**
 * THE BROWSER WITNESSES, WHERE THE SENTENCE ABOVE SAID THEY WERE AND WERE NOT.
 *
 * CLAUDE.md: "`MUTATION_WITNESSES` cannot hold a browser check, and that is a
 * hole in the rule above." The schema resolves `testFile`/`redAssertion` against
 * a vitest `it(` body, and nothing in `tools/` has one. So these are recorded in
 * the same two fields, unresolvable by machine, and they expire the moment
 * either the mutant's subject or the check's text is edited away — by a reader
 * noticing, which is the honest limit rather than a guarantee.
 *
 * EVERY ROW WAS RUN. `mutant` is the verbatim edit, `redCheck` is the verbatim
 * `what` string of the check that went red. `wasRedBefore` on the first row is
 * the measurement that says which hole was open.
 */
const BROWSER_MUTATION_WITNESSES = Object.freeze([
  Object.freeze({
    subject: 'src/meet/BombOutView.tsx',
    mutant: "useOfferCutIn([{ kind: 'meet-over', bombedOut: true }]);  ->  useOfferCutIn([]);",
    wasRedBefore: false,
    wasRed: true,
    // RE-RUN, NOT TRANSCRIBED, when Sprint 1c shrank the run to two legs and
    // the ASK's wording moved with the leg count: mutant re-applied at this
    // tree, same two checks red ("0 of 1, on legs [] (expected [2])"), source
    // restored, run green again at 31/0.
    redCheck:
      "GDD §7.2: THE ASK — the 1 deliberately-bombed legs each OFFERED GDD §6.3's bomb-out beat TO THE GATE",
    alsoRed:
      "GDD §12.3: THE REFUSAL — every bomb-out beat that did not take the slot was refused for 'session-cap-reached'",
    note:
      'THE DEFECT THIS ROUND EXISTS FOR. The row shipped once with redCheck reading ' +
      '"FILLED IN BY THE RUN BELOW" — a placeholder published verbatim into cap.json, under a ' +
      'header claiming every row was run with the verbatim text of what reddened. A critic found ' +
      'it there. RESOLVED BY RUNNING THE MUTANT RATHER THAN BY EDITING THE STRING: wasRed was ' +
      'TRUE, so the header was right and the field was the lie. The run reddened TWO checks, both ' +
      'recorded — the ASK is the one that names the hole, the REFUSAL follows from it because a ' +
      'beat nobody offers is a beat nothing can refuse.',
  }),
]);

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
  /**
   * HOW MANY CUT-INS THIS TOOL PHOTOGRAPHS.
   *
   * Not a budget — a shutter count. No committed pixel in
   * `.gauntlet/shots/cutin-cap/` had ever shown a cut-in: the three PNGs are
   * evidence that each leg reached a real ending and had finished drawing, and
   * nothing else. The tool knew when one was up and never took the picture, so
   * the run's central claim rested entirely on a presence poll — in a repository
   * whose lesson two commits earlier was that presence is not visibility.
   *
   * One, because the cap says there is one to photograph. The check below pins
   * the count at `THE_CAP` rather than at this number, so raising it does not
   * quietly turn the pin into a bound.
   */
  CUT_IN_SHOTS_MAX: 1,
  /**
   * HOW MUCH LONGER THAN ONE WHOLE BEAT AN OVERLAY MAY BE ON SCREEN.
   *
   * It has to sit STRICTLY BETWEEN the jitter of one beat and the length of two,
   * because that is the whole discrimination: a pair of cut-ins reconciled in
   * place (`live` A -> B with no gap) is counted once by a DOM transition
   * watcher and reads as an overlay of about `2 x WHOLE_BEAT_MS`. Measured spans
   * on a clean run are ~1732 ms against a nominal 1720, so the slack covers the
   * 16 ms poll granularity and a frame or two of scheduling, and the threshold
   * lands at 2120 ms against a merged pair's ~3440.
   */
  CUT_IN_SPAN_SLACK_MS: 400,
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
    ['verify-cutin-cap.mjs', 'sessionDrive.mjs', 'readTuning.mjs', 'enterMeetFromCalendar.mjs'].map((name) => {
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
const observerText = await readFile(path.join(srcRoot, 'src', 'cutin', 'cutInObserver.ts'), 'utf8');
const bombOutViewText = await readFile(path.join(srcRoot, 'src', 'meet', 'BombOutView.tsx'), 'utf8');

/**
 * THE NAME THE GATE'S OWN LOG TAKES ON `globalThis`, READ FROM THE APP.
 *
 * Typed here, it would be the exact hazard `readTuning.mjs` exists against: a
 * renamed channel would make the drain find nothing, the offer log would be
 * empty, and "the gate refused" would become unaskable while the file that asked
 * it stayed green on everything else. Read, so a rename is a RED premise.
 */
const observerGlobal = constStringInSource(observerText, 'CUT_IN_OBSERVER_GLOBAL');

const bombOutAllowance = numberInBlock(tuningText, 'SESSION_ALLOWANCE', 'bomb-out');
const enterMs = numberInSource(tuningText, 'ENTER_MS');
const holdMs = numberInSource(tuningText, 'HOLD_MS');
/** Enter plus hold: how long a cut-in is on screen if nobody taps it. */
const wholeBeatMs = enterMs === null || holdMs === null ? Number.POSITIVE_INFINITY : enterMs + holdMs;
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
/**
 * AND THE SAME ARITHMETIC FOR THE RECAP, because the arm below needed it and
 * did not have it. `RecapView` staggers rows inside `Block`; the exit
 * (`RECAP_ROW_ORDER.CARD`) is the last one, so the screen has finished
 * assembling at `CARD * STAGGER + FADE`. Read, not typed, for the reason the
 * block above gives.
 */
const recapStaggerMs = numberInSource(meetTuningText, 'RECAP_ROW_STAGGER_MS');
const recapFadeMs = numberInSource(meetTuningText, 'RECAP_ROW_FADE_MS');
const recapRowOrderCard = numberInBlock(meetTuningText, 'RECAP_ROW_ORDER', 'CARD');
const recapLastRowMs =
  recapStaggerMs === null || recapFadeMs === null || recapRowOrderCard === null
    ? null
    : recapRowOrderCard * recapStaggerMs + recapFadeMs;
check(
  recapLastRowMs !== null,
  "CONTROL: the recap screen's own arrival arithmetic was READ, not guessed",
  recapLastRowMs === null
    ? 'COULD NOT READ one of RECAP_ROW_STAGGER_MS / RECAP_ROW_FADE_MS / RECAP_ROW_ORDER.CARD out of meetTuning.ts'
    : `${recapRowOrderCard} x ${recapStaggerMs} + ${recapFadeMs} = ${recapLastRowMs}ms`,
);

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
check(
  observerGlobal !== null,
  "CONTROL: the gate's own decision log has a name, and it was READ from src/cutin/cutInObserver.ts",
  observerGlobal === null
    ? 'COULD NOT READ CUT_IN_OBSERVER_GLOBAL — without it the drain below looks for nothing and every offer check is unaskable'
    : `${JSON.stringify(observerGlobal)}; the in-page recorder drains this on the same poll it watches the DOM on`,
);

/**
 * "A container is the wrong probe when the animation is on the children" is
 * the lesson a blank committed frame and a t≈50ms recap were made of, and the
 * scan below is the control on every probe choice that rests on "nothing
 * animates": it must still SEE animation where animation is, or the claim
 * "this screen is static" is being made by a pattern that stopped matching.
 */
const ANIMATES = /\b(?:Animated|withTiming|withDelay|useAnimatedStyle|useSharedValue)\b/;
const bombOutAnimates = ANIMATES.test(bombOutViewText);
check(
  bombOutAnimates,
  'CONTROL: the animation scan still sees a screen that animates, so a probe choice resting on "nothing animates" is a claim the scan could refute',
  `BombOutView.tsx animates: ${bombOutAnimates} (must be true, or the pattern has stopped matching and every` +
    ' probe-the-container decision below rests on a scan that sees nothing). The placeholder half of this' +
    ' control went with the placeholder (Sprint 1c): the refused ending is one static Text inside' +
    ' MeetScreen.tsx, which animates elsewhere, so a file-level scan cannot isolate that arm and does not claim to.',
);

if (!readEverything || bombOutAllowance !== 1 || observerGlobal === null) {
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
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
// Sprint 2: the server persists a lifter across boots. Every goto in this tool
// means a FRESH one, so the boundary is armed rather than assumed.
await armFreshLifterPerBoot(context);
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
 *
 * IT WATCHES TWO THINGS, NOT ONE. The DOM half counts what reached the SCREEN.
 * The drain half reads `src/cutin/cutInObserver.ts`'s log — every decision
 * `CutInHost.offer` made, fires AND refusals — and stamps each new entry with
 * the leg and the address bar. A refusal and an offer nobody made are the same
 * picture, so the picture alone could never say which of them happened, and
 * that is the hole this half exists for.
 */
await page.addInitScript(
  ({ pollMs, beats, observerKey }) => {
    window.__cutInCap = {
      log: [],
      // WHAT THE GATE WAS ASKED AND WHAT IT ANSWERED, drained from the app's own
      // log. `observerSeen` is separate from `offers.length` on purpose: an
      // empty log with the channel OPEN is a build where a screen stopped
      // offering — the defect — and an empty log with the channel MISSING is a
      // build where the observer never loaded. Collapsing the two would put the
      // fix's own bug one level out.
      offers: [],
      offerSeq: -1,
      observerSeen: false,
      observerDropped: 0,
      polls: 0,
      // THE WORST GAP BETWEEN TWO POLLS, which is the only quantity that
      // decides whether a cut-in can be missed. `polls > 0` is a BOUND and
      // pins nothing: a recorder that ran 9000 times and stalled once for two
      // seconds reports a healthy count and a low fire count, and low is the
      // direction that looks like a pass. setInterval does not promise its
      // period — on the run that prompted this, 9398 polls over 203s averaged
      // ~23ms against a nominal 16, so ~28% of the schedule was already lost.
      worstGapMs: 0,
      lastAt: null,
      up: false,
      leg: 0,
      startedDay: new Date().toDateString(),
    };
    window.__cutInCapLeg = (n) => {
      window.__cutInCap.leg = n;
    };
    setInterval(() => {
      const s = window.__cutInCap;
      s.polls += 1;
      const now = performance.now();
      if (s.lastAt !== null) {
        const gap = now - s.lastAt;
        if (gap > s.worstGapMs) s.worstGapMs = gap;
      }
      s.lastAt = now;
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

      // ---- and the gate's own log ---------------------------------------
      const readGateLog = window[observerKey];
      if (typeof readGateLog === 'function') {
        s.observerSeen = true;
        const taken = readGateLog();
        s.observerDropped = taken.dropped;
        for (const o of taken.observations) {
          if (o.seq <= s.offerSeq) continue;
          s.offerSeq = o.seq;
          s.offers.push({
            seq: o.seq,
            leg: s.leg,
            at: Math.round(performance.now()),
            sessionId: o.sessionId,
            beatKinds: o.beatKinds,
            outcome: o.outcome,
            moment: o.moment,
            refusal: o.refusal,
            firedCountBefore: o.firedCountBefore,
            firedCountAfter: o.firedCountAfter,
            search: window.location.search,
          });
        }
      }
    }, pollMs);
  },
  {
    pollMs: CAP_DRIVE.RECORDER_POLL_MS,
    observerKey: observerGlobal,
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
      'meet-refused',
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
      refused: has('meet-refused'),
      openCareer: has('shell-open-career'),
      cutIn: has('cut-in'),
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

/**
 * THE SHUTTER FOR THE INTERRUPT ITSELF.
 *
 * No committed pixel in `.gauntlet/shots/cutin-cap/` had ever shown a cut-in.
 * The three PNGs are evidence that each leg reached a real ending and had
 * finished drawing — a real and hard-won claim, and not a claim about cut-ins.
 * The tool knew when one was up and never took the picture, so the record's
 * central claim rested entirely on a presence poll, in a repository whose lesson
 * two commits earlier was that presence is not visibility.
 *
 * IT WAITS THE APP'S OWN `ENTER_MS` OUT FIRST, which is the same mistake this
 * file has already made twice in the other direction: the overlay fades in, so a
 * shutter that fires at the instant `[data-testid="cut-in"]` appears photographs
 * a transparent rectangle and files it beside a green line. The wait is read
 * from `cutInTuning.ts`, the opacity is measured up the whole parent chain, and
 * the measurement is what the check below compares — not the fact that a file
 * was written.
 *
 * IT RETURNS WHETHER IT SHOT, because the caller's `state` is stale afterwards.
 * The budget is only consumed on a shot that landed: an overlay that left during
 * the fade is not a photograph and must not spend the one this run is pinned to.
 */
const cutInShots = [];
let currentLeg = 0;
async function maybePhotographCutIn(state) {
  if (cutInShots.length >= CAP_DRIVE.CUT_IN_SHOTS_MAX) return false;
  if (!state.cutIn) return false;
  await page.waitForTimeout(enterMs);
  const still = await read();
  if (!still.cutIn) return true;
  const artOpacity = await effectiveOpacity('cut-in-art');
  const lineOpacity = await effectiveOpacity('cut-in-line');
  const file = `cut-in-leg-${currentLeg}.png`;
  await page.screenshot({ path: path.join(outDir, file) });
  cutInShots.push({ file, leg: currentLeg, artOpacity, lineOpacity, afterEnterMs: enterMs });
  return true;
}

/**
 * Wait `ms`, WATCHING. A bare `waitForTimeout` is a window in which a cut-in can
 * arrive, be photographed by nobody and leave — and the bomb-out arm waits 4220
 * of them. At least `ms`, possibly more if the shutter fires inside it, which is
 * the right direction for every caller here.
 */
async function settleWatching(ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    const left = deadline - Date.now();
    if (left <= 0) return;
    const state = await read();
    await maybePhotographCutIn(state);
    await page.waitForTimeout(Math.min(CAP_DRIVE.POLL_MS, Math.max(1, deadline - Date.now())));
  }
}

async function until(done, timeoutMs) {
  const started = Date.now();
  for (;;) {
    let state = await read();
    // The shutter first, then the verdict: photographing takes `ENTER_MS` plus a
    // screenshot, so a `done` decided on the pre-shot state would be reading a
    // screen that has moved on.
    if (await maybePhotographCutIn(state)) state = await read();
    if (done(state)) return { ok: true, state, ms: Date.now() - started };
    if (Date.now() - started >= timeoutMs) return { ok: false, state, ms: Date.now() - started };
    await page.waitForTimeout(CAP_DRIVE.POLL_MS);
  }
}

const meetIsOver = (s) => s.recap || s.waiting || s.refused || s.bombed;
const saying = (s, phrase) => s.prompt !== null && s.prompt.includes(phrase);

/**
 * EVERY WAY `driveMeet` CAN COME BACK, AS A CLOSED SET.
 *
 * It used to return bare string literals and the "is the ending DRAWN" check
 * below handled two of them with an `if / else if`. FOR EVERY OTHER ONE it
 * emitted `ok: true` reading *"the 'placeholder' screen is DRAWN … probed
 * (none): effective opacity 1.000 after 0ms"* — having probed nothing, waited
 * nothing and looked at nothing. The comment twenty-five lines above it calls
 * exactly that "a check asserting a falsehood is worse than no check", and it is
 * the fifth instance in this repository of a guard written for one arm of one
 * conditional and not its sibling.
 *
 * The `refused` ending replaced `placeholder` in Sprint 1c: the calendar
 * refuses a re-entry before a meet opens, so `MeetScreen`'s refused arm — the
 * server's sentence where the recap would be — is unreachable through the
 * app's own controls, and a leg that ends there has found a defect. It stays
 * in the closed set BECAUSE it is a screen the app can draw: an ending
 * without a probe is the green-on-nothing failure this table was built
 * against, however unlikely the ending.
 *
 * So the endings are a frozen object, `driveMeet` may only return one of its
 * values, and `ENDING_PROBE` is keyed by the same values with a control below
 * pinning the two key sets equal. A new ending cannot ship without a probe,
 * which is the structural version of the rule that a guard must be applied to
 * its sibling mechanically rather than by whoever remembers.
 */
const MEET_ENDING = Object.freeze({
  BOMBED: 'bombed',
  RECAP: 'recap',
  REFUSED: 'refused',
  WAITING: 'waiting',
  TIMEOUT: 'timeout',
  OVERRUN: 'overrun',
  STUCK: 'stuck',
});

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
      const settled = await until((s) => s.recap || s.refused || s.bombed, RECAP_SETTLE_MS);
      const end = settled.state;
      return {
        ended: end.bombed
          ? MEET_ENDING.BOMBED
          : end.recap
            ? MEET_ENDING.RECAP
            : end.refused
              ? MEET_ENDING.REFUSED
              : MEET_ENDING.WAITING,
        attempts,
        search,
        ms: Date.now() - startedAt,
      };
    }
    if (Date.now() - startedAt >= CAP_DRIVE.MEET_TIMEOUT_MS) {
      return { ended: MEET_ENDING.TIMEOUT, attempts, search, ms: Date.now() - startedAt, why: 'the meet ran past its deadline' };
    }
    if (attempts.length > CAP_DRIVE.MAX_ATTEMPTS) {
      return { ended: MEET_ENDING.OVERRUN, attempts, search, ms: Date.now() - startedAt, why: `played ${attempts.length} attempts` };
    }

    if (state.weighIn) {
      const pressed = await pressWhenClear('weigh-in-action', CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.pressed) return { ended: MEET_ENDING.STUCK, attempts, search, ms: Date.now() - startedAt, why: pressed.why };
      await until((s) => !s.weighIn, CAP_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }
    if (state.openers) {
      const pressed = await pressWhenClear('openers-action', CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.pressed) return { ended: MEET_ENDING.STUCK, attempts, search, ms: Date.now() - startedAt, why: pressed.why };
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
          ended: MEET_ENDING.STUCK,
          attempts,
          search,
          ms: Date.now() - startedAt,
          why: `the attempt choice offered none of ${order.join('/')} — on screen: ${JSON.stringify(offered.state.options)}`,
        };
      }
      const pressed = await pressWhenClear(`attempt-option-${want}`, CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!pressed.pressed) return { ended: MEET_ENDING.STUCK, attempts, search, ms: Date.now() - startedAt, why: pressed.why };
      await until((s) => !s.select, CAP_DRIVE.BEAT_TIMEOUT_MS);
      continue;
    }
    if (state.walkout || state.deliberation || state.verdict) {
      // Three TIMED beats that run themselves out. The walk-out is also where
      // GDD §7.2's first firing moment is offered, so nothing is pressed here.
      const moved = await until((s) => s.attempt || s.select || meetIsOver(s), CAP_DRIVE.BEAT_TIMEOUT_MS);
      if (!moved.ok) return { ended: MEET_ENDING.STUCK, attempts, search, ms: Date.now() - startedAt, why: 'a timed beat never handed on' };
      continue;
    }
    if (state.attempt) {
      const rep = await playOneAttempt(intent, search.holdMs);
      attempts.push({ attempt: state.attemptLabel, ...rep });
      if (!rep.played) return { ended: MEET_ENDING.STUCK, attempts, search, ms: Date.now() - startedAt, why: rep.why };
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
// TWO DIFFERENT MEETS, AND TWO IS THE APP'S OWN ARITHMETIC, NOT A BUDGET CUT.
// Since Sprint 1c a played meet is ALREADY_ENTERED on the calendar (its row
// draws no enter control), so a second sitting means the next rung — and the
// rungs open on the banked total. Measured across two runs before this
// shrank: a fresh lifter's e1RM seeds sum to 520 (180/120/220 in
// sessionTuning.ts), so NO first-meet total can reach nationals' 550 — leg 1
// made 8 of 9 and the ladder was still shut, which two readings in a row
// called the robot's variance before anyone summed the seeds. A fresh
// lifter's day therefore holds exactly two meets: the open local, and the
// regional their first total unlocks. The old leg 3 existed "so the count
// bites on a day when leg 1 fires nothing"; with one miss leg that day is
// covered by the refusal check's own two arms (leg 2's bomb-out FIRES when
// leg 1 granted nothing, and the grant pin still demands exactly one) — what
// goes unwitnessed on that rare day is the 'session-cap-reached' reason
// itself, which the check's detail names rather than hides. Each miss leg
// still carries a priority list: on a run whose total surprises upward the
// higher rung is taken and named.
const LEGS = Object.freeze([
  Object.freeze({ n: 1, intent: 'make', enter: Object.freeze(['career-enter-local']), why: 'a played meet — nine walk-outs and the recap, GDD §7.2’s "one meet is one sitting"' }),
  Object.freeze({ n: 2, intent: 'miss', enter: Object.freeze(['career-enter-nationals', 'career-enter-regional']), why: "a second sitting after the host went away — GDD §6.3's bomb-out, allowed in every sitting" }),
]);

/**
 * HOW EACH ENDING PROVES IT IS DRAWN — one row per member of `MEET_ENDING`.
 *
 * `kind: 'screen'` is an ending a player looks at, and it carries the ELEMENT to
 * probe and the wait to probe it after. The probe is the LAST STAGGERED ROW
 * where there is one, never the container: `RecapView` animates inside `Block`,
 * so `meet-recap` reads 1.000 for every state in which the recap is on screen at
 * all and no edit to the subject could redden it. `leg-1-recap.png` was filed at
 * t≈50 ms of a 1240 ms assembly beside a green line saying "effective opacity
 * 1.000".
 *
 * `kind: 'not-an-ending'` is `driveMeet` reporting that it never got there. The
 * check is RED, and it says which, because the alternative — the one this table
 * replaces — was a green line describing a probe that never happened.
 *
 * `waiting` is in the second group deliberately: `driveMeet` only reports it
 * after its own `RECAP_SETTLE_MS` settle has timed out waiting for the recap, so
 * it is the round trip failing rather than a screen the meet finished on.
 */
const ENDING_PROBE = Object.freeze({
  [MEET_ENDING.BOMBED]: Object.freeze({
    kind: 'screen',
    present: (s) => s.bombExit,
    presentTimeoutMs: CAP_DRIVE.BOMB_OUT_EXIT_TIMEOUT_MS,
    probe: 'bomb-out-action',
    arrivalMs: bombOutLastRowMs === null ? CAP_DRIVE.BOMB_OUT_EXIT_TIMEOUT_MS : bombOutLastRowMs,
    arithmetic:
      'BOMB_OUT_SILENCE_MS + ' +
      `${bombOutRowOrderAction} x BOMB_OUT_ROW_STAGGER_MS + BOMB_OUT_ROW_FADE_MS, read from meetTuning.ts`,
    exit: 'bomb-out-action',
  }),
  [MEET_ENDING.RECAP]: Object.freeze({
    kind: 'screen',
    present: (s) => s.leaveMeet,
    presentTimeoutMs: CAP_DRIVE.BEAT_TIMEOUT_MS,
    probe: 'recap-action',
    arrivalMs: recapLastRowMs === null ? CAP_DRIVE.BEAT_TIMEOUT_MS : recapLastRowMs,
    arithmetic: `${recapRowOrderCard} x RECAP_ROW_STAGGER_MS + RECAP_ROW_FADE_MS, read from meetTuning.ts`,
    exit: 'shell-leave-meet',
  }),
  [MEET_ENDING.REFUSED]: Object.freeze({
    kind: 'screen',
    present: (s) => s.refused,
    presentTimeoutMs: CAP_DRIVE.BEAT_TIMEOUT_MS,
    // A ROW WHOSE PROBE IS ITS OWN CONTAINER, safe only because the arm is one
    // static `Text` inside `MeetScreen` with no staggered assembly (the
    // refused sentence renders in `styles.waiting`, which animates nothing).
    // The ending is unreachable through the app's own controls since Sprint 1c
    // — the calendar refuses re-entry before a meet opens — so a leg ending
    // here is a red about the APP, and this row exists so that red names the
    // screen instead of probing nothing. Its way out is the shell's pill.
    probe: 'meet-refused',
    arrivalMs: CAP_DRIVE.SETTLE_MS,
    arithmetic: 'no staggered assembly — a single static text row in MeetScreen’s refused arm',
    exit: 'shell-leave-meet',
  }),
  [MEET_ENDING.WAITING]: Object.freeze({
    kind: 'not-an-ending',
    why: "the recap's round trip never completed — `driveMeet` reports this only after RECAP_SETTLE_MS of waiting for one of recap / refused / bombed",
  }),
  [MEET_ENDING.TIMEOUT]: Object.freeze({
    kind: 'not-an-ending',
    why: 'the meet ran past MEET_TIMEOUT_MS without ending',
  }),
  [MEET_ENDING.OVERRUN]: Object.freeze({
    kind: 'not-an-ending',
    why: 'more attempts were played than GDD §6.2 has, so the loop was not advancing',
  }),
  [MEET_ENDING.STUCK]: Object.freeze({
    kind: 'not-an-ending',
    why: 'a control did not take a press, or a timed beat never handed on',
  }),
});

const endingsDeclared = [...Object.values(MEET_ENDING)].sort();
const endingsProbed = [...Object.keys(ENDING_PROBE)].sort();
check(
  endingsDeclared.length === endingsProbed.length &&
    endingsDeclared.every((e, i) => e === endingsProbed[i]),
  `CONTROL: every one of the ${endingsDeclared.length} endings driveMeet can return has a row in ENDING_PROBE`,
  `declared ${JSON.stringify(endingsDeclared)}; probed ${JSON.stringify(endingsProbed)}. ` +
    'A new ending with no row is the shape that emitted "the \'placeholder\' screen is DRAWN … probed (none)".',
);

const legRecords = [];
let teardowns = 0;
let drive = null;

await page.goto(url, { waitUntil: 'load' });
const created = await completeCreateIfNeeded(page);
if (created.why) {
  check(false, "the app opens on GDD §3.2's daily session with no query string", created.why);
}
const booted = await until((s) => s.checkIn, CAP_DRIVE.BOOT_TIMEOUT_MS);
check(booted.ok, "the app opens on GDD §3.2's daily session with no query string", `search=${JSON.stringify(booted.state.search)} after ${booted.ms}ms`);
check(booted.state.search === '', 'CONTROL: the address bar carries no query string — this is the played arm, not a debug frame', JSON.stringify(booted.state.search));

let search = freshDepthSearch();
if (booted.ok) {
  for (const leg of LEGS) {
    // BOTH SIDES OF THE SAME FACT. The page stamps the leg onto what IT records
    // (overlays and gate decisions); `currentLeg` stamps it onto what the driver
    // records (the photograph). Two counters set from one line, so a frame filed
    // under leg 0 is impossible rather than merely unlikely.
    currentLeg = leg.n;
    await page.evaluate((n) => window.__cutInCapLeg(n), leg.n);

    // The same no-press-through-an-interrupt discipline `pressWhenClear`
    // applies, ahead of the calendar drive's own three presses: wait the
    // cut-in out first, then let the shared drive do the pressing.
    const clear = await until((s) => !s.cutIn, WHOLE_BEAT_MS + CAP_DRIVE.CUT_IN_CLEAR_SLACK_MS);
    if (!clear.ok) {
      check(false, `leg ${leg.n}: the calendar's own controls enter a meet`, `a cut-in was still up after ${clear.ms}ms`);
      break;
    }
    // Open the career surface first with the shared drive aimed at the leg's
    // FIRST choice; if that row is shut (the gate's answer about leg 1's
    // total), fall down the leg's priority list by probing what the calendar
    // actually draws before pressing.
    let opened = { entered: false, why: 'the leg had no enter candidates' };
    let pressedRow = null;
    for (const candidate of leg.enter) {
      opened = await enterMeetFromCalendar(page, {
        stepMs: CAP_DRIVE.BEAT_TIMEOUT_MS,
        enterTestId: candidate,
      });
      if (opened.entered) {
        pressedRow = candidate;
        break;
      }
      // The career surface is already up after a failed attempt; the helper
      // recognises a drawn career beat and skips the pill press, so the next
      // candidate goes straight to its own row's wait.
    }
    if (!opened.entered) {
      check(
        false,
        `leg ${leg.n}: the calendar's own controls enter a meet (tried ${leg.enter.join(', ')})`,
        `${opened.why} — every candidate rung was shut or absent; on this app run that is a fact about ` +
          'what leg 1 banked (the qualifying gate), and the per-attempt notes on leg 1 say how its lifting went',
      );
      break;
    }
    console.log(`    leg ${leg.n}: entered via ${pressedRow}`);
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
     *
     * AND THEN THE FIX WENT INTO ONE ARM AND NOT ITS SIBLING, IN THIS BLOCK,
     * WHICH IS THE FOURTH INSTANCE OF THAT PATTERN IN THIS REPOSITORY. The
     * bombed arm above was correct. The recap arm below waited on presence and
     * probed `meet-recap` — the plain `ScrollView` container, whose opacity
     * NOTHING ANIMATES. `RecapView` staggers its rows inside `Block`, so the
     * container reads 1.000 for every state in which the recap is on screen at
     * all, and the branch only runs once the node is present. **No edit to the
     * subject could redden it.** `leg-1-recap.png` was filed at t≈50ms of a
     * 1240ms assembly — `MEET COMPLETE` at full weight because it is the one
     * `Text` outside a `Block`, the hero total a near-black smear, the attempt
     * board absent — beside a green line reading "effective opacity 1.000".
     *
     * A container is the wrong probe when the animation is on the children.
     * Probe the LAST staggered row, and wait its own arithmetic out.
     *
     * AND THEN, THE FIFTH INSTANCE, IN THE SAME BLOCK AGAIN. The fix above
     * handled `'bombed'` and `'recap'` and let EVERY OTHER ENDING fall through
     * to `let drawn = 1; let drawnProbe = '(none)'`, which emitted `ok: true`
     * reading *"the 'placeholder' screen is DRAWN … probed (none): effective
     * opacity 1.000 after 0ms"* — a green line asserting a falsehood about a
     * probe that never ran, twenty-five lines under the sentence calling that
     * worse than no check. `ENDING_PROBE` is the structural answer: the endings
     * are a closed set, every member has a row, and a member with no row is a
     * RED control rather than a silent `1.000`.
     */
    const probe = ENDING_PROBE[drive.ended];
    let arrivedMs = 0;
    let drawn = 0;
    if (probe === undefined) {
      check(
        false,
        `leg ${leg.n}: the ending '${drive.ended}' has a row in ENDING_PROBE`,
        'it does not, so nothing was probed — this is the fall-through that used to report opacity 1.000 after 0ms',
      );
      break;
    } else if (probe.kind === 'not-an-ending') {
      check(
        false,
        `leg ${leg.n}: the meet reached an ENDING SCREEN, so there is something to photograph`,
        `it ended '${drive.ended}' — ${probe.why}${drive.why === undefined ? '' : `; driveMeet said: ${drive.why}`}`,
      );
      break;
    } else {
      arrivedMs = probe.arrivalMs;
      await until(probe.present, probe.presentTimeoutMs);
      await settleWatching(arrivedMs);
      drawn = await effectiveOpacity(probe.probe);
      check(
        drawn >= CAP_DRIVE.DRAWN_MIN_OPACITY,
        `leg ${leg.n}: the '${drive.ended}' screen is DRAWN, not merely mounted, before the shutter`,
        `probed ${probe.probe}: effective opacity ${drawn.toFixed(3)} after ${arrivedMs}ms (${probe.arithmetic})`,
      );
    }
    await page.screenshot({ path: path.join(outDir, `leg-${leg.n}-${drive.ended}.png`) });

    if (leg.n === LEGS.length) break;

    // ...and OUT, the way the screen offers. A bomb-out draws its own exit
    // (`SHELL_NAV` gives that beat no chrome); every other ending uses the
    // shell's pill — and WHICH ONE is a field of the row above rather than a
    // second ternary on `drive.ended`, because that second ternary is where the
    // sibling defect keeps getting written.
    const exitId = probe.exit;
    await until(probe.present, probe.presentTimeoutMs);
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
    await settleWatching(CAP_DRIVE.SETTLE_MS);
  }
}

await settleWatching(WHOLE_BEAT_MS + CAP_DRIVE.CUT_IN_CLEAR_SLACK_MS);
const recorder = await page.evaluate(() => ({
  ...window.__cutInCap,
  endedDay: new Date().toDateString(),
}));

// ---------------------------------------------------------------------------
// The non-vacuity guards, and then the assertion
// ---------------------------------------------------------------------------

check(
  recorder.polls > 0 && recorder.worstGapMs < wholeBeatMs,
  'CONTROL: the in-page recorder ran at all',
  `${recorder.polls} polls at a nominal ${CAP_DRIVE.RECORDER_POLL_MS}ms, worst gap ${Math.round(recorder.worstGapMs)}ms against a whole beat of ${wholeBeatMs}ms`
    + '; without this, "no second cut-in" is what a dead instrument reports — and a single stall longer than one beat hides a whole cut-in while every other line stays green',
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
const bombedLegs = legRecords.filter((l) => l.intent === 'miss' && l.ended === MEET_ENDING.BOMBED).length;
const wantBombed = LEGS.filter((l) => l.intent === 'miss').length;
const missLegNumbers = LEGS.filter((l) => l.intent === 'miss').map((l) => l.n);
check(
  bombedLegs === wantBombed,
  // NAMED FOR WHAT IT MEASURES. This computes `intent === 'miss' && ended ===
  // 'bombed'` — it observes the SCREEN, and never an offer. The pair of checks
  // below is the offer half, and they are what makes the sentence this one
  // cannot say true: a leg whose BombOutView stopped asking for a cut-in looks
  // IDENTICAL here, and on a day when leg 1 fires the `fired === THE_CAP` pin
  // does not rescue it either.
  `CONTROL: the ${wantBombed} deliberately-bombed legs each REACHED GDD §6.3's bomb-out screen (this sees the screen, not the offer)`,
  `${bombedLegs} of ${wantBombed}; endings were ${JSON.stringify(legRecords.map((l) => `${l.n}:${l.ended}`))}. ` +
    'Without this, "exactly one cut-in" is also what a run that never offered a second qualifying beat reports.',
);
const withQueryString = recorder.log.filter((c) => c.search !== '');
check(
  withQueryString.length === 0,
  'CONTROL: every cut-in counted was on the played arm — no query string in the address bar',
  `${withQueryString.length} of ${recorder.log.length} carried one`,
);

// ---------------------------------------------------------------------------
// WHAT THE GATE WAS ASKED, AND WHAT IT ANSWERED
//
// Everything above this line watches the SCREEN. A refusal and an offer nobody
// made draw the same screen, so everything above is blind to the difference
// between "the gate refused" and "nothing asked" — which is the difference
// between meeting §12.3's refusal condition and happening to look like it.
// ---------------------------------------------------------------------------

const offers = recorder.offers ?? [];
check(
  recorder.observerSeen === true && recorder.observerDropped === 0,
  "CONTROL: the gate's own decision channel was open, and its log did not overflow",
  `channel ${JSON.stringify(observerGlobal)} seen: ${recorder.observerSeen}; dropped ${recorder.observerDropped} ` +
    `(CUT_IN_TUNING.OBSERVED_DECISIONS is the bound; anything above 0 means the earliest offers of this run are gone and every count below is over a truncated log); ` +
    `${offers.length} decisions drained`,
);
const offersWithQueryString = offers.filter((o) => o.search !== '');
check(
  offersWithQueryString.length === 0,
  'CONTROL: every DECISION observed was on the played arm too — no query string in the address bar',
  `${offersWithQueryString.length} of ${offers.length} carried one. ` +
    'The sibling of the cut-in check above, applied mechanically rather than left to whoever reads this: `?cutin=` stages a beat through the same `offer`, so a decision taken down the debug arm would otherwise count here.',
);

/**
 * LEG 1'S OFFERS — THE HALF THE FIRST VERSION OF THIS SECTION DID NOT ASSERT.
 *
 * Legs 2 and 3 lean on the bomb-out because it is allowed in every sitting. Leg
 * 1 is the PLAYED meet, and it is where GDD §7.2's other three firing moments
 * are reported: the third-attempt walk-out, which is the beat §12.2 grades this
 * game on, and both PR sub-moments at the recap. None of them was checked, so
 * deleting `useOfferCutIn` from `WalkoutView` or `RecapView` left this whole
 * file green — the same "a build where a screen stopped offering produces a
 * byte-identical record" the block at the top of this file describes, still
 * true of four screens one round after being closed for the fifth.
 *
 * COUNTS, NOT PRESENCE, and derived rather than typed: one walk-out offer per
 * attempt the driver actually played on leg 1, read from that leg's own record.
 * A build that offered on some attempts and not others holds `> 0` and reddens
 * here.
 */
const legOne = legRecords.find((l) => l.n === 1) ?? null;
const legOneAttempts = legOne === null ? 0 : legOne.attempts.length;
const walkoutOffers = offers.filter((o) => o.leg === 1 && o.beatKinds.includes('meet-walkout'));
check(
  legOneAttempts > 0 && walkoutOffers.length === legOneAttempts,
  "GDD §7.2: THE ASK, LEG 1 — every attempt the player lifted OFFERED its walk-out beat to the gate",
  `${walkoutOffers.length} walk-out offer(s) against ${legOneAttempts} attempt(s) played on leg 1. ` +
    'This is the beat §12.2 grades meet day on. Deleting useOfferCutIn from WalkoutView, or letting ' +
    'bombRisk arrive always-true so the gate reads every walk-out as no qualifying moment, reddens ' +
    'here — and used to redden nothing in this file.',
);

/**
 * And the recap's PR ask. `RecapView` offers ONE decision carrying both record
 * sub-kinds, so this pins one offer and both kinds inside it rather than two
 * offers — the shape is read off the observation, not assumed.
 */
const recordOffers = offers.filter((o) => o.leg === 1 && o.beatKinds.includes('record'));
const recordKindCount = recordOffers.reduce(
  (n, o) => n + o.beatKinds.filter((k) => k === 'record').length,
  0,
);
check(
  recordOffers.length === 1 && recordKindCount === 2,
  "GDD §7.2: THE ASK, LEG 1 — the recap OFFERED both PR sub-moments the app can reach",
  `${recordOffers.length} record offer(s) carrying ${recordKindCount} record beat(s); want 1 carrying 2. ` +
    "§7.2 names three PR sub-moments and only two are reachable by any screen — 'tier' by none, which " +
    'cutInGate.ts §5 discloses. So two is the whole of what the app can ask for, and a drop to one ' +
    'means a screen stopped asking rather than that the third arrived.',
);

/** Offers the gate recognised as GDD §6.3's bomb-out. */
const bombOffers = offers.filter((o) => o.beatKinds.includes('meet-over') && o.moment === 'bomb-out');
const bombOfferLegs = bombOffers.map((o) => o.leg);
check(
  bombOffers.length === wantBombed &&
    bombOfferLegs.length === missLegNumbers.length &&
    bombOfferLegs.every((n, i) => n === missLegNumbers[i]),
  `GDD §7.2: THE ASK — the ${wantBombed} deliberately-bombed legs each OFFERED GDD §6.3's bomb-out beat TO THE GATE`,
  `${bombOffers.length} of ${wantBombed}, on legs ${JSON.stringify(bombOfferLegs)} (expected ${JSON.stringify(missLegNumbers)}). ` +
    'This is the line the screen check above cannot say. A build where BombOutView stopped offering — the `useOfferCutIn` line gone, or `bombedOut` arriving false so the gate reads the beat as no moment at all — leaves every other check in this file green and reddens here.',
);

/** How many of those took the slot: 0 on a day leg 1 fired, 1 on a day it did not. */
const bombFires = bombOffers.filter((o) => o.outcome === 'fire').length;
const bombCapRefusals = bombOffers.filter((o) => o.refusal === 'session-cap-reached').length;
check(
  bombCapRefusals === wantBombed - bombFires,
  `GDD §12.3: THE REFUSAL — every bomb-out beat that did not take the slot was refused for 'session-cap-reached'`,
  `${bombCapRefusals} refused by the CAP, ${bombFires} fired, against ${wantBombed} asked. ` +
    `Reasons in order: ${JSON.stringify(bombOffers.map((o) => o.refusal ?? `FIRED:${o.moment}`))}. ` +
    "Not 'held-back-for-scarcity' — that is §7.2's soft rate and SESSION_ALLOWANCE['bomb-out'] is 1 — and not 'no-qualifying-moment', which would mean the beat never qualified. " +
    'Nothing asked at all gives 0 against a want of ' + `${wantBombed}, which is red.`,
);

const grants = offers.filter((o) => o.outcome === 'fire');
check(
  grants.length === THE_CAP,
  `GDD §12.3: THE GRANT — the gate granted exactly ${THE_CAP} cut-in across the whole sitting`,
  `${grants.length} grant(s): ${JSON.stringify(grants.map((g) => `leg ${g.leg} ${g.moment} (count ${g.firedCountBefore}->${g.firedCountAfter})`))}. ` +
    `Every other decision was a refusal: ${JSON.stringify([...new Set(offers.filter((o) => o.outcome !== 'fire').map((o) => o.refusal))])} over ${offers.length - grants.length} of them.`,
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

/**
 * THE TWO INSTRUMENTS AGREE — and the direction they can disagree in is the one
 * this file's header calls the error that reads green.
 *
 * The DOM recorder logs a `false -> true` transition of `[data-testid="cut-in"]`.
 * `CutInHost` renders from `live !== null` and `CutInView`'s `Pressable` is
 * RECONCILED IN PLACE when `live` changes A -> B, so two cut-ins with no gap
 * between them are ONE transition and the screen count reads 1 while the gate
 * granted 2. Today's app cannot produce that overlap — every grant goes through
 * a `dismiss` first — but nothing asserted it, and the gate-side count is immune
 * to it by construction.
 */
check(
  grants.length === fired,
  'GDD §12.3: the gate’s grant count and the overlay count are the SAME NUMBER',
  `gate granted ${grants.length}, ${fired} overlay(s) reached the screen. ` +
    'They come apart in two ways and both matter: a grant that never drew (the view stopped rendering), and two grants counted as one overlay (`live` A->B reconciled in place, which a DOM transition watcher cannot see).',
);

/**
 * ...AND THE SIBLING OF THAT, MEASURED ON THE SPAN RATHER THAN THE COUNT. A
 * merged pair is one transition of about two whole beats. The data was already
 * in the log — `goneAt - at` against `WHOLE_BEAT_MS` — and nothing asserted on
 * it.
 */
const spans = recorder.log.map((c) => (c.goneAt === null ? null : c.goneAt - c.at));
const stillUpAtEnd = recorder.log.filter((c) => c.goneAt === null).length;
const overlong = recorder.log.filter(
  (c) => c.goneAt !== null && c.goneAt - c.at > WHOLE_BEAT_MS + CAP_DRIVE.CUT_IN_SPAN_SLACK_MS,
).length;
check(
  stillUpAtEnd === 0 && overlong === 0,
  'GDD §7.2: every overlay was up for ONE whole beat — not two reconciled into one, and none left on screen',
  `spans ${JSON.stringify(spans)}ms against ENTER_MS + HOLD_MS = ${WHOLE_BEAT_MS}ms ` +
    `(+${CAP_DRIVE.CUT_IN_SPAN_SLACK_MS}ms slack, so the threshold is ${WHOLE_BEAT_MS + CAP_DRIVE.CUT_IN_SPAN_SLACK_MS}ms against a merged pair's ~${2 * WHOLE_BEAT_MS}ms); ` +
    `${overlong} over the threshold, ${stillUpAtEnd} still up when the run ended`,
);

/**
 * AND A PIXEL OF THE THING ITSELF.
 *
 * Every PNG this tool has ever committed is of an ENDING — real evidence, and
 * evidence about something else. The run's central claim rested entirely on a
 * presence poll, in a repository whose lesson two commits earlier was that
 * presence is not visibility. The shutter now fires on the interrupt, after the
 * app's own `ENTER_MS`, and what is checked is the MEASURED opacity of the art
 * rather than the existence of a file.
 */
// AND BOTH HALVES OF IT, BECAUSE THE SECOND ONE WAS MEASURED AND NEVER READ.
//
// `lineOpacity` has been taken beside `artOpacity` at every shutter, carried
// into `cutInShots`, and PRINTED in this check's detail — where it reads as
// evidence — while the only thing `litShots` filtered on was the art. A build
// that renamed `cut-in-line`'s testID, hid the Text, or faded it to nothing
// printed `cut-in-line 0.000` in the pass line and this check stayed green. A
// number that reaches a template string and never a predicate is decoration
// wearing the costume of evidence, and this file already worries about a
// renamed testID by name a few blocks up.
//
// GDD §7.2's cut-in is a picture AND a line of copy. `effectiveOpacity` returns
// 0 for an element that is absent, `display:none` or `visibility:hidden`, so the
// one call covers "renamed", "hidden" and "transparent" without a second probe.
//
// NOT DOMINATED IN EITHER DIRECTION, worked out symbolically before it was
// added rather than by intuition: `styles.line` carries no opacity of its own,
// so in a healthy build the two readings are equal — but they are equal through
// the OVERLAY's parent chain, not by construction. Art drawn with no line and
// line drawn with no art are both reachable states of `CutInView`, so neither
// reading implies the other and the existing `artOpacity` filter cannot speak
// for this one. Same threshold on purpose: `DRAWN_MIN_OPACITY` is this file's
// one line between present and visible and the copy does not need a second one.
const litShots = cutInShots.filter(
  (s) => s.artOpacity >= CAP_DRIVE.DRAWN_MIN_OPACITY && s.lineOpacity >= CAP_DRIVE.DRAWN_MIN_OPACITY,
);
const artDark = cutInShots.filter((s) => s.artOpacity < CAP_DRIVE.DRAWN_MIN_OPACITY);
const lineDark = cutInShots.filter((s) => s.lineOpacity < CAP_DRIVE.DRAWN_MIN_OPACITY);
check(
  cutInShots.length === THE_CAP && litShots.length === THE_CAP,
  `GDD §7.2: the cut-in was PHOTOGRAPHED — ${THE_CAP} frame, with its art AND its line drawn rather than merely mounted`,
  cutInShots.length === 0
    ? `no frame was taken. Either nothing was ever on screen, or every appearance fell outside a watched wait — the shutter runs inside every \`until\` poll and every settle, so a miss here is a real absence rather than bad luck.`
    : cutInShots
        .map(
          (s) =>
            `${s.file} (leg ${s.leg}): cut-in-art effective opacity ${s.artOpacity.toFixed(3)}, cut-in-line ${s.lineOpacity.toFixed(3)}, ` +
            `taken ${s.afterEnterMs}ms after the overlay appeared (ENTER_MS, read from cutInTuning.ts)`,
        )
        .join('; ') +
      ` — floor ${CAP_DRIVE.DRAWN_MIN_OPACITY}` +
      // WHICH HALF WENT DARK, named rather than left to whoever reads the list:
      // a zero against a missing testID and a zero against a faded Text look
      // identical above, and only one of the two is a copy change.
      `${artDark.length === 0 ? '' : `; ART NOT DRAWN on ${artDark.length} frame(s): ${artDark.map((s) => s.file).join(', ')}`}` +
      `${lineDark.length === 0 ? '' : `; LINE NOT DRAWN on ${lineDark.length} frame(s): ${lineDark.map((s) => s.file).join(', ')} — cut-in-line is absent, hidden or transparent, so §7.2's copy reached no player`}`,
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
        premise: { bombOutAllowance, enterMs, holdMs, wholeBeatMs: Number.isFinite(wholeBeatMs) ? wholeBeatMs : null },
        legs,
        cutIns: rec === null ? [] : rec.log,
        /**
         * WHAT THE GATE WAS ASKED AND WHAT IT ANSWERED, in the record rather
         * than only in a console line. `cutIns` above is the SCREEN; this is the
         * GATE, and the whole point of the round that added it is that the two
         * are different observations. A reader who only ever sees this file must
         * be able to tell "refused" from "nobody asked" without re-running.
         */
        gateDecisions: rec === null ? [] : (rec.offers ?? []),
        gateChannel: {
          name: observerGlobal,
          seen: rec === null ? false : rec.observerSeen === true,
          dropped: rec === null ? null : (rec.observerDropped ?? null),
        },
        cutInFrames: cutInShots,
        recorderPolls: rec === null ? 0 : rec.polls,
        recorderWorstGapMs: rec === null ? null : Math.round(rec.worstGapMs),
        browserMutationWitnesses: BROWSER_MUTATION_WITNESSES,
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
