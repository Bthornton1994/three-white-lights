#!/usr/bin/env node
/**
 * verify-lift-press.mjs — DOES A PRESS ON THE LIFT SURFACE BEHAVE LIKE A LIFT
 * INPUT IN A REAL BROWSER, OR LIKE A TEXT SELECTION?
 *
 * ===========================================================================
 * WHY THIS EXISTS RATHER THAN THE TEST THAT ALREADY GUARDS IT
 * ===========================================================================
 * A human playtest — the first one this build has had (GDD §12.1) — found that
 * pressing the lift surface on a mobile browser triggered the browser's own
 * text-selection gesture: the surface highlighted, selection handles appeared.
 * The squat's whole input is a press-and-hold, so the one gesture the mechanic
 * is built on is the one a browser reads as "select this".
 *
 * The fix is `PRESS_NOT_SELECT` and `PRESS_NOT_TAKEN` in
 * `src/lift/pressGuard.ts`. `src/lift/liftInput.test.ts` guards it and SAYS IN
 * ITS OWN HEADER what it cannot do: `vitest.config.ts` is `environment: node`,
 * nothing renders, so it proves the properties are DECLARED on the right
 * elements and can say nothing about whether they reached a DOM node or whether
 * a press behaves. This tool is that missing half.
 *
 * ===========================================================================
 * WHY THIS TOOL WAS EXTENDED, WHICH IS THE FINDING IT WAS BUILT TO REPORT
 * ===========================================================================
 * Its first run reported the fix ABSENT from the played session surface, and the
 * reason it was absent is that it had been written into `LiftScreen.tsx` — the
 * REPLAY HARNESS. `AppShell.tsx` mounts that screen behind `route.surface ===
 * 'replay'`, `shellRoute.ts` builds that surface with `source: 'debug'`, and
 * `playerReachableFrom` keeps it out. So the fix for a player-reported defect
 * lived on the one lift surface no player can open, and the source scan guarding
 * it read that file by name and stayed green.
 *
 * That is repaired, and this tool now drives ALL THREE press surfaces rather
 * than two. It also moved PROBE 1's subject, for the reason below.
 *
 * ===========================================================================
 * WHICH ARMS ARE DRIVEN, AND WHY ALL THREE
 * ===========================================================================
 * CLAUDE.md: "A screen a player reaches needs a check that reaches it the way a
 * player does." `tools/capture-lift.mjs` and `tools/verify-lift-shots.mjs` both
 * reach the lift renderer through `?replay=<load>&moment=<id>`, a debug route.
 * That rule was earned on `frozenMeetFor`, where the debug arm and the played
 * arm were literally different code and 103 green checks had never pressed an
 * exit on a meet a player opened.
 *
 * IT IS EARNED AGAIN HERE. The three arms are three different components:
 *
 *   - the SESSION arm — GDD §3.2's daily set, no query string — renders
 *     `SessionScreen` → `SetView`, whose touch target is `session-touch`.
 *     `SetView.tsx` says in its own header that "`LiftScreen` itself is
 *     deliberately NOT reused whole".
 *   - the MEET arm — GDD §6.2's attempt, reached by entering a meet from the
 *     Career calendar (`enterMeetFromCalendar.mjs`'s three-press drive) and
 *     playing through weigh-in and openers, still
 *     with no query string — renders `MeetScreen` → `AttemptView`, whose touch
 *     target is `attempt-touch`. A THIRD component, not a variant of the second,
 *     and the one where a press the browser eats costs an attempt that does not
 *     come back: GDD §6.2 gives one rep per attempt and no retry.
 *   - the DEBUG arm renders `LiftScreen` (`route.surface === 'replay'`), whose
 *     touch target is `lift-touch`. Kept because it is genuinely pressed — by
 *     `capture-lift.mjs` and `verify-lift-shots.mjs` — and because it is what
 *     the two played arms are compared against.
 *
 * So a claim about `lift-touch` is not a claim about what a player presses, and
 * this tool refuses to make one. All three are driven, all three are reported,
 * both played arms assert the address bar carries no query string at the moment
 * the styles are read, and cross-arm checks compare them directly.
 *
 * ===========================================================================
 * TWO PROBES, AND PROBE 1'S SUBJECT MOVED TO WHERE ITS DOMAIN IS ALIVE
 * ===========================================================================
 * CLAUDE.md: "an assertion is vacuous if no state of the code it is meant to be
 * checking would make it red", and the sharpest shape it lists is an EMPTY
 * DOMAIN. A probe that reports "no selection" on a surface where a selection is
 * impossible is exactly that, and it would read as the strongest line in this
 * file. So each probe carries its own domain measurement, taken on the SAME
 * element by neutralising the fix at runtime, and a claim is only allowed to
 * pass if its domain is live.
 *
 *   PROBE 1 — SELECTION. Press, hold, drift; read `window.getSelection()`.
 *
 *     ON THE STAGE ITS DOMAIN IS DEAD, measured rather than assumed: the touch
 *     target is a Skia `<canvas>` filling the whole element,
 *     `document.caretRangeFromPoint` at the probe point returns the CANVAS node
 *     at offset 0, and forcing `user-select: text` back onto that element leaves
 *     the same gesture selecting nothing — Blink will not start a selection
 *     inside a replaced element. That reading is still taken, and it is reported
 *     as a NAMED SKIPPED check carrying its own evidence. It is not a green.
 *
 *     ITS SUBJECT IS THEREFORE THE COPY, which is what is selectable on these
 *     screens and what a thumb sits directly under: `session-prompt`,
 *     `attempt-prompt`, `lift-prompt`. `user-select` INHERITS, so the fix
 *     declared on the screen root reaches them, and the domain there is live in
 *     both directions on every arm every run — as shipped the press-and-drift
 *     selects nothing, and with `user-select: text` forced onto the same element
 *     it selects "P AND HOLD TO D" out of "TAP AND HOLD TO DESCEND".
 *
 *     THAT IS WHY THE FIX IS TWO OBJECTS. Spreading all three properties onto
 *     the stage — the shape that shipped — puts `user-select` on the one element
 *     where it provably does nothing, and leaves the text it was meant to
 *     protect reading `auto`. `src/lift/pressGuard.ts` carries the argument;
 *     this file carries the measurement.
 *
 *   PROBE 2 — THE BROWSER TAKING THE GESTURE. Dispatch a real touch pan and
 *     count `pointercancel` events. A `pointercancel` is the browser saying it
 *     has claimed the pointer for its own gesture and the app will not hear
 *     about it again — literally `touchAction`'s half of the bug, the half
 *     `LiftScreen.tsx`'s own comment calls "the one a screenshot cannot show".
 *     DOMAIN: LIVE, demonstrated in both directions on the same element on every
 *     arm every run — `touch-action: none` gives 0 cancels and `manipulation`
 *     gives 1, and both of those are pinned checks rather than a note. (`auto`
 *     also gives 1; that one was taken at calibration and is NOT exercised here,
 *     so it is written as a measurement and not as a guarantee.) This is the
 *     behavioural check the tool actually rests on.
 *
 * ===========================================================================
 * TWO GESTURES, BECAUSE A PERFECTLY STILL PRESS SELECTS NOTHING ANYWHERE
 * ===========================================================================
 * Measured on this engine: a press held 900ms with no movement leaves a
 * COLLAPSED caret on plain selectable text — `rangeCount 1`, `toString()`
 * empty. So "a still press-and-hold produced no selection" is true of every
 * element on the page including the ones with no fix on them, and reading it as
 * evidence about the fix would be the empty-domain shape one level out. Both
 * gestures are run and both are reported; the drifting one is the only one that
 * selects even with the fix neutralised. That limitation is ASSERTED, not just
 * described — the per-arm check headed `LIMIT — a STILL press-and-hold selects
 * nothing even with the fix neutralised` reads the still gesture on the
 * neutralised element, so if the engine ever starts selecting on a motionless
 * press this paragraph goes red instead of quietly staying on the page as a
 * stale reason.
 *
 * ===========================================================================
 * HOW THE MEET ARM SPENDS ATTEMPTS, WHICH IS THE ONE THING IT CANNOT AVOID
 * ===========================================================================
 * A pan is a real touch. On the attempt screen a touch is the rep — press-in
 * starts the descent, the release resolves it — so every PROBE 2 pan on the meet
 * arm costs one attempt, and a 300ms pan is nearly always a miss. Three misses
 * on one lift is a bomb-out (GDD §6.3) and the meet ends.
 *
 * So the four pans are spread by `MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND`:
 * at most one gesture per lift until every lift has had one, then any attempt,
 * with `driveMeetToItsEnd` playing everything in between properly. Measured on a
 * clean run, the instrument holds squat 1, bench 1 and all three deadlifts,
 * and the driver plays squat 2-3 and bench 2-3. The surplus lands on the LAST
 * lift by construction, which is what keeps the readings alive: deadlift is
 * where a bomb-out costs nothing, because by then every reading is taken.
 *
 * PROBE 1's SUBJECT costs no press: the prompt is not the `Pressable`, so a
 * press-and-drift on it starts no rep. It costs an ATTEMPT anyway, because
 * `LIFT_TUNING.BRACE_TIMEOUT_TICKS` starts the descent by itself after ten
 * seconds of nothing and five readings take longer than that. The instrument
 * counts that attempt against the quota at the moment it takes the screen —
 * `reachAttempt` — rather than at the moment it gestures, because an attempt
 * lost to the brace clock is exactly as missed as one lost to a pan.
 *
 * ===========================================================================
 * WHAT THIS TOOL CANNOT SAY
 * ===========================================================================
 * - It is headless desktop Chromium with touch emulation, not a phone. It
 *   cannot reproduce iOS Safari's press-and-hold callout, and
 *   `-webkit-touch-callout` is not implemented by this engine at all — see
 *   `CALLOUT_UNSUPPORTED`, reported as a NAMED SKIPPED check rather than folded
 *   into a green.
 * - It does not judge whether the lift FEELS right (GDD §12.1). It judges
 *   whether the browser lets the press through.
 * - It cannot say a selection is impossible on the STAGE on a phone. It says the
 *   stage's selection domain is dead IN BLINK, with the caret probe as evidence,
 *   and it makes no claim about WebKit's behaviour on a replaced element.
 * - IT COVERS THREE OF THE THREE PRESS SURFACES, which is a claim
 *   `src/lift/liftInput.test.ts` is what actually keeps true: that file
 *   discovers every `<LiftStage>` in the repository and pins the count at three
 *   alongside these three testIDs. If a fourth surface arrives, that test goes
 *   red and this sentence has somewhere to be corrected from. This file names
 *   its three by hand on purpose — a browser check that read its selectors out
 *   of the module under test would agree with a broken module.
 *
 * ===========================================================================
 * THERE IS NO SEPARATE SELF-TEST FILE, AND THAT IS DELIBERATE
 * ===========================================================================
 * `verify-lift-shots.mjs` has `verify-lift-shots.selftest.mjs` beside it
 * because its checks cannot demonstrate themselves. These can: the four CONTROL
 * / LIMIT / DOMAIN lines emitted per arm ARE the self-test, they run on every
 * invocation against the same elements the claims are about, and PROBE 1's
 * claim is not allowed to pass unless its own control fired in the same run.
 * A self-test that runs only when somebody remembers to invoke it is the weaker
 * arrangement of the two.
 *
 * Usage:
 *   node tools/verify-lift-press.mjs [--url URL] [--out DIR]
 *                                    [--arms all|session|meet|debug]
 */
import { chromium } from 'playwright';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { enterMeetFromCalendar } from './enterMeetFromCalendar.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  ASCENT_PROMPTS,
  BENCH_BEAT,
  BENCH_DRIVE,
  ECCENTRIC_ONLY_PROMPTS,
  LIFT_PROMPTS,
  SESSION_DRIVE,
  SESSION_PROMPTS,
  adaptDepthSearch,
  checkInLiftTestId,
  awaitFirstDriveCue,
  grindTapToResolution,
  holdBenchToTheChest,
  freshDepthSearch,
  openSessionToFirstSet,
  readLoop,
  tapDriveCuesToLockout,
} from './sessionDrive.mjs';
import {
  MEET_DRIVE,
  MEET_LIFT_ORDER,
  driveMeetToItsEnd,
  freshMeetSearches,
  holdsIn,
  liftFromAttemptLabel,
  meetSaying,
  readMeetLoop,
  untilMeet,
  waitUntilDrawn,
} from './meetDrive.mjs';
import { markerDirFor } from './verifyMarker.mjs';
import { decodePng, diffPixels } from './png.mjs';
import {
  blockInSource,
  numberInBlock,
  numberInDeclaration,
  numberInSource,
  parserSelfTest,
  stringInSource,
} from './readTuning.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, '..');

// ---------------------------------------------------------------------------
// RAW LOG, WRITTEN UNCONDITIONALLY — the gap that cost a named cause.
// ---------------------------------------------------------------------------
/**
 * This tool's first post-fix run for the drive-boost/hold decoupling
 * (2026-08-20) reported two failures — a meet-arm probe and a downstream
 * CROSS-ARM comparison — then a clean re-run 85/85 minutes later. The
 * re-run was structurally sound (the fix only widens a boolean gate, so it
 * could not have CAUSED a new failure) but the first run's own output had
 * gone nowhere but a terminal nobody piped to a file, so which check named
 * which assertion could not be recovered afterward. Six subsequent re-runs
 * could not reproduce it either. A flake with no name is not evidence either
 * way; the fix here is not to explain that one after the fact, but to make
 * sure the next one leaves a transcript.
 *
 * So every run now writes its own log, unconditionally — pass, fail, or a
 * crash before either verdict is reached. Written SYNCHRONOUSLY, one
 * `appendFileSync` per line rather than a buffered stream, so a hard kill
 * (watchdog's `--budget` SIGKILLs the whole process group on timeout) loses
 * at most the line in flight — the same "write before, not after"
 * discipline `verifyMarker.mjs` already applies to its own marker file.
 *
 * `uncaughtException` / `unhandledRejection` are caught here too, because
 * this script is top-level-await with no wrapping try/catch: an unguarded
 * `await` that throws (a Playwright call with no `.catch()`) unwinds the
 * whole module, `browser.close()` at the bottom never runs, and nothing in
 * `checks`/`reds()` ever gets a chance to name what happened — exactly the
 * shape that would explain a failure with no named assertion. That is
 * reported here and then the process still exits non-zero exactly as it
 * would have without this block; nothing about the crash's outward behavior
 * changes, only whether it leaves a record.
 *
 * Lands in `.gauntlet/verify/` (via `markerDirFor`, so `VERIFY_MARKER_DIR`
 * overrides it the same way it overrides the JSON markers) as
 * `lift-press-<timestamp>.verify.log`. That directory and the
 * `*.verify.log` suffix are both already gitignored and already excluded
 * from `treeIdentity.mjs`'s hash — this reuses an existing, anticipated
 * convention rather than adding a new one. Not rotated or pruned; on this
 * environment's fixed disk allowance that is a known limit, not a defect,
 * and cheap to add later if the directory grows large enough to matter.
 */
const RUN_LOG_DIR = markerDirFor(SRC_ROOT);
mkdirSync(RUN_LOG_DIR, { recursive: true });
const RUN_LOG_PATH = path.join(
  RUN_LOG_DIR,
  `lift-press-${new Date().toISOString().replace(/[:.]/g, '-')}.verify.log`,
);
const rawLog = (line) => {
  try {
    appendFileSync(RUN_LOG_PATH, `${line}\n`);
  } catch {
    // Best-effort. A logging failure must never be why the verification
    // itself fails — that would be a worse defect than the one this closes.
  }
};
const realConsoleLog = console.log.bind(console);
console.log = (...parts) => {
  rawLog(parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' '));
  realConsoleLog(...parts);
};
const onFatal = (label) => (error) => {
  const text = error?.stack ?? String(error);
  rawLog(`${label}: ${text}`);
  realConsoleLog(`\n!! ${label} (see ${RUN_LOG_PATH}): ${text}`);
  process.exit(1);
};
process.on('uncaughtException', onFatal('UNCAUGHT EXCEPTION'));
process.on('unhandledRejection', onFatal('UNHANDLED REJECTION'));
{
  let headShort = 'unknown';
  try {
    headShort = execFileSync('git', ['-C', SRC_ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    // left as 'unknown' — see capturedFrom below for the full provenance record
  }
  rawLog(`=== verify-lift-press.mjs started ${new Date().toISOString()} @ ${headShort} ===`);
}

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
const outDir = path.resolve(flag('out', '.gauntlet/shots/lift-press'));
const armsWanted = flag('arms', 'all');

// ---------------------------------------------------------------------------
// EVERY NUMBER THIS ROBOT MOVES ON, IN ONE PLACE
// ---------------------------------------------------------------------------
/**
 * None of these are game feel. The game's feel values live in
 * `src/game/liftTuning.ts`; these are a ROBOT'S REACTION TIMES and a gesture's
 * shape, kept here for the reason `SESSION_DRIVE` keeps its own: somebody
 * re-tuning the mechanic gets one place to look when the robot stops keeping up
 * with it.
 *
 * HOLD_MS IS NOT A GUESS AT THE MECHANIC'S BAND. `sessionDrive.mjs` derives
 * ~710-1150ms as the legal depth window and holds 1000. This gesture is not
 * trying to play a legal rep — it is trying to look like a finger that stayed
 * down long enough for a browser to call it a long press. Chromium's own
 * long-press threshold is ~500ms, so comfortably past that is the whole
 * requirement; 900 clears it and still lands inside the mechanic's band, so the
 * played arm's rep resolves normally instead of hanging on a brace.
 *
 * THE DRIFT IS A FRACTION OF THE ELEMENT, NOT A PIXEL COUNT, AND IT IS
 * CALIBRATED RATHER THAN CHOSEN. Measured on `lift-prompt` (260px of ordinary
 * selectable text): a drift of 2, 5, 10, 16, 24, 40 or 60px RIGHTWARD FROM THE
 * CENTRE leaves a collapsed caret every time, while the same 60px starting near
 * the LEFT EDGE selects "TAP AN" and a full-width drag selects the whole
 * string. The asymmetry is a fact about the engine that this tool does not
 * explain; what it does is start the gesture near the element's leading edge,
 * where the control demonstrably selects, so the control is a control.
 */
const PRESS_PROBE = Object.freeze({
  /** How long the finger stays down. See the paragraph above. */
  HOLD_MS: 900,
  /** Where in the element's box the finger lands, as a fraction of its size. */
  GRIP_X_FRACTION: 0.1,
  GRIP_Y_FRACTION: 0.5,
  /** How far it wanders during the hold, as a fraction of the element's width. */
  DRIFT_X_FRACTION: 0.6,
  /** How many move events the drift is broken into. */
  DRIFT_STEPS: 8,
  /** Settle after a gesture before the selection is read. */
  READ_SETTLE_MS: 250,

  /**
   * PROBE 2's pan. Ten moves over 200px is an unambiguous vertical drag — well
   * past any engine's pan-recognition threshold, so a browser that is ALLOWED
   * to claim the gesture will claim it.
   */
  PAN_PX: 200,
  /**
   * AND THE SAME PAN AT A FINGER'S SCALE, because the 200px reading on its own
   * would over-claim and a reader would not be able to tell.
   *
   * A `pointercancel` only arrives once the browser has RECOGNISED a pan, and
   * recognition needs movement. So "the browser takes the press away" is a
   * statement about a gesture that moved, and how far it had to move is the
   * difference between "a player who swipes loses the rep" and "a player who
   * holds still loses the rep". 20px is a thumb that wandered, not a swipe:
   * roughly a fingertip's own width at this device scale, and inside the range
   * `PRESS_PROBE.DRIFT_X_FRACTION` already treats as ordinary drift.
   *
   * Both counts are read and both are compared. Neither is printed without a
   * predicate behind it — CLAUDE.md's "measured, carried, displayed, never
   * compared" is the failure this pair is arranged to avoid.
   */
  SMALL_PAN_PX: 20,
  PAN_STEPS: 10,
  PAN_STEP_MS: 30,
  PAN_SETTLE_MS: 300,
  /**
   * How many touchmoves the page hears from the 20px pan when the browser takes
   * it. Reported rather than pinned, and the distinction matters: 3 of the 10
   * dispatched is Chromium coalescing the 2px steps and then going quiet at the
   * cancel, which is the engine's policy and not a fact about this app.
   *
   * WRITTEN AS A MEASUREMENT BECAUSE IT WAS ONCE WRITTEN AS A DIFFERENT ONE. An
   * earlier version of this comment said the page hears ZERO touchmoves before
   * the cancel. The record beside it said 3, in the check's own detail line, and
   * nothing compared the two — the "measured, carried, displayed, never
   * compared" shape CLAUDE.md records, inside a paragraph explaining a
   * measurement. The number lives here now and `panNonVacuity` below is what
   * asserts the only thing that has to be true: the page heard SOMETHING.
   */
  SMALL_PAN_MOVES_SEEN_WHEN_TAKEN: 3,
  /**
   * The two counts PROBE 2 is pinned against. Exact counts rather than bounds,
   * per CLAUDE.md — a bound lets the defect grow back quietly, and `>= 0` is
   * true of everything.
   */
  PAN_CANCELS_WHEN_BROWSER_MAY_PAN: 1,
  PAN_CANCELS_WHEN_TOUCH_ACTION_NONE: 0,

  /** Skia's first paint of a frozen replay frame. */
  DEBUG_SETTLE_MS: 1200,
  /** How long to wait for a work set's stage to come back after a rest. */
  STAGE_RETURN_MS: 90000,
  POLL_MS: 250,
  /** Playwright waits for the app to boot at all. */
  BOOT_MS: 120000,
  /** Phone-ish viewport, matching `verify-session-boundary.mjs`. */
  VIEWPORT: Object.freeze({ width: 390, height: 844 }),
  DEVICE_SCALE: 2,
  /** The replay frame the debug arm is frozen on. A brace: nothing is moving. */
  DEBUG_REPLAY: 'replay=1.0&moment=brace',
});

/**
 * THE MEET ARM'S OWN NUMBERS, kept apart from `PRESS_PROBE` because they are
 * about spending a resource the session arm does not have.
 *
 * A robot's reaction times again, not game feel: GDD §6.2's own timings live in
 * `src/game/meetTuning.ts`.
 */
const MEET_PROBE = Object.freeze({
  /** The beat the CAREER pill is drawn on at boot: GDD §3.2's check-in. The
   *  way into a meet is `tools/enterMeetFromCalendar.mjs`'s three-press drive
   *  (Sprint 1c deleted `shell-open-meet`). */
  CHECK_IN: 'session-briefing',
  /** How long the pill has to finish fading in before the press. */
  PILL_MS: 40000,
  /** ...and the meet has to appear after it. */
  MEET_MS: 40000,
  /**
   * HOW MANY PROBES ONE LIFT MAY TAKE BEFORE EVERY LIFT HAS HAD ONE.
   *
   * A pan is a real touch and a 300ms touch on the attempt screen is a rep the
   * lifter almost certainly missed. Three misses on one lift bombs it out (GDD
   * §6.3) and the meet is over, so an instrument that took all four readings on
   * squat would end the meet before it had them. One per lift until each lift
   * has one, then anything — which puts the four on squat 1, bench 1, deadlift 1
   * and deadlift 2, with the driver playing the rest properly.
   */
  PROBES_PER_LIFT_BEFORE_A_SECOND: 1,
  /**
   * How many times `reachAttempt` will ask again before calling it stuck.
   *
   * `LIFT_TUNING.BRACE_TIMEOUT_TICKS` starts the descent on its own after ten
   * seconds of nothing, which is shorter than PROBE 1's five readings on a slow
   * boot. So an attempt this tool was holding can begin and resolve by itself
   * while a selection is being read — the mechanic behaving exactly as designed,
   * and not something to report as the meet being stuck.
   */
  REACH_RETRIES: 3,
  /** `LABEL_SEPARATOR` moved to `meetDrive.mjs` as `ATTEMPT_LABEL_SEPARATOR`
   *  with the parser that reads it — see `liftOf` below for why there is one
   *  parser of `attempt-label` and not two. */
  /** How long a recap has to settle before `driveMeetToItsEnd` names an ending. */
  RECAP_SETTLE_MS: 30000,
});

/**
 * The three properties the fix is made of, WITH THE ELEMENT EACH ONE IS READ
 * OFF, because that is the half the first version of this fix got wrong.
 *
 * `on: 'target'` means the element the finger lands in — `touch-action` does not
 * inherit, so a value anywhere else is not a value here. `on: 'text'` means the
 * prompt beside the stage — `user-select` and `-webkit-touch-callout` inherit
 * from the screen root, and the text is the only thing on these screens a
 * selection can start in.
 *
 * Restated here rather than imported from `pressGuard.ts`: CLAUDE.md's rule for
 * `capture-lift.mjs`'s moment list applies identically — a check that reads its
 * expectations out of the module under test agrees with a broken module.
 */
const PRESS_PROPERTIES = Object.freeze([
  Object.freeze({
    key: 'userSelect',
    cssName: 'user-select',
    expected: 'none',
    on: 'text',
    leaves: 'the copy beside the stage highlights and selection handles appear',
  }),
  Object.freeze({
    key: 'touchAction',
    cssName: 'touch-action',
    expected: 'none',
    on: 'target',
    leaves: 'the browser claims the gesture before the handler sees it',
  }),
  Object.freeze({
    key: 'WebkitTouchCallout',
    cssName: '-webkit-touch-callout',
    expected: 'none',
    on: 'text',
    leaves: "iOS Safari's press-and-hold callout still fires",
  }),
]);

/**
 * THE ONE PROPERTY THIS ENGINE CANNOT ANSWER FOR, NAMED RATHER THAN QUIETLY
 * PASSED.
 *
 * `-webkit-touch-callout` is a WebKit/iOS property. Blink does not implement
 * it: `getComputedStyle(el).getPropertyValue('-webkit-touch-callout')` returns
 * the empty string on an element that declares it. So its computed value is
 * unreadable HERE, and an `expected === actual` check on it would be a check on
 * Chromium's property table rather than on the app.
 *
 * It is therefore a NAMED SKIPPED check, which is what CLAUDE.md asks for when
 * an arm cannot be driven: "the honest output is a named SKIPPED check, not a
 * quiet fallback that leaves the section looking complete." Whether the
 * declaration is present at all stays covered by the source scan in
 * `src/lift/liftInput.test.ts`, and that division of labour is stated in both
 * files rather than left for a reader to work out.
 */
const CALLOUT_UNSUPPORTED = 'WebkitTouchCallout';
/** How many of `PRESS_PROPERTIES` this engine can actually read. Pinned. */
const READABLE_PROPERTIES = PRESS_PROPERTIES.filter((p) => p.key !== CALLOUT_UNSUPPORTED);

/**
 * The three arms, with the element a finger lands on and the element PROBE 1
 * reads a selection off.
 *
 * `textTestId` is the prompt: the copy directly above the stage, which is what a
 * thumb sits under and the only thing on these screens that can be selected. It
 * used to be labelled the CONTROL, on the reasoning that it carried none of the
 * fix and therefore selected. That is no longer true and the rename is the
 * point: the fix now reaches it by inheritance, so it is the SUBJECT, and the
 * control is the same element with `user-select: text` forced back onto it.
 *
 * A control on the same page, driven by the same gesture, in the same browser is
 * the requirement — and the same element, neutralised, satisfies it more tightly
 * than a second element ever did.
 */
const ARMS = Object.freeze([
  Object.freeze({
    id: 'session',
    played: true,
    what: 'the daily set (GDD §3.2) — reached through the app’s own controls, no query string',
    touchTestId: 'session-touch',
    textTestId: 'session-prompt',
    expectQueryString: '',
  }),
  Object.freeze({
    id: 'meet',
    played: true,
    what: 'a meet attempt (GDD §6.2) — reached by pressing the shell pill and playing in, no query string',
    touchTestId: 'attempt-touch',
    textTestId: 'attempt-prompt',
    expectQueryString: '',
  }),
  Object.freeze({
    id: 'debug',
    played: false,
    what: `the replay harness — reached by ?${PRESS_PROBE.DEBUG_REPLAY}, which no player can type`,
    touchTestId: 'lift-touch',
    textTestId: 'lift-prompt',
    expectQueryString: `?${PRESS_PROBE.DEBUG_REPLAY}`,
  }),
]);

/** How many arms a player can reach. Pinned so dropping one is a red line. */
const PLAYED_ARMS = ARMS.filter((arm) => arm.played);

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------
const checks = [];
let failed = 0;
function check(ok, what, detail) {
  checks.push({ ok, what, detail: detail ?? null });
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : '!!  '}${what}${detail === undefined ? '' : `  — ${detail}`}`);
}
/** A check that could not be run here, recorded as neither a pass nor a fail. */
const skipped = [];
function skip(what, why) {
  skipped.push({ what, why });
  console.log(`SKIP  ${what}  — ${why}`);
}
const reds = () => checks.filter((c) => !c.ok);

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------
/**
 * The same field `capture-cutin.mjs`, `verify-cutin-cap.mjs` and
 * `verify-shell-route.mjs` carry, for the same reason: a record with no commit
 * on it cannot be dated. Snapshotted BEFORE the browser opens, so it records
 * the tree the app was served from.
 *
 * `instrument` is not optional — `tools/evidence.mjs` refuses a tracked shot
 * record that carries no digest. A commit SHA says which app was played and
 * nothing about the tool, and the tool is half of what every number below
 * means: set `PRESS_PROBE.DRIFT_X_FRACTION` to 0 and every "no selection"
 * reading here becomes true of every element on the page, with the same SHA and
 * every "ok" line intact.
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
  const git = (...gitArgs) => execFileSync('git', ['-C', SRC_ROOT, ...gitArgs], { encoding: 'utf8' }).trim();
  try {
    record.commit = git('rev-parse', '--short', 'HEAD');
    record.branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const status = git('status', '--porcelain');
    const lines = status === '' ? [] : status.split('\n');
    const notCode = ['.gauntlet/shots/', '.gauntlet/evidence/', '.gauntlet/state.json', '.gauntlet/verify/'];
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
    ['verify-lift-press.mjs', 'sessionDrive.mjs', 'meetDrive.mjs', 'enterMeetFromCalendar.mjs'].map((name) => {
      const file = path.join(HERE, name);
      try {
        return [name, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16)];
      } catch (error) {
        return [name, `unreadable — ${String(error).slice(0, 80)}`];
      }
    }),
  );
  return record;
})();

// ---------------------------------------------------------------------------
// Page-side readers
// ---------------------------------------------------------------------------

/**
 * Everything the browser will say about one element's press behaviour.
 *
 * The ancestor chain is walked because `user-select` INHERITS: a `none` on the
 * target is not the whole story, and an `auto` on the target can still compute
 * to `none` under a `none` parent. `touch-action` does NOT inherit, which is
 * why the target's own value is the one that decides it. Both facts are
 * recorded rather than assumed, so a reader can check the reasoning against the
 * numbers instead of taking it.
 *
 * `hitTarget` is what `elementFromPoint` says is actually under the finger,
 * which on this screen is the Skia `<canvas>` and NOT the element carrying the
 * style. That distinction is the whole reason PROBE 1's domain is dead.
 */
const readTarget = (page, testId) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el === null) return null;
    const readAll = (n) => {
      const cs = getComputedStyle(n);
      return {
        userSelect: cs.getPropertyValue('user-select'),
        webkitUserSelect: cs.getPropertyValue('-webkit-user-select'),
        touchAction: cs.getPropertyValue('touch-action'),
        webkitTouchCallout: cs.getPropertyValue('-webkit-touch-callout'),
      };
    };
    const chain = [];
    let n = el;
    while (n !== null && n !== document.documentElement) {
      chain.push({ tag: n.tagName, testid: n.getAttribute('data-testid'), ...readAll(n) });
      n = n.parentElement;
    }
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const caret = document.caretRangeFromPoint ? document.caretRangeFromPoint(cx, cy) : null;
    return {
      testid: id,
      tag: el.tagName,
      box: { x: r.x, y: r.y, width: r.width, height: r.height },
      self: readAll(el),
      chain,
      hitTarget: hit === null ? null : { tag: hit.tagName, testid: hit.getAttribute('data-testid'), ...readAll(hit) },
      /**
       * The browser's own answer to "is there a text position here". A CANVAS
       * node at offset 0 means there is not one inside anything — the direct
       * cause of PROBE 1's empty domain, recorded as a measurement rather than
       * inferred from a run of empty readings.
       */
      caretAtCentre:
        caret === null
          ? null
          : { node: caret.startContainer.nodeName, offset: caret.startOffset, text: String(caret.startContainer.textContent ?? '').slice(0, 40) },
      textInside: (el.textContent ?? '').trim().slice(0, 80),
    };
  }, testId);

const readSelection = (page) =>
  page.evaluate(() => {
    const s = window.getSelection();
    if (s === null) return null;
    return {
      rangeCount: s.rangeCount,
      text: s.toString(),
      isCollapsed: s.isCollapsed,
      anchorNode: s.anchorNode === null ? null : s.anchorNode.nodeName,
      anchorText: s.anchorNode === null ? null : String(s.anchorNode.textContent ?? '').slice(0, 60),
    };
  });

const clearSelection = (page) => page.evaluate(() => { window.getSelection()?.removeAllRanges(); });
const queryString = (page) => page.evaluate(() => window.location.search);

/**
 * Turn the three properties off (`'off'`) or on (`'on'`) on one element, or put
 * it back (`null`).
 *
 * `user-select: text`, NOT `auto`. Per CSS UI 4 an `auto` under a `none` parent
 * COMPUTES to `none`, so "neutralise the fix" written as `auto` would be a
 * no-op wherever an ancestor also carries `none` — a control that quietly does
 * nothing, which is worse than no control at all. `text` is unconditional.
 */
const forceProperties = (page, testId, force) =>
  page.evaluate(
    ({ id, force }) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el === null) return null;
      const props = ['user-select', '-webkit-user-select', 'touch-action', '-webkit-touch-callout'];
      if (force === 'off') {
        el.style.setProperty('user-select', 'text', 'important');
        el.style.setProperty('-webkit-user-select', 'text', 'important');
        el.style.setProperty('touch-action', 'auto', 'important');
        el.style.setProperty('-webkit-touch-callout', 'default', 'important');
      } else if (force === 'on') {
        el.style.setProperty('user-select', 'none', 'important');
        el.style.setProperty('-webkit-user-select', 'none', 'important');
        el.style.setProperty('touch-action', 'none', 'important');
        el.style.setProperty('-webkit-touch-callout', 'none', 'important');
      } else if (force === 'pan') {
        // PROBE 2's neutralisation: only `touch-action`, and only to the value
        // the played arm was measured carrying. Read in this tree at
        // `node_modules/react-native-web/dist/exports/Pressable/index.js`,
        // `styles.active` is `{ cursor: 'pointer', touchAction: 'manipulation' }`
        // — so this is not an invented worst case, it is the value a Pressable
        // already has when nobody adds the fix, and the played arm's own
        // computed reading is the check that it is still true here.
        el.style.setProperty('touch-action', 'manipulation', 'important');
      } else {
        for (const p of props) el.style.removeProperty(p);
      }
      const cs = getComputedStyle(el);
      return { userSelect: cs.getPropertyValue('user-select'), touchAction: cs.getPropertyValue('touch-action') };
    },
    { id: testId, force },
  );

// ---------------------------------------------------------------------------
// PROBE 1 — the gesture
// ---------------------------------------------------------------------------
/**
 * A press-and-hold at a grip point inside one element, optionally with a
 * finger's drift across it.
 *
 * Mouse rather than `Input.dispatchTouchEvent`, and the reason is measured
 * rather than preferred: a CDP touch hold on this page places a COLLAPSED caret
 * on selectable text and nothing at all on the stage, so it discriminates only
 * between "a text position exists here" and "one does not" — which
 * `caretAtCentre` already reports, with fewer moving parts. The mouse
 * press-and-drift produces a real, non-collapsed, readable RANGE on selectable
 * text, which is the thing a player would see highlighted.
 */
async function pressAndHold(page, box, drift) {
  const gx = box.x + box.width * PRESS_PROBE.GRIP_X_FRACTION;
  const gy = box.y + box.height * PRESS_PROBE.GRIP_Y_FRACTION;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  if (!drift) {
    await page.waitForTimeout(PRESS_PROBE.HOLD_MS);
  } else {
    const total = box.width * PRESS_PROBE.DRIFT_X_FRACTION;
    const per = PRESS_PROBE.HOLD_MS / PRESS_PROBE.DRIFT_STEPS;
    for (let i = 1; i <= PRESS_PROBE.DRIFT_STEPS; i += 1) {
      await page.waitForTimeout(per);
      await page.mouse.move(gx + (total * i) / PRESS_PROBE.DRIFT_STEPS, gy);
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(PRESS_PROBE.READ_SETTLE_MS);
}

/**
 * One reading: clear, confirm the clear took, press, read.
 *
 * The confirm is not ceremony. A leftover range from the previous reading would
 * make every subsequent one report a selection, and the whole file would look
 * like it was biting when it was reading its own residue.
 */
async function probeSelection(page, testId, label, drift) {
  await clearSelection(page);
  const before = await readSelection(page);
  const box = await page.getByTestId(testId).boundingBox().catch(() => null);
  if (box === null) return { label, testId, drift, reached: false, why: `${testId} had no box when this reading was taken` };
  await pressAndHold(page, box, drift);
  const after = await readSelection(page);
  return {
    label,
    testId,
    drift,
    reached: true,
    clearedBefore: before !== null && before.rangeCount === 0,
    box,
    selection: after,
    /**
     * The one derived boolean every check reads. A COLLAPSED caret is not a
     * selection: nothing is highlighted and there are no handles, which is the
     * thing the playtest reported. Requiring a non-empty string as well as a
     * range is what keeps "the browser put a cursor somewhere" out of the count.
     */
    selected: after !== null && after.rangeCount > 0 && after.text.length > 0 && !after.isCollapsed,
  };
}

// ---------------------------------------------------------------------------
// PROBE 2 — does the browser take the gesture away from the app?
// ---------------------------------------------------------------------------
/**
 * Dispatch a real vertical touch pan on an element and count the
 * `pointercancel` events the page sees.
 *
 * A `pointercancel` is the browser announcing that it has claimed the pointer
 * for its own gesture: the app's press is over, and no `pointerup` is coming.
 * For a press-and-hold mechanic that is the input being eaten mid-descent —
 * `LiftScreen.tsx`'s own comment calls this "the half that eats input rather
 * than merely looking wrong, and the one a screenshot cannot show."
 *
 * `touchmove` cancelability is recorded beside it and is NOT the signal: taken
 * at calibration on all three values of `touch-action`, it reads
 * `[true, false, false, …]` every time, so it does not discriminate and a check
 * comparing it across arms would be decoration. THAT SENTENCE IS NOT LEFT AS
 * PROSE — `panCancelablePattern` below pins the shape, so if the engine ever
 * makes this stream depend on `touch-action` the file goes red and somebody
 * gets to promote it to a real signal instead of finding this paragraph still
 * confidently saying it is useless. The cancel count is what discriminates, and
 * both numbers are in the record so the next reader can check which one was
 * load-bearing rather than take this paragraph's word for it.
 */
async function probePan(page, cdp, testId, label, panPx = PRESS_PROBE.PAN_PX) {
  const box = await page.getByTestId(testId).boundingBox().catch(() => null);
  if (box === null) return { label, testId, panPx, reached: false, why: `${testId} had no box when this pan was taken` };
  await page.evaluate(() => {
    window.__liftPressPan = { cancels: 0, moveCancelable: [] };
    if (window.__liftPressPanBound !== true) {
      window.__liftPressPanBound = true;
      document.addEventListener('pointercancel', () => { window.__liftPressPan.cancels += 1; }, true);
      document.addEventListener('touchmove', (e) => { window.__liftPressPan.moveCancelable.push(e.cancelable); }, { capture: true, passive: true });
    }
  });
  const x = box.x + box.width / 2;
  const y = box.y + box.height * PRESS_PROBE.GRIP_Y_FRACTION;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= PRESS_PROBE.PAN_STEPS; i += 1) {
    await page.waitForTimeout(PRESS_PROBE.PAN_STEP_MS);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y + (panPx * i) / PRESS_PROBE.PAN_STEPS, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(PRESS_PROBE.PAN_SETTLE_MS);
  const seen = await page.evaluate(() => window.__liftPressPan);
  return { label, testId, panPx, reached: true, cancels: seen.cancels, moveCancelable: seen.moveCancelable, moves: seen.moveCancelable.length };
}

// ---------------------------------------------------------------------------
// PROBE 3 — the JS-level second layer, added after this tool's PROBE 1/2 read
// clean and a phone playtest found the callout coming back anyway
// ---------------------------------------------------------------------------
/**
 * `src/lift/pressGuard.ts`'s `SUPPRESS_CONTEXT_MENU`. Unlike
 * `-webkit-touch-callout`, whether a dispatched `contextmenu` event ends up
 * `defaultPrevented` is standard DOM Events, not a CSS property table — so
 * this IS observable in this engine, even though the native iOS callout the
 * handler stands in for is not. What this probe answers and what it does not
 * answer are different questions, and only the first is claimed:
 *
 *   answers: does `onContextMenu` reach the DOM and call `preventDefault`.
 *   does NOT answer: whether iOS actually suppresses its native callout as a
 *   result — that is the half named unverifiable in pressGuard.ts's header.
 *
 * Costs nothing to run: a synthetic `contextmenu` `MouseEvent` does not touch
 * `onPressIn`/`onPressOut`, starts no rep and spends no meet attempt, so it
 * runs on all three arms rather than being rationed like PROBE 2's pans.
 */
async function probeContextMenu(page, testId) {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (el === null) return { reached: false };
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    return { reached: true, defaultPrevented: event.defaultPrevented };
  }, testId);
}

// ---------------------------------------------------------------------------
// THE FULL REP CYCLE — the coverage gap a phone playtest found
// ---------------------------------------------------------------------------
/**
 * Every reading above this point in the file is taken once, right after the
 * arm opens — which is BRACE, before any press. `PROBE 1`'s gesture presses
 * the COPY, not the stage, so it never advances the mechanic's phase either.
 * So nothing in this file had ever re-read computed style after a real press
 * had moved the rep past DESCENT — and a phone playtest found the callout
 * suppressed correctly during the held-down depth press and NOT suppressed on
 * the far side of it: the drive press, and the hold through lockout.
 *
 * This drives ONE real rep with a real mouse, through every phase —
 * BRACE, DESCENT, HOLE, ASCENT (before and after the drive press), LOCKOUT,
 * RESOLVED — and re-reads `user-select` / `touch-action` off
 * `session-touch` and `session-prompt` at each boundary. `PRESS_NOT_SELECT`
 * and `PRESS_NOT_TAKEN` are static objects on a `StyleSheet.create` module
 * export, spread once at the screen root and the stage; nothing in `SetView`
 * conditionally removes them on a phase change. So the honest prediction is
 * NO deviation — and asserting that is still worth doing, deliberately,
 * because "the mechanism has no reason to vary" is exactly the kind of claim
 * CLAUDE.md's "verifying a mechanism is not verifying what follows from it"
 * warns is not the same as measuring it. This measures it.
 *
 * SESSION ARM ONLY, and that scope is a decision rather than an oversight.
 * The meet arm's nine attempts are already fully accounted for by PROBE 1's
 * screen and PROBE 2's four pans plus what `driveMeetToItsEnd` needs to keep
 * every lift off three misses (see the file header's arithmetic); a full rep
 * cycle here would need at least one more attempt this arm's budget does not
 * have. The debug arm is a frozen replay frame — `?replay=1.0&moment=brace` —
 * and never advances past BRACE at all, so there is no cycle to drive. What
 * this covers is a fact about `LiftStage`'s CSS placement, which every arm
 * mounts identically (the CROSS-ARM section below already asserts the three
 * arms compute the SAME press properties), so a defect here would not be
 * session-specific even though the drive is.
 *
 * ADAPTIVE, NOT A SINGLE GUESSED HOLD — measured, not assumed. The first
 * version of this probe held for a single fixed 1000ms (`sessionDrive.mjs`'s
 * own `DEPTH_HOLD_MS` default) and it BURIED the rep outright on this run: a
 * fresh lifter's very first prescribed set is not the RPE-8 triple that
 * constant's derivation assumes, so the legal band sits somewhere else. That
 * file's own header calls 1000ms "A STARTING POINT, not a fixed value" and
 * ships `freshDepthSearch`/`adaptDepthSearch` for precisely this reason. This
 * probe reuses both: on a miss it reads the miss's `detail`, adapts the hold
 * exactly the way the shared driver does, waits for the app's own automatic
 * next-rep reset, and retries — up to `FULL_CYCLE.MAX_ATTEMPTS` times. A miss
 * along the way is not a defect in the app; it is the mechanic behaving
 * correctly under a hold this probe guessed wrong, and every phase reading
 * from every attempt — including the missed ones, which still visit BRACE,
 * DESCENT and RESOLVED — is kept and checked, not just the ones from the
 * attempt that finally reached LOCKOUT.
 *
 * ===========================================================================
 * WHY THIS ARM PICKS SESSION_DRIVE.RPE_CHOICE_HEAVY, AND WHAT KIND OF
 * CLAIM THAT IS
 * ===========================================================================
 * `ASCENT_AFTER_CUE` (RIDE IT, `promptFor` in `src/game/lift.ts`) had never
 * been observed rendering anywhere in this repo's own browser evidence — not
 * on-device, not here. Traced rather than guessed: it only shows once
 * `drivesUsed > 0` with no cue currently open, i.e. between a rep's 2nd+
 * required drive cue, and `driveAttemptsFor` needs `loadRatio` above what
 * `SESSION_DRIVE.RPE_CHOICE` (mid-ladder, RPE 8) reaches.
 *
 * THIS IS A REAL, PLAYER-REACHABLE STATE, NOT A SYNTHETIC OVERRIDE — worth
 * being exact about, because the two support different strength claims and
 * this file elsewhere refuses to blur them. `SESSION_DRIVE.RPE_CHOICE_HEAVY`
 * presses `session-rpe-9`, one button on the RPE ladder `BriefingView.tsx`
 * renders for every player on every session (`SESSION_TUNING.RPE_CHOICES` is
 * `[6, 7, 8, 9, 10]`) — not `?replay=` or any other debug entry point. A real
 * lifter choosing to work at RPE 9 is an ordinary, ungated decision the game
 * already offers; this arm just makes the same choice a heavy-effort player
 * would, rather than the mid-ladder one `openSessionToFirstSet`'s default
 * models for every other caller of it. So what this proves is "a real player
 * choosing a heavy RPE the session offers sees RIDE IT render", which is
 * a strictly weaker claim than "every player sees it" — most days, at the
 * mid-ladder RPE this file's other tools keep photographing, a session never
 * reaches a second drive cue at all, and that is not a defect.
 *
 * RPE 9, NOT RPE 10 — chosen for the single-tap forgiveness margin, measured
 * via the pure sim: at RPE 9 a press anywhere from dead-on-ideal to +90ms
 * late still grades a clean `good-lift` at every seed tried, +120ms still
 * wins as a `grind`, and only past +140ms of a ~151ms half-window does it
 * actually miss. At RPE 10 the same sweep started failing past +100ms of a
 * narrower ~147ms half-window — a real, load-scaled difference (the RPE-
 * scaled precision axis working as designed), not noise, and this loop's own
 * `AIM_FOR_CENTER_DELAY_MS` cannot fully account for the real wall-clock
 * latency a browser-driven tap carries (see that constant's own header). RPE
 * 9's wider margin absorbs that; RPE 10's measurably did not.
 *
 * IT DOES NOT REACH EVERY CUE COUNT THE MECHANIC HAS, either, and that is
 * also stated rather than implied — RE-MEASURED after the Finding 2 retune
 * (`liftTuning.ts`'s `DRIVE_ATTEMPTS_PER_REP.MAXIMAL` 3 → 6): measured,
 * `percentOf1RM(REPS_PER_SET, 9)` is 89.2% of e1RM, short of the ~100%
 * loadRatio `driveAttemptsFor` needs to return 5 (the count
 * `LOAD_PRESETS.MAXIMAL` reaches in `lift.test.ts`). RPE 9 gives 4 drive
 * cues now — no longer uniform across the ladder the way the old tuning's
 * flat "2 everywhere" was: RPE6=3, RPE7=4, RPE8=4, RPE9=4, RPE10=5,
 * measured directly rather than assumed to still hold — so this closes
 * "does RIDE IT ever render", not "does a 6-cue rep".
 *
 * SECOND, INDEPENDENT FIX BUNDLED HERE, BECAUSE THE FIRST ONE IS USELESS
 * WITHOUT IT: even at a load requiring 4 cues, the OLD single
 * `mouse.down()`-held-to-lockout below could only ever satisfy the FIRST
 * one — `lift.ts`'s ASCENT step reads `pressed` off a single 'press' EVENT
 * per physical touch edge, so a continuous hold produces exactly one such
 * edge. The drive loop below taps and releases for each cue as it opens,
 * matching how a real finger moves rather than how this probe's OLDER,
 * single-cue-era code happened to model it.
 */
/**
 * Restated from `LIFT_COPY.SUBTITLE` in `src/game/liftTuning.ts`, the same
 * way `SESSION_PROMPTS` above already mirrors `LIFT_COPY.PROMPT` — a plain
 * `.mjs` tool cannot import a `.ts` module without a loader this tree does
 * not run, so the check below compares the BROWSER'S rendered text against
 * this local copy rather than against the constant itself. That means a
 * future edit to the real subtitle reddens THIS line, same as it would for
 * SESSION_PROMPTS.DRIVE — this is not weaker evidence, it is the established
 * pattern for exactly this boundary.
 */
const REAL_SUBTITLE_MIRROR =
  'Two moments, not two motions: release at the bottom, tap every drive cue. Catch the beat.';
/**
 * Same pattern as `REAL_SUBTITLE_MIRROR` immediately above, restated from
 * `LIFT_COPY.PROMPT.ASCENT_AFTER_CUE` in `src/game/liftTuning.ts`.
 *
 * `ASCENT_BEFORE_CUE` (shown before ANY cue has ever landed) and
 * `ASCENT_AFTER_CUE` (shown between cues, once `drivesUsed > 0` —
 * `promptFor` in `src/game/lift.ts`) currently render the SAME string, so
 * this mirror cannot by itself prove which branch fired — a phase captured
 * before the first tap would match it just as well and the check would be
 * vacuous the same way a floor-wide 'RIDE IT' search would be. What makes it
 * non-vacuous is WHERE it is checked: only against phases this probe itself
 * labelled `-drive-tap-N-settled`, which by construction only exist after
 * `drivesTapped` taps have already landed — so if one of THOSE phases reads
 * this string, `promptFor` can only have taken the AFTER branch to produce
 * it. See the check itself for the phase-name filter that makes this true.
 */
const REAL_ASCENT_AFTER_CUE_MIRROR = 'RIDE IT';
/**
 * `awaitFirstDriveCue` and `tapDriveCuesToLockout` USED TO LIVE HERE AND ARE
 * `sessionDrive.mjs`'s NOW, imported at the top of this file.
 *
 * Moved rather than copied when `meetDrive.mjs` needed the same beat for GDD
 * §6.2's three attempts: this loop is where four separate real bugs were found
 * and fixed (a phantom re-tap burning a cue slot; an evidence snapshot eating
 * the aim window's own margin; a win showing GRINDER filed as a miss; a miss
 * reason read late enough to belong to the NEXT rep), and a second, meet-shaped
 * copy would be four bugs waiting to be re-introduced one at a time.
 *
 * WHAT DID NOT MOVE, DELIBERATELY: `FULL_CYCLE`'s four reaction times. They
 * were measured against THIS arm's loads and are handed in per call, so one
 * arm's measurements cannot silently claim to describe the other's. See
 * `ASCENT_TIMING` in `sessionDrive.mjs`.
 */
const FULL_CYCLE_ASCENT_TIMING = Object.freeze({
  get aimDelayMs() {
    return FULL_CYCLE.AIM_FOR_CENTER_DELAY_MS;
  },
  get tapMs() {
    return FULL_CYCLE.DRIVE_TAP_MS;
  },
  get settleMs() {
    return FULL_CYCLE.BETWEEN_CUES_SETTLE_MS;
  },
  get minCueSpacingMs() {
    return FULL_CYCLE.MIN_CUE_SPACING_MS;
  },
  get driveTimeoutMs() {
    return FULL_CYCLE.DRIVE_TIMEOUT_MS;
  },
  /**
   * The 15ms this file's own `untilLoop` polls at, restated as the shared
   * loop's parameter. `AIM_FOR_CENTER_DELAY_MS`'s header cites this number as
   * part of why zero is the reasoned aim delay at RPE 9, so it is not free to
   * drift: `untilLoop` below and this entry are the same 15.
   */
  pollMs: 15,
});

async function probeFullRepCycle(page, url) {
  // A FRESH, ISOLATED SESSION — NOT THE ONE PROBE 1/2 ALREADY PLAYED. See the
  // "WHY THIS ARM PICKS SESSION_DRIVE.RPE_CHOICE_HEAVY" section of this
  // function's header for what RPE_CHOICE_HEAVY is and is not. This
  // paragraph is about a DIFFERENT constraint discovered wiring it in: GDD's
  // session.ts says plainly, "A missed rep ends the set" — a whole
  // `SESSION_TUNING.WORK_SETS` slot (5 total), not one rep-slot. The caller's
  // arm-entry `openSessionToFirstSet` already spent some of those 5 on PROBE
  // 1/2's four real pans before this function is ever reached. Sharing that
  // SAME session at the heavier RPE meant PROBE 1/2's pans were now ALSO
  // running the harder load — burning sets neither they nor this loop's own
  // retries could afford, measured: attemptsUsed stalled at 4 instead of
  // reaching FULL_CYCLE.MAX_ATTEMPTS' declared 6, the budget silently smaller
  // than the number written for it. `armFreshLifterPerBoot` (this file's
  // top level) makes every `page.goto` a brand-new lifter, so this function
  // opening its OWN session gives it the full 5-set budget to itself, spent
  // on nothing but its own drive-tap retries.
  // SQUAT BY NAME, for the reason `openArm` gives at its own call: the default
  // is the calendar's rotation and every rep below is squat-shaped.
  const opened = await openSessionToFirstSet(page, url, undefined, SESSION_DRIVE.RPE_CHOICE_HEAVY, 'squat');
  if (!opened.reached) {
    return {
      drove: false,
      drovePastLockout: false,
      why: `this probe's own fresh session never reached a work set — ${opened.why ?? 'unknown'}`,
      phases: [],
      attemptsUsed: 0,
      misses: [],
    };
  }

  const phases = [];
  const snapshot = async (phase) => {
    const touch = await readTarget(page, 'session-touch');
    const text = await readTarget(page, 'session-prompt');
    const loop = await readLoop(page);
    // loop.detail was already being fetched by readLoop on every call below
    // and discarded — session-detail carries LIFT_COPY.SUBTITLE (see
    // REAL_SUBTITLE_MIRROR below) for most of a rep (LiftScreen.tsx: shown
    // whenever resolution is null or has no detail of its own), so this was
    // free evidence this probe was already paying for and not keeping.
    phases.push({
      phase,
      loopPrompt: loop.prompt,
      loopDetail: loop.detail,
      touch: touch?.self ?? null,
      text: text?.self ?? null,
    });
  };

  // ADAPTIVE, NOT A SINGLE GUESSED HOLD. `sessionDrive.mjs`'s own header
  // treats `DEPTH_HOLD_MS` as "A STARTING POINT, not a fixed value" and ships
  // `adaptDepthSearch` for exactly this reason — measured here, not merely
  // read: a single 1000ms hold buried the first rep of a fresh lifter's
  // session outright (DEPTH_COLLAPSE before the release ever fired), which is
  // the miss this codebase's own driver already expects and adapts away from
  // rather than treating as a harness failure.
  let search = freshDepthSearch();
  let drovePastLockout = false;
  let attemptsUsed = 0;
  const misses = [];

  for (let attempt = 1; attempt <= FULL_CYCLE.MAX_ATTEMPTS && !drovePastLockout; attempt += 1) {
    attemptsUsed = attempt;
    // WAIT FOR BRACE ON ATTEMPT 1 TOO, not only on a retry. This probe runs
    // after PROBE 2's four real pans on the same session-touch stage, each of
    // which is a genuine press-drag-release the mechanic processes as a rep
    // attempt — so the arm can already be mid-verdict ('NO LIFT', still
    // holding its result-screen delay) by the time this function's first
    // press fires. Measured: without this wait, attempt 1 pressed straight
    // into that hold and `sessionDrive.mjs`'s own `playOneRep` — which always
    // waits for BRACE before its first press too — was the thing that showed
    // the asymmetry. `attempt > 1` used to be the only branch that re-braced.
    const rebraced = await untilLoopSaying(page, SESSION_PROMPTS.BRACE, FULL_CYCLE.NEXT_BRACE_TIMEOUT_MS);
    if (!rebraced) {
      return {
        drove: attemptsUsed > 1,
        drovePastLockout: false,
        why: attempt === 1 ? 'the arm never showed a brace to start on' : 'the next rep never re-braced',
        phases,
        attemptsUsed,
        misses,
      };
    }
    await snapshot(`attempt${attempt}-0-brace-before-press`);

    const box = await page.getByTestId('session-touch').boundingBox().catch(() => null);
    if (box === null) return { drove: false, drovePastLockout: false, why: 'no session-touch box to start a rep on', phases, attemptsUsed, misses };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // PRESS-TO-DESCENT-CONFIRMED IS NOT FREE, AND IT IS NOT CONSTANT.
    // `search.holdMs` is meant as the total real time the app's depth
    // tracking sees between press and release — but the wait below used to
    // start only once THIS ROBOT'S OWN POLL noticed DESCENT, not from the
    // actual press. Instrumented rather than guessed (Date.now() either
    // side, printed across several real attempts, the same method
    // AIM_FOR_CENTER_DELAY_MS's header already documents): attempt 1 measured
    // 75-116ms, every retry attempt measured 281-337ms — NOT one constant
    // that could be baked into `search.holdMs` as a fixed offset, because
    // attempt 1 and attempt 2+ differ by roughly 200ms from each other. A
    // static compensation cannot fit both; a live one, subtracting THIS
    // attempt's own measured gap, does.
    const pressAt = Date.now();
    await page.mouse.down();

    const descending = await untilLoopSaying(page, SESSION_PROMPTS.DESCENT, FULL_CYCLE.PHASE_TIMEOUT_MS);
    if (!descending) {
      await page.mouse.up();
      return { drove: false, drovePastLockout: false, why: 'holding never started a descent', phases, attemptsUsed, misses };
    }
    await snapshot(`attempt${attempt}-1-descent`);
    const detectionLagMs = Date.now() - pressAt;
    const remainingHoldMs = Math.max(0, search.holdMs - detectionLagMs);
    await page.waitForTimeout(remainingHoldMs);
    await snapshot(`attempt${attempt}-2-descent-mid-hold`);
    await page.mouse.up();
    await snapshot(`attempt${attempt}-3-immediately-after-release`);

    // Did that release already end the rep (buried, or short of depth with
    // nothing left to ascend)? The outcome and its detail are what
    // `adaptDepthSearch` moves the NEXT attempt's hold on.
    const afterRelease = await readLoop(page);
    if (SESSION_PROMPTS.OUTCOMES.includes(afterRelease.prompt)) {
      misses.push({ attempt, holdMs: search.holdMs, outcome: afterRelease.prompt, detail: afterRelease.detail });
      search = adaptDepthSearch(search, { detail: afterRelease.detail });
      continue;
    }

    const inHole = await untilLoopSaying(page, 'OUT OF THE HOLE', FULL_CYCLE.PHASE_TIMEOUT_MS);
    if (inHole) await snapshot(`attempt${attempt}-4-hole`);

    // WAIT FOR THE DRIVE CUE **OR RESOLUTION**, TOGETHER — exactly
    // `sessionDrive.mjs`'s own `playOneRep`: `saying(DRIVE) || resolved(s)`.
    // The ascent can end on its own (a stall collapse, or the ascent timing
    // out) with no drive cue ever opening. Waiting on the cue ALONE and then
    // separately reading `readLoop()` after giving up raced the app's own
    // automatic next-rep reset: by the time the wait gave up, the miss had
    // already resolved AND the next rep had already re-braced, so the
    // "outcome" read back was the NEXT rep's BRACE prompt — not a miss reason
    // at all, and `adaptDepthSearch` silently no-opped on it. Measured on this
    // engine: attempt 2 recorded outcome `"TAP AND HOLD TO DESCEND"` and
    // attempt 3 held the exact same `holdMs` as attempt 2 as a result.
    // `lockoutPrompt` deliberately left null here — see `awaitFirstDriveCue`.
    // This is the same wait this block always did, moved into the function that
    // owns the precondition it establishes.
    const { cueOpen: driveOpen, loop: ascentEnded } = await awaitFirstDriveCue(page, {
      read: readLoop,
      timing: FULL_CYCLE_ASCENT_TIMING,
    });
    if (!driveOpen) {
      await snapshot(`attempt${attempt}-5-ascent-before-drive(drive-cue-seen=${driveOpen})`);
      const outcome = ascentEnded ?? (await readLoop(page));
      // Same non-vacuity as the tap loop below: an ascent that resolves
      // before ever showing a drive cue is a real miss ONLY if the outcome
      // is 'NO LIFT'. 'GOOD LIFT'/'GRINDER' without a cue is not reachable
      // at this arm's load in practice (the whole point of the load choice
      // is that an undriven bar cannot clear it), but treating it as a miss
      // by construction, rather than checking, is exactly the bug measured
      // in the tap loop — closed here too rather than left as a latent copy.
      if (SESSION_PROMPTS.OUTCOMES.includes(outcome.prompt) && outcome.prompt !== 'NO LIFT') {
        drovePastLockout = true;
        break;
      }
      misses.push({ attempt, holdMs: search.holdMs, outcome: outcome.prompt, detail: outcome.detail });
      search = adaptDepthSearch(search, { detail: outcome.detail });
      continue;
    }
    // NO SNAPSHOT HERE WHEN A CUE IS OPEN — moved to just after the first
    // tap below. See AIM_FOR_CENTER_DELAY_MS's header: `snapshot`'s own two
    // `readTarget` calls plus `readLoop` are three sequential CDP round
    // trips, measured costing 29-93ms in this exact spot — silently spent
    // out of the aim delay's own budget rather than the window's slack, the
    // largest single cause of every real drive-attempt landing late.

    // TAP EACH ARMED CUE — do not hold through the ascent. `lift.ts`'s ASCENT
    // step reads `pressed` off a single 'press' EVENT per physical touch edge
    // (`const pressed = input !== null && input.kind === 'press'`), so ONE
    // mouse.down() held to lockout satisfies at most the FIRST armed cue.
    // `driveAttemptsFor` (lift.ts) returns 3-5 across this session's own
    // ladder (RPE6-10; RPE9 specifically is 4, after the Finding 2 retune —
    // see SESSION_DRIVE.RPE_CHOICE_HEAVY's header for the measured numbers),
    // so a held-not-tapped drive silently starves every cue after the
    // first: each arms, times out unpressed (a miss the sim
    // absorbs without ending the rep — "A MISSED TAP COSTS VELOCITY. IT NEVER
    // ENDS THE REP ON ITS OWN"), and `promptFor`'s ASCENT_AFTER_CUE branch
    // (`state.drivesUsed > 0`, `LIFT_COPY.PROMPT.ASCENT_AFTER_CUE` — RIDE IT)
    // never had a first cue land to follow. This loop taps and releases for
    // each cue as it opens, the way a real finger does, and keeps going until
    // either lockout or the rep ends some other way.
    const drive = await tapDriveCuesToLockout(page, {
      read: readLoop,
      timing: FULL_CYCLE_ASCENT_TIMING,
      lockoutPrompt: LIFT_PROMPTS.squat.LOCKOUT,
      onTap: (n) => snapshot(`attempt${attempt}-6-drive-tap-${n}-released`),
      onSettled: (n) => snapshot(`attempt${attempt}-6-drive-tap-${n}-settled`),
      onLockout: (n) => snapshot(`attempt${attempt}-7-lockout-after-${n}-tap(s)`),
    });
    const { lockedOut, finalOutcome } = drive;
    drovePastLockout = drovePastLockout || lockedOut;
    await page.waitForTimeout(150);
    await snapshot(`attempt${attempt}-8-after-drive-sequence`);

    if (!lockedOut) {
      // finalOutcome is null only if untilLoop's own wait timed out with
      // nothing matching — a real "nothing happened" the fallback readLoop()
      // legitimately describes, not a race with the reset.
      const outcome = finalOutcome ?? (await readLoop(page));
      misses.push({ attempt, holdMs: search.holdMs, outcome: outcome.prompt, detail: outcome.detail });
      search = adaptDepthSearch(search, { detail: outcome.detail });
    }
  }

  await page.waitForTimeout(PRESS_PROBE.READ_SETTLE_MS);
  await snapshot('resolved-or-reset-for-next-rep');

  return { drove: true, drovePastLockout, phases, attemptsUsed, misses };
}

/**
 * Every number this probe's retry loop moves on. Not game feel — `holdMs`
 * itself comes from `sessionDrive.mjs`'s adaptive search, which already owns
 * the mechanic's real timing band; these are just how long the robot waits
 * for a prompt and how many misses it tolerates before giving up.
 */
const FULL_CYCLE = Object.freeze({
  /**
   * `sessionDrive.mjs`'s own adaptive search is written to converge, not to
   * guarantee a make on the first try — a fresh lifter's first rep measured
   * buried outright at the 1000ms starting point. Bounded rather than
   * unbounded so a genuinely broken mechanic fails this probe instead of
   * hanging it.
   */
  MAX_ATTEMPTS: 6,
  PHASE_TIMEOUT_MS: PRESS_PROBE.HOLD_MS * 4,
  DRIVE_TIMEOUT_MS: PRESS_PROBE.HOLD_MS * 6,
  /** REP_RESULT_HOLD_MS plus the reset, generously. */
  NEXT_BRACE_TIMEOUT_MS: 8000,
  /**
   * How long each drive tap's mouse.down() is held before releasing — a real
   * quick tap, not a hold. Several sim ticks (TICK_MS ~16.7) so the press is
   * unambiguously registered, nowhere near driveSpacingTicks' ~450ms gap so
   * it cannot itself eat into the window the next cue needs to arm in.
   */
  DRIVE_TAP_MS: 60,
  /**
   * After releasing a tap, how long to let the state machine settle before
   * reading it. RE-MEASURED after the Finding 2 retune (liftTuning.ts:
   * DRIVE_ATTEMPTS_SPACING_MS.MAXIMAL 380ms → 60ms): `driveSpacingTicks(0.892)`
   * is now 15 ticks, 250ms, down from 27 ticks/~450ms. 200ms no longer sits
   * comfortably inside that — moved to 100ms so this still lands safely
   * before the real floor rather than nearly on top of it.
   */
  BETWEEN_CUES_SETTLE_MS: 100,
  /**
   * The floor this loop waits out, after BETWEEN_CUES_SETTLE_MS, before
   * treating a still-'DRIVE — TAP' reading as a genuinely new cue worth
   * tapping again. RE-MEASURED after the Finding 2 retune, same reason as
   * `BETWEEN_CUES_SETTLE_MS` above: `driveSpacingTicks(0.892)` (lift.ts, at
   * RPE_CHOICE_HEAVY's loadRatio) is now 15 ticks, ~250ms — no cue can
   * legitimately arm before that elapses. 550ms (the old value, set above a
   * ~450ms floor) would now poll for the next cue only after its window
   * (open at the floor, closing `DRIVE_IDEAL_LEAD_MS + DRIVE_WINDOW_MS/2`
   * — ~400ms — later, so ~650ms after cue N resolves) has only 100ms left
   * rather than the ~400ms margin the old pairing had — set above the NEW
   * measured value with a smaller but still real margin (30ms) rather than
   * reusing a margin sized for a floor that no longer exists.
   */
  MIN_CUE_SPACING_MS: 280,
  /**
   * How long to wait, after this loop detects a cue is open, before actually
   * tapping. NOT load-bearing precision the way an earlier version of this
   * constant had to be — that history is kept here because it is what
   * explains RPE_CHOICE_HEAVY being RPE 9 rather than RPE 10, and because the
   * bugs it surfaced were real regardless of which RPE this arm settled on.
   *
   * FIRST TRIED AT RPE 10, THEORETICALLY: `byLoad(DRIVE_WINDOW_MS, 0.922)`
   * gives a half-window of ~147ms, so this was set to that value, aiming for
   * `idealTick` dead center. It measurably missed — the true cost from
   * "detected open" to "the sim registers the press" runs longer than a
   * `waitForTimeout` alone accounts for.
   *
   * RECALIBRATED EMPIRICALLY, the same way `sessionDrive.mjs` calibrates
   * `DEPTH_HOLD_MS` against the real mechanic rather than deriving it from
   * tuning constants: single-tap-only trials in an isolated browser (no other
   * arm's load on the page, still at RPE 10), sweeping delay against LOCKOUT
   * reached on that one tap alone — a reliable band from roughly 80ms to
   * 120ms, falling off on both sides, 100ms in the middle. STILL not enough
   * once wired into the real loop: every drive-reaching attempt across a full
   * 6-try budget stalled. Instrumented rather than guessed again —
   * `Date.now()` either side of the wait, printed for several real attempts —
   * and found the actual cause: this loop used to take an evidence snapshot
   * (`snapshot(...)`, three sequential CDP round trips) BETWEEN detecting the
   * cue and starting this wait. Measured cost of that call alone: 29-93ms,
   * silently spent out of this delay's own budget — total detected-open-to-
   * mouse-down ran 126-173ms, past RPE 10's ~147ms half-width on several
   * attempts. That snapshot is no longer taken before the tap (see the
   * comment above this loop). A SEPARATE bug surfaced alongside it: this
   * loop's own success check required literally seeing 'LOCK IT' text, and
   * `LOCKOUT_TICKS` at this load is short enough that a poll can land after
   * it — a rep that reached RESOLVED showing 'GRINDER' (a real win,
   * `SESSION_PROMPTS.OUTCOMES`) was being filed as a miss because the one
   * frame it happened to skip past was the only thing this loop accepted as
   * success. Fixed alongside (see the `wonOutright` check below).
   *
   * With both of those genuine bugs closed, RPE 10 still was not reliable —
   * runs still varied between passing outright and 0/6 drive-attempts
   * landing. Measured via the pure sim rather than tuned further by feel: at
   * RPE 10, a single tap only wins from dead-on-ideal to +100ms late (of a
   * ~147ms half-window) before it starts missing — LOSING on both the early
   * and the late side, which is what made aiming for the center the right
   * shape of fix there.
   *
   * AT RPE 9 THE SHAPE IS DIFFERENT, AND THAT CHANGES WHAT "AIM FOR CENTER"
   * SHOULD MEAN. Same sweep: offset 0 (dead-on-`openTick`, no deliberate wait
   * at all) already grades a clean `good-lift` at every seed tried, and stays
   * a win all the way out to +90ms as `good-lift`, +120ms as `grind`, only
   * missing past +140ms of a ~151ms half-window. So the LEADING edge is not
   * a losing zone here the way it was at RPE 10 — only the trailing one is.
   * Adding a deliberate wait before tapping does not move this loop toward
   * any better-scoring point; it only spends margin against the one edge
   * that actually loses, on top of whatever real dispatch latency this loop
   * cannot observe or bound (measured elsewhere in this header: readLoop's
   * own round trip alone ranged 1-25ms across two runs of the same code, and
   * total open-to-mouse-down 65-969ms across a single run's own attempts —
   * a spread no fixed small delay added on top makes safer). Zero is the
   * REASONED choice at this load, not merely the cheapest one: it is the
   * point in the sim-measured winning band furthest from the only edge that
   * loses, with the full ~140ms of margin available to absorb whatever this
   * loop cannot see, instead of consuming part of that margin up front for a
   * shape of forgiveness (a losing leading edge) this load does not have.
   * `untilLoop`/`untilLoopSaying` still poll at 15ms rather than the 30ms
   * they used during the original RPE 10 calibration, closing a real but
   * smaller systematic detection lag on top of this.
   */
  AIM_FOR_CENTER_DELAY_MS: 0,
});

/**
 * Poll `readLoop`'s prompt text until it CONTAINS `wanted`, or the deadline
 * passes. Substring rather than equality, matching `sessionDrive.mjs`'s own
 * `saying()` — `LIFT_COPY.PROMPT.ASCENT_CUE_OPEN` is `'DRIVE — TAP'`, not
 * the bare `SESSION_PROMPTS.DRIVE` this checks against, and an equality check
 * here silently never matches it. Measured, not theorised: the first version
 * of this probe used `===` and reported `drovePastLockout: false` on every
 * run, because it could never see the drive cue open at all.
 */
async function untilLoopSaying(page, wanted, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const loop = await readLoop(page);
    if (loop.prompt !== null && loop.prompt.includes(wanted)) return true;
    if (Date.now() - started >= timeoutMs) return false;
    await page.waitForTimeout(15);
  }
}

/**
 * Poll `readLoop` until `predicate(loop)` is true, returning the loop state
 * that satisfied it (or `null` on timeout) — unlike `untilLoopSaying`, which
 * only reports whether ONE substring showed up and discards the reading that
 * proved it. Needed wherever more than one ending is legitimate at once, the
 * way `sessionDrive.mjs`'s own `playOneRep` waits on
 * `saying(DRIVE) || resolved(s)`: waiting on the cue alone and then reading
 * state separately after giving up races the app's own automatic next-rep
 * reset, and the second read can already belong to a different rep.
 */
async function untilLoop(page, predicate, timeoutMs) {
  const started = Date.now();
  for (;;) {
    const loop = await readLoop(page);
    if (predicate(loop)) return loop;
    if (Date.now() - started >= timeoutMs) return null;
    await page.waitForTimeout(15);
  }
}

// ---------------------------------------------------------------------------
// THE PROMPT LADDER — WHICH LIFT DOES A PLAYER WHO TAPPED THE CHIP ACTUALLY GET?
// ---------------------------------------------------------------------------
/**
 * ===========================================================================
 * THE EVIDENCE GAP THIS CLOSES, MEASURED RATHER THAN ASSERTED
 * ===========================================================================
 * Everything above this line drives a SQUAT. `.gauntlet/shots/lift-press/press.json`
 * stamped commit `ba1931c`, whose session arm recorded `loopPrompt`
 * "TAP AND HOLD TO DESCEND" and `loopDetail` "...release at the bottom, tap
 * every drive cue..." — squat grammar, both — and that record predates
 * `9789da3` ("thread LiftKind into the tick sim"), so it describes a
 * squat-only tree. Two of the game's three competition lifts had shipped phase
 * models and NO browser evidence at all.
 *
 * CLAUDE.md: "A screen a player reaches needs a check that reaches it the way a
 * player does." A deadlift is a screen a player reaches — `CheckInView.tsx`
 * renders one chip per `SESSION_TUNING.LIFT_ROTATION` entry and a tap on
 * `check-in-lift-deadlift` retargets the session (GDD §3.2) — so the rule
 * applies in full and was unmet.
 *
 * ===========================================================================
 * WHY THE PROMPT TEXT IS THE INSTRUMENT, AND WHAT MAKES THAT MORE THAN COPY
 * ===========================================================================
 * `vitest.config.ts` is `environment: node`, so nothing in the suite renders,
 * and the browser cannot read `LiftState.phase` — it is a value inside a hook.
 * What it CAN read is `session-prompt`, which `SetView.tsx` fills from
 * `promptFor(loop.state)`, a pure function of `state.phase` and
 * `state.config.kind`. So the prompt ladder is the phase ladder seen through
 * one total function, and the strings are per-kind and mutually exclusive:
 * "TAP TO PULL" is printable ONLY from (deadlift, BRACE), "DON'T LET GO" only
 * from (deadlift, LOCKOUT) before the command, "DOWN" only from (deadlift,
 * LOCKOUT) after it, and "KEEP DESCENDING" / "OUT OF THE HOLE" /
 * "STAY TIGHT" / "WAIT FOR IT" / "PRESS — TAP FAST" only from a DESCENT or a
 * HOLE —
 * phases `stepLift` REFUSES to a deadlift outright.
 *
 * `session-detail` is the second, independent read: `SetView` fills it from
 * `LIFT_COPY.SUBTITLE[loop.state.config.kind]`, indexing the config's kind
 * DIRECTLY rather than routing through a phase. So the subtitle says which
 * lift the sim was configured for and the prompt ladder says which phase path
 * it actually walked, and a fallback that moved one without the other shows up
 * as the two disagreeing.
 *
 * ===========================================================================
 * THE ZERO HAS TWO NON-ZERO CONTROLS BESIDE IT, TAKEN BY THE SAME INSTRUMENT
 * ===========================================================================
 * "We polled a deadlift and saw no DESCENT" is the shape CLAUDE.md refuses
 * everywhere — a measurement at the horizons somebody happened to sweep,
 * presented as a property. An empty domain (a recorder that samples nothing, a
 * rep that never left BRACE) reports exactly the same zero as the property.
 *
 * So all three lifts are driven, by one function, in one run, and the counts
 * are pinned EXACTLY rather than bounded: a squat's ladder contains exactly 2
 * of the game's 5 eccentric-only lines, a bench's exactly 3, a deadlift's
 * exactly 0. The two non-zero counts are what the zero is zero against, which
 * is the arrangement `src/game/streak.test.ts` uses for the same reason.
 *
 * ===========================================================================
 * WHAT THIS SECTION CANNOT SAY
 * ===========================================================================
 * - It cannot see the CUE RING. `cueProgress` returning null for the whole of
 *   a deadlift LOCKOUT — the "nothing telegraphs the down command" guarantee —
 *   is drawn into the Skia `<canvas>`, not into any element with a testID.
 *   Reported as a NAMED SKIPPED check rather than folded into a green;
 *   `lift.test.ts`'s no-countdown test is what actually keeps it true.
 * - It cannot say the down command's delay is SEEDED rather than fixed. One
 *   played rep is one draw, and a hardcoded delay inside the declared band
 *   would satisfy the band check below. What that check catches is a delay
 *   that has come loose from the table it is declared in, and a command that
 *   never arrives at all. The seeding is `lift.test.ts`'s to hold.
 * - It does not judge whether the hold FEELS like a hold (GDD §12.1).
 */

/**
 * ===========================================================================
 * WHERE THIS SECTION'S PURE-SIM NUMBERS CAME FROM — STAMPED, BECAUSE THEY ARE
 * ONE-TIME MEASUREMENTS AND NOTHING IN THE TREE CAN WATCH THEM EXPIRE
 * ===========================================================================
 * Several constants and skip messages below cite sweeps over `lift.ts` — the
 * RPE table in `RPE_CHOICE`, the depth bands in `START_HOLD_MS`, the
 * `0 of 40` / `40 of 40` control figures, the `29 of 40` seed split. Those were
 * taken by driving `createLift` / `stepLift` directly from a throwaway vitest
 * file which is NOT in this tree, so they are anecdotes about an unnamed tree
 * unless the tree is named.
 *
 * MEASURED AT `8ef61c9`. A reader can check that stamp without knowing what was
 * measured — `git merge-base --is-ancestor 8ef61c9 HEAD` — which is the
 * property CLAUDE.md's stamping rule exists for. Re-derivable only by
 * re-writing that harness: the `@guarantee` scoper reaches `src/` and cannot
 * see a `.mjs` tool, so NOTHING HERE GOES RED when `liftTuning.ts` moves
 * underneath these numbers. They are labelled measurements rather than
 * guarantees for exactly that reason, and a re-tune of the mechanic should
 * expect to re-take them.
 *
 * The BROWSER numbers are different in kind and are stamped where they appear:
 * the re-grip spread (90 / 114 / 121 ms) was measured against `18ef5b7`, after
 * the spacing-floor fix that produced it.
 */

/**
 * Every number the ladder probe moves on, in one place.
 *
 * NONE OF THESE ARE GAME FEEL — the game's are in `src/game/liftTuning.ts`.
 * These are a robot's reaction times and its patience, kept here for the reason
 * `PRESS_PROBE` and `FULL_CYCLE` keep theirs: one place to look when the robot
 * stops keeping up with a re-tuned mechanic.
 */
const LIFT_LADDER = Object.freeze({
  /**
   * THE RPE THIS PROBE PRESSES — `SESSION_DRIVE.RPE_CHOICE`, `session-rpe-8`,
   * one button on the ladder `BriefingView.tsx` renders for every player on
   * every session. An ordinary ungated decision, not a debug entry point, and
   * the same mid-ladder rung every capture tool in this directory photographs.
   *
   * ===========================================================================
   * RPE 9 WAS TRIED FIRST AND WAS MEASURABLY THE WORSE CHOICE FOR THIS PIECE
   * ===========================================================================
   * `probeFullRepCycle` picks RPE 9 because it needs a SECOND drive cue to
   * exist, which is a fact about squat's ascent. This probe's subject is the
   * deadlift's LOCKOUT, and the two rungs differ there in a way that decides
   * whether the control rep can discriminate at all.
   *
   * Measured in the pure sim at `8ef61c9` over 40 seeds at each rung, driving
   * the ascent the way this probe does and varying how LATE each tap lands (0 to 45 ticks
   * after the cue opens, which past ~20 means the window has already closed and
   * the press is graded a full window early — the worst case a slow robot
   * produces):
   *
   *              held to the down command        finger never returns
   *     RPE 6    good-lift 40/40 at every lag    miss 25 / grind 15
   *     RPE 7    good-lift 40/40 at every lag    miss 28 / grind 12
   *     RPE 8    good-lift 40/40 at every lag    miss 29 / grind 11
   *     RPE 9    good-lift to 12 ticks, then     miss 30 / grind 10
   *              grind 40/40 past 20
   *
   * So at RPE 9 the held rep grades GRINDER whenever the robot is more than
   * ~200 ms late on a tap — which is most of the time in this environment, and
   * was the outcome of the first real browser run of this probe. Both halves of
   * the control pair then read GRINDER and the pair says nothing. At RPE 8 the
   * held rep is a clean GOOD LIFT at every tap lag and the un-held one never
   * is, so the pair discriminates on every seed.
   *
   * AND THE COST OF RPE 8 IS STATED RATHER THAN HIDDEN: at that load a deadlift
   * locks out 40/40 as a clean `good-lift` EVEN WITH NO DRIVE TAPS AT ALL, so
   * the ascent's cues are not load-bearing there. This probe still taps every
   * one of them and the ladder below still records them rendering — what it
   * does NOT claim is that the taps were what made the rep. That is the shape
   * `liftTuning.ts`'s `DEMO.DEFAULT_LOAD_INDEX` header already worries about
   * for squat ("the drive input is decoration and the mechanic is a cutscene
   * with a button on it"), and it is reported as a finding rather than fixed
   * from here: this is a browser instrument, not a tuning pass.
   */
  RPE_CHOICE: SESSION_DRIVE.RPE_CHOICE,

  /**
   * ===========================================================================
   * ...EXCEPT ON BENCH, WHICH TAKES THE TOP OF THE LADDER, AND THE REASON IS A
   * PINNED TABLE RATHER THAN A PREFERENCE
   * ===========================================================================
   * The 2026-08-25 replay steer's headline property is "stop tapping and the
   * bar stalls; start again and it comes back", and this probe now drives that
   * on the stage: a rep with a deliberate hole in its grind, a stall cue that
   * has to draw during the hole, and a lockout on the other side of it. THAT
   * CHECK NEEDS A LOAD THAT CAN ACTUALLY STALL.
   *
   * ===========================================================================
   * THE REASON THIS BLOCK GAVE FOR RPE 10 WAS TRUE AND IS NOT ANY MORE, AND IT
   * IS CORRECTED RATHER THAN LEFT STANDING BEHIND A DECISION IT NO LONGER
   * SUPPORTS
   * ===========================================================================
   * It read: "at RPE 8 nothing can [stall] — `REACHABLE_RESCUE` pins
   * `session/rpe8/0.8500/as-expected` at `[40, 0, 0]`, the outcome moves but
   * ZERO of 80 paired reps stall and ZERO lose a rep. A stall check driven
   * there has an empty domain." That was accurate, and it is the exact
   * complaint a phone replay made about RPE 8 on 2026-08-26; the difficulty
   * retune it produced is what closed it. The same three rows now read:
   *
   *     session/rpe8/0.8500/as-expected    [80, 20, 20]   (was [40,  0,  0])
   *     session/rpe9/0.8750/as-expected    [80, 80, 80]   (was [80, 20, 20])
   *     session/rpe10/0.9000/as-expected   [80, 80, 80]   (was [80, 80, 40])
   *
   * as `[rescued, fromMiss, stalled]` out of 80 pairs. So RPE 8 CAN stall now
   * and the old argument's empty-domain premise is gone with it.
   *
   * RPE 10 STAYS, ON THE WEAKER REASON THAT IS STILL TRUE. It is the hardest
   * rung the ladder offers, so the stall it produces is the largest and the
   * abandoned control is the least likely to sneak a make: every one of its 80
   * pairs stalls AND turns a miss into a make when the tapping resumes, which
   * is what makes "pause -> stall -> resume -> LOCKOUT" a claim about the
   * mechanic rather than about a rep that was going to make anyway. RPE 9 would
   * now satisfy the same two conditions, and that is written down so nobody
   * re-derives this choice as FORCED when it is only the strongest.
   *
   * AND THE COST IS STATED RATHER THAN HIDDEN, in the shape this block's own
   * RPE-8 note already uses: RPE 10 is the hardest rung the ladder offers, so a
   * bench rep here is genuinely losable by a robot whose cadence is poor. That
   * is why `grindTapToResolution` MEASURES its achieved inter-tap gap and this
   * file compares the implied grind force against
   * `BENCH_DRIVE.GRIND_FORCE_FLOOR` — a missed rep with a poor cadence behind
   * it is the driver's failure and must not be read as the app's.
   *
   * A REAL PLAYER DECISION, NOT A DEBUG OVERRIDE. `session-rpe-10` is one
   * button on the ladder `BriefingView.tsx` renders for every player on every
   * session, and `SESSION_TUNING.RPE_CHOICES` is `[6, 7, 8, 9, 10]`.
   */
  RPE_CHOICE_FOR: Object.freeze({
    squat: SESSION_DRIVE.RPE_CHOICE,
    bench: 'session-rpe-10',
    deadlift: SESSION_DRIVE.RPE_CHOICE,
  }),

  /**
   * ===========================================================================
   * ...AND BENCH ANSWERS THE CHECK-IN AT ITS WORST, WHICH IS THE HARDEST REP AN
   * ORDINARY PLAYER CAN REACH AND NOT THE EASIEST
   * ===========================================================================
   * THE FIRST RUN OF THE STALL CHECK MEASURED ZERO, AND THE CAUSE WAS THE CELL
   * RATHER THAN THE STAGE. Driven at the mid check-in, RPE 10, the bar did not
   * stall — the rescue rep reached lockout as a clean GOOD LIFT with no stalled
   * tick in it, so the band the check was looking for was correctly absent and
   * the check was correctly red about a rep that had nothing to say.
   *
   * Structural elimination before any re-run, in the pure sim over the REAL
   * cells (`sessionFeel` + `prescribeSession`, driven with this probe's own
   * schedule: taps every 3 ticks, hole after 8 taps), 20 seeds per cell,
   * measured@66c2415:
   *
   *     cell                              pause  stalled  made
   *     mid/as-expected   rpe10  0.9000    18t    0/20    20/20
   *     mid/as-expected   rpe10  0.9000    80t    0/20    20/20
   *     best/popping      rpe10  0.9500    80t    0/20    20/20
   *     poor/slower...    rpe10  0.8750    60t    0/20    20/20
   *     poor/slower...    rpe10  0.8750    80t   20/20    20/20
   *
   * A HIGHER LOAD IS NOT A HARDER REP HERE, and that is what makes this a table
   * rather than an intuition: `lift.test.ts`'s `REACHABLE_COUPLING` pins that a
   * better check-in raises the lifter's capacity MORE than it raises the load,
   * at every rung — and that RPE 10 is the one rung where the POOR check-in is
   * the hardest cell. So the hardest bench rep the ladder can offer is the top
   * of the RPE ladder answered at the bottom of the check-in, which is what
   * these three press.
   *
   * ===========================================================================
   * RE-TAKEN AFTER THE 2026-08-26 DIFFICULTY RETUNE: THE WORST CHECK-IN IS NO
   * LONGER REQUIRED, AND IT IS KEPT ANYWAY
   * ===========================================================================
   * The table above is the OLD curve's and is kept as the record of why this
   * row was written. Re-run on the shipped curve at this probe's own schedule
   * and its own hole (taps every 3 ticks, hole at 12t, pause 45t), 20 seeds:
   *
   *     cell                              pause  stalled  rescued  abandoned
   *     mid/as-expected   rpe10  0.9000    42t   20/20    20/20      0/20
   *     mid/as-expected   rpe10  0.9000    55t   20/20     0/20      0/20
   *     best/popping      rpe10  0.9500    42t   20/20    20/20      0/20
   *     poor/slower...    rpe10  0.8750    42t   20/20    20/20      0/20
   *     poor/slower...    rpe10  0.8750    55t   20/20     0/20      0/20
   *
   * The `0/20` in the mid row's `stalled` column — the whole reason this arm
   * takes the worst answers — is now `20/20`. Every check-in stalls at RPE 10.
   *
   * IT STAYS AT THE WORST ANSWERS, and the reason is that it is still the
   * hardest cell (`REACHABLE_COUPLING`'s pin that RPE 10 is the one rung where
   * a poor check-in is hardest is unchanged, because a uniform demand shift
   * preserves differences) and that changing which cell a browser instrument
   * presses is a change to what the evidence is OF. The row is corrected, not
   * re-chosen. A future piece that wants the mid answers here now can have
   * them; this one is a tuning pass and does not get to move the subject.
   *
   * The other two lifts keep `SESSION_DRIVE.CHECK_IN_TAPS`: the deadlift arm's
   * whole control pair is calibrated at the mid answers (see `RPE_CHOICE`), and
   * squat is a control for the eccentric census rather than a difficulty test.
   */
  CHECK_IN_FOR: Object.freeze({
    squat: SESSION_DRIVE.CHECK_IN_TAPS,
    bench: SESSION_DRIVE.WORST_CHECK_IN_TAPS,
    deadlift: SESSION_DRIVE.CHECK_IN_TAPS,
  }),

  /**
   * ===========================================================================
   * THE DELIBERATE HOLE IN THE GRIND — WHERE IT GOES AND HOW LONG IT LASTS
   * ===========================================================================
   * BOTH ARE ROBOT KNOBS AND NEITHER IS GAME FEEL, and both are here rather
   * than inline because the run they steer is the one this piece exists to
   * take. Placeholders against a mechanic GDD §12.1 leaves open; if a browser
   * run shows no stall, these are the two numbers to move.
   *
   * `GRIND_HOLE_AT_MS` PUTS THE HOLE AT AN INSTANT AND NOT AFTER A TAP COUNT,
   * and that distinction cost this check a red run. A tap count does not say
   * where the BAR is: the browser's achieved cadence varied 44-73 ms between
   * runs, so "after 8 taps" opened the hole 416 ms into one rep and 584 ms into
   * the next, and the second one had already cleared the sticking point — the
   * abandoned control locked out and the pair said nothing.
   *
   * ===========================================================================
   * WHERE THE JOINT WINDOW IS, MEASURED — AND IT IS EARLY
   * ===========================================================================
   * The pair needs BOTH arms at once: the abandoned rep must miss AND the
   * rescued rep must make, across the band of cadences a browser produces. The
   * abandoned arm never resumes, so the hole's LENGTH cannot reach it and its
   * column is a function of the instant alone; the rescued arm depends on both.
   * Swept in the pure sim on this probe's own cell, 40 seeds at each of three
   * cadences (3/4/5 ticks between taps), measured@6124931 — `abandoned made`
   * out of 40, and the WORST-CASE stalled ticks the hole produces:
   *
   *     instant   abandoned made   worst banded ticks   rescued made
   *               (any hole)       (hole 55t)           (hole 55t)
   *      10t      0 / 0 / 0        28 / 37 / 37         40 / 40 / 40
   *      12t      0 / 0 / 0        32 / 37 / 40         40 / 40 / 40
   *      14t      0 / 0 / 0        21 / 34 / 40         40 / 40 / 40
   *      18t      0 / 0 / 0         8 / 16 / 31         40 / 40 / 40
   *      21t      0 / 0 / 0         0 /  0 / 11         40 / 40 / 40
   *      27t     40 / 0 / 0         —                    —
   *
   * 12 ticks (200 ms) is taken because it is the widest point in BOTH
   * directions: nine ticks of slack before the abandoned rep starts making at
   * 27t, and the largest stall the hole produces, which is what the stage's
   * stall check has to see. Past 18t the stall collapses toward zero — the bar
   * is far enough up that stopping no longer stops it — and the earlier run's
   * 400 ms target sat right on that edge, which is why the pair came back 50/50
   * in a browser while reading 40/40 in the sim.
   *
   * THE HOLE THEREFORE OPENS WHILE THE BAR IS STILL ON THE CHEST, and this
   * block says so rather than letting the check's title imply otherwise.
   * `PRESS_LAUNCH_MS` is 300 ms, so 200 ms is inside the launch beat: the
   * player stops tapping just before the bar leaves, and the STALL that follows
   * is on the ascent, where `stallBand` is the only place it can be. The beat
   * being driven is still GDD §6.2's own sentence — "stop tapping and the force
   * falls away and the bar stalls; start again and it comes back" — because the
   * grind starts at the command and not at the launch. It is not "mid-ascent",
   * so neither check says that any more.
   *
   * `GRIND_PAUSE_MS` WAS 55 TICKS, from the same sweep's other axis: at 45
   * ticks the worst-case stall dropped to 16 and at 65 the rescued arm started
   * failing at the slower cadences (40 / 0 / 0 at 12t). 55 was the middle of the
   * only column where both arms held at every cadence measured. PAST TENSE
   * DELIBERATELY — the section directly below took it to 45, and this sentence
   * spent a round in the present tense asserting a value the file no longer
   * shipped, two lines above its own correction.
   *
   * ===========================================================================
   * BOTH SWEPT TABLES ABOVE ARE THE OLD CURVE'S, AND 55 TICKS WENT PAST THE
   * RESCUE CLIFF WHEN THE 2026-08-26 DIFFICULTY RETUNE LANDED
   * ===========================================================================
   * THIS IS THE FAILURE THIS RE-SWEEP EXISTS TO CATCH, and it was caught before
   * a browser run rather than by one. Re-run on the shipped curve, same sim,
   * same cell, same three cadences, 40 seeds each, at the shipped instant of
   * 12t: the RESCUED arm reads `0 / 0 / 0` made at a 55-tick pause. The
   * instrument's own control pair had stopped being a pair — the rep it was
   * driving to lockout no longer reaches lockout — and the check would have
   * come back red about the app.
   *
   * RE-SWEPT, and the pause axis at instant 12t is where the cliff is (worst
   * banded ticks and `rescued made`, per cadence 3/4/5 ticks):
   *
   *     pause   worst banded ticks   rescued made
   *      30t     2 / 11 / 12         40 / 40 / 40
   *      38t    16 / 23 / 19         40 / 40 / 40
   *      42t    20 / 28 / 27         40 / 40 / 40
   *      45t    24 / 33 / 33         40 / 40 / 40
   *      48t    28 / 33 / 33         40 / 40 / 40
   *      52t    36 / 32 / 32         40 /  0 /  0
   *      55t    30 / 30 / 30          0 /  0 /  0
   *
   * 45 ticks (750 ms) is taken: the largest pause that still rescues at EVERY
   * cadence with a whole column of margin above it, and the one that leaves the
   * biggest stall for the stage check to photograph. Seven ticks (117 ms) of
   * slack to the cliff at 52t, which is what `page.waitForTimeout` overshoot has
   * to fit inside; under-ticking on a loaded browser makes the real hole SHORTER
   * than 45 and is therefore the safe direction for the rescue, costing only
   * stall depth (16-23 banded ticks even at 38t).
   *
   * THE INSTANT DID NOT MOVE, AND IT GAINED SLACK. On the same re-sweep at a
   * 45-tick pause the abandoned arm is `0 / 0 / 0` made at every instant from
   * 10t through 33t and only starts making at 40t — the retune pushed that edge
   * out from 27t. The worst banded ticks still peak early (24/33/33 at 12t,
   * falling to 3/9/19 by 27t), so 12t remains the widest point in both
   * directions and stays.
   *
   * ===========================================================================
   * RE-SWEPT A THIRD TIME AFTER THE 2026-08-27 WORKING-RUNG LEVER. 45 TICKS
   * SURVIVES; THE PARAGRAPH ABOVE'S "SEVEN TICKS OF SLACK" DOES NOT
   * ===========================================================================
   * THE TABLE IMMEDIATELY ABOVE IS THE 2026-08-26 CURVE'S AND EVERY ROW OF IT
   * HAS MOVED, so it is corrected here rather than left reading as current —
   * the same treatment the 55-tick paragraph got, applied before a browser run
   * rather than after one. `BENCH_WORKING_RUNG_DEMAND_ONSET` adds +0.045 to
   * bench's ascent demand above the warm-up floor's margin line, and this
   * probe's cell — RPE 10 at the worst check-in — is as far above that line as
   * a session gets.
   *
   * Same sim, same cell, same schedule, 40 seeds per (pause, cadence),
   * measured@c548b641. Cadences widened to 3/4/5/6/7 ticks, because the
   * browser's achieved mean has read as high as 110 ms (6.6 ticks) on this box
   * and the old sweep's three columns could not see that:
   *
   *     pause   worst banded ticks   rescued made (gap 3/4/5/6/7)
   *      30t     7 / 16 / 17          40 / 40 / 40 /  0 /  0
   *      38t    21 / 27 / 25          40 / 40 / 40 /  0 /  0
   *      42t    25 / 33 / 32          40 / 40 / 40 /  0 /  0
   *      45t    29 / 37 / 39          40 / 40 / 40 /  0 /  0   <- shipped
   *      48t    33 / 37 / 39          40 / 40 / 40 /  0 /  0
   *      49t      —                   40 /  0 /  0 /  0 /  0   <- the cliff
   *      52t    31 / 32 / 31           0 /  0 /  0 /  0 /  0
   *      55t    30 / 32 / 31           0 /  0 /  0 /  0 /  0
   *
   * THAT TABLE IS SWEPT AT INSTANT 12t ONLY, AND READING A CLIFF OFF IT IS
   * WRONG — THE CORRECTION IS THE NEXT SECTION AND IT COST THIS FILE A VALUE.
   * At 12t the first pause that drops a column is 49t. That is a fact about one
   * instant the browser essentially never produces, because the hole opens LATE:
   * `openedAtMs` reads 211-311 ms against an asked 200 across every capture this
   * file has taken, which is 13t to 19t. Swept over THAT band the answer is
   * different and worse, and it is below.
   *
   * WHAT DOES CARRY FROM THIS TABLE is the direction-of-error correction, which
   * the 2026-08-26 paragraph has backwards. It says under-ticking makes the real
   * hole shorter than asked and is therefore the safe error. EVERY RECORDED RUN
   * OVERSHOOTS INSTEAD, and there are ten of them rather than an impression —
   * `paused.realMs` against a 750 ms ask, read off every `press.json` in this
   * file's history that carries one: 762, 765, 766, 767, 771, 772, 772, 773,
   * 787, 794 ms. That is +12 to +44 ms, never negative once.
   *
   * ===========================================================================
   * SWEPT OVER THE INSTANT BAND THE BROWSER REALLY PRODUCES, THE CLIFF IS 46t —
   * WHICH THE SHIPPED 750 ms ASK WAS ALREADY REACHING. `GRIND_PAUSE_MS` IS NOW
   * 700 ms
   * ===========================================================================
   * 40 seeds per (instant, cadence), instants 12t..18t, cadences 3/4/5 ticks,
   * measured@ca83deee. `rescued made` out of 40 per cadence, and the worst stall
   * the hole produces at cadence 3:
   *
   *     pause          12t        13t        14t        15t        16t   band
   *      42t (700ms)  40/40/40  40/40/40  40/40/40  40/40/40  40/40/40  19-25
   *      45t (750ms)  40/40/40  40/40/40  40/40/40  40/40/40  40/40/40  24-29
   *      46t (767ms)  40/40/40  40/40/40  40/40/40  40/40/ 0  40/40/40  24-33
   *      47t (783ms)  40/40/40  40/40/40  40/40/ 0  40/40/ 0  40/40/40  24-33
   *      48t (800ms)  40/40/40  40/40/ 0  40/40/ 0  40/40/ 0  40/40/40  28-33
   *
   * 45t is the last pause clean at every instant and every cadence. 46t is the
   * cliff, and every failure in it is the FIVE-TICK column.
   *
   * THE PROBLEM THAT FIXES: the ask is 750 ms and the REAL hole is 762-794 ms,
   * so nine of the ten recorded runs opened a hole of 45.7t to 47.6t — at or
   * past the 46t cliff. They all made anyway, because this box's achieved
   * cadence is 3-4 ticks and the 3- and 4-tick columns hold to 48t. The pair was
   * passing on the cadence it happened to get, not on the pause it declared.
   *
   * AND THAT MATTERS BECAUSE `GRIND_PAIR_MAX_GAP_MS` DECLARES 5 TICKS LEGAL.
   * 83 ms is 5 ticks; a run at that cadence is one this instrument claims the
   * pair for rather than skipping. At a 750 ms ask, such a run lands in a column
   * the table above shows failing — and it would be reported as the APP failing
   * to rescue a rep. That is the misattribution this whole block exists to
   * prevent, one axis over from where it was caught last time.
   *
   * SO THE CONSTANT MOVES AND THE CEILING DOES NOT. 700 ms is 42t; plus the
   * worst overshoot ever recorded (+44 ms) the real hole is 744 ms — 44.6t,
   * inside the 45t clean zone at every instant and every declared cadence. The
   * rule a future tuner should re-derive from, rather than this number:
   *
   *     ask + worst observed overshoot <= the last pause clean at every
   *     (instant in the observed `openedAtMs` band, cadence <= GRIND_PAIR_MAX_GAP_MS)
   *
   * WHAT IT COSTS is stall depth, and the stall check has room for it: the band
   * goes from 24-29 ticks to 19-25, while the stage's own reading is SATURATED —
   * 10140 of 10140 px in the top strip against a 5070 floor. 19 ticks is 317 ms,
   * which is several recorder frames of a fully-lit band rather than a hair.
   *
   * ONE THING THIS DOES NOT CLOSE, AND IT IS WHY THE CEILING WAS LEFT ALONE. On
   * a genuinely loaded box the overshoot will exceed +44 ms and 700 ms will
   * reach the cliff too. What protects the pair there is that the two failures
   * are CORRELATED in the helpful direction: a box slow enough to overshoot
   * badly is also slow enough to miss the 83 ms cadence ceiling, and a run that
   * misses it is a named skip rather than a claim. That is an argument, not a
   * measurement — nobody has driven this on a loaded box — so it is written as
   * one.
   *
   * THE INSTANT ITSELF STAYS AT 200 ms AND GAINED SLACK. At a 45t pause the
   * abandoned arm is `0` made at every instant from 10t through 40t and first
   * makes at 50t — the edge the 2026-08-26 sweep put at 40t. Nothing about the
   * shorter pause moves that arm, which never resumes.
   *
   * ---------------------------------------------------------------------------
   * THE OBSERVED `openedAtMs` BAND IS WIDER THAN 13t-17t. FIVE RUNS AT THE NEW
   * VALUE READ 211, 218, 223, 295 AND 311 ms
   * ---------------------------------------------------------------------------
   * 311 ms is 18.7t, past the 12t-18t grid the table above was swept on, so the
   * grid was extended rather than the reading rounded down: at a 42t pause the
   * rescued arm reads 40/40/40 at EVERY instant from 17t to 26t (band falling
   * 19 -> 3 as the bar climbs past the stick). A late hole is therefore a
   * shallower stall, not a lost rescue, and 200 ms stays.
   *
   * ---------------------------------------------------------------------------
   * ONE RUN OF FIVE AT THIS VALUE WENT RED IN A WAY NEITHER AXIS EXPLAINS, AND
   * IT IS RECORDED RATHER THAN RE-RUN AWAY
   * ---------------------------------------------------------------------------
   * `press-full-3`: hole opened at 295 ms, ran 711 ms, and the rescued rep
   * dispatched **6 taps in total** — 3 after resuming — then resolved NO LIFT.
   * Both arms lost the rep. Every other run at this value dispatched 29-34 and
   * locked out.
   *
   * BOTH MEASUREMENTS ARE KEPT BESIDE EACH OTHER because a threshold moved to
   * make it stop failing would hide the next real failure at the same site. The
   * pause was NOT lengthened back, and the 60 ms arms-agreement tolerance was
   * NOT widened. What can be said structurally is only that the pause is not the
   * cause: the sim is monotone in it — a shorter hole rescues wherever a longer
   * one does, checked at every (instant 12..26t, cadence 3/4/5) — so no state of
   * this constant makes 42t fail where 45t made. What is left is the class this
   * file already records under the 2026-08-21 lockout work: real browser
   * dispatch timing, which the pure sim does not model at all.
   *
   * THE SEPARATE, MILDER FLAKE, ALSO NOT PAPERED OVER: the pair's comparability
   * precondition (the two holes agreeing within 60 ms) failed once in five, at
   * 311 ms against 247 ms. That run's rescued rep DID lock out and its abandoned
   * rep did not — the pair's subject was fine and its precondition was not,
   * which is the check reporting honestly rather than a finding about the app.
   */
  GRIND_HOLE_AT_MS: 200,
  GRIND_PAUSE_MS: 700,

  /**
   * How many reps this probe will spend trying to walk one kind's full ladder.
   *
   * `sessionDrive.mjs`'s adaptive depth search converges rather than making the
   * first rep — see `DEPTH_HOLD_STEP_MS`. Bounded so a genuinely broken
   * mechanic fails this probe instead of hanging it. `SESSION_TUNING.WORK_SETS`
   * is 5 and a missed rep ends its set, so 4 is inside the budget of a session
   * this probe opens for itself.
   */
  MAX_ATTEMPTS: 4,

  /**
   * WHERE THE DEPTH HOLD STARTS, PER LIFT — and squat's is NOT bench's, which
   * is why this is a table rather than `SESSION_DRIVE.DEPTH_HOLD_MS` reused.
   *
   * Measured at `8ef61c9` from `descentRate` / `DEPTH_LEGAL` / `DEPTH_COLLAPSE`
   * at this probe's own RPE 8 load (ratio 0.863):
   *
   *     squat    legal at  649 ms, ideal  811 ms, buried past 1054 ms
   *     bench    legal at  610 ms, ideal  663 ms, buried past  762 ms
   *
   * So `DEPTH_HOLD_MS`'s 1000 is inside squat's band and 238 ms PAST the point
   * a bench rep is buried — a shared constant would spend three of this
   * probe's four attempts bisecting its way back down on every bench run.
   *
   * `bench: null` IS THE 2026-08-25 RULING, NOT AN OMISSION. Bench's descent
   * stopped being a hold: the bar is fed down and resisted, contact happens
   * wherever it reaches the chest, and what is graded is the RATE it arrives
   * at. There is no release tick to bisect, so there is no starting hold to
   * put here. The 610/663/762 figures above are the OLD beat's and are kept as
   * the record of what this row used to mean. What steers bench now is
   * `sessionDrive.mjs`'s `BENCH_BEAT`, whose duty cycle is searched out of the
   * mechanic's own constants rather than measured once and typed.
   *
   * BIASED ABOVE THE IDEAL, NOT AT THE MIDDLE, for the reason `DEPTH_HOLD_MS`'s
   * own header gives: `useLiftLoop` takes at most `FEEDBACK.MAX_CATCH_UP_TICKS`
   * ticks per animation frame, so on a loaded software-rendered browser a
   * wall-clock millisecond buys LESS depth than this arithmetic says and the
   * legal band slides UP in wall-clock terms. Starting points, not fixed
   * values — `adaptDepthSearch` moves them on the miss reason.
   *
   * `deadlift: null` is the lift, not an omission: there is no eccentric to
   * hold through, so there is no hold to start anywhere.
   */
  START_HOLD_MS: Object.freeze({ squat: 1000, bench: null, deadlift: null }),

  /**
   * How long to wait for a deadlift's brace to end after the pull press.
   *
   * NOT A TAP AT A GUESSED INSTANT. `stepLift`'s BRACE branch only leaves for
   * ASCENT once `phaseTick >= braceTicks(load, kind)` — 32 ticks (~533 ms) at
   * this probe's load — and a press EDGE dispatched before that is consumed
   * with nothing to show for it, leaving the rep sitting until
   * `BRACE_TIMEOUT_TICKS` fires ten seconds later. What the branch actually
   * accepts is a finger ALREADY DOWN when the brace ends (`pressed || m.held`).
   * So the robot presses, waits for the prompt to LEAVE "TAP TO PULL", and only
   * then releases — which is also what a lifter does, and is why
   * `LIFT_COPY.PROMPT.BRACE.deadlift` reads "TAP TO PULL" rather than a hold
   * instruction: the finger's real job starts a beat later, on the drive cues.
   *
   * `braceTicks` at MAXIMAL is 42 ticks (700 ms); this deadline is comfortably
   * past it and means "the app has stopped responding", not "the app was slow".
   */
  PULL_TIMEOUT_MS: 6000,
  /** A beat after the bar leaves the floor before the finger comes off it. */
  PULL_RELEASE_MS: 80,

  /**
   * HOW LONG TO WAIT AT THE CHEST FOR THE PRESS COMMAND.
   *
   * Past `PRESS_COMMAND_DELAY_TICKS`' whole declared range plus the beat that
   * follows it, so a timeout here means the command never came rather than that
   * this probe was impatient.
   *
   * WHAT USED TO SIT BESIDE THIS WAS `PRESS_TAP_MS`, A SINGLE REACTION TAP, and
   * it is gone rather than retuned. The 2026-08-25 ruling replaced one press
   * with a windowed burst, and the phone replay that followed replaced the
   * burst with a grind that runs to the end of the rep — so how long ONE tap is
   * held decides nothing and there is no window to fill.
   * `sessionDrive.mjs`'s `grindTapToResolution` owns that loop and derives its
   * cadence from `GRIND_TAP_REFRACTORY_TICKS` and `GRIND_CHARGE` rather than
   * from a number here.
   */
  COMMAND_TIMEOUT_MS: 6000,

  /**
   * How long to wait at a deadlift lockout for the down command.
   *
   * `DOWN_COMMAND_DELAY_TICKS.MAX` is 96 ticks (1600 ms); this is generously
   * past it, so a timeout here means the command never came rather than that
   * this probe was impatient. The BAND the measured hold is checked against is
   * read from source (`DEADLIFT_LOCKOUT`), never from this number.
   */
  DOWN_TIMEOUT_MS: 8000,

  /**
   * HOW MUCH LATER THAN THE APP THIS INSTRUMENT CAN NOTICE A FRAME.
   *
   * The hold is measured from the page-side recorder's own timestamps, not from
   * `Date.now()` either side of a CDP round trip, so the only error left is the
   * recorder's own sampling grain: one animation frame (~17 ms at 60 Hz) or one
   * `SAMPLE_MS` interval tick, at each of the two ends. 100 ms is past that
   * pair doubled.
   *
   * NOT A TOLERANCE CHOSEN TO MAKE A CHECK STOP FAILING, which CLAUDE.md
   * refuses by name — it is the instrument's resolution, it was written before
   * the check was first run, and the band it widens is 1000 ms across.
   */
  FRAME_ALLOWANCE_MS: 100,

  /** How often the page-side recorder samples, on top of every animation frame. */
  SAMPLE_MS: 10,
  /** A cap on the recorder's rows, so a long run cannot grow without bound. */
  MAX_ROWS: 4000,
  /**
   * The elements the recorder watches.
   *
   * `session-set-label` USED TO BE HERE AND IS GONE, deliberately. It was
   * sampled on every row of all nine ladders and serialised into `press.json`,
   * and it reached no predicate anywhere — the third instance of CLAUDE.md's
   * "measured, carried, displayed, never compared" in this section. That rule
   * offers two ways out, "either compare it or stop printing it", and there is
   * no comparison this instrument can honestly make of it: the only candidate
   * is that the set index ADVANCES, which happens when a rep misses and not
   * when one is made, so it is not deterministic on a run whose reps are
   * supposed to be made. A number with no consequence is worse than an absent
   * one, because absence prompts a question and a printed number answers one.
   *
   * `session-weight` STAYS, and it stays because it earned a predicate rather
   * than because it is interesting: the three lifts are prescribed from three
   * different `STARTING_E1RM` seeds, so the weight on the bar is what says the
   * chip retargeted the PLAN and not merely the copy. See the cross-lift check
   * at the end of the LADDER section.
   */
  WATCHED_IDS: Object.freeze(['session-prompt', 'session-detail', 'session-weight']),

  /** Let a rep's result beat clear before the next rep is asked for. */
  BETWEEN_REPS_MS: 400,
  /** How long to wait for the next rep's brace after one resolves. */
  NEXT_BRACE_MS: 12000,
  /** How long a resolved rep's outcome has to appear. */
  RESOLVE_TIMEOUT_MS: 12000,
  /**
   * How long a rep NOBODY TOUCHES gets to resolve itself.
   *
   * `BRACE_TIMEOUT_TICKS` is 600 ticks — ten seconds — after which `stepLift`
   * starts the rep without a press; then the ascent, then at most
   * `DOWN_COMMAND_DELAY_TICKS.MAX` plus `DOWN_COMMAND_SETTLE_TICKS` of lockout.
   * Roughly fourteen seconds all told, so this is generous rather than tight:
   * a timeout here means the rep never resolved at all.
   */
  NEVER_PRESS_TIMEOUT_MS: 40000,
  /** Settle before a photograph, so the shutter is not inside a transition. */
  SHOT_SETTLE_MS: 60,
  /**
   * WHERE THE PROMPT IS DRAWN IN THE FRAME, as fractions of the screenshot's
   * own height, so it survives a device-scale change.
   *
   * `SetView`'s header stacks the set label, the weight, the rep pips and then
   * the prompt above the stage. This band is wide enough to hold the prompt on
   * a 390x844 viewport and is the region the two lockout frames are required to
   * DISAGREE inside — a band that missed the text would make that check
   * vacuous, so it is deliberately generous rather than tight.
   */
  PROMPT_BAND: Object.freeze({ TOP_FRACTION: 0.05, HEIGHT_FRACTION: 0.14 }),
});

/**
 * THE TICK-DENOMINATED HALF OF THE DEADLIFT'S LOCKOUT, READ OUT OF SOURCE.
 *
 * `readTuning.mjs`'s rule, applied: a NAME a check identifies the app by stays
 * transcribed in the tool (that is what `LIFT_PROMPTS` is), and a NUMBER a
 * check COMPARES AGAINST is read from source. `tools/capture-cutin.mjs` held a
 * hold duration by hand and went on asking "did the tap beat the hold?" against
 * a number the app had stopped using; the band below is exactly that shape of
 * comparison and gets exactly that treatment.
 *
 * A `null` from any reader is a FINDING here rather than a default — a null
 * read as "not configured" is a check that has quietly stopped asking anything.
 */
function readDeadliftLockoutTuning() {
  const liftTuning = readFileSync(path.join(SRC_ROOT, 'src/game/liftTuning.ts'), 'utf8');
  const spriteTuning = readFileSync(path.join(SRC_ROOT, 'src/art/spriteTuning.ts'), 'utf8');
  const read = {
    downDelayMinTicks: numberInBlock(liftTuning, 'DOWN_COMMAND_DELAY_TICKS', 'MIN'),
    downDelayMaxTicks: numberInBlock(liftTuning, 'DOWN_COMMAND_DELAY_TICKS', 'MAX'),
    gripGraceTicks: numberInSource(liftTuning, 'LOCKOUT_GRIP_GRACE_TICKS'),
    slipGrindTicks: numberInSource(liftTuning, 'LOCKOUT_SLIP_GRIND_TICKS'),
    settleTicks: numberInSource(liftTuning, 'DOWN_COMMAND_SETTLE_TICKS'),
    tickHz: numberInDeclaration(spriteTuning, 'TICK_HZ'),
  };
  const missing = Object.entries(read)
    .filter(([, value]) => typeof value !== 'number' || !Number.isFinite(value))
    .map(([key]) => key);
  const tickMs = typeof read.tickHz === 'number' && read.tickHz > 0 ? 1000 / read.tickHz : null;
  return {
    ...read,
    tickMs,
    missing,
    parserComplaints: parserSelfTest(),
    /** The declared band, in wall-clock ms, widened by the instrument's own grain. */
    holdFloorMs:
      tickMs === null || missing.length > 0
        ? null
        : read.downDelayMinTicks * tickMs - LIFT_LADDER.FRAME_ALLOWANCE_MS,
    holdCeilingMs:
      tickMs === null || missing.length > 0
        ? null
        : read.downDelayMaxTicks * tickMs + LIFT_LADDER.FRAME_ALLOWANCE_MS,
  };
}
const DEADLIFT_LOCKOUT = readDeadliftLockoutTuning();

/**
 * ===========================================================================
 * THE STAGE PIXEL SAMPLER — THE CHECK THAT WOULD HAVE CAUGHT "PIXEL-STATIC
 * ACROSS THE COMMAND"
 * ===========================================================================
 * Phone playtest 4 measured the press command drawing NOTHING: the renderer's
 * own `frameKey` was byte-identical at command minus 2, minus 1, the command
 * tick, plus 1, plus 3 and plus 6. Every check in this file was green through
 * that, and none of them could have been anything else — they read testIDs, and
 * the whole beat is inside a Skia `<canvas>` that has none. This section's own
 * header already says so about the cue ring, as a NAMED SKIPPED check.
 *
 * So the sampler reads the canvas. In the page, on the same animation frames
 * `useLiftLoop` paints on, through `gl.readPixels` — the app renders through
 * WebGL here and a Node-side screenshot costs a CDP round trip per look, which
 * is far too coarse for a 260 ms wash and is exactly the sampling-rate blindness
 * the frame recorder above was written to avoid.
 *
 * TWO NUMBERS PER FRAME, AND EACH ONE ANSWERS A DIFFERENT QUESTION:
 *
 *   `d`    how many sampled pixels differ from the previous frame. This is the
 *          "did anything draw" measurement, and the command's answer has to be
 *          bigger than every frame of the wait it follows.
 *   `lit`  how many pixels INSIDE THE GRIND TRAY match the lit-pip colour. The
 *          tray is a dark plate the readout draws itself on, and the pips are
 *          on top of the command wash rather than under it, so this is a count
 *          of the readout and not of whatever the room happens to be doing.
 *   `e`    how many pixels in the stage's TOP STRIP differ from a baseline
 *          taken before the stall band could exist. That strip is the one edge
 *          of the stage nothing else animates, and the band pulses too slowly
 *          for an inter-frame delta to see it — both reasons are argued where
 *          the loop computes it.
 *
 * WHAT IT CANNOT SAY, stated rather than left to be assumed: it cannot say the
 * beat LOOKS right, or that a player would notice it (GDD §12.1 — that is a
 * human on a phone). It says pixels moved, how many, and where.
 */
const STAGE_BEAT = Object.freeze({
  /**
   * How different one channel has to be before two frames count as different.
   *
   * `verify-shell-route.mjs`'s number and its reason: a software-rasterised
   * canvas is not bit-reproducible, and this must stay far below what an
   * authored change makes. A full-stage wash moves every dark pixel by tens of
   * levels; this is 12.
   */
  SAME_PICTURE_TOLERANCE: 12,
  /**
   * Sample every Nth pixel in each axis for the whole-stage delta.
   *
   * The wash is a full-stage effect, so a quarter of the pixels answers the
   * same question a quarter as expensively — and the sampler runs on the app's
   * own main thread, where the cost comes out of the rep it is measuring.
   * The tray count below is taken at FULL resolution, because it is small and
   * because a stride could straddle a pip.
   */
  DELTA_STRIDE: 2,
  /** How close a pixel has to be to the lit-pip colour to be counted as one. */
  PIP_COLOUR_TOLERANCE: 30,
  /**
   * The counts the two windows must contain before either is evidence.
   *
   * A wait with no frames in it and a command with no frames in it both report
   * a delta of zero, which is the empty-domain shape this file refuses
   * everywhere else. Floors rather than pins because the wait's length is
   * SEEDED (`PRESS_COMMAND_DELAY_TICKS` spans 24-96 ticks) — a pin would be a
   * claim about which draw this rep got.
   */
  MIN_WAIT_FRAMES: 8,
  MIN_COMMAND_FRAMES: 3,
  /**
   * How much of the sampled stage the command hit must move.
   *
   * A STRUCTURAL FLOOR, NOT A TOLERANCE PICKED TO MAKE A CHECK PASS, and the
   * difference is what it would redden on. The ruling asks for a stimulus a
   * player cannot miss, and what the build answers with is a wash over the WHOLE
   * stage: at any peak alpha that moves a dark backdrop pixel past
   * `SAME_PICTURE_TOLERANCE` at all, essentially every sampled pixel moves. So
   * a run that came in under half the stage would mean the hit had become a
   * local effect somewhere — a corner glow, a ring on its own — which is the
   * thing playtest 4's "I did not see it" says is not enough. It is deliberately
   * far below what the shipped wash measures; the measured figure is printed
   * beside it on every run.
   */
  MIN_COMMAND_DELTA_FRACTION: 0.5,
  /**
   * How long the driven hole has to be open before its frames count as "the
   * player has stopped".
   *
   * DERIVED FROM THE MECHANIC, NOT CHOSEN: `GRIND_CHARGE_DECAY_PER_TICK` is
   * 0.9057, a half-life of about seven ticks (117 ms), so at 200 ms the charge
   * behind the row is down to roughly a third of what it was and the row has
   * visibly moved. Below one half-life the reading would be of a row still on
   * its way down rather than of a player who has stopped, and the check would
   * be about the sampler's timing instead of about the mechanic. The hole
   * itself is `LIFT_LADDER.GRIND_PAUSE_MS`, several times this.
   */
  GRIND_SETTLE_MS: 200,
  /**
   * How much of the TOP STRIP the stall band must move, as a fraction of the
   * pixels sampled in it.
   *
   * A STRUCTURAL FLOOR, NOT A TOLERANCE PICKED TO MAKE A CHECK PASS, and the
   * same argument `MIN_COMMAND_DELTA_FRACTION` makes one beat earlier. The band
   * is drawn as a stroke `STALL_BAND_PX` deep along every edge of the stage, so
   * it covers the WHOLE strip this reads: at any alpha that moves a pixel past
   * `SAME_PICTURE_TOLERANCE` at all, essentially every sampled pixel in the
   * strip moves. A run that came in under half the strip would mean the cue had
   * become something local — a corner, a line — which is what playtest 4's "I
   * did not see it" says is not enough for a stimulus a player is meant to
   * answer. Deliberately far below what the shipped band measures; the measured
   * figure is printed beside it on every run.
   */
  MIN_STALL_EDGE_FRACTION: 0.5,
  /**
   * How far apart the rescued rep's hole and the abandoned rep's may open and
   * still be "the same instant".
   *
   * THE INSTRUMENT'S OWN RESOLUTION, not a tolerance chosen to make anything
   * pass — and the difference was tested rather than asserted. ITS FIRST
   * VERSION WAS A GRAIN AND THIS CHECK WENT RED ON IT: the loop noticed the
   * instant once per tap, so a 56 ms cadence opened its hole at 471 ms and a
   * 45 ms one opened at 406 ms, 65 ms apart. Widening this to 80 would have
   * made it green and is the move CLAUDE.md refuses by name.
   * `grindTapToResolution` splits the inter-tap gap AT the instant now, so the
   * grain is one loop's overhead rather than one tap period.
   *
   * 60 ms is therefore generous against the mechanism as it stands, and it is a
   * third of the 100 ms window the sim sweep says the pair's discrimination
   * survives inside (24 ticks ± 6). It stays at 60 rather than being
   * tightened to whatever the fixed loop achieves, because what it is FOR is
   * catching a pair that has stopped being a pair — not measuring the loop.
   */
  PAIRED_HOLE_TOLERANCE_MS: 60,
  /** A cap on the sampler's rows, so a long run cannot grow without bound. */
  MAX_ROWS: 3000,
});

/**
 * THE STAGE BEAT'S OWN GEOMETRY AND COLOUR, READ OUT OF SOURCE.
 *
 * Same rule as `readDeadliftLockoutTuning` above and the same reason: the tray
 * rectangle and the lit-pip colour are numbers this check STEERS BY. Typed here
 * a second time they would go stale the first time a playtester moved the row,
 * and the check would then count lit pixels in a rectangle the readout no longer
 * occupies — reporting zero, honestly, about the wrong part of the screen.
 *
 * The pip row's geometry is derived here the way `grindReadout` derives it, from
 * the same five constants, rather than read as a finished rectangle: there is no
 * rectangle in the source to read.
 */
function readStageBeatTuning() {
  const liftTuning = readFileSync(path.join(SRC_ROOT, 'src/game/liftTuning.ts'), 'utf8');
  const palette = readFileSync(path.join(SRC_ROOT, 'src/lift/liftPalette.ts'), 'utf8');
  const stage = blockInSource(liftTuning, 'STAGE_COMMAND') ?? '';
  const layout = blockInSource(liftTuning, 'LAYOUT') ?? '';
  const read = {
    stageW: numberInSource(layout, 'STAGE_W'),
    stageH: numberInSource(layout, 'STAGE_H'),
    cueX: numberInSource(layout, 'CUE_X'),
    /**
     * THE ROW'S LENGTH IS `GRIND_READOUT_UNITS` NOW, AND IT USED TO BE
     * `BENCH_BEAT.maxCountedTaps`. Under the burst the row was one pip per
     * counted tap out of a per-rep cap, so the mechanic's cap WAS the row
     * length; the 2026-08-25 replay steer deleted the cap and the row became a
     * level of its own declared length. Reading the old constant would now be
     * reading a number the mechanic no longer has.
     */
    units: numberInSource(stage, 'GRIND_READOUT_UNITS'),
    pipW: numberInSource(stage, 'GRIND_PIP_W'),
    pipH: numberInSource(stage, 'GRIND_PIP_H'),
    pipGap: numberInSource(stage, 'GRIND_PIP_GAP'),
    pipsY: numberInSource(stage, 'GRIND_PIPS_Y'),
    trayPad: numberInSource(stage, 'GRIND_TRAY_PAD'),
    pressFlashMs: numberInBlock(stage, 'FLASH_MS', 'press'),
    downFlashMs: numberInBlock(stage, 'FLASH_MS', 'down'),
    /**
     * The stall band's depth at the stage edges, which is the region the stall
     * check reads. Same rule as the tray: a rectangle typed here a second time
     * would go stale the first time a playtester moved it, and the check would
     * then measure a strip the band no longer occupies — reporting zero,
     * honestly, about the wrong part of the screen.
     */
    stallBandPx: numberInSource(stage, 'STALL_BAND_PX'),
  };
  const missing = Object.entries(read)
    .filter(([, value]) => typeof value !== 'number' || !Number.isFinite(value))
    .map(([key]) => key);
  const litColour = stringInSource(palette, 'GRIND_PIP_LIT');
  if (litColour === null) missing.push('GRIND_PIP_LIT');
  if (missing.length > 0) {
    return { ...read, litColour, missing, tray: null, pipArea: null };
  }
  const pitch = read.pipW + read.pipGap;
  const rowW = read.units * pitch - read.pipGap;
  const left = read.cueX - rowW / 2;
  return {
    ...read,
    litColour,
    missing,
    /** In STAGE POINTS, top-left origin — the units `liftFrame.ts` works in. */
    tray: {
      x: left - read.trayPad,
      y: read.pipsY - read.trayPad,
      w: rowW + read.trayPad * 2,
      h: read.pipH + read.trayPad * 2,
    },
    /** One pip's area in stage points, so a lit-pixel count reads back as pips. */
    pipArea: read.pipW * read.pipH,
    pips: read.units,
  };
}
const STAGE_BEAT_TUNING = readStageBeatTuning();

/**
 * A PAGE-SIDE FRAME RECORDER, INSTALLED BEFORE THE APP'S OWN CODE RUNS.
 *
 * ===========================================================================
 * WHY IN THE PAGE AND NOT IN THE DRIVER'S POLL LOOP
 * ===========================================================================
 * The two frames this whole section turns on are SHORT. "DOWN" is on screen for
 * `DOWN_COMMAND_SETTLE_TICKS` — 20 ticks, ~333 ms — and 'DRIVE — TAP' for one
 * cue window. A Node-side poll costs a CDP round trip per look, measured
 * elsewhere in this file at 1-25 ms and considerably worse under load, and "the
 * poll happened not to be looking" is indistinguishable in the output from "the
 * frame never rendered". That is the empty-domain shape CLAUDE.md names,
 * arriving through a sampling rate.
 *
 * In-page it samples on EVERY ANIMATION FRAME — the same clock `useLiftLoop`
 * paints on, so a prompt that was painted at all is a prompt this saw — with a
 * `setInterval` beside it as a second sampler in case rAF is throttled. Both
 * counters are reported and both are asserted non-zero, because a recorder that
 * stopped ticking returns the same empty ladder as a rep that never happened.
 *
 * It also counts POINTERDOWN / POINTERUP on the document, timestamped on the
 * same clock. That is what makes "the correct play at a deadlift lockout is NO
 * INPUT" checkable from outside the robot: the PAGE says how many pointer
 * events it received between the frame that first said "DON'T LET GO" and the
 * frame that first said "DOWN", rather than the driver asserting it sent none —
 * which would be a check on its own control flow, self-referential in exactly
 * the way this file's own vacuity rules refuse.
 */
function installLadderRecorder(context) {
  return context.addInitScript(
    ({ ids, intervalMs, maxRows, stage }) => {
      const rows = [];
      const pointers = [];
      const counts = { raf: 0, interval: 0, dropped: 0 };
      const NOTHING_YET = 'nothing sampled yet';
      let last = NOTHING_YET;
      const sample = (via) => {
        counts[via] += 1;
        const row = { t: Math.round(performance.now()), via };
        for (const id of ids) {
          const node = document.querySelector('[data-testid="' + id + '"]');
          row[id] = node === null ? null : node.textContent;
        }
        const key = ids.map((id) => String(row[id])).join(' | ');
        if (key === last) return;
        last = key;
        if (rows.length >= maxRows) {
          counts.dropped += 1;
          return;
        }
        rows.push(row);
      };
      const onFrame = () => {
        sample('raf');
        requestAnimationFrame(onFrame);
      };
      requestAnimationFrame(onFrame);
      setInterval(() => sample('interval'), intervalMs);
      for (const kind of ['pointerdown', 'pointerup']) {
        document.addEventListener(
          kind,
          (event) => {
            const node = event.target;
            const owner =
              node !== null && typeof node.closest === 'function' ? node.closest('[data-testid]') : null;
            pointers.push({
              t: Math.round(performance.now()),
              kind,
              on: owner === null ? null : owner.getAttribute('data-testid'),
            });
          },
          true,
        );
      }
      // ---------------------------------------------------------------
      // THE STAGE PIXEL SAMPLER. Same rAF clock, its own rows, and OFF
      // until a probe arms it: the read is a full-canvas `readPixels` and
      // a loop over it, on the app's own main thread, so leaving it
      // running through the three press arms would be spending the rep's
      // frame budget on measuring reps nobody is measuring.
      // ---------------------------------------------------------------
      // ===============================================================
      // ONE INTERVENTION ON THE APP, DISCLOSED RATHER THAN BURIED:
      // `preserveDrawingBuffer`.
      // ===============================================================
      // A WebGL drawing buffer is CLEARED after it is composited unless the
      // context was created with `preserveDrawingBuffer: true`, so a
      // `readPixels` taken from anywhere other than inside the app's own draw
      // call returns transparent black. Measured, not assumed: without this
      // patch the sampler read 186 frames of a live bench rep and reported
      // ZERO changed pixels on every one of them — the shipped stage beat
      // looked exactly as dead as the beat playtest 4 measured, for a reason
      // that had nothing to do with the app.
      //
      // WHAT IT CHANGES AND WHAT IT DOES NOT. It changes one context
      // attribute: whether the back buffer survives compositing. It does not
      // change a draw call, a colour, a size or an order, so the pixels this
      // reads are the pixels that were shown. What it can change is
      // PERFORMANCE — a retained buffer is a real cost — which is why the
      // sampler is armed per rep rather than left running, and why the frame
      // recorder's own `raf` count sits beside every claim taken from it.
      //
      // THE HONEST LIMIT: this makes the instrument's subject one context
      // attribute away from the shipped one. There is no way to read a WebGL
      // canvas from outside its own draw call without it, and a Node-side
      // screenshot is a CDP round trip per look — far too coarse for a 260 ms
      // wash and exactly the sampling blindness the frame recorder above
      // exists to avoid. Recorded here so nobody has to rediscover the trade.
      const realGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, attributes) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
          return realGetContext.call(this, type, {
            ...(attributes ?? {}),
            preserveDrawingBuffer: true,
          });
        }
        return realGetContext.call(this, type, attributes);
      };

      const pix = {
        armed: false,
        preserveDrawingBufferForced: true,
        rows: [],
        marks: [],
        counts: { frames: 0, dropped: 0 },
        err: null,
        mode: null,
        sampled: 0,
        edgeSampled: 0,
        canvas: null,
        scale: null,
      };
      const lit = (() => {
        const hex = stage.litColour.replace('#', '');
        return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      })();
      let gl = null;
      let buf = null;
      let previous = null;
      let edgeBase = null;
      const pixFrame = () => {
        requestAnimationFrame(pixFrame);
        if (!pix.armed) return;
        const node = document.querySelector('[data-testid="' + stage.stageTestId + '"] canvas');
        if (node === null) return;
        try {
          if (gl === null || pix.canvas !== node) {
            gl = node.getContext('webgl2') ?? node.getContext('webgl');
            pix.canvas = node;
            pix.mode = gl === null ? 'no-webgl-context' : 'webgl';
            pix.preserveDrawingBuffer =
              gl === null ? null : gl.getContextAttributes().preserveDrawingBuffer === true;
            buf = gl === null ? null : new Uint8Array(node.width * node.height * 4);
            previous = null;
            edgeBase = null;
            pix.scale = node.width / stage.stageW;
          }
          if (gl === null || buf === null) return;
          const w = node.width;
          const h = node.height;
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          // WHOLE-STAGE DELTA, strided.
          const step = stage.stride;
          let changed = 0;
          let sampled = 0;
          for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
              const i = (y * w + x) * 4;
              sampled += 1;
              if (previous === null) continue;
              if (
                Math.abs(buf[i] - previous[i]) > stage.tolerance ||
                Math.abs(buf[i + 1] - previous[i + 1]) > stage.tolerance ||
                Math.abs(buf[i + 2] - previous[i + 2]) > stage.tolerance
              ) {
                changed += 1;
              }
            }
          }
          pix.sampled = sampled;
          // LIT PIPS, inside the tray only, at full resolution. `readPixels`
          // is bottom-up, so the tray's rows are counted from the far end.
          const sc = pix.scale;
          const x0 = Math.max(0, Math.round(stage.tray.x * sc));
          const x1 = Math.min(w, Math.round((stage.tray.x + stage.tray.w) * sc));
          const yTop = Math.round(stage.tray.y * sc);
          const yBot = Math.round((stage.tray.y + stage.tray.h) * sc);
          const g0 = Math.max(0, h - yBot);
          const g1 = Math.min(h, h - yTop);
          let litPx = 0;
          for (let y = g0; y < g1; y += 1) {
            for (let x = x0; x < x1; x += 1) {
              const i = (y * w + x) * 4;
              if (
                Math.abs(buf[i] - stage.lit[0]) <= stage.pipTolerance &&
                Math.abs(buf[i + 1] - stage.lit[1]) <= stage.pipTolerance &&
                Math.abs(buf[i + 2] - stage.lit[2]) <= stage.pipTolerance
              ) {
                litPx += 1;
              }
            }
          }
          // ---------------------------------------------------------------
          // THE STALL BAND, READ OUT OF THE STAGE'S TOP STRIP AGAINST A FIXED
          // BASELINE RATHER THAN AGAINST THE PREVIOUS FRAME.
          // ---------------------------------------------------------------
          // WHY A BASELINE AND NOT A DELTA, DERIVED FROM THE CONSTANTS RATHER
          // THAN PREFERRED: the band PULSES on `STALL_PULSE_MS` (300 ms), so at
          // 60 fps the steepest frame-to-frame change in its alpha is a few
          // hundredths — a few levels on a channel — which is well under
          // `SAME_PICTURE_TOLERANCE`'s 12 and would read as ZERO on an
          // inter-frame delta. Against a frame from before the band existed the
          // difference is the band's whole alpha, which is tens of levels.
          //
          // WHY THE TOP STRIP AND NOT THE WHOLE BAND: it is the one edge of the
          // stage nothing else animates. The sprite sits at `SPRITE_Y` 292 and
          // the shake moves only it; the bar-path plot's own glyph cannot rise
          // above y~39 (`traceY(1)`), and the panel behind it is a static fill.
          // The left and bottom edges of the band cross the sprite cell, so a
          // reading taken there would be measuring the lifter.
          //
          // The baseline is the FIRST frame after arming, which is a braced rep
          // on a drawn room. If it were ever garbage — a canvas read before it
          // painted — every frame would differ from it, INCLUDING the wait
          // frames the grader uses as its control, so that control is what says
          // this reading is real rather than a comment claiming it is.
          let edgePx = 0;
          let edgeSampled = 0;
          const bandPx = Math.round(stage.stallBandPx * sc);
          const bandFrom = Math.max(0, h - bandPx);
          for (let y = bandFrom; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
              const i = (y * w + x) * 4;
              edgeSampled += 1;
              if (edgeBase === null) continue;
              if (
                Math.abs(buf[i] - edgeBase[i]) > stage.tolerance ||
                Math.abs(buf[i + 1] - edgeBase[i + 1]) > stage.tolerance ||
                Math.abs(buf[i + 2] - edgeBase[i + 2]) > stage.tolerance
              ) {
                edgePx += 1;
              }
            }
          }
          pix.edgeSampled = edgeSampled;
          const promptNode = document.querySelector('[data-testid="session-prompt"]');
          const row = {
            t: Math.round(performance.now()),
            d: previous === null ? null : changed,
            lit: litPx,
            e: edgeBase === null ? null : edgePx,
            prompt: promptNode === null ? null : promptNode.textContent,
          };
          if (edgeBase === null) edgeBase = buf.slice();
          previous = buf.slice();
          pix.counts.frames += 1;
          if (pix.rows.length >= stage.maxRows) pix.counts.dropped += 1;
          else pix.rows.push(row);
        } catch (error) {
          pix.err = String(error).slice(0, 200);
        }
      };
      // `lit` is resolved once, above, and handed to the loop through the same
      // object every other number arrives in, so the loop reads one source.
      stage.lit = lit;
      requestAnimationFrame(pixFrame);
      window.__stagePix = pix;
      window.__stagePixArm = (on) => {
        pix.armed = on === true;
        pix.rows.length = 0;
        pix.marks.length = 0;
        pix.counts.frames = 0;
        pix.counts.dropped = 0;
        previous = null;
        edgeBase = null;
      };
      /**
       * PUT A LABELLED INSTANT INTO THE SAMPLER'S OWN CLOCK.
       *
       * The driver's `Date.now()` and the recorder's `performance.now()` are
       * different clocks, and a window sliced with one and read with the other
       * is a window in the wrong place. The driver marks the pause it drives
       * from inside the page, so both ends of every comparison sit on the same
       * clock as the frames.
       */
      window.__stagePixMark = (label) => {
        pix.marks.push({ t: Math.round(performance.now()), label });
      };

      window.__liftLadder = { rows, pointers, counts };
      // RESETTING CLEARS `last` TOO. Without that the next sample would only
      // push on a CHANGE, so whatever prompt is ALREADY on screen at the reset
      // would never be recorded and every ladder would start one rung late.
      window.__liftLadderReset = () => {
        rows.length = 0;
        pointers.length = 0;
        counts.raf = 0;
        counts.interval = 0;
        counts.dropped = 0;
        last = NOTHING_YET;
      };
    },
    {
      ids: [...LIFT_LADDER.WATCHED_IDS],
      intervalMs: LIFT_LADDER.SAMPLE_MS,
      maxRows: LIFT_LADDER.MAX_ROWS,
      // EVERY NUMBER THE PIXEL SAMPLER USES, READ OUT OF `src/` ON THE NODE
      // SIDE AND CARRIED IN. The page cannot read the repository, and a second
      // hand-typed copy of the tray rectangle would go stale the first time a
      // playtester moved the row — see `readStageBeatTuning`.
      stage: {
        stageTestId: 'session-touch',
        stageW: STAGE_BEAT_TUNING.stageW,
        tray: STAGE_BEAT_TUNING.tray,
        litColour: STAGE_BEAT_TUNING.litColour,
        stallBandPx: STAGE_BEAT_TUNING.stallBandPx,
        tolerance: STAGE_BEAT.SAME_PICTURE_TOLERANCE,
        pipTolerance: STAGE_BEAT.PIP_COLOUR_TOLERANCE,
        stride: STAGE_BEAT.DELTA_STRIDE,
        maxRows: STAGE_BEAT.MAX_ROWS,
      },
    },
  );
}

/** Arm or disarm the stage pixel sampler, clearing whatever it had. */
const armStagePixels = (page, on) =>
  page.evaluate((flag) => {
    if (window.__stagePixArm !== undefined) window.__stagePixArm(flag);
  }, on);

/** Put a labelled instant into the sampler's own clock. See `__stagePixMark`. */
const markStagePixels = (page, label) =>
  page.evaluate((text) => {
    if (window.__stagePixMark !== undefined) window.__stagePixMark(text);
  }, label);

/** Everything the pixel sampler has seen since it was armed. */
const readStagePixels = (page) =>
  page.evaluate(() => {
    const live = window.__stagePix;
    if (live === undefined) return null;
    return {
      rows: live.rows.slice(),
      marks: live.marks.slice(),
      counts: { ...live.counts },
      err: live.err,
      mode: live.mode,
      sampled: live.sampled,
      edgeSampled: live.edgeSampled,
      scale: live.scale,
      preserveDrawingBufferForced: live.preserveDrawingBufferForced === true,
      /**
       * WHAT THE CONTEXT ACTUALLY CAME BACK WITH, read off the context rather
       * than assumed from the patch. A patch that stopped being applied — a
       * context created before the init script, a browser that ignores the
       * attribute — would leave every delta at zero and every claim below
       * green-by-emptiness, which is why this is reported and checked rather
       * than described in the comment above.
       */
      preserveDrawingBuffer: live.preserveDrawingBuffer,
    };
  });

/** Everything the recorder has seen since the last reset. */
const readLadder = (page) =>
  page.evaluate(() => {
    const live = window.__liftLadder;
    if (live === undefined) return null;
    return { rows: live.rows.slice(), pointers: live.pointers.slice(), counts: { ...live.counts } };
  });

const resetLadder = (page) =>
  page.evaluate(() => {
    if (window.__liftLadderReset !== undefined) window.__liftLadderReset();
  });

/** The ordered distinct prompt strings the recorder saw, nulls dropped. */
function promptRungs(ladder) {
  const out = [];
  for (const row of ladder?.rows ?? []) {
    const text = row['session-prompt'];
    if (text === null || text === undefined) continue;
    if (out.length > 0 && out[out.length - 1].text === text) continue;
    out.push({ text, t: row.t });
  }
  return out;
}

/** The first instant a given prompt was on screen, or null if it never was. */
function firstAt(ladder, text) {
  for (const row of ladder?.rows ?? []) {
    if (row['session-prompt'] === text) return row.t;
  }
  return null;
}

/**
 * Every value `session-weight` took while the recorder was running, distinct.
 *
 * THIS IS THE FIELD THAT SAYS THE CHIP RETARGETED THE PLAN AND NOT ONLY THE
 * COPY. `SetView` renders `${totalKgFor(plan.loadRatio, plan.e1rmKg)} kg`, and
 * `plan.e1rmKg` comes from the chosen lift's own `STARTING_E1RM` seed — three
 * different numbers for the three lifts. The prompt ladder and the subtitle are
 * both read out of `LIFT_COPY`; this one is read out of the arithmetic, so it
 * is the one a copy-only change could not fake.
 */
function weightsIn(ladder) {
  return [
    ...new Set(
      (ladder?.rows ?? [])
        .map((row) => row['session-weight'])
        .filter((text) => text !== null && text !== undefined && text !== ''),
    ),
  ];
}

/** Every subtitle the recorder saw, distinct. `SetView` fills it per kind. */
function subtitlesSeen(ladder) {
  return [...new Set((ladder?.rows ?? []).map((row) => row['session-detail']).filter((t) => t !== null && t !== undefined))];
}

/**
 * PLAY ONE REP OF ONE LIFT, WITH THAT LIFT'S OWN INPUT GRAMMAR.
 *
 * ===========================================================================
 * THREE GRAMMARS, NOT THREE TUNINGS, WHICH IS WHY THIS IS NOT `playOneRep`
 * ===========================================================================
 * `sessionDrive.mjs`'s `playOneRep` implements SQUAT'S grammar — hold to
 * descend, release at the bottom, tap the drive cue — and says so in its own
 * header. It cannot drive the other two, and the reason is structural rather
 * than a matter of numbers (`lift.ts`, "THREE LIFTS, THREE PHASE PATHS, THREE
 * FACULTIES"):
 *
 *   squat     hold to descend -> release AT DEPTH  -> tap the cues -> done
 *   bench     HOLD the bar all the way down -> it arrives at the chest under
 *             control -> WAIT for the press command -> TAP CONTINUOUSLY from
 *             there until the rep resolves. NO drive cues at all.
 *   deadlift  hold through the brace, release once the bar leaves the floor ->
 *             tap the cues -> CLAMP DOWN at lockout and DO NOTHING until the
 *             down command
 *
 * A deadlift has no DESCENT and no HOLE at all, so there is no release to time;
 * `playOneRep` would wait on 'RELEASE AT DEPTH' for `DESCENT_TIMEOUT_MS` and
 * report "holding never started a descent" about a lift that cannot have one.
 *
 * ===========================================================================
 * `holdAtLockout: false` IS THE CONTROL, AND IT IS THE WHOLE POINT OF THE BEAT
 * ===========================================================================
 * The deadlift is the only lift where the correct play at the decisive instant
 * is to do nothing and keep doing it. A check that only ever HOLDS cannot tell
 * that apart from a lockout that asks for nothing at all — it would pass
 * identically on a build where `m.held` was forced true at the brace, which is
 * a defect an independent critic actually planted in this repository once and
 * which left the whole unit suite green (`lift.ts`'s deadlift BRACE branch
 * carries the story).
 *
 * So the same rep is driven a second time with the finger deliberately kept
 * off the bar at lockout, and the two outcomes are compared. Measured in the
 * pure sim over 40 seeds at every rung of the RPE ladder: a rep that never
 * re-grips is NEVER a clean `good-lift` — it is a `miss`/'dropped' when the sag
 * reaches `LOCKOUT_DROP_HEIGHT_LOSS` before the command and a `grind`
 * otherwise, and which of the two it is depends on the rep's seed. That
 * `never a good-lift` is the invariant the check asserts, because it is the
 * part that holds at every seed and every load; which branch fired is recorded
 * beside it rather than asserted.
 */
async function driveLadderRep(page, kind, holdMs, { holdAtLockout = true, shots = null, neverPress = false, grindPause = null, grindAbandon = null } = {}) {
  const L = LIFT_PROMPTS[kind];
  const outcomeOf = (loop) =>
    loop !== null && SESSION_PROMPTS.OUTCOMES.includes(loop.prompt) ? loop.prompt : null;
  const bail = async (why) => ({
    played: false,
    kind,
    holdAtLockout,
    why,
    ladder: await readLadder(page),
  });

  await resetLadder(page);
  // ARMED PER REP, so `pix` describes THIS rep and nothing before it — the same
  // property `resetLadder` gives the prompt ladder, and for the same reason: a
  // sampler that carried the previous attempt's frames would let a command from
  // a rep that is over stand in for one that never drew.
  await armStagePixels(page, true);

  const braced = await untilLoopSaying(page, L.BRACE, LIFT_LADDER.NEXT_BRACE_MS);
  if (!braced) {
    const now = await readLoop(page);
    return bail(
      `the stage never showed ${kind}'s brace line ${JSON.stringify(L.BRACE)} — it was saying ${JSON.stringify(now.prompt)}`,
    );
  }

  if (neverPress) {
    // ===================================================================
    // `NEVER_PRESS_SWEEP`, IN A BROWSER, FOR ONE REP.
    // ===================================================================
    // `lift.ts`'s deadlift BRACE branch carries a paragraph about an
    // independent critic adding one line — `m.held = true;` — that gave a
    // player who never touched the screen a CLEAN DEADLIFT at every load,
    // 100 of 100, with the whole suite green. `lift.test.ts` covers it now.
    //
    // THE SLIP CONTROL ABOVE DOES NOT, AND THAT WAS MEASURED RATHER THAN
    // ASSUMED: the mutant was replanted against this tool and it SURVIVED,
    // 32 checks green. The reason is exact — that control still plays the
    // pull and the drive cues, and its own `mouse.up()` clears the forced
    // grip before the lockout ever arrives, so the flag it plants is gone by
    // the time the beat it breaks begins. A rep that touches nothing at all
    // is the only shape that keeps the flag set, which is why this arm
    // exists and why it is not a duplicate of the one above it.
    //
    // Nothing is dispatched here. `BRACE_TIMEOUT_TICKS` starts the rep by
    // itself after ten seconds and the sim plays it out; the page's own
    // pointer count is what says no input was made, and the caller asserts
    // that count is zero beside the verdict.
    const resolvedAlone = await untilLoop(
      page,
      (loop) => SESSION_PROMPTS.OUTCOMES.includes(loop.prompt),
      LIFT_LADDER.NEVER_PRESS_TIMEOUT_MS,
    );
    return {
      played: true,
      kind,
      neverPress: true,
      reachedLockout: null,
      outcome: resolvedAlone === null ? null : resolvedAlone.prompt,
      detail: resolvedAlone === null ? null : resolvedAlone.detail,
      ladder: await readLadder(page),
      pix: await readStagePixels(page),
    };
  }

  const box = await page.getByTestId('session-touch').boundingBox().catch(() => null);
  if (box === null) return bail('the set has no touch stage to press');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  let reachedDescent = false;
  let reachedCommand = false;
  let benchDescent = null;
  let grind = null;

  if (L.DESCENT === null) {
    // ---- DEADLIFT: the pull. See `PULL_TIMEOUT_MS` for why this is a HOLD
    // through the brace and not a tap at a guessed instant.
    await page.mouse.down();
    const offTheFloor = await untilLoop(
      page,
      (loop) => loop.prompt !== null && !loop.prompt.includes(L.BRACE),
      LIFT_LADDER.PULL_TIMEOUT_MS,
    );
    await page.waitForTimeout(LIFT_LADDER.PULL_RELEASE_MS);
    await page.mouse.up();
    if (offTheFloor === null) return bail('the pull press never took the bar off the floor');
    const straightToOutcome = outcomeOf(offTheFloor);
    if (straightToOutcome !== null) {
      return {
        played: true,
        kind,
        holdAtLockout,
        reachedLockout: false,
        outcome: straightToOutcome,
        detail: offTheFloor.detail,
        ladder: await readLadder(page),
        pix: await readStagePixels(page),
      };
    }
  } else {
    // ---- SQUAT AND BENCH: the eccentric. Identical to `playOneRep`'s hold,
    // with this lift's own DESCENT line and this lift's own starting hold, and
    // with the press-to-DESCENT detection lag subtracted live — see
    // `probeFullRepCycle`'s own note on why a static offset cannot fit both a
    // first attempt and a retry.
    const pressAt = Date.now();
    await page.mouse.down();
    const descending = await untilLoopSaying(page, L.DESCENT, FULL_CYCLE.PHASE_TIMEOUT_MS);
    if (!descending) {
      await page.mouse.up();
      return bail(`holding never started ${kind}'s descent (${JSON.stringify(L.DESCENT)})`);
    }
    reachedDescent = true;
    if (kind === 'bench') {
      // ---- BENCH: HOLD IT ALL THE WAY DOWN (GDD §6.2, steered 2026-08-25).
      // Not a duty cycle and not a timed release. `holdMs` is not bench's unit
      // and there is no plan to thread through any more: holding is correct at
      // every load, so the whole play is one instruction and the finger comes
      // off ON THE TOUCH. Shared with the meet arm — see
      // `holdBenchToTheChest`'s header for what it replaced and why.
      benchDescent = await holdBenchToTheChest(page, { read: readLoop });
    } else {
      await page.waitForTimeout(Math.max(0, holdMs - (Date.now() - pressAt)));
      await page.mouse.up();
    }

    const afterRelease = await readLoop(page);
    const releasedIntoOutcome = outcomeOf(afterRelease);
    if (releasedIntoOutcome !== null) {
      return {
        played: true,
        kind,
        holdAtLockout,
        reachedDescent,
        benchDescent,
        grind,
        reachedLockout: false,
        outcome: releasedIntoOutcome,
        detail: afterRelease.detail,
        ladder: await readLadder(page),
        pix: await readStagePixels(page),
      };
    }

    if (L.COMMAND !== null) {
      // ---- BENCH ONLY: the reaction. `stepLift`'s HOLE branch reads a press
      // EDGE and consumes it whether or not the command has fired, so a robot
      // that pressed early would false-start and be graded
      // `PRESS_FALSE_START_QUALITY` — which is the mechanic behaving correctly.
      // This waits for the command's own frame.
      //
      // IT WAITS ON THE GRIND LINE TOO. Bench's ascent line is its own
      // ('GRIND — KEEP TAPPING') since the steer, and a poll that lands a beat
      // late would otherwise see it and conclude the command never came.
      // `ASCENT_PROMPTS.RIDE` stays in the list for the opposite reason: bench
      // arms no drive cue any more, so a bench rep showing another lift's
      // ascent copy is a reading the caller needs rather than a timeout.
      const commanded = await untilLoop(
        page,
        (loop) =>
          (loop.prompt !== null && loop.prompt.includes(L.COMMAND)) ||
          (loop.prompt !== null && (L.GRIND ?? null) !== null && loop.prompt.includes(L.GRIND)) ||
          SESSION_PROMPTS.OUTCOMES.includes(loop.prompt) ||
          (loop.prompt !== null && loop.prompt.includes(ASCENT_PROMPTS.RIDE)),
        LIFT_LADDER.COMMAND_TIMEOUT_MS,
      );
      const onACommandBeat =
        commanded !== null &&
        commanded.prompt !== null &&
        (commanded.prompt.includes(L.COMMAND) ||
          ((L.GRIND ?? null) !== null && commanded.prompt.includes(L.GRIND)));
      if (onACommandBeat) {
        reachedCommand = true;
        // ---- THE GRIND, WHICH RUNS TO THE END OF THE REP. One tap was the
        // whole answer under the original beat and a windowed burst under the
        // one after it; the 2026-08-25 replay steer makes taps count from here
        // until the rep resolves or the bar beats you.
        // `grindTapToResolution` stops when the prompt stops asking for taps
        // rather than on a stopwatch — see its header.
        //
        // `grindPause` IS THE RESCUE, DRIVEN. The marks go into the sampler's
        // own clock so the pixel grader can slice its frames on the hole this
        // driver really left; the driver's `Date.now()` is a different clock.
        grind = await grindTapToResolution(page, {
          read: readLoop,
          pause: grindPause,
          abandonAtMs: grindAbandon,
          onPauseStart: () => markStagePixels(page, 'pause-start'),
          onPauseEnd: () => markStagePixels(page, 'pause-end'),
        });
      }
      const missedOnTheChest = outcomeOf(commanded);
      if (missedOnTheChest !== null) {
        return {
          played: true,
          kind,
          holdAtLockout,
          reachedDescent,
          reachedCommand,
          benchDescent,
          grind,
          reachedLockout: false,
          outcome: missedOnTheChest,
          detail: commanded.detail,
          ladder: await readLadder(page),
          pix: await readStagePixels(page),
        };
      }
    }
  }

  // ---- THE ASCENT. One implementation, shared with PROBE 3, parameterised by
  // this lift's own LOCKOUT line — see `tapDriveCuesToLockout`'s header.
  let lockoutHeld = false;
  const clampAtLockout = async () => {
    // THE DEADLIFT'S CHECK, AND THE ONLY PLACE THIS PROBE PRESSES FOR A REASON
    // THAT IS NOT A CUE. The bar is locked and the hold has started;
    // `LOCKOUT_GRIP_GRACE_TICKS` (10 ticks, ~167 ms) is how long the finger has
    // to get back on it, and the sag past that is what costs the rep.
    if (kind === 'deadlift' && holdAtLockout) {
      await page.mouse.down();
      lockoutHeld = true;
    }
  };
  // BENCH SKIPS THE CUE LOOP ENTIRELY, AND THAT IS THE DELETION HALF OF THE
  // 2026-08-25 REPLAY STEER RATHER THAN AN OPTIMISATION. `lift.ts`'s ASCENT
  // branch shuts the drive machinery off for bench BY CONSTRUCTION — not by
  // `driveAttemptsFor` happening to return something small — so
  // `awaitFirstDriveCue` on a bench rep can only wait out its whole
  // `driveTimeoutMs`, and every tap it then dispatched would land with nothing
  // armed. `grindTapToResolution` has already tapped this rep to its end; what
  // is left is to read where it ended.
  let drive = { drivesTapped: 0, lockedOut: false, finalOutcome: null };
  if ((L.GRIND ?? null) !== null) {
    drive = {
      drivesTapped: 0,
      lockedOut: grind !== null && grind.endedOn !== null && grind.endedOn.includes(L.LOCKOUT),
      finalOutcome: grind === null ? null : { prompt: grind.endedOn },
    };
  } else {
  const first = await awaitFirstDriveCue(page, {
    read: readLoop,
    timing: FULL_CYCLE_ASCENT_TIMING,
    lockoutPrompt: L.LOCKOUT,
  });
  drive = { drivesTapped: 0, lockedOut: false, finalOutcome: first.loop };
  if (first.cueOpen) {
    drive = await tapDriveCuesToLockout(page, {
      read: readLoop,
      timing: FULL_CYCLE_ASCENT_TIMING,
      lockoutPrompt: L.LOCKOUT,
      onTap: async () => {},
      onSettled: async () => {},
      onLockout: clampAtLockout,
    });
  } else if (first.lockedOut) {
    // The bar reached lockout without a cue ever arming. Legal — at a light
    // enough load `ascentDemand` never beats capacity — and the hold below is
    // still the beat under test, so it is driven rather than reported as a
    // failure to find a cue.
    drive = { drivesTapped: 0, lockedOut: true, finalOutcome: first.loop };
    await clampAtLockout();
  }
  }

  let downCommandSeen = false;
  let shotsTaken = null;
  if (kind === 'deadlift' && drive.lockedOut) {
    if (shots !== null) shotsTaken = await photographTheHold(page, shots, L);
    // WAIT OUT THE HOLD DOING NOTHING, which is the play. The recorder in the
    // page is what times it; this loop only decides when to let go.
    const downed = await untilLoop(
      page,
      (loop) =>
        (loop.prompt !== null && loop.prompt.includes(L.DOWN)) ||
        SESSION_PROMPTS.OUTCOMES.includes(loop.prompt),
      LIFT_LADDER.DOWN_TIMEOUT_MS,
    );
    downCommandSeen = downed !== null && downed.prompt !== null && downed.prompt.includes(L.DOWN);
    if (downCommandSeen && shotsTaken !== null) {
      shotsTaken = { ...shotsTaken, ...(await photographTheDownCommand(page, shots, L)) };
    }
    if (lockoutHeld) {
      await page.mouse.up();
      lockoutHeld = false;
    }
  }
  if (lockoutHeld) {
    await page.mouse.up();
  }

  const resolved = await untilLoop(
    page,
    (loop) => SESSION_PROMPTS.OUTCOMES.includes(loop.prompt),
    LIFT_LADDER.RESOLVE_TIMEOUT_MS,
  );
  const ladder = await readLadder(page);
  const pix = await readStagePixels(page);
  await armStagePixels(page, false);
  return {
    played: true,
    pix,
    kind,
    holdAtLockout,
    reachedDescent,
    reachedCommand,
    benchDescent,
    grind,
    reachedLockout: drive.lockedOut,
    drivesTapped: drive.drivesTapped,
    downCommandSeen,
    outcome: resolved === null ? null : resolved.prompt,
    detail: resolved === null ? null : resolved.detail,
    shots: shotsTaken,
    ladder,
  };
}

/**
 * PHOTOGRAPH THE HOLD, AND READ THE SCREEN EITHER SIDE OF THE SHUTTER.
 *
 * CLAUDE.md's "Presence is not visibility": a committed screenshot in this
 * repository once came out a flat dark rectangle filed beside a detailed record
 * saying it was a bomb-out screen, and it was found by somebody opening the
 * file. So the shutter's own instant is read from the DOM immediately before
 * and immediately after it opens, both reads are recorded, and the check on
 * this shot has a PREDICATE behind every number it prints rather than a caption.
 *
 * The frame-accurate evidence that these two beats rendered is the page-side
 * recorder, not these PNGs. The PNGs are what a human opens.
 */
async function photographTheHold(page, shots, ladderCopy) {
  await page.waitForTimeout(LIFT_LADDER.SHOT_SETTLE_MS);
  const before = (await readLoop(page)).prompt;
  await page.screenshot({ path: shots.hold }).catch(() => {});
  const after = (await readLoop(page)).prompt;
  return { holdShot: { path: shots.hold, before, after, wanted: ladderCopy.LOCKOUT } };
}

async function photographTheDownCommand(page, shots, ladderCopy) {
  const before = (await readLoop(page)).prompt;
  await page.screenshot({ path: shots.down }).catch(() => {});
  const after = (await readLoop(page)).prompt;
  return { downShot: { path: shots.down, before, after, wanted: ladderCopy.DOWN } };
}

/**
 * OPEN A FRESH SESSION ON ONE LIFT AND WALK ITS LADDER.
 *
 * A FRESH SESSION PER LIFT, and that is a budget fact rather than tidiness:
 * `armFreshLifterPerBoot` makes every `page.goto` a brand-new lifter, GDD §3.2
 * allows one session a day, and `SESSION_TUNING.WORK_SETS` is 5 with a missed
 * rep ending its set. Sharing one session across three lifts is not possible
 * anyway — the lift is chosen once, on the check-in, before the session exists.
 */
async function probeLiftLadder(page, url, kind, { shots = null, alsoSlip = false } = {}) {
  const rpeChoice = LIFT_LADDER.RPE_CHOICE_FOR[kind] ?? LIFT_LADDER.RPE_CHOICE;
  const checkIn = LIFT_LADDER.CHECK_IN_FOR[kind] ?? SESSION_DRIVE.CHECK_IN_TAPS;
  const opened = await openSessionToFirstSet(page, url, checkIn, rpeChoice, kind);
  // WHICH LIFT THE SESSION ACTUALLY LANDED ON, WHICH IS NOT ALWAYS THE ONE THE
  // CHIP ASKED FOR — AND THE DIFFERENCE IS THE DEFECT THIS SECTION EXISTS FOR.
  //
  // `openSessionToFirstSet` refuses when the first set's brace line is not the
  // chosen lift's, and it says which lift's line it DID match. Returning there
  // would leave every check below as a skip, so the one mutant that matters
  // most — `repConfigFor` mapping a deadlift day onto squat's phase model,
  // which this repository shipped for a round as `simKindFor` — would produce
  // one red and a section of silence.
  //
  // So the rep is driven anyway, with the grammar of whatever lift is actually
  // on screen, and every check below is still run AGAINST THE LIFT THAT WAS
  // ASKED FOR. Under that mutant the subtitle check, the ladder-order check and
  // the eccentric census all go red with the real reading in their detail,
  // which is what a reader needs to see.
  const landedOn = opened.reached
    ? kind
    : opened.matchedKinds !== undefined && opened.matchedKinds.length === 1
      ? opened.matchedKinds[0]
      : null;
  if (landedOn === null) {
    return { kind, reached: false, landedOn: null, why: opened.why, chip: checkInLiftTestId(kind) };
  }
  // THE ADDRESS BAR, AT THE MOMENT THE STAGE IS READ — CLAUDE.md asks for this
  // by name so a played arm cannot silently fall back to a debug URL. There is
  // no `?lift=` arm in `resolveEntry` to fall back TO, which makes the reading
  // stronger than the assertion; taken anyway, because "there is no such route"
  // is a claim about today's `shellRoute.ts` and this is a measurement.
  const search = await queryString(page);
  const stage = await waitForStage(page, 'session-touch');
  if (!stage.ok) {
    return { kind, reached: false, landedOn, why: 'the chosen lift never produced a pressable stage', queryString: search };
  }

  const attempts = [];
  let best = null;
  // THE CAMERA STAYS ARMED UNTIL IT HAS ACTUALLY TAKEN A FRAME, not until the
  // first attempt is over. An earlier shape armed it only while `best` was
  // null, which meant a first attempt that MISSED disarmed it permanently and
  // no run whose opening rep fell short would ever have photographed anything —
  // a silent gap that only shows up on the runs where the retry loop earns its
  // keep.
  let photographed = null;
  const rungsWanted = requiredRungsFor(kind);
  let depthSearch = {
    holdMs: LIFT_LADDER.START_HOLD_MS[landedOn] ?? 0,
    stepMs: SESSION_DRIVE.DEPTH_HOLD_STEP_MS,
    lastDirection: 0,
  };
  // BENCH CARRIED ITS OWN SEARCH FOR ONE ROUND AND CARRIES NOTHING NOW. That
  // search bisected a duty cycle against an arrival RATE; the 2026-08-25 replay
  // steer left the descent with no parameter at all, so there is no plan to
  // thread and no `adaptBenchDescent` to move it. `depthSearch` above is squat's
  // and is untouched.

  for (let attempt = 1; attempt <= LIFT_LADDER.MAX_ATTEMPTS; attempt += 1) {
    // DRIVEN WITH `landedOn`'S GRAMMAR — the lift on screen — because a driver
    // waiting for a beat this lift does not have would time out rather than
    // produce the reading the checks need to redden on.
    const rep = await driveLadderRep(page, landedOn, depthSearch.holdMs, {
      holdAtLockout: true,
      shots: photographed === null ? shots : null,
    });
    if (rep.shots?.holdShot !== undefined) photographed = rep.shots;
    const scored = { attempt, holdMs: depthSearch.holdMs, ...rep, matched: matchRungs(rep.ladder, rungsWanted) };
    attempts.push(scored);
    if (best === null || scoreOf(scored) > scoreOf(best)) best = scored;
    // WHEN THIS LOOP IS ALLOWED TO STOP, and the deadlift's condition is
    // stricter than the other two on purpose. Walking the ladder is enough for
    // squat and bench, whose job here is to be non-zero controls for the
    // eccentric census. The deadlift's control pair needs its HELD rep to be a
    // clean GOOD LIFT, because the discrimination check below compares the two
    // outcomes and a held rep that graded GRINDER — reachable when the robot's
    // re-grip misses `LOCKOUT_GRIP_GRACE_TICKS` under load — makes the pair say
    // nothing. Retrying costs a rep out of a 5-set budget this session has to
    // itself, and a made rep does not even end its set.
    const enough =
      kind === 'deadlift' && landedOn === 'deadlift'
        ? scored.matched.walkedInOrder && scored.outcome === 'GOOD LIFT'
        : scored.matched.walkedInOrder;
    if (enough) break;
    if (!rep.played) break;
    depthSearch = adaptDepthSearch(depthSearch, { detail: rep.detail ?? '' });
    await page.waitForTimeout(LIFT_LADDER.BETWEEN_REPS_MS);
  }

  // =========================================================================
  // BENCH ONLY: THE RESCUE, DRIVEN THROUGH THE APP'S OWN CONTROLS
  // =========================================================================
  // GDD §6.2's headline property is the one sentence in the whole steer that a
  // burst mechanic cannot express: "stop tapping and the force falls away and
  // the bar stalls; start again and it comes back and the bar can be rescued."
  // `lift.test.ts` measures it in the pure sim over every reachable load. It
  // had never been PLAYED, and until this rep nothing on the stage even drew
  // the stall.
  //
  // A SEPARATE REP FROM THE LADDER WALK ABOVE, on purpose and at a cost of one
  // set out of the five this session has to itself. The ladder reps have to
  // grind continuously — every readout claim and the whole-chain claim are read
  // off them — so folding a deliberate hole into them would measure a stall the
  // harness caused in every claim above. This one rep is the only rep in the
  // run that stops tapping, and it stops at a stated instant for a stated
  // length (`GRIND_HOLE_AT_MS`, `GRIND_PAUSE_MS`).
  //
  // AND THE CONTROL IT IS A RESCUE AGAINST, DRIVEN SECOND. A rep that pauses
  // and locks out proves the rep locked out; it does not prove that COMING BACK
  // is what saved it, and a real mutant walks through the difference — an
  // ascent boost reading the LAUNCH snapshot rather than the live charge would
  // carry a paused rep to lockout on a frozen force, turning the continuous
  // grind back into the burst the steer replaced with every "it reached
  // lockout" check still green. So the abandoned rep stops tapping at the SAME
  // instant and never starts again, and the pair differs in exactly one thing.
  //
  // IT IS DRIVEN LAST, on purpose: it is meant to be a miss, and a missed rep
  // ends its set (`SESSION_TUNING`), so putting it anywhere else would cost the
  // reps above it a set they are budgeted for.
  let rescued = null;
  let abandoned = null;
  if (landedOn === 'bench' && kind === 'bench') {
    await page.waitForTimeout(LIFT_LADDER.BETWEEN_REPS_MS);
    rescued = await driveLadderRep(page, kind, depthSearch.holdMs, {
      holdAtLockout: true,
      grindPause: {
        atMs: LIFT_LADDER.GRIND_HOLE_AT_MS,
        ms: LIFT_LADDER.GRIND_PAUSE_MS,
      },
    });
    await page.waitForTimeout(LIFT_LADDER.BETWEEN_REPS_MS);
    abandoned = await driveLadderRep(page, kind, depthSearch.holdMs, {
      holdAtLockout: true,
      grindAbandon: LIFT_LADDER.GRIND_HOLE_AT_MS,
    });
  }

  // THE CONTROL REP — deadlift only, and only once a held rep has been seen, so
  // the pair differs in exactly one thing. See `driveLadderRep`'s header.
  let slip = null;
  // `landedOn === kind` guards it: a control pair taken on a lift that is not
  // the one under test would compare two reps of the wrong lift and could pass
  // by accident, which is worse than not taking it.
  let neverPressed = null;
  if (alsoSlip && landedOn === kind && best !== null && best.reachedLockout === true) {
    await page.waitForTimeout(LIFT_LADDER.BETWEEN_REPS_MS);
    slip = await driveLadderRep(page, kind, depthSearch.holdMs, { holdAtLockout: false });
    await page.waitForTimeout(LIFT_LADDER.BETWEEN_REPS_MS);
    neverPressed = await driveLadderRep(page, kind, 0, { neverPress: true });
  }

  return {
    kind,
    landedOn,
    reached: opened.reached,
    // Carried even on the success path, so a run whose chip did NOT take has
    // the refusal's own sentence in the check's detail rather than `undefined`.
    why: opened.why ?? null,
    chip: checkInLiftTestId(kind),
    queryString: search,
    rpeChoice,
    checkIn,
    attempts,
    best,
    rescued,
    abandoned,
    shots: photographed,
    slip,
    neverPressed,
  };
}

/**
 * How good an attempt was, for picking which one every claim is read off.
 *
 * Rungs first, because a rep that walked further has more to say than one that
 * graded better and stopped early; the verdict breaks the tie, so a run whose
 * attempts all walked the whole ladder reports the best-graded of them. Written
 * as one function rather than inline so the two comparisons cannot drift apart.
 */
/**
 * ===========================================================================
 * GRADE THE COMMAND BEAT FROM THE CANVAS — THE CHECK PHONE PLAYTEST 4's
 * MEASUREMENT WOULD HAVE FAILED
 * ===========================================================================
 * At `575c5d3` the press command drew nothing at all: `frameKey` byte-identical
 * at command minus 2 through plus 6, on an obeyed rep. Every check in this file
 * was green through that and none of them COULD have been anything else — they
 * read testIDs, and the beat is inside a Skia `<canvas>` that has none.
 *
 * WHAT EACH CLAIM IS COMPARED AGAINST, because a number with no comparison is
 * decoration however convincing it looks in a log line:
 *
 *   THE HIT      the biggest inter-frame delta inside the flash's own declared
 *                duration, against the biggest one anywhere in the WAIT that
 *                preceded it on the same rep. Strictly greater, plus a
 *                structural floor (`MIN_COMMAND_DELTA_FRACTION`) that says the
 *                hit is a full-stage event rather than a corner. Both windows
 *                carry a frame-count floor, or an empty one would report the
 *                same zero as a stage that draws nothing.
 *   THE CONTROL  the same instrument on a SQUAT, which has no command at all
 *                (`commandHit` returns null for it by construction). Its
 *                biggest delta anywhere in the rep must stay under the floor,
 *                so the floor is a statement about a command and not about
 *                anything a moving sprite does.
 *   THE READOUT  lit pixels inside the grind tray, quantised back to pips, on
 *                the rep that carries the driven hole. Read in three windows of
 *                ONE rep — grinding, paused, grinding again — because the row's
 *                claim since the steer is that it moves BOTH WAYS with the live
 *                rate, and a window that only rises cannot say that.
 *   THE STALL    pixels in the stage's TOP STRIP that differ from a baseline
 *                taken before the band could exist, inside the same driven
 *                hole, against the same strip during the WAIT on the chest.
 *                The wait is the control that cannot be confounded: `stallBand`
 *                returns null outside ASCENT by construction, so a non-zero
 *                reading there would mean the baseline itself was wrong.
 *   THE RESCUE   that the same rep — paused, stalled, resumed — reached
 *                LOCKOUT, through the app's own controls with no query string.
 *
 * WHAT IT CANNOT SAY: whether the beat reads in the hand. That is GDD §12.1 and
 * it is a human on a phone.
 */
function gradeStageBeat(kind, run) {
  const best = run.best ?? null;
  const pix = best?.pix ?? null;

  // ---- THE INSTRUMENT'S OWN DOMAIN ----------------------------------------
  const rows = pix?.rows ?? [];
  const moved = rows.filter((row) => row.d !== null && row.d > 0).length;
  check(
    pix !== null &&
      pix.err === null &&
      pix.mode === 'webgl' &&
      pix.preserveDrawingBuffer === true &&
      pix.counts.dropped === 0 &&
      pix.sampled > 0 &&
      rows.length > 0 &&
      moved > 0,
    `LADDER ${kind} STAGE DOMAIN: the canvas sampler read real, MOVING frames off the stage for the rep every pixel claim below is taken from`,
    pix === null
      ? 'the sampler was never installed'
      : `mode=${JSON.stringify(pix.mode)}, preserveDrawingBuffer=${pix.preserveDrawingBuffer} (forced by this instrument: ${pix.preserveDrawingBufferForced}), ${rows.length} frame(s) kept, ${moved} of them moved, ${pix.sampled} px sampled per frame at stride ${STAGE_BEAT.DELTA_STRIDE}, canvas scale ${pix.scale}, ${pix.counts.dropped} dropped against a ${STAGE_BEAT.MAX_ROWS}-row cap, err=${JSON.stringify(pix.err)}`,
  );
  check(
    STAGE_BEAT_TUNING.missing.length === 0,
    `LADDER ${kind} STAGE DOMAIN: the tray rectangle and the lit-pip colour resolved out of source rather than being typed here`,
    STAGE_BEAT_TUNING.missing.length === 0
      ? `tray ${JSON.stringify(STAGE_BEAT_TUNING.tray)} in stage points, ${STAGE_BEAT_TUNING.pips} pips of ${STAGE_BEAT_TUNING.pipArea}pt each, lit ${JSON.stringify(STAGE_BEAT_TUNING.litColour)}, flash ${STAGE_BEAT_TUNING.pressFlashMs}/${STAGE_BEAT_TUNING.downFlashMs}ms`
      : `unread: ${STAGE_BEAT_TUNING.missing.join(', ')}`,
  );
  if (pix === null || STAGE_BEAT_TUNING.missing.length > 0) {
    skip(
      `LADDER ${kind}: every stage-pixel claim below it`,
      'the sampler or its geometry did not resolve, and a section that looked complete here would be worse than a named gap',
    );
    return;
  }
  const floorPx = pix.sampled * STAGE_BEAT.MIN_COMMAND_DELTA_FRACTION;

  // ---- THE SQUAT CONTROL: a lift with no command --------------------------
  if (kind === 'squat') {
    const biggest = rows.reduce((most, row) => Math.max(most, row.d ?? 0), 0);
    check(
      rows.length > 0 && biggest < floorPx,
      `LADDER squat STAGE CONTROL: no frame of a lift that HAS no command ever moves a command-sized share of the stage`,
      `biggest inter-frame delta over the whole rep was ${biggest} px of ${pix.sampled} sampled (${((biggest / pix.sampled) * 100).toFixed(1)}%), against the ${Math.round(floorPx)} px floor a command has to clear`,
    );
    return;
  }

  // ---- THE HIT ------------------------------------------------------------
  const commandLine = kind === 'bench' ? LIFT_PROMPTS.bench.COMMAND : LIFT_PROMPTS.deadlift.DOWN;
  const waitLine = kind === 'bench' ? LIFT_PROMPTS.bench.HOLE : LIFT_PROMPTS.deadlift.LOCKOUT;
  const flashMs = kind === 'bench' ? STAGE_BEAT_TUNING.pressFlashMs : STAGE_BEAT_TUNING.downFlashMs;
  const says = (row, line) => row.prompt !== null && row.prompt.includes(line);
  const commandRow = rows.find((row) => says(row, commandLine)) ?? null;
  const commandT = commandRow === null ? null : commandRow.t;
  const wait =
    commandT === null ? [] : rows.filter((row) => row.d !== null && row.t < commandT && says(row, waitLine));
  const hit =
    commandT === null
      ? []
      : rows.filter((row) => row.d !== null && row.t >= commandT && row.t <= commandT + flashMs);
  const maxWait = wait.reduce((most, row) => Math.max(most, row.d), 0);
  const maxHit = hit.reduce((most, row) => Math.max(most, row.d), 0);
  check(
    commandT !== null &&
      wait.length >= STAGE_BEAT.MIN_WAIT_FRAMES &&
      hit.length >= STAGE_BEAT.MIN_COMMAND_FRAMES &&
      maxHit > maxWait &&
      maxHit >= floorPx,
    `LADDER ${kind} STAGE HIT: the ${JSON.stringify(commandLine)} command PAINTS the stage, and paints it harder than any frame of the wait it follows`,
    commandT === null
      ? `the sampler never saw ${JSON.stringify(commandLine)} on a frame — the command's own line never rendered while the canvas was being read`
      : `command frame at ${commandT}ms; over the ${flashMs}ms flash the biggest delta was ${maxHit} px of ${pix.sampled} sampled (${((maxHit / pix.sampled) * 100).toFixed(1)}%, floor ${Math.round(floorPx)}), against ${maxWait} px (${((maxWait / pix.sampled) * 100).toFixed(1)}%) as the biggest of the ${wait.length} wait frame(s) before it; ${hit.length} flash frame(s) read`,
  );

  if (kind !== 'bench') return;

  // ---- THE READOUT, AND THE STALL, ON THE REP WITH THE DRIVEN HOLE --------
  //
  // ==========================================================================
  // WHAT THIS REPLACED, AND WHY THE OLD CHECK COULD NOT SURVIVE THE STEER
  // ==========================================================================
  // The check that stood here asserted `regressions === 0` — the pip row never
  // goes down — plus `last > first` and `maxIncrease < last - first`. It was
  // written against a burst: one pip per counted tap out of a per-rep cap, so a
  // row that fell was a row that was broken.
  //
  // SINCE THE 2026-08-25 REPLAY STEER THAT ASSERTION IS FALSE OF A CORRECT ROW.
  // `lit` is `grindForce` scaled onto the row and `grindForce` decays every
  // tick the player is not tapping, so a row that CANNOT regress is exactly the
  // row the steer deleted — a level that fills up and stays full while the
  // player quietly stops. The old check and the new mechanic cannot both be
  // right, and the mechanic is the one a human ruled on.
  //
  // NOT DOMINATION, THEN, BUT CONTRADICTION, and the replacement is not a
  // weakening: `regressions === 0` is satisfied by a hardcoded full row (the
  // mutant that survived the previous version of this check, recorded below),
  // and "it falls during a driven hole and comes back after it" is not.
  // `invalid === 0` survives from the old check because it is orthogonal — the
  // row's length is still its length — and it is pinned as a ZERO with the
  // frame count beside it as the population.
  const scale = pix.scale ?? 1;
  const pipAreaPx = STAGE_BEAT_TUNING.pipArea * scale * scale;
  const pipsAt = (row) => Math.round(row.lit / pipAreaPx);

  // THE THREE WINDOWS ARE SLICED ON THE DRIVER'S OWN MARKS, which are stamped
  // inside the page on the sampler's clock. Slicing on `Date.now()` would put
  // them somewhere else entirely — see `__stagePixMark`.
  const paused = run.rescued ?? null;
  const pausePix = paused?.pix ?? null;
  const pauseRows = pausePix?.rows ?? [];
  const marks = pausePix?.marks ?? [];
  const markAt = (label) => marks.find((mark) => mark.label === label)?.t ?? null;
  const pauseFrom = markAt('pause-start');
  const pauseTo = markAt('pause-end');
  const pauseCommandRow = pauseRows.find((row) => says(row, commandLine)) ?? null;
  const pauseCommandT = pauseCommandRow === null ? null : pauseCommandRow.t;

  // GRINDING: after the command's own flash has decayed (so the wash is not
  // being read as the readout) and before the hole opens.
  // HELD: the hole, given `GRIND_SETTLE_MS` for the charge to fall — the
  // half-life is about 117 ms at the shipped decay and the hole is 700.
  // RESUMED: everything after the hole closes.
  const inWindow = (row, from, to) =>
    from !== null && to !== null && row.t >= from && row.t <= to;
  // THE HIGH WINDOW STARTS AT THE COMMAND FRAME AND NOT PAST THE FLASH, and
  // that is a fact about the drawing order rather than a relaxation. The tray
  // is opaque and the pips are drawn ON TOP of the command wash
  // (`LiftStage.tsx` draws the readout last, and says why), so `lit` — a count
  // of lit-pip pixels inside the tray — cannot see the wash at all. The
  // `+flashMs` offset belongs to the measurements that read the WHOLE STAGE,
  // and the stall control below still carries it for exactly that reason.
  //
  // It also has to start there now: the hole opens at `GRIND_HOLE_AT_MS`, which
  // is inside the launch beat and therefore inside the flash, so a window that
  // began after the flash would be EMPTY — the frame-count floor below would
  // catch that, but a check that can only be satisfied by moving a tuning knob
  // is not the check anybody wanted.
  const grinding =
    pauseCommandT === null
      ? []
      : pauseRows.filter((row) => inWindow(row, pauseCommandT, pauseFrom));
  const held =
    pauseFrom === null
      ? []
      : pauseRows.filter((row) => inWindow(row, pauseFrom + STAGE_BEAT.GRIND_SETTLE_MS, pauseTo));
  const resumed = pauseTo === null ? [] : pauseRows.filter((row) => row.t > pauseTo);

  const grindingPips = grinding.map(pipsAt);
  const heldPips = held.map(pipsAt);
  const resumedPips = resumed.map(pipsAt);
  const peakGrinding = grindingPips.length === 0 ? null : Math.max(...grindingPips);
  const floorHeld = heldPips.length === 0 ? null : Math.min(...heldPips);
  const peakResumed = resumedPips.length === 0 ? null : Math.max(...resumedPips);
  const invalid = [...grindingPips, ...heldPips, ...resumedPips].filter(
    (n) => n < 0 || n > STAGE_BEAT_TUNING.pips,
  ).length;

  check(
    grinding.length >= STAGE_BEAT.MIN_COMMAND_FRAMES &&
      held.length >= STAGE_BEAT.MIN_COMMAND_FRAMES &&
      resumed.length >= STAGE_BEAT.MIN_COMMAND_FRAMES &&
      invalid === 0 &&
      peakGrinding !== null &&
      floorHeld !== null &&
      peakResumed !== null &&
      peakGrinding > 0 &&
      floorHeld < peakGrinding &&
      peakResumed > floorHeld,
    'LADDER bench STAGE READOUT: the grind row FALLS while the driven hole is open and COMES BACK when the tapping resumes — which neither a hardcoded row nor a running tap total can do',
    pausePix === null
      ? 'no paused rep was driven, so the readout has no hole to be read across'
      : `windows: grinding ${grinding.length} frame(s) peak ${peakGrinding} pip(s), held ${held.length} frame(s) floor ${floorHeld}, resumed ${resumed.length} frame(s) peak ${peakResumed}; ${invalid} reading(s) out of 0..${STAGE_BEAT_TUNING.pips}; pips ${JSON.stringify(grindingPips)} | ${JSON.stringify(heldPips)} | ${JSON.stringify(resumedPips)}; raw lit px over the whole paused rep ${Math.min(...pauseRows.map((row) => row.lit), Infinity)}..${Math.max(...pauseRows.map((row) => row.lit), -Infinity)} across ${pauseRows.length} frame(s); marks ${JSON.stringify(marks)}, command frame ${pauseCommandT}ms, ${Math.round(pipAreaPx)} px per pip at canvas scale ${scale}`,
  );

  // ---- THE STALL ----------------------------------------------------------
  //
  // The band is only drawn while `grindIsLive` AND the phase is ASCENT AND the
  // bar's velocity is under `GRIND_STALL_VELOCITY` (`stallBand`, liftFrame.ts).
  // So the WAIT on the chest is a control that cannot be confounded: it is a
  // HOLE-phase beat, the predicate is false there by construction, and a
  // non-zero reading in it would mean the baseline this measurement is taken
  // against was itself wrong rather than that the app drew something.
  const pauseWait =
    pauseCommandT === null
      ? []
      : pauseRows.filter((row) => row.e !== null && row.t < pauseCommandT && says(row, waitLine));
  const edgeFloorPx = (pausePix?.edgeSampled ?? 0) * STAGE_BEAT.MIN_STALL_EDGE_FRACTION;
  // THE POSITIVE CONTROL ON THE INSTRUMENT ITSELF, AND IT IS NOT OPTIONAL.
  // The two readings the check below compares are a ZERO and a non-zero, and a
  // strip measurement that could not see anything AT ALL would report exactly
  // the same zero for the control and then fail the finding — which reads as
  // "the app drew nothing" when the truth is "this instrument is blind".
  //
  // The command wash is what settles it: it is a FULL-STAGE effect
  // (`FLASH_PEAK_ALPHA`), so it necessarily crosses this strip, and it is drawn
  // on a rep this grader has already proven painted (the STAGE HIT check, on
  // the same rows). If the strip cannot see the wash, nothing it says about the
  // band is worth anything.
  const pauseWash =
    pauseCommandT === null
      ? []
      : pauseRows.filter(
          (row) => row.e !== null && row.t >= pauseCommandT && row.t <= pauseCommandT + flashMs,
        );
  const peakWashEdge = pauseWash.length === 0 ? null : Math.max(...pauseWash.map((row) => row.e));
  check(
    pauseWash.length >= STAGE_BEAT.MIN_COMMAND_FRAMES &&
      peakWashEdge !== null &&
      peakWashEdge >= edgeFloorPx,
    'LADDER bench STAGE STALL CONTROL: the top strip CAN see a full-stage effect — the command wash moves it',
    pausePix === null
      ? 'no paused rep was driven'
      : `${pauseWash.length} wash frame(s), biggest ${peakWashEdge} px of ${pausePix.edgeSampled} sampled in the top ${STAGE_BEAT_TUNING.stallBandPx}pt strip, against the same ${Math.round(edgeFloorPx)} px floor the stall band must clear`,
  );
  const heldEdge = held.filter((row) => row.e !== null).map((row) => row.e);
  const waitEdge = pauseWait.map((row) => row.e);
  const peakHeldEdge = heldEdge.length === 0 ? null : Math.max(...heldEdge);
  const peakWaitEdge = waitEdge.length === 0 ? null : Math.max(...waitEdge);
  check(
    heldEdge.length >= STAGE_BEAT.MIN_COMMAND_FRAMES &&
      peakHeldEdge !== null &&
      peakHeldEdge >= edgeFloorPx,
    'LADDER bench STAGE STALL: the stage goes URGENT inside the driven hole',
    pausePix === null
      ? 'no paused rep was driven, so the stall band has no hole to be read across'
      : `held: ${heldEdge.length} frame(s), biggest ${peakHeldEdge} px of ${pausePix.edgeSampled} sampled in the top ${STAGE_BEAT_TUNING.stallBandPx}pt strip (floor ${Math.round(edgeFloorPx)}); edges ${JSON.stringify(heldEdge)}`,
  );
  // THE WAIT READING IS AN INSTRUMENT BASELINE, AND ITS TITLE SAYS SO NOW.
  // The first title bundled it into the app claim as "draws NOTHING there
  // through the wait", which reads as a discriminator on `stallBand` — and no
  // edit to `stallBand`'s body can redden it: `grindIsLive` is false through
  // the whole wait BY CONSTRUCTION (`pressCommandTick` is null until the
  // command fires, upstream of everything the band computes), so a zero here
  // is a fact about the strip and the baseline frame, not about a decision the
  // app made. CLAUDE.md's misdescribing-identifier rule applies to a check's
  // title identically. What the zero DOES pin — and the reason it stays a
  // check rather than being deleted — is the instrument's noise floor: a
  // baseline frame captured mid-paint, or a strip that drifts without an
  // authored change, reports here as a non-zero wait and takes the held
  // reading's meaning with it.
  check(
    pauseWait.length >= STAGE_BEAT.MIN_WAIT_FRAMES && peakWaitEdge === 0,
    "LADDER bench STAGE STALL BASELINE: the sampler reads ZERO through the wait — a beat where stallBand is null BY CONSTRUCTION — so the strip's noise floor, not an app decision, is what this pins",
    pausePix === null
      ? 'no paused rep was driven'
      : `wait: ${pauseWait.length} frame(s), biggest ${peakWaitEdge} px of ${pausePix.edgeSampled} sampled; edges ${JSON.stringify(waitEdge)}`,
  );

  // ---- THE RESCUE, AND THE CADENCE THAT HAS TO BE BEHIND IT ---------------
  //
  // OUTCOME, NOT MECHANISM. What is asserted is that the rep with the hole in
  // it reached LOCKOUT anyway — pause, stall, resume, lockout — and that the
  // driver's own achieved cadence was good enough for a full grind, so a miss
  // could not have been quietly blamed on the app. `impliedForce` is the
  // measured inter-tap gap turned into the grind force it settles at; it is
  // compared here rather than only printed.
  const rescueGrind = paused?.grind ?? null;
  const givenUp = run.abandoned ?? null;
  const givenUpGrind = givenUp?.grind ?? null;
  // ---- THE SAME PRECONDITION AS THE PAIR BELOW, AND MISSING IT HERE WAS A
  // ---- DEFECT THE PAIR'S OWN FIX WALKED PAST
  //
  // The pair check below skips when the achieved cadence exceeds
  // `GRIND_PAIR_MAX_GAP_MS`. THIS check has the identical dependency and was
  // left as a red: recovering from a stall is the thing both lines are about,
  // and `GRIND_PAIR_MAX_GAP_MS`'s own header says the sim measures that
  // recovery FAILING at 100 ms between taps. So a host tapping at 119 ms
  // produces a rep that does not lock out for exactly the reason the constant
  // predicts, and calling that the app's failure is the misattribution the
  // ceiling exists to prevent. Measured: 119 ms mean, implied force 0.886
  // clearing `GRIND_FORCE_FLOOR` 0.7 comfortably — so the weaker floor passes
  // while the one that actually governs recovery is exceeded.
  //
  // CLAUDE.md's rule, applied to the branch immediately above the one that was
  // fixed: "when you fix a check, the next thing to look at is the branch
  // immediately below it." Here it was the branch above.
  const rescueCadenceHolds =
    (rescueGrind?.gaps?.meanMs ?? Infinity) <= BENCH_DRIVE.GRIND_PAIR_MAX_GAP_MS;
  if (!rescueCadenceHolds) {
    skip(
      'LADDER bench RESCUE: the resumed rep was driven fast enough for the recovery to be the app’s to make',
      `this host tapped at ${Math.round(rescueGrind?.gaps?.meanMs ?? -1)}ms mean against a `
        + `${BENCH_DRIVE.GRIND_PAIR_MAX_GAP_MS}ms ceiling; the sim measures stall recovery failing `
        + 'at 100ms between taps, so a rep that does not lock out here is the driver\u2019s cadence '
        + 'rather than the app\u2019s grind. Not a tolerance to widen.',
    );
  }
  check(
    rescueCadenceHolds === false ||
      (paused !== null &&
      paused.played === true &&
      paused.reachedDescent === true &&
      paused.reachedCommand === true &&
      rescueGrind !== null &&
      rescueGrind.paused !== null &&
      rescueGrind.sawGrindLine === true &&
      rescueGrind.impliedForce !== null &&
      rescueGrind.impliedForce >= BENCH_DRIVE.GRIND_FORCE_FLOOR &&
      paused.reachedLockout === true &&
      paused.outcome !== 'NO LIFT'),
    'LADDER bench RESCUE: a rep whose grind was deliberately STOPPED and then RESUMED stalled on the way up and reached LOCKOUT anyway, through the app’s own controls',
    paused === null
      ? 'no paused rep was driven'
      : `hole ${JSON.stringify(rescueGrind?.paused ?? null)} after ${rescueGrind?.dispatched ?? 0} dispatched tap(s); cadence ${JSON.stringify(rescueGrind?.gaps ?? null)} implying grind force ${rescueGrind?.impliedForce === null || rescueGrind?.impliedForce === undefined ? 'n/a' : rescueGrind.impliedForce.toFixed(3)} against a ${BENCH_DRIVE.GRIND_FORCE_FLOOR} floor; grind line seen=${rescueGrind?.sawGrindLine}; stopped because ${JSON.stringify(rescueGrind?.stoppedBecause ?? null)} on ${JSON.stringify(rescueGrind?.endedOn ?? null)}; lockout=${paused.reachedLockout}, outcome ${JSON.stringify(paused.outcome)} ${JSON.stringify(paused.detail ?? null)}`,
  );

  // ---- THE PAIR, WHICH IS WHAT MAKES THE LINE ABOVE A CLAIM ---------------
  //
  // Two reps of the same lift at the same load, driven identically up to the
  // same instant, differing ONLY in whether the tapping came back. If a bar
  // that is never tapped again reaches lockout too, then "the rescue rescued
  // it" is a sentence about a rep that was going to make anyway — and there is
  // a real mutant with exactly that signature (an ascent boost read off the
  // launch snapshot instead of the live charge). Measured in the pure sim at
  // this cell and this schedule, 40 seeds: resumed makes 40/40, abandoned
  // misses 40/40 on 'timeout'.
  //
  // TWO THINGS ARE ASSERTED ABOUT THE DRIVER AND NOT ABOUT THE APP, and they
  // are here because without them a red on this line reads as the app's
  // failure when it is the robot's. The two holes must have opened at the SAME
  // INSTANT within one poll of each other — that is what makes the pair a pair
  // — and both cadences must clear `GRIND_PAIR_MAX_GAP_MS`, which is stricter
  // than `GRIND_FORCE_FLOOR` because recovering from a stall asks more of a
  // cadence than making a rep does. Both bands are measured; see
  // `grindTapToResolution`'s header.
  const holeAt = rescueGrind?.paused?.openedAtMs ?? null;
  const controlAt = givenUpGrind?.abandonedAtMs ?? null;
  const holesAgree =
    holeAt !== null &&
    controlAt !== null &&
    Math.abs(holeAt - controlAt) <= STAGE_BEAT.PAIRED_HOLE_TOLERANCE_MS;
  const cadenceHolds =
    (rescueGrind?.gaps?.meanMs ?? Infinity) <= BENCH_DRIVE.GRIND_PAIR_MAX_GAP_MS &&
    (givenUpGrind?.gaps?.meanMs ?? Infinity) <= BENCH_DRIVE.GRIND_PAIR_MAX_GAP_MS;
  // ---- THE CADENCE IS A PRECONDITION, SO ITS FAILURE IS A SKIP -------------
  //
  // `cadenceHolds` is a fact about the DRIVER, not the app — the header above
  // says so. Folded into the `check` below it turned a host that could not tap
  // fast enough into a RED on a line that reads as an app claim, and left the
  // run with no way to say the honest thing: the instrument could not make this
  // measurement here. Five runs across two hosts read achieved means of 78-110ms
  // against an 83ms ceiling with EVERY substantive clause about the app passing.
  //
  // CLAUDE.md: "If the played arm cannot be driven, the honest output is a named
  // SKIPPED check, not a quiet fallback." So an unmet cadence is now a skip that
  // carries its own achieved numbers, and the app clauses are asserted only when
  // the pair is actually comparable. This is NOT a widened tolerance: 83ms is
  // unchanged, and above it the pair genuinely cannot discriminate, so there is
  // no claim to make either way.
  const cadenceDetail =
    `rescued ${Math.round(rescueGrind?.gaps?.meanMs ?? -1)}ms and abandoned `
    + `${Math.round(givenUpGrind?.gaps?.meanMs ?? -1)}ms against a `
    + `${BENCH_DRIVE.GRIND_PAIR_MAX_GAP_MS}ms ceiling`;
  if (!cadenceHolds) {
    skip(
      'LADDER bench RESCUE CONTROL: the abandoned/resumed pair is comparable enough to discriminate',
      `this host did not tap fast enough to make the pair a pair — ${cadenceDetail}. `
        + 'Above the ceiling the two reps differ in cadence as well as in the thing under '
        + 'test, so neither a pass nor a fail is available. Not a tolerance to widen: the '
        + 'ceiling is what makes the pair discriminating.',
    );
  }
  check(
    cadenceHolds === false ||
      (givenUp !== null &&
      givenUp.played === true &&
      givenUp.reachedCommand === true &&
      givenUpGrind !== null &&
      holesAgree &&
      givenUp.reachedLockout === false &&
      paused?.reachedLockout === true),
    'LADDER bench RESCUE CONTROL: the SAME rep with the grind stopped at the SAME instant and never resumed does NOT reach lockout — so coming back is what saved the one above',
    givenUp === null
      ? 'no abandoned rep was driven'
      : `holes opened at ${holeAt}ms (rescued, asked ${rescueGrind?.paused?.askedAtMs}) and ${controlAt}ms (abandoned) — agree within ${STAGE_BEAT.PAIRED_HOLE_TOLERANCE_MS}ms: ${holesAgree}; cadences ${rescueGrind?.gaps?.meanMs}ms and ${givenUpGrind?.gaps?.meanMs}ms against a ${BENCH_DRIVE.GRIND_PAIR_MAX_GAP_MS}ms pair ceiling: ${cadenceHolds}; lockout=${givenUp.reachedLockout} against the rescued rep's ${paused?.reachedLockout}; outcome ${JSON.stringify(givenUp.outcome)} ${JSON.stringify(givenUp.detail ?? null)}, stopped because ${JSON.stringify(givenUpGrind?.stoppedBecause ?? null)} on ${JSON.stringify(givenUpGrind?.endedOn ?? null)}`,
  );

  // ---- AND THE OUTCOME THE WHOLE CHAIN IS FOR -----------------------------
  // The UNINTERRUPTED rep, which is the ordinary play: held descent, wait,
  // continuous grind, lockout. The pip count beside it is what says the taps
  // were COUNTED rather than merely dispatched, which the driver cannot know
  // about itself (`grindTapToResolution` returns `countedTaps: null` and says
  // why).
  const bestGrind = best?.grind ?? null;
  const bestRows = commandT === null ? [] : rows.filter((row) => says(row, commandLine));
  const bestPips = bestRows.map(pipsAt);
  const bestPeak = bestPips.length === 0 ? 0 : Math.max(...bestPips);
  check(
    best?.reachedDescent === true &&
      best?.reachedCommand === true &&
      (bestGrind?.dispatched ?? 0) > 0 &&
      bestGrind?.sawGrindLine === true &&
      bestGrind?.impliedForce !== null &&
      (bestGrind?.impliedForce ?? 0) >= BENCH_DRIVE.GRIND_FORCE_FLOOR &&
      bestPeak > 0 &&
      best?.reachedLockout === true &&
      best?.outcome !== 'NO LIFT',
    'LADDER bench: a rep driven through the WHOLE new chain — held descent, wait, CONTINUOUS grind — reached LOCKOUT',
    `descent ${JSON.stringify(best?.benchDescent === null || best?.benchDescent === undefined ? null : { heldMs: best.benchDescent.heldMs, deadlineMs: best.benchDescent.deadlineMs, leftBecause: best.benchDescent.leftBecause })}; grind ${JSON.stringify(bestGrind === null ? null : { dispatched: bestGrind.dispatched, ms: bestGrind.ms, gaps: bestGrind.gaps, impliedForce: bestGrind.impliedForce, sawCommandLine: bestGrind.sawCommandLine, sawGrindLine: bestGrind.sawGrindLine, sawFalseStart: bestGrind.sawFalseStart, stoppedBecause: bestGrind.stoppedBecause, endedOn: bestGrind.endedOn })}; ${bestPeak} pip(s) at the row's peak over ${bestRows.length} command frame(s); lockout=${best?.reachedLockout}, outcome ${JSON.stringify(best?.outcome)} ${JSON.stringify(best?.detail ?? null)}`,
  );
}

function scoreOf(scored) {
  return scored.matched.matchedCount * 10 + (OUTCOME_RANK[scored.outcome] ?? 0);
}

/**
 * THE RUNGS ONE LIFT'S LADDER MUST WALK, IN ORDER.
 *
 * Built from `LIFT_PROMPTS` rather than typed out, so a lift whose copy changes
 * cannot leave a stale expectation behind. The counts are per kind and EXACT —
 * squat 4, bench 5, deadlift 4 — and they are what the "no eccentric line ever
 * rendered" zero further down is zero AGAINST: a deadlift ladder that matched
 * nothing would report the same zero as one that walked its own beats
 * perfectly, and the difference between those two is this list.
 *
 * `RIDE IT` is on every list because every lift has an ascent, and it is
 * deliberately NOT evidence about WHICH lift — `ASCENT_BEFORE_CUE` and
 * `ASCENT_AFTER_CUE` are the same generic press language on all three. What
 * carries the identity is the brace line, the eccentric lines' presence or
 * absence, and (on deadlift) the two lockout lines.
 */
function requiredRungsFor(kind) {
  const L = LIFT_PROMPTS[kind];
  // THE ASCENT RUNG IS PER LIFT NOW, AND ASSUMING IT WAS 'RIDE IT' FOR ALL
  // THREE WAS A REAL STALE EXPECTATION THIS RUN CAUGHT. Squat and deadlift flip
  // between 'RIDE IT' and 'DRIVE — TAP' across their ascents; bench shows ONE
  // line for the whole grind (`LIFT_COPY.PROMPT.ASCENT_GRINDING`) because it
  // arms no cue. Measured against a real driven bench rep before this was
  // changed: the ladder walked 4 of 5 with `"RIDE IT"@never`, on a rep that had
  // in fact rendered every beat it has — a check reporting the tool's stale
  // idea of the mechanic as the app's failure.
  const ascent = L.GRIND ?? ASCENT_PROMPTS.RIDE;
  return [L.BRACE, L.DESCENT, L.HOLE, L.COMMAND, ascent, kind === 'deadlift' ? L.LOCKOUT : null, kind === 'deadlift' ? L.DOWN : null].filter(
    (line) => line !== null,
  );
}

/**
 * Did this ladder show every wanted rung, each one after the last?
 *
 * ORDER, NOT MERE PRESENCE. CLAUDE.md's progression rule: a claim that
 * something advances is three facts, and a set-membership check carries only
 * the two a frozen value satisfies trivially. "BRACE happened, then DESCENT
 * happened, then HOLE happened" is the third — it MOVED — and it is the one a
 * screen stuck on one beat fails.
 */
function matchRungs(ladder, wanted) {
  const rungs = promptRungs(ladder);
  let cursor = 0;
  const at = [];
  for (const line of wanted) {
    const found = rungs.findIndex((rung, index) => index >= cursor && rung.text === line);
    if (found < 0) {
      at.push({ line, at: null });
      continue;
    }
    cursor = found + 1;
    at.push({ line, at: rungs[found].t });
  }
  const matchedCount = at.filter((entry) => entry.at !== null).length;
  return {
    wanted,
    at,
    matchedCount,
    walkedInOrder: matchedCount === wanted.length,
    rungs: rungs.map((rung) => rung.text),
  };
}

/** How many of the game's eccentric-only lines this ladder ever showed. */
function eccentricLinesIn(ladder) {
  const seen = new Set(promptRungs(ladder).map((rung) => rung.text));
  return ECCENTRIC_ONLY_PROMPTS.filter((line) => seen.has(line));
}

/**
 * THE THREE LIFTS THIS SECTION DRIVES, AND WHY IT IS ALL THREE.
 *
 * Deadlift is the one with no browser evidence and the one the piece is for.
 * The other two are here as CONTROLS for its zero — see the section header —
 * and bench closes the same evidence gap on the way past, since a bench session
 * had never been driven in a browser either.
 *
 * Taken from `LIFT_PROMPTS` rather than typed out, so a lift added to the
 * game's rotation without being added here is visible as a shorter run rather
 * than as a silent omission.
 */
const LADDER_KINDS = Object.freeze(Object.keys(LIFT_PROMPTS));

/**
 * HOW MANY OF THE GAME'S FIVE DESCENT/HOLE-ONLY LINES EACH LIFT MAY EVER SHOW.
 *
 * Derived from `LIFT_PROMPTS` rather than pinned as three literals, because
 * three literals would have to be re-derived by hand the moment a line moves —
 * and a stale expectation that still passes is what this whole file is about.
 * What the CHECK adds is that the derivation is compared against a real played
 * rep on a real screen: deadlift's entry is 0 BECAUSE it has no eccentric
 * copy, and the assertion is that a driven deadlift shows none of the other
 * two lifts' either.
 */
const ECCENTRIC_LINE_COUNT = Object.freeze(
  Object.fromEntries(
    Object.entries(LIFT_PROMPTS).map(([kind, ladder]) => [
      kind,
      [ladder.DESCENT, ladder.HOLE, ladder.COMMAND].filter((line) => line !== null).length,
    ]),
  ),
);

/**
 * `LIFT_COPY.MISS_REASON.dropped`, restated the way every other line in this
 * tool is. DEADLIFT'S OWN: `lift.ts` gives the lockout drop its own
 * `MissReason` precisely so a player is not handed "The bar beat you at the
 * sticking point" about a bar that was locked out a moment ago.
 */
const DEADLIFT_DROPPED_REASON = 'Put it down before the call.';

/**
 * The three verdicts a rep can end on, ordered worst to best.
 *
 * `SESSION_PROMPTS.OUTCOMES` is the same three strings as a flat list and says
 * nothing about which is better, which is right for a driver deciding whether a
 * rep is over. A CONTROL comparing two reps needs the order, and it needs it
 * written down once rather than inferred at a call site from a string
 * comparison that would happen to sort GOOD LIFT above GRINDER by accident.
 */
const OUTCOME_RANK = Object.freeze({ 'NO LIFT': 0, GRINDER: 1, 'GOOD LIFT': 2 });

/**
 * GRADE THE TWO PHOTOGRAPHS — with a predicate behind every number printed.
 *
 * CLAUDE.md's "measured, carried, displayed, never compared": three tools in
 * this repository shipped a quantity that reached a log line and never a
 * predicate. A screenshot is the most convincing form of that — a reader
 * supplies the comparison in their head — and this repository has already filed
 * a 7 KB flat dark rectangle beside a detailed record saying it was a bomb-out
 * screen.
 *
 * So three things are asserted rather than described:
 *
 *   - the DOM said the wanted line at the instant the shutter opened. Read
 *     immediately before AND after, both recorded; the assertion is on the
 *     before-read, which is the one that brackets the exposure's start.
 *   - neither frame is blank, measured as more than one distinct colour inside
 *     the prompt's own box rather than as a file size.
 *   - the two frames are NOT the same frame, measured as differing pixels
 *     inside that box. A shutter that fired twice on one beat would file two
 *     convincing PNGs and this is what catches it.
 */
/**
 * WHICH PROMPTS THE SCREEN MAY HAVE REACHED BY THE TIME EACH SHUTTER CLOSED.
 *
 * `after` was read, recorded and printed into both photograph checks and
 * asserted in neither — only `before` was — so a shutter that straddled a
 * transition would have shown it in the record and passed. That is CLAUDE.md's
 * "measured, carried, displayed, never compared", inside a check written to
 * avoid exactly it.
 *
 * The predicate is FORWARD-ONLY rather than equality, and that is the honest
 * shape: a `DOWN` frame lasts `DOWN_COMMAND_SETTLE_TICKS` (~333 ms) and a
 * `page.screenshot` on this machine takes a good fraction of that, so the
 * screen legitimately reaching the verdict during the exposure is not a defect.
 * What IS a defect is the screen having moved to a beat that belongs to a
 * DIFFERENT rep — a brace, an ascent line, or nothing at all — which is what
 * "the shutter photographed something else" looks like from here.
 */
const HOLD_SHOT_FORWARD = Object.freeze([
  LIFT_PROMPTS.deadlift.LOCKOUT,
  LIFT_PROMPTS.deadlift.DOWN,
  ...SESSION_PROMPTS.OUTCOMES,
]);
const DOWN_SHOT_FORWARD = Object.freeze([LIFT_PROMPTS.deadlift.DOWN, ...SESSION_PROMPTS.OUTCOMES]);
const shutterStayedForward = (after, allowed) => after !== null && allowed.includes(after);

async function gradeTheLockoutPhotographs(shots) {
  if (shots === null || shots.holdShot === undefined) {
    skip(
      'LADDER deadlift: the lockout hold and the down command, photographed',
      'no rep reached a lockout with the camera armed, so there was nothing to photograph — not substituted with a frame from anywhere else',
    );
    return;
  }
  const { holdShot, downShot } = shots;
  check(
    holdShot.before === holdShot.wanted && shutterStayedForward(holdShot.after, HOLD_SHOT_FORWARD),
    `LADDER deadlift: the shutter for ${path.basename(holdShot.path)} opened while ${JSON.stringify(holdShot.wanted)} was the live prompt, and the screen had not moved BACKWARD by the time it closed`,
    `before=${JSON.stringify(holdShot.before)} after=${JSON.stringify(holdShot.after)}; an \`after\` outside ${JSON.stringify(HOLD_SHOT_FORWARD)} means the exposure straddled into a different rep`,
  );
  if (downShot === undefined) {
    skip(
      'LADDER deadlift: the down command, photographed',
      'the down command never arrived on this rep, so no frame of it exists to photograph',
    );
    return;
  }
  check(
    downShot.before === downShot.wanted && shutterStayedForward(downShot.after, DOWN_SHOT_FORWARD),
    `LADDER deadlift: the shutter for ${path.basename(downShot.path)} opened while ${JSON.stringify(downShot.wanted)} was the live prompt, and the screen had not moved BACKWARD by the time it closed`,
    `before=${JSON.stringify(downShot.before)} after=${JSON.stringify(downShot.after)}; an \`after\` outside ${JSON.stringify(DOWN_SHOT_FORWARD)} means the exposure straddled into a different rep`,
  );

  // THE PIXELS. `promptBox` is read off the live page after the fact, which is
  // legitimate because the prompt element does not move between beats — only
  // its text does — and it is the region both frames must disagree inside.
  let pixels = null;
  try {
    const hold = decodePng(readFileSync(holdShot.path));
    const down = decodePng(readFileSync(downShot.path));
    const region = promptRegionIn(hold);
    pixels = {
      region,
      differing: diffPixels(hold, down, region).differing,
      total: region.w * region.h,
      holdColours: distinctColoursIn(hold, region),
      downColours: distinctColoursIn(down, region),
    };
  } catch (error) {
    pixels = { error: String(error).slice(0, 200) };
  }
  check(
    pixels.error === undefined && pixels.holdColours > 1 && pixels.downColours > 1,
    'LADDER deadlift: neither photograph is a blank rectangle — both have drawn pixels inside the prompt band',
    pixels.error !== undefined
      ? pixels.error
      : `${pixels.holdColours} distinct colour(s) in the hold frame, ${pixels.downColours} in the down frame, over ${pixels.total} px`,
  );
  check(
    pixels.error === undefined && pixels.differing > 0,
    'LADDER deadlift: the two photographs are two DIFFERENT frames — the prompt band disagrees between them, so the shutter did not fire twice on one beat',
    pixels.error !== undefined ? pixels.error : `${pixels.differing} of ${pixels.total} px differ inside ${JSON.stringify(pixels.region)}`,
  );
}

/**
 * The band of the screenshot the prompt is drawn in.
 *
 * A FIXED FRACTION OF THE FRAME, not the element's measured box, and that is
 * deliberate: the box would have to be read from the live page at the instant
 * of the shot, which is a third CDP round trip inside a 333 ms window, and a
 * box read afterwards can belong to a re-laid-out screen. The prompt sits in
 * `SetView`'s header, under the set label, the weight and the rep pips; this
 * band covers the top quarter of the stage and is checked to FIT the decoded
 * image rather than assumed to.
 */
function promptRegionIn(image) {
  const y = Math.round(image.height * LIFT_LADDER.PROMPT_BAND.TOP_FRACTION);
  const h = Math.round(image.height * LIFT_LADDER.PROMPT_BAND.HEIGHT_FRACTION);
  return { x: 0, y, w: image.width, h: Math.min(h, image.height - y) };
}

/** How many distinct RGBA values are drawn inside a region. Blank is 1. */
function distinctColoursIn(image, region) {
  const seen = new Set();
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      const i = (y * image.width + x) * 4;
      seen.add(
        (image.rgba[i] << 24) | (image.rgba[i + 1] << 16) | (image.rgba[i + 2] << 8) | image.rgba[i + 3],
      );
      if (seen.size > 64) return seen.size;
    }
  }
  return seen.size;
}

// ---------------------------------------------------------------------------
// Arm drivers
// ---------------------------------------------------------------------------

/** Wait for a work set's stage to be pressable again after a rest. */
async function waitForStage(page, testId) {
  const started = Date.now();
  for (;;) {
    const box = await page.getByTestId(testId).boundingBox().catch(() => null);
    if (box !== null) return { ok: true, ms: Date.now() - started };
    if (Date.now() - started >= PRESS_PROBE.STAGE_RETURN_MS) {
      return { ok: false, ms: Date.now() - started, state: await readLoop(page).catch(() => null) };
    }
    await page.waitForTimeout(PRESS_PROBE.POLL_MS);
  }
}

/**
 * THE MEET ARM'S RUNNING STATE.
 *
 * One object rather than closures, so the record can carry it: which attempts
 * this instrument gestured at, which lift each of those was on, and the depth
 * search `driveMeetToItsEnd` carried between the attempts it played properly.
 * A reader checking whether the four readings came off four different attempts
 * looks here rather than taking this file's word for it.
 */
const meetRun = {
  probedLabels: [],
  probesByLift: new Map(),
  searches: freshMeetSearches(),
  /** How `driveMeetToItsEnd` ended, each time it was asked to advance. */
  drives: [],
};

/**
 * The lift an attempt label names — `SQUAT · ATTEMPT 1 OF 3` -> `'squat'`.
 *
 * `meetDrive.mjs`'s, not a second parser of the same string. This file used to
 * split on `MEET_PROBE.LABEL_SEPARATOR` itself and return the printed WORD; the
 * driver now has to read the same field to decide which ladder to steer by, and
 * two parsers of one label is the sibling-drift this repository has paid for
 * four times. Downstream this changed the quota's grouping key from `'SQUAT'` to
 * `'squat'`, which is a key either way.
 */
const liftOf = liftFromAttemptLabel;

/**
 * `MEET_DRIVER_KNOWS_ONLY` USED TO BE HERE, AND IT IS DELETED BECAUSE THE LIMIT
 * IT NAMED IS CLOSED. Recorded rather than removed silently: a gap that turns
 * back into a check is the one kind of edit a reader should be able to find.
 *
 * ===========================================================================
 * WHAT IT SAID, AND WHAT IT WAS RIGHT ABOUT
 * ===========================================================================
 * `playOneMeetAttempt` waited on `SESSION_PROMPTS.BRACE` and
 * `SESSION_PROMPTS.DESCENT`, which are SQUAT'S lines. GDD §6.2 runs squat, then
 * bench, then deadlift, and since `9789da3` those two have their own copy and
 * their own phase paths — a bench attempt says 'TAP AND HOLD TO LOWER' and a
 * deadlift says 'TAP TO PULL' and has no DESCENT at all. So the meet driver
 * could hold squat's three attempts and nothing after them, and
 * `MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND` sends this instrument to bench
 * for its second reading. The arm reported PROBE 2's four pans as a NAMED
 * SKIPPED check rather than as a red, because the app was behaving correctly
 * throughout and a red saying "the meet is stuck" about a healthy meet is the
 * crying-wolf shape this file refuses elsewhere.
 *
 * ===========================================================================
 * WHAT CLOSED IT
 * ===========================================================================
 * `meetDrive.mjs` steers by `LIFT_PROMPTS[kind]` now, reading the kind off
 * `attempt-label` — bench's wait-then-press beat and the deadlift's lockout
 * hold, which is the meet-day half of what the LADDER section below does for
 * the daily session. It also cross-checks the label against the brace line the
 * mechanic actually draws, so an attempt whose phase model disagrees with the
 * meet's own label is a red rather than a timeout.
 *
 * So `reachAttempt` no longer refuses an attempt on the ground that it is not a
 * squat, `panBlockedByLift` is gone, and the four pans are real checks again.
 * A stage that still does not come back is a red with its own reason, as it
 * always was for every cause except this one.
 */

/**
 * May this instrument spend THIS attempt on a pan?
 *
 * One per lift until every lift the meet has offered has had one, then
 * anything. See `MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND` for why a greedier
 * rule bombs the meet out before the readings are taken.
 */
function meetProbeAllowed(label) {
  const lift = liftOf(label);
  if (lift === null) return false;
  if (meetRun.probedLabels.includes(label)) return false;
  const already = meetRun.probesByLift.get(lift) ?? 0;
  if (already < MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND) return true;
  // Every lift probed once already? Then a second on any of them is free — by
  // that point the readings this instrument still needs are the last ones.
  const lifts = [...meetRun.probesByLift.keys()];
  return lifts.length >= MEET_LIFT_ORDER.length;
}

/** Record that an attempt was spent, so the next one is a different attempt. */
function meetProbeTaken(label) {
  if (label === null || meetRun.probedLabels.includes(label)) return;
  meetRun.probedLabels.push(label);
  const lift = liftOf(label);
  if (lift !== null) meetRun.probesByLift.set(lift, (meetRun.probesByLift.get(lift) ?? 0) + 1);
}

/**
 * Get to an attempt screen, braced, that this instrument has not already
 * gestured at — playing whatever is in between properly.
 *
 * `driveMeetToItsEnd` is the shared driver and it is NOT reimplemented here: it
 * presses the weigh-in, takes the suggested openers, sits through walk-outs and
 * verdicts and answers GDD §6.3's choice cards. All this adds is a `shouldStop`
 * that hands control back at an attempt worth spending.
 */
async function reachAttempt(page) {
  const whys = [];
  // RETRIED, BECAUSE THE APP LEGITIMATELY MOVES UNDER THE INSTRUMENT.
  // `LIFT_TUNING.BRACE_TIMEOUT_TICKS` starts the descent by itself after ten
  // seconds of nothing, so an attempt this tool was holding can begin and
  // resolve on its own clock while a reading is being taken. That is the
  // mechanic behaving as designed; asking once and giving up would report it as
  // the meet being stuck.
  for (let attemptNumber = 0; attemptNumber < MEET_PROBE.REACH_RETRIES; attemptNumber += 1) {
    // AN ATTEMPT THIS TOOL HAS ALREADY SPENT MUST BE OFF THE SCREEN BEFORE THE
    // DRIVER IS ASKED FOR ANOTHER, AND THAT IS NOT POLITENESS.
    //
    // `driveMeetToItsEnd` reads the beat at the top of its loop and then hands
    // the screen to `playOneMeetAttempt`. Handed a spent attempt in its last
    // frames, that call finds no brace, reports `played: false`, and the driver
    // returns `'stuck'` — the app correct, the meet fine, and the instrument
    // reporting a failure it caused by asking one frame early. Measured twice on
    // this arm before it was written down.
    let now = await readMeetLoop(page);
    if (now.attempt && now.attemptLabel !== null && meetRun.probedLabels.includes(now.attemptLabel)) {
      await settleAfterGesture(page, { id: 'meet' }, now.attemptLabel);
      now = await readMeetLoop(page);
    }
    const alreadyHere =
      now.attempt && now.attemptLabel !== null && !meetRun.probedLabels.includes(now.attemptLabel);
    if (!alreadyHere) {
      const drive = await driveMeetToItsEnd(page, {
        searches: meetRun.searches,
        recapSettleMs: MEET_PROBE.RECAP_SETTLE_MS,
        shouldStop: (state) => state.attempt && meetProbeAllowed(state.attemptLabel),
      });
      meetRun.searches = drive.searches ?? meetRun.searches;
      meetRun.drives.push({ ended: drive.ended, why: drive.why, attempts: drive.attempts.length });
      if (drive.ended !== 'stopped') {
        return {
          ok: false,
          why: `the meet ended '${drive.ended}' before another attempt could be probed — ${drive.why}${whys.length === 0 ? '' : ` (after ${whys.join('; ')})`}`,
        };
      }
    }
    // The rep is pressable at the BRACE, not the instant the screen mounts —
    // AND THE BRACE LINE IS THE LIFT'S, NOT SQUAT'S. This used to wait on
    // `SESSION_PROMPTS.BRACE`, which is squat's 'TAP AND HOLD TO DESCEND'; a
    // bench attempt says 'TAP AND HOLD TO LOWER' and a deadlift 'TAP TO PULL',
    // so on either of those this waited out `BRACE_TIMEOUT_MS` against a line
    // that would never render. `liftFromAttemptLabel` reads which lift the meet
    // says is on the platform and `LIFT_PROMPTS` gives that lift's own line.
    const onScreen = await readMeetLoop(page);
    const kindOnScreen = liftFromAttemptLabel(onScreen.attemptLabel);
    const braceLine = kindOnScreen === null ? SESSION_PROMPTS.BRACE : LIFT_PROMPTS[kindOnScreen].BRACE;
    const braced = await untilMeet(
      page,
      (state) => meetSaying(state, braceLine) || !state.attempt,
      MEET_DRIVE.BRACE_TIMEOUT_MS,
    );
    if (!meetSaying(braced.state, braceLine)) {
      whys.push(
        `try ${attemptNumber + 1}: the attempt never braced on ${JSON.stringify(braceLine)}` +
          ` (${kindOnScreen ?? 'lift unread'}) — prompt was ${JSON.stringify(braced.state.prompt)}`,
      );
      continue;
    }
    const box = await page.getByTestId('attempt-touch').boundingBox().catch(() => null);
    if (box === null) {
      whys.push(`try ${attemptNumber + 1}: the braced attempt has no touch stage`);
      continue;
    }
    // COUNTED HERE AND NOT AT THE GESTURE. From the moment this returns, the
    // instrument owns the attempt and it will be spent one way or the other —
    // by a gesture, or by the brace timing out while a reading is taken. Both
    // are misses on the same lift, and the quota above has to see both or it is
    // counting half of what it is protecting against.
    meetProbeTaken(braced.state.attemptLabel);
    return { ok: true, label: braced.state.attemptLabel };
  }
  return { ok: false, why: `no attempt braced in ${MEET_PROBE.REACH_RETRIES} tries — ${whys.join('; ')}` };
}

/**
 * THE MEET ARM'S BOOKKEEPING — CHECKED WHEN THE PANS WERE TAKEN, NAMED WHEN
 * THEY WERE NOT.
 *
 * ===========================================================================
 * WHY THIS IS A FUNCTION BOTH PATHS CALL
 * ===========================================================================
 * This block used to sit below a `continue` that a blocked arm took, so on the
 * one kind of run where these gaps matter most they were not reported at all.
 * Measured by set-differencing this record's `what` strings against
 * `8ef61c9`'s: four entries that existed at base were absent, with no name
 * anywhere. `blockedBy` is the whole difference between the two paths now, and
 * it is a string (the reason) or null.
 *
 * WHAT STAYS A REAL CHECK ON A BLOCKED RUN, and it is not none of it: the
 * driver-played count reads `meetRun.drives`, which a blocked run still fills
 * (measured `0, 2, 0, 0` — two attempts really were played), and the quota's
 * ORDERING half reads `meetRun.probedLabels`, which is whatever the instrument
 * held before it stopped. Only the COMPLETENESS half — that every lift was
 * reached — is unmeasurable on a run that never reached them, and only that
 * half is skipped.
 */
function gradeMeetBookkeeping(arm, { panPlan, panSurfaces, blockedBy }) {
  if (arm.id !== 'meet') return;
  const panPlanLength = panPlan.length;

  // ---- 1. FOUR PANS ON FOUR DIFFERENT ATTEMPTS ---------------------------
  // A pan that silently re-used a screen would report the same cancel count
  // under two names, which is the strongest-looking and emptiest thing this
  // arm could do.
  const spent = panPlan.map((step) => panSurfaces[step.name]);
  const spentReal = spent.filter((label) => label !== undefined);
  const whatDistinct = `ARM ${arm.id}: the ${panPlanLength} pans were spent on ${panPlanLength} DIFFERENT attempts, so no reading is a copy of another`;
  if (blockedBy === null) {
    check(
      new Set(spent).size === panPlanLength,
      whatDistinct,
      `${new Set(spent).size} distinct of ${spent.length}: ${spent.join(' | ')}`,
    );
  } else {
    skip(
      whatDistinct,
      `only ${spentReal.length} of ${panPlanLength} pans were spent, so there is no set of four to be distinct — ${blockedBy}. NOT re-pinned at the smaller number: a set-size check over a shorter list is a different claim wearing the same sentence`,
    );
  }

  // ---- 2. THE QUOTA, IN ITS TWO HALVES -----------------------------------
  // `MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND` claims a rule: no lift takes a
  // second instrument gesture until every lift has taken one. That is the whole
  // reason the readings survive to be taken, and a rule with nothing behind it
  // is the shape this repository keeps finding in prose.
  const seenLifts = new Set();
  const heldPerLift = new Map();
  const tooEarly = [];
  for (const label of meetRun.probedLabels) {
    const lift = liftOf(label);
    seenLifts.add(lift);
    const held = (heldPerLift.get(lift) ?? 0) + 1;
    heldPerLift.set(lift, held);
    if (held > MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND && seenLifts.size < MEET_LIFT_ORDER.length) {
      tooEarly.push(`${label} was this instrument's ${held}${'th'} on ${lift} while only ${seenLifts.size} lift(s) had been touched`);
    }
  }
  const heldInOrder = `held in order: ${meetRun.probedLabels.join(' | ')}; per lift ${[...meetRun.probesByLift.entries()].map(([lift, n]) => `${lift}x${n}`).join(', ')}`;
  const whatQuota = `ARM ${arm.id}: no lift took a second gesture from this instrument until all ${MEET_LIFT_ORDER.length} lifts had taken one`;
  if (blockedBy === null) {
    check(
      tooEarly.length === 0 && seenLifts.size === MEET_LIFT_ORDER.length,
      whatQuota,
      heldInOrder + (tooEarly.length === 0 ? '' : `; VIOLATIONS: ${tooEarly.join('; ')}`),
    );
  } else {
    skip(
      whatQuota,
      `the instrument held ${meetRun.probedLabels.length} attempt(s) on ${[...seenLifts].join('/') || 'nothing'} before it stopped, so the half of this rule that says every lift was REACHED cannot be measured on this run — ${blockedBy}. The ordering half is checked separately below rather than folded in, because folding them left the rule the skip above cites as its own cause with nothing asserting it`,
    );
    // THE ORDERING HALF, WHICH IS MEASURABLE ON WHAT WAS HELD — and which is
    // reported as an EMPTY DOMAIN rather than a pass when there is not enough
    // to bite on. The rule cannot fire below two held attempts: the violation
    // test is `held > 1`, so one label can never produce one.
    const enoughToBite = meetRun.probedLabels.length >= MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND + 1;
    const whatOrdering = `ARM ${arm.id}: the ordering half of that quota held over the attempts this instrument DID hold`;
    if (enoughToBite) {
      check(
        tooEarly.length === 0,
        whatOrdering,
        heldInOrder + (tooEarly.length === 0 ? '' : `; VIOLATIONS: ${tooEarly.join('; ')}`),
      );
    } else {
      skip(
        whatOrdering,
        `${meetRun.probedLabels.length} attempt(s) held, and a second gesture on one lift is what this rule forbids — below ${MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND + 1} held there is no pair for it to be about. An empty domain, reported rather than passed`,
      );
    }
  }

  // ---- 3. THE DRIVER REALLY PLAYED THE ONES IN BETWEEN --------------------
  // Checked on BOTH paths: `meetRun.drives` is filled by `driveMeetToItsEnd`
  // whether or not a pan was ever spent, so "the meet was driven" is not four
  // gestures and nothing else. A count, not a bound.
  const drivenAttempts = meetRun.drives.reduce((total, drive) => total + drive.attempts, 0);
  check(
    drivenAttempts > 0,
    `ARM ${arm.id}: the shared driver played the attempts this instrument did not`,
    `${drivenAttempts} attempt(s) played by driveMeetToItsEnd against ${meetRun.probedLabels.length} held here; drives: ${JSON.stringify(meetRun.drives)}`,
  );
}

/**
 * PROBE 1's OTHER READING, WHICH IS NOT A CHECK, WITH ITS EVIDENCE.
 *
 * CLAUDE.md asks for a NAMED SKIPPED check rather than a quiet fallback that
 * leaves the section looking complete. The stage's "no selection" reading is
 * TRUE and is NOT EVIDENCE, and this is where that is said on every run —
 * INCLUDING a run whose arm was blocked, which is the case the `continue` used
 * to swallow. At `ba1931c` this gap was named on the meet arm; for one commit
 * on this branch it was simply absent, which is a worse artifact than the red
 * it replaced.
 */
function reportStageSelectionGap(arm, { readings, target, neutralised, blockedBy }) {
  const stageNeutralised = readings['stage-neutralised-drift'];
  const what = `ARM ${arm.id}: PROBE 1 on ${arm.touchTestId} itself — a press-and-hold on the STAGE leaves no selection`;
  if (stageNeutralised !== undefined) {
    skip(
      what,
      `DOMAIN DEAD, re-measured this run rather than cited: with user-select forced to ${JSON.stringify(stageNeutralised.forcedTo?.userSelect)} on the stage, the same gesture that selects ${JSON.stringify(neutralised.selection?.text)} on ${arm.textTestId} selects ${JSON.stringify(stageNeutralised.selection?.text)} here (rangeCount=${stageNeutralised.selection?.rangeCount}). caretRangeFromPoint at the probe point is ${JSON.stringify(target.caretAtCentre)}: the node under the finger is a Skia <canvas> with no text position in it, and Blink will not start a selection inside a replaced element. No value of the fix makes this red, so it is not counted either way.`,
    );
    return;
  }
  const why =
    arm.id === 'meet'
      ? `NOT TAKEN ON THIS ARM. A press-and-hold on the stage spends a meet attempt, GDD §6.2 has nine, and PROBE 1's screen plus the four pans plus the four the driver needs to keep a lift off three misses is all nine.`
      : `NOT TAKEN THIS RUN — the gesture plan did not reach it${blockedBy === null ? '' : `: ${blockedBy}`}.`;
  skip(
    what,
    `${why} What it measures is a fact about Blink and about \`LiftStage\`, which every arm mounts identically, and it is measured on whichever arms in this same run did reach it. caretRangeFromPoint at this arm's probe point still reads ${JSON.stringify(target.caretAtCentre)}, which is the same CANVAS node with no text position in it.`,
  );
}

/**
 * `reportUnrunGestureChecks` USED TO BE HERE. It turned a blocked meet arm's
 * eight PROBE 2 lines into eight NAMED skipped checks, deriving each name from
 * the sibling arm that did run so a transcription could not go stale.
 *
 * DELETED WITH ITS ONE CALLER. That caller was the `panBlockedByLift` branch,
 * and the only thing that ever set `panBlockedByLift` was the meet reaching a
 * lift `meetDrive.mjs` had no grammar for — which is closed (see the block
 * where `MEET_DRIVER_KNOWS_ONLY` used to be). A sixty-line mechanism no state
 * of the subject can reach reads as coverage and is not, which is the shape
 * CLAUDE.md files under "delete it and record the domination". Its history is
 * in git if a genuinely unreachable arm ever needs it again.
 */
async function openArm(page, arm) {
  if (arm.id === 'debug') {
    await page.goto(`${url}/?${PRESS_PROBE.DEBUG_REPLAY}`, { waitUntil: 'load', timeout: PRESS_PROBE.BOOT_MS });
    await page.getByTestId(arm.touchTestId).waitFor({ state: 'visible', timeout: PRESS_PROBE.BOOT_MS });
    await page.waitForTimeout(PRESS_PROBE.DEBUG_SETTLE_MS);
    return { reached: true };
  }

  if (arm.id === 'meet') {
    // THE PLAYED PATH TO MEET DAY. No query string at any point: a fresh load,
    // then the shell's own pill, then the meet's own controls. `?meet=` frames
    // are a DIFFERENT ARM of `frozenMeetFor` — `route.source === 'debug'` — so a
    // meet opened that way is literally not this code.
    await page.goto(url, { waitUntil: 'load', timeout: PRESS_PROBE.BOOT_MS });
    await page.getByTestId(MEET_PROBE.CHECK_IN).waitFor({ state: 'visible', timeout: PRESS_PROBE.BOOT_MS }).catch(() => {});
    const entry = await enterMeetFromCalendar(page, { stepMs: MEET_PROBE.PILL_MS });
    if (!entry.entered) {
      return { reached: false, why: `the way into meet day refused — ${entry.why}` };
    }
    const opened = await untilMeet(page, (state) => state.weighIn || state.attempt, MEET_PROBE.MEET_MS);
    if (!opened.ok) return { reached: false, why: 'pressing the pill never produced a meet' };
    const attempt = await reachAttempt(page);
    if (!attempt.ok) return { reached: false, why: attempt.why };
    return { reached: true, firstAttempt: attempt.label };
  }

  // THE PLAYED PATH TO A SET. `openSessionToFirstSet` launches with NO query
  // string and plays GDD §3.2's opening beats with a mouse — three readiness
  // answers and an RPE — which is the only way to a work set. No `?session=`
  // frame: those set `preview`, and a previewed set is not a set a player
  // pressed.
  //
  // MID-LADDER DEFAULT, UNCHANGED — this arm's own PROBE 1/2 checks below
  // (selection, touch-action, four real pans) do not care which RPE governs
  // the day, and every one of `SESSION_TUNING.WORK_SETS` (5) sets they can
  // consume comes out of the SAME budget `probeFullRepCycle`'s retry loop
  // needs. `probeFullRepCycle` opens its OWN fresh session at
  // RPE_CHOICE_HEAVY instead of sharing this one — see its header for why.
  //
  // AND IT ASKS FOR SQUAT BY NAME, which is a fix rather than a preference.
  // The default this used to take is `liftForDay(...)` — the rotation indexed
  // by the REAL CALENDAR — while every rep this arm drives is squat-shaped, so
  // this arm worked one day in three and reported a wall of timeouts on the
  // other two. `check-in-lift-squat` is a chip on the check-in's first paint,
  // one tap, a player control; asking for it costs nothing and makes the arm
  // day-independent. See `openSessionToFirstSet`'s `lift` parameter.
  const opened = await openSessionToFirstSet(page, url, undefined, undefined, 'squat');
  if (!opened.reached) return { reached: false, why: opened.why ?? 'the session never reached a work set' };
  const back = await waitForStage(page, arm.touchTestId);
  if (!back.ok) return { reached: false, why: `no ${arm.touchTestId} on the first work set` };
  return { reached: true, firstPrompt: opened.state?.prompt ?? null };
}

/**
 * Get the arm back to a pressable stage after a gesture consumed one.
 *
 * The session arm waits: three reps end a set and a rest screen replaces the
 * stage, and the stage comes back on its own. The meet arm has to be DRIVEN —
 * the attempt is gone for good, and the next one is on the far side of a
 * verdict, a choice and a walk-out.
 */
async function regainStage(page, arm) {
  if (arm.id !== 'meet') return waitForStage(page, arm.touchTestId);
  const attempt = await reachAttempt(page);
  return { ok: attempt.ok, why: attempt.why, label: attempt.label };
}

/**
 * Wait until a gesture that spends an attempt has actually spent it.
 *
 * A touch on the attempt screen resolves the rep a frame or two after the
 * release, so asking the shared driver to advance immediately hands it a screen
 * that is about to stop existing. See the call site for the run that cost.
 *
 * Nothing to do on the other arms: the session stage is still there after a rep,
 * and the debug arm's replay frame never moves at all.
 */
async function settleAfterGesture(page, arm, label) {
  if (arm.id !== 'meet') return;
  await untilMeet(
    page,
    (state) => !state.attempt || (label !== null && state.attemptLabel !== label),
    MEET_DRIVE.BEAT_TIMEOUT_MS,
  );
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { ...PRESS_PROBE.VIEWPORT },
  deviceScaleFactor: PRESS_PROBE.DEVICE_SCALE,
  // A phone-shaped context. The reported defect is a MOBILE browser's gesture,
  // so the page is served the same primitives a phone gets.
  hasTouch: true,
  isMobile: true,
});
// Sprint 2: the server persists a lifter across boots. Every goto in this tool
// means a FRESH one, so the boundary is armed rather than assumed.
await armFreshLifterPerBoot(context);
// The page-side frame recorder the LADDER section reads. Installed on the
// CONTEXT rather than per navigation, so it is running before the app's own
// code on every goto — a recorder attached after the set is on screen would
// already have missed the brace.
await installLadderRecorder(context);
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));

const armsToRun = ARMS.filter((a) => armsWanted === 'all' || armsWanted === a.id);
const results = [];

// ---------------------------------------------------------------------------
// WHAT THIS RUN COVERS, WRITTEN INTO THE RECORD AND SAID OUT LOUD
// ---------------------------------------------------------------------------
/**
 * ===========================================================================
 * A PARTIAL RECORD MUST SAY IT IS PARTIAL, AND THIS ONE COULD NOT
 * ===========================================================================
 * `--arms` predates this section and the section roughly tripled what it can
 * silently omit. Demonstrated rather than described: an `--arms ladder` run
 * writes `press.json` with the identical top-level key set, a valid
 * `capturedFrom` (right commit, clean tree, matching instrument hashes),
 * `arms: []`, and 34 checks — with nothing anywhere saying it is a third of a
 * run. Pointed at the tracked path it overwrites 108 checks with 34, and
 * `tools/evidence.mjs --verify` calls the result FRESH and green, because
 * freshness asks "did code change" and not "does this record cover what its
 * name implies".
 *
 * Two things close it, and the second is the one that bites:
 *
 *   - `capturedFrom.coverage` records the `--arms` value, which sections ran,
 *     and a `complete` flag, so a reader (or a scan) can tell without counting
 *     checks.
 *   - every section that did NOT run emits a NAMED SKIPPED check. That is the
 *     mechanism this file already uses for everything else it cannot say, and
 *     it means a partial record carries its own gaps in the same array a
 *     reviewer already reads — rather than in a field they would have to know
 *     to look for.
 */
const LADDER_REQUESTED = armsWanted === 'all' || armsWanted === 'ladder';
const CROSS_ARM_REQUESTED = armsWanted === 'all';
const COVERAGE = Object.freeze({
  argument: armsWanted,
  pressArmsRequested: armsToRun.map((a) => a.id),
  pressArmsSkipped: ARMS.filter((a) => !armsToRun.includes(a)).map((a) => a.id),
  ladder: LADDER_REQUESTED,
  crossArm: CROSS_ARM_REQUESTED,
  complete: armsWanted === 'all',
});
if (!COVERAGE.complete) {
  console.log(
    `\n!! PARTIAL RUN: --arms ${armsWanted}. This record does NOT cover the whole tool. See capturedFrom.coverage and the named skips below.`,
  );
  for (const missing of COVERAGE.pressArmsSkipped) {
    skip(
      `ARM ${missing}: every check on this arm`,
      `not run — this invocation was --arms ${armsWanted}, so this record covers a SUBSET of the tool. Nothing is substituted for these readings and no other arm's numbers stand in for them`,
    );
  }
  if (!LADDER_REQUESTED) {
    skip(
      'LADDER: every check on all three lifts',
      `not run — this invocation was --arms ${armsWanted}`,
    );
  }
  if (!CROSS_ARM_REQUESTED) {
    skip(
      'CROSS-ARM: every comparison between the arms',
      `not run — this invocation was --arms ${armsWanted}, and a comparison needs every arm to have produced a reading`,
    );
  }
}
capturedFrom.coverage = COVERAGE;

for (const arm of armsToRun) {
  console.log(`\n=== ARM: ${arm.id} — ${arm.what} ===`);
  const opened = await openArm(page, arm);
  if (!opened.reached) {
    check(false, `ARM ${arm.id}: the lift surface was reached`, opened.why);
    results.push({ arm: arm.id, reached: false, why: opened.why });
    continue;
  }
  check(true, `ARM ${arm.id}: the lift surface was reached`, `${arm.touchTestId} is on screen`);

  // THE ADDRESS BAR, AT THE MOMENT THE SCREEN IS READ. CLAUDE.md asks for this
  // by name so a played arm cannot fall back to the debug URL and leave the
  // section looking complete.
  const search = await queryString(page);
  check(
    search === arm.expectQueryString,
    `ARM ${arm.id}: the address bar carries ${arm.expectQueryString === '' ? 'NO query string' : arm.expectQueryString}`,
    JSON.stringify(search),
  );

  // -------------------------------------------------------------------------
  // 1. COMPUTED STYLE, off the live elements — EACH PROPERTY ON THE ELEMENT IT
  //    IS ABOUT
  // -------------------------------------------------------------------------
  const target = await readTarget(page, arm.touchTestId);
  const text = await readTarget(page, arm.textTestId);
  check(target !== null, `ARM ${arm.id}: ${arm.touchTestId} is in the DOM`, target === null ? 'absent' : target.tag);
  check(
    text !== null,
    `ARM ${arm.id}: the copy beside the stage, ${arm.textTestId}, is in the DOM`,
    text === null ? 'absent' : `${text.tag} "${text.textInside}"`,
  );
  if (target === null || text === null) {
    results.push({ arm: arm.id, reached: true, target, text });
    continue;
  }

  console.log(`  computed on ${arm.touchTestId}: ${JSON.stringify(target.self)}`);
  console.log(`  under the finger (${target.hitTarget?.tag}): ${JSON.stringify(target.hitTarget)}`);
  console.log(`  computed on ${arm.textTestId}: ${JSON.stringify(text.self)}`);
  console.log(`  caretRangeFromPoint at the probe point: ${JSON.stringify(target.caretAtCentre)}`);

  const readOf = { target, text };
  for (const prop of PRESS_PROPERTIES) {
    const where = prop.on === 'target' ? arm.touchTestId : arm.textTestId;
    if (prop.key === CALLOUT_UNSUPPORTED) {
      skip(
        `ARM ${arm.id}: ${prop.cssName} on ${where} — without it ${prop.leaves}`,
        `Blink does not implement ${prop.cssName}; getComputedStyle returns ${JSON.stringify(readOf[prop.on].self.webkitTouchCallout)} on an element that declares it, so no reading here would be about the app. The declaration stays covered by the source scan in src/lift/liftInput.test.ts.`,
      );
      continue;
    }
    const seen = readOf[prop.on].self[prop.key];
    check(
      seen === prop.expected,
      `ARM ${arm.id}: ${where} computes ${prop.cssName}: ${prop.expected} — without it ${prop.leaves}`,
      `read ${JSON.stringify(seen)}, wanted ${JSON.stringify(prop.expected)}`,
    );
  }

  // The element the finger actually lands on. `user-select` inherits, so the
  // canvas inside the stage carries the root's value down.
  check(
    target.hitTarget !== null && target.hitTarget.userSelect === 'none',
    `ARM ${arm.id}: the element UNDER the finger inherits user-select: none`,
    `${target.hitTarget?.tag} reads ${JSON.stringify(target.hitTarget?.userSelect)}`,
  );

  // AND THE PROPERTY THAT DOES NOT INHERIT, ASSERTED AS NOT INHERITING.
  //
  // This is the check that would have caught the shipped placement error from
  // the other side: `touch-action` on the ROOT and not on the stage reads as
  // fixed if you only look at the root. The stage's own value is what the
  // browser resolves the gesture from, and the canvas below it is `auto` —
  // reported rather than asserted, because it is the ancestor chain that decides
  // and this line is here so a reader can see the chain rather than infer it.
  check(
    target.self.touchAction === 'none',
    `ARM ${arm.id}: ${arm.touchTestId} — the PRESSED element itself computes touch-action: none, which is the only place it counts`,
    `${arm.touchTestId} reads ${JSON.stringify(target.self.touchAction)}; the canvas under it reads ${JSON.stringify(target.hitTarget?.touchAction)}, and the browser resolves the gesture up that chain`,
  );

  // NON-VACUITY ON THE SELECTION READS, AS A COUNT RATHER THAN A BOUND. The
  // stage must NOT be the element the selection probe is about, or "the text is
  // protected" is being read off the canvas where nothing could have selected.
  // Counted as the number of DISTINCT elements the readings come off.
  const probeElements = new Set([arm.touchTestId, arm.textTestId]);
  check(
    probeElements.size === 2 && target.box.width > 0 && text.box.width > 0,
    `ARM ${arm.id}: the pressed element and the copy are 2 different drawn elements`,
    `${arm.touchTestId} ${JSON.stringify(target.box)} vs ${arm.textTestId} ${JSON.stringify(text.box)}`,
  );

  // -------------------------------------------------------------------------
  // PROBE 3 — the context-menu guard, on both elements the CSS guard covers
  // -------------------------------------------------------------------------
  // Taken HERE, before PROBE 1/2 spend any gesture, because a synthetic
  // `contextmenu` event costs nothing (it never touches
  // `onPressIn`/`onPressOut`) but the ELEMENT it is dispatched on has to still
  // be on screen — and on the meet arm, PROBE 2's last pan spends the meet's
  // final attempt and ends it. Measured: taken after PROBE 2 instead, this
  // read `attempt-touch` and `attempt-prompt` as gone (`{"reached":false}`)
  // because the meet had already moved to its recap. That is an ordering bug
  // in this instrument, not a finding about the app, and the fix is ordering,
  // not a workaround.
  const contextMenu = {
    touch: await probeContextMenu(page, arm.touchTestId),
    text: await probeContextMenu(page, arm.textTestId),
  };
  console.log(
    `  contextmenu ${arm.touchTestId}=${JSON.stringify(contextMenu.touch)}  ${arm.textTestId}=${JSON.stringify(contextMenu.text)}`,
  );
  check(
    contextMenu.touch.reached && contextMenu.touch.defaultPrevented === true,
    `ARM ${arm.id}: PROBE 3 — a dispatched contextmenu event on ${arm.touchTestId} is defaultPrevented`,
    JSON.stringify(contextMenu.touch),
  );
  check(
    contextMenu.text.reached && contextMenu.text.defaultPrevented === true,
    `ARM ${arm.id}: PROBE 3 — a dispatched contextmenu event on ${arm.textTestId} is defaultPrevented (via bubbling to the screen root)`,
    JSON.stringify(contextMenu.text),
  );

  // -------------------------------------------------------------------------
  // 2. PROBE 1 — SELECTION, and its own domain
  // -------------------------------------------------------------------------
  // EVERY READING HERE IS ON THE COPY, AND THAT COSTS NOTHING. The prompt is
  // not the `Pressable`, so a press-and-drift on it starts no rep and — on the
  // meet arm — spends no attempt. All four come off one screen, in order, with
  // the stage untouched.
  //
  // THE STAGE IS STILL READ, as the SKIPPED check below, because its dead domain
  // is the evidence for why this probe's subject moved.
  const readings = {};
  readings['as-shipped-drift'] = await probeSelection(page, arm.textTestId, 'as-shipped-drift', true);
  readings['as-shipped-still'] = await probeSelection(page, arm.textTestId, 'as-shipped-still', false);

  const forcedOff = await forceProperties(page, arm.textTestId, 'off');
  readings['neutralised-drift'] = await probeSelection(page, arm.textTestId, 'neutralised-drift', true);
  readings['neutralised-drift'].forcedTo = forcedOff;
  readings['neutralised-still'] = await probeSelection(page, arm.textTestId, 'neutralised-still', false);
  readings['neutralised-still'].forcedTo = forcedOff;

  const restoredTo = await forceProperties(page, arm.textTestId, null);
  readings['restored-drift'] = await probeSelection(page, arm.textTestId, 'restored-drift', true);
  readings['restored-drift'].restoredTo = restoredTo;

  const readingNames = Object.keys(readings);
  for (const name of readingNames) {
    const r = readings[name];
    console.log(`  ${name.padEnd(18)} on ${String(r.testId).padEnd(15)} -> ${r.reached ? JSON.stringify(r.selection) : `NOT REACHED: ${r.why}`}`);
  }

  const cleared = readingNames.filter((n) => readings[n].clearedBefore === true).length;
  check(
    cleared === readingNames.length,
    `ARM ${arm.id}: all ${readingNames.length} selection readings started from an empty selection`,
    `${cleared} of ${readingNames.length}`,
  );

  // ---- THE POSITIVE CONTROL ON THE GESTURE -------------------------------
  // The SAME element with the fix neutralised. If this is not red-capable,
  // nothing that reads a selection is evidence — and this is a tighter control
  // than the second element it replaces, because it holds everything but the
  // one property constant.
  const neutralised = readings['neutralised-drift'];
  check(
    neutralised.selected === true,
    `ARM ${arm.id}: CONTROL — with user-select forced back to text on ${arm.textTestId}, the same press-hold-and-drift DOES select`,
    `rangeCount=${neutralised.selection?.rangeCount} collapsed=${neutralised.selection?.isCollapsed} text=${JSON.stringify(neutralised.selection?.text)} (forced to ${JSON.stringify(neutralised.forcedTo?.userSelect)})`,
  );

  // ---- THE LIMIT THAT DECIDES WHY THERE ARE TWO GESTURES ------------------
  // Asserted rather than described, so it cannot silently stop being true and
  // leave the header explaining a limitation that has gone away. Taken on the
  // NEUTRALISED element: a still press selecting nothing on a protected element
  // would say nothing, and this needs to be a statement about the gesture.
  const still = readings['neutralised-still'];
  check(
    still.selected === false,
    `ARM ${arm.id}: LIMIT — a STILL press-and-hold selects nothing even with the fix neutralised, so still-press readings are not evidence`,
    `rangeCount=${still.selection?.rangeCount} collapsed=${still.selection?.isCollapsed} text=${JSON.stringify(still.selection?.text)}`,
  );

  // ---- THE CLAIM, WHICH MAY ONLY PASS IF IT COULD HAVE FAILED -------------
  // CLAUDE.md: "a pointer to a test that cannot fail is the same defect one
  // level out." So the claim's `ok` carries its own domain: no selection AND a
  // demonstration that neutralising the fix on THIS element produces one.
  const shipped = readings['as-shipped-drift'];
  const domainLive = neutralised.selected === true;
  const noSelection = shipped.selected === false;
  check(
    noSelection && domainLive,
    `ARM ${arm.id}: PROBE 1 — a press-and-hold-and-drift on ${arm.textTestId} leaves NO selection, AND that could have gone the other way`,
    `as-shipped rangeCount=${shipped.selection?.rangeCount} collapsed=${shipped.selection?.isCollapsed} text=${JSON.stringify(shipped.selection?.text)}; ` +
      (domainLive
        ? `DOMAIN LIVE — neutralised rangeCount=${neutralised.selection?.rangeCount} text=${JSON.stringify(neutralised.selection?.text)}`
        : `DOMAIN DEAD — with user-select forced to ${JSON.stringify(neutralised.forcedTo?.userSelect)} the same gesture still selects nothing, so no value of the fix makes this red`),
  );

  // ---- THE EXPERIMENT DID NOT CONTAMINATE ITS SUBJECT ---------------------
  const rd = readings['restored-drift'];
  check(
    rd.selected === shipped.selected && rd.selection?.rangeCount === shipped.selection?.rangeCount,
    `ARM ${arm.id}: restoring the fix reproduces the as-shipped reading`,
    `restored rangeCount=${rd.selection?.rangeCount} vs as-shipped ${shipped.selection?.rangeCount}; computed back to ${JSON.stringify(rd.restoredTo)}`,
  );

  // -------------------------------------------------------------------------
  // 3. PROBE 2 — the browser taking the gesture, which is the LIVE one
  // -------------------------------------------------------------------------
  //
  // EVERY GESTURE BELOW LANDS ON THE STAGE, AND ON THE MEET ARM THAT SPENDS AN
  // ATTEMPT — a touch on the attempt screen IS the rep. So the five are declared
  // as one table with one accounting rather than five copy-pasted blocks, and
  // `panSurfaces` records which attempt each one was spent on.
  //
  // The last entry is not a pan. It is PROBE 1's reading of the STAGE, which is
  // the evidence for why PROBE 1's subject is the prompt — and it is a mouse
  // press-and-hold on the stage, so it costs a gesture exactly as a pan does.
  //
  // IT IS NOT RUN ON THE MEET ARM, AND THE ARITHMETIC IS WHY. GDD §6.2 gives a
  // meet nine attempts. PROBE 1's screen costs one, the four pans cost four, and
  // the driver needs the other four to keep any lift off three misses. A tenth
  // does not exist. The reading is a SKIPPED line on every arm rather than a
  // check, and what it measures — that Blink starts no selection inside a
  // `<canvas>` — is a fact about the engine and the `LiftStage` component, which
  // all three arms mount identically. So it is taken where it is free and named
  // as not taken where it is not, rather than quietly costing the meet arm a
  // control.
  //
  // `expectTouchAction` is what the pan is SUPPOSED to run at — `'shipped'`
  // meaning whatever the app declares, which is the thing under test. It is
  // compared against what the element read back, below.
  const GESTURE_PLAN = [
    { name: 'as-shipped', kind: 'pan', px: PRESS_PROBE.PAN_PX, force: null, expectTouchAction: 'shipped' },
    { name: 'as-shipped-small', kind: 'pan', px: PRESS_PROBE.SMALL_PAN_PX, force: null, expectTouchAction: 'shipped' },
    { name: 'neutralised', kind: 'pan', px: PRESS_PROBE.PAN_PX, force: 'pan', expectTouchAction: 'manipulation' },
    { name: 'forced-fixed', kind: 'pan', px: PRESS_PROBE.PAN_PX, force: 'on', expectTouchAction: 'none' },
    ...(arm.id === 'meet'
      ? []
      : [{ name: 'stage-neutralised-drift', kind: 'selection', px: null, force: 'off', expectTouchAction: null }]),
  ];
  const PAN_PLAN = GESTURE_PLAN.filter((step) => step.kind === 'pan');
  const pans = {};
  /** Which stage each gesture was spent on, so five readings is five. */
  const panSurfaces = {};
  let panBlocked = null;
  for (const step of GESTURE_PLAN) {
    const back = await regainStage(page, arm);
    if (!back.ok) {
      panBlocked = `${step.name} was never taken — ${back.why ?? 'the stage did not come back'}`;
      break;
    }
    // `reachAttempt` has already counted this attempt against the per-lift quota
    // — see the note at that call. All this records is WHICH attempt each
    // reading came off, which is what the distinctness check below reads.
    if (arm.id === 'meet' && back.label !== undefined && back.label !== null) {
      panSurfaces[step.name] = back.label;
    }
    const forcedTo = step.force === null ? null : await forceProperties(page, arm.touchTestId, step.force);
    if (step.kind === 'pan') {
      pans[step.name] = await probePan(page, cdp, arm.touchTestId, step.name, step.px);
      if (forcedTo === null) pans[step.name].touchAction = target.self.touchAction;
      else pans[step.name].forcedTo = forcedTo;
    } else {
      readings[step.name] = await probeSelection(page, arm.touchTestId, step.name, true);
      readings[step.name].forcedTo = forcedTo;
    }
    if (step.force !== null) await forceProperties(page, arm.touchTestId, null).catch(() => {});
    // AND WAIT FOR THE GESTURE TO HAVE LANDED BEFORE ASKING FOR ANOTHER STAGE.
    //
    // Not politeness — a race this cost a run. A touch on the attempt screen
    // resolves the rep a frame or two later, so `driveMeetToItsEnd` could read
    // `attempt: true` at the top of its loop and hand a screen that had already
    // become the verdict to `playOneMeetAttempt`, which then reported "no brace
    // to press — prompt was null" and ended the meet 'stuck'. The app was fine;
    // the instrument was asking a question one frame too early.
    await settleAfterGesture(page, arm, panSurfaces[step.name] ?? null);
  }

  for (const name of Object.keys(pans)) {
    const p = pans[name];
    console.log(
      `  pan ${name.padEnd(18)} ${String(p.panPx).padStart(3)}px  touch-action=${JSON.stringify(p.forcedTo?.touchAction ?? p.touchAction)} -> pointercancel=${p.cancels} over ${p.moves} touchmoves${panSurfaces[name] === undefined ? '' : `  on ${panSurfaces[name]}`}`,
    );
  }

  // EVERY READING THE SECTION BELOW IS ABOUT WAS ACTUALLY TAKEN. Without this, a
  // meet that bombed out halfway through would leave `pans` short and every
  // check below would read `undefined === 0` as false — a red, but one whose
  // message would be about a cancel count rather than about the meet ending.
  const gesturesTaken = Object.keys(pans).length + (readings['stage-neutralised-drift'] === undefined ? 0 : 1);
  // A RED WITH ITS OWN REASON, ON EVERY CAUSE. The one exception — a stage that
  // could not come back because the meet had reached a lift `meetDrive.mjs` had
  // no grammar for — was a NAMED SKIPPED check here, routed through
  // `reportUnrunGestureChecks`. That cause is closed (see the block where
  // `MEET_DRIVER_KNOWS_ONLY` used to be), so the branch that reported it is
  // deleted rather than left as an arm nothing can take: CLAUDE.md's rule for a
  // check no state of the subject can reach.
  check(
    panBlocked === null && gesturesTaken === GESTURE_PLAN.length,
    `ARM ${arm.id}: all ${GESTURE_PLAN.length} stage gestures were taken on a live stage`,
    panBlocked === null
      ? `${gesturesTaken} of ${GESTURE_PLAN.length}${arm.id === 'meet' ? `, on attempts ${JSON.stringify(panSurfaces)}` : ''}`
      : panBlocked,
  );
  if (panBlocked !== null) {
    // AND THE FOUR OTHER GAP-REPORTING SITES THIS `continue` USED TO JUMP.
    //
    // Measured by a critic set-differencing the `what` strings of this record
    // against `8ef61c9`'s: 11 meet-arm CHECKS and 1 meet-arm SKIP present at
    // base were absent here, and the skip above honestly covered only 7 of
    // them. Four fell off the record with no name anywhere — the two pan
    // bookkeeping checks, the driver-played count, and PROBE 1's stage reading,
    // which was a NAMED gap at base and became an unreported one here.
    //
    // The sharpest of the four is the quota. The skip above explains itself by
    // citing `MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND` as the mechanism that
    // sent the instrument to another lift — and that rule's only assertion in
    // this file was one of the four this `continue` stopped running. A gap that
    // is explained by a rule nothing checks is the shape this repository keeps
    // paying for.
    //
    // So both sites are functions now and both paths call them, with
    // `blockedBy` deciding check-or-skip per line. The `continue` stays where it
    // is: the checks BELOW it read `pans['neutralised']` and friends directly
    // and would fail on `undefined === 0` with a message about a cancel count.
    gradeMeetBookkeeping(arm, { panPlan: PAN_PLAN, panSurfaces, blockedBy: panBlocked });
    reportStageSelectionGap(arm, { readings, target, neutralised, blockedBy: panBlocked });
    // `touchTestId` GOES IN EVEN ON THIS PATH, and it was missing. CROSS-ARM's
    // "the 3 arms are 3 different elements" builds a Set over that field, so a
    // blocked arm contributed `undefined` — which is distinct from the other
    // two and made the check PASS on an arm that had reported no element at
    // all. A set-size check whose domain includes `undefined` is one member
    // short of vacuous, and it was passing for the wrong reason.
    results.push({
      arm: arm.id,
      reached: true,
      queryString: search,
      touchTestId: arm.touchTestId,
      textTestId: arm.textTestId,
      target,
      text,
      readings,
      pans,
      panSurfaces,
      why: panBlocked,
    });
    continue;
  }

  gradeMeetBookkeeping(arm, { panPlan: PAN_PLAN, panSurfaces, blockedBy: null });
  reportStageSelectionGap(arm, { readings, target, neutralised, blockedBy: null });

  // ---- A PAN THE PAGE NEVER HEARD IS A MEASUREMENT THIS HOST CANNOT MAKE --
  //
  // Every `cancels === ...` conclusion below reads a count off ONE pan, and a
  // pan that dispatched nothing reports zero cancels — which is the value three
  // of the four conclusions WANT. So a starved pan does not redden them, it
  // passes them, vacuously, and the only thing that notices is the non-vacuity
  // guard further down. That guard was reddening as an app failure on a host
  // that simply could not deliver the gesture.
  //
  // WHY THE 20px PAN IS THE ONE THAT STARVES, so nobody re-derives it: the
  // full-size pans travel `PAN_PX` in `PAN_STEPS` steps and the page sees all
  // ten every time. `SMALL_PAN_PX` is 20px over the same step count, so each
  // step is 2px — under the browser's own slop threshold, where Chromium
  // coalesces or drops the moves entirely. Measured across six runs on this
  // host: the 200px pans read 10 moves every time; the 20px pan read 0 four
  // times and 3 twice, never more. The guard's requirement is calibrated to a
  // distance the small pan cannot reliably reach here.
  //
  // So a starved pan is reported as a NAMED SKIP — the pan AND the conclusion
  // that reads it — and everything that did drive is graded exactly as before.
  // `checkPan` is the whole mechanism, applied to all four conclusions rather
  // than to the one that failed today, because they share the dependency and
  // patching one is how the sibling defect two rounds ago happened.
  const panStarved = (name) => pans[name].moves === 0 && pans[name].cancels === 0;
  const starvedPans = Object.keys(pans).filter(panStarved);
  for (const name of starvedPans) {
    skip(
      `ARM ${arm.id}: PROBE 2 pan "${name}" — the page received this gesture at all`,
      `${pans[name].moves} touchmove(s) and ${pans[name].cancels} pointercancel(s) at `
        + `${pans[name].panPx}px: the page heard nothing, so its cancel count is a count of `
        + 'nothing and every conclusion resting on it is skipped with it. Not a threshold to '
        + 'lower — a smaller required distance would make the pan stop testing the gesture.',
    );
  }
  /** `check`, unless the pan it reads never reached the page. */
  const checkPan = (name, ok, what, detail) => {
    if (panStarved(name)) {
      skip(what, `the "${name}" pan put nothing on the page (${detail}) — skipped rather than `
        + 'passed, because zero cancels is the value this conclusion wants and it would have '
        + 'read as the cleanest line in the file');
      return;
    }
    check(ok, what, detail);
  };

  // ---- THE PROBE'S DOMAIN, DEMONSTRATED IN BOTH DIRECTIONS ---------------
  // Same element, same pan, only `touch-action` moved. Counts pinned exactly,
  // not bounded — `>= 0` would be true of a probe that never fired at all.
  checkPan(
    'neutralised',
    pans['neutralised'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_BROWSER_MAY_PAN,
    `ARM ${arm.id}: PROBE 2 DOMAIN — with touch-action neutralised to manipulation, the browser TAKES the gesture`,
    `pointercancel=${pans['neutralised'].cancels}, wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_BROWSER_MAY_PAN} (touch-action read back as ${JSON.stringify(pans['neutralised'].forcedTo?.touchAction)})`,
  );
  checkPan(
    'forced-fixed',
    pans['forced-fixed'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE,
    `ARM ${arm.id}: PROBE 2 DOMAIN — with touch-action forced to none on the SAME element, it does not`,
    `pointercancel=${pans['forced-fixed'].cancels}, wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE} (touch-action read back as ${JSON.stringify(pans['forced-fixed'].forcedTo?.touchAction)})`,
  );
  // NON-VACUITY ON THE PAN ITSELF. A pan that dispatched no touchmoves would
  // report zero cancels and read as the cleanest pass in the file, so what the
  // page actually SAW is counted rather than assumed.
  //
  // Two counts, because the two pan sizes do not deliver the same number of
  // events and pinning them together would be wrong rather than strict. At
  // `PAN_PX` every one of the `PAN_STEPS` moves lands; at `SMALL_PAN_PX` each
  // step is 2px and Chromium coalesces the sub-slop ones, so the page sees
  // fewer — `PRESS_PROBE.SMALL_PAN_MOVES_SEEN_WHEN_TAKEN`, and not pinned
  // because that number is the engine's coalescing policy rather than anything
  // about this app.
  //
  // What IS pinned exactly is a count of PANS, in both directions: how many ran
  // at full size and landed all their moves, and how many of all the pans put
  // at least one touchmove on the page. Neither is a bound on a measurement.
  const panNames = Object.keys(pans);
  // A pan is evidence if the page received ANYTHING attributable to it — a
  // touchmove or a cancel. Not `moves > 0`: when the browser takes a gesture it
  // can stop telling the page about it almost immediately, and a guard that
  // required a full stream would redden on the file's own sharpest reading.
  // What must not happen is a pan the page never heard about at all, and that is
  // what this counts.
  const pansThePageSaw = panNames.filter((n) => pans[n].moves > 0 || pans[n].cancels > 0).length;
  // SCOPED TO THE PANS THAT DROVE, AND ALL-STARVED IS A RED RATHER THAN A PASS.
  //
  // The starved ones are named skips above, with the conclusions that read them.
  // What is left for this line to say is the half a skip cannot: that SOMETHING
  // drove. Without the first clause an arm where every pan starved would satisfy
  // `pansThePageSaw === panNames.length - starvedPans.length` as `0 === 0` and
  // report the cleanest pass in the file, which is the exact shape this guard
  // exists to refuse — a count of nothing reading as evidence, one level out.
  check(
    pansThePageSaw > 0 && pansThePageSaw === panNames.length - starvedPans.length,
    `ARM ${arm.id}: PROBE 2 — at least one pan reached the page, and every pan not skipped for starvation put something on it`,
    `${pansThePageSaw} of ${panNames.length} drove`
      + `${starvedPans.length === 0 ? '' : `, ${starvedPans.length} skipped as starved (${starvedPans.join(', ')})`}`
      + `; ${panNames.map((n) => `${n}=${pans[n].moves} moves @${pans[n].panPx}px, ${pans[n].cancels} cancel(s)`).join('; ')}`,
  );
  // AND THE MOVE STREAM ITSELF, SCOPED TO THE PANS IT CAN BE A STATEMENT ABOUT.
  //
  // An earlier version pinned every full-size pan at `PAN_STEPS` and reddened
  // on the played arm at 5 of 10 — correctly reporting a fact and wrongly
  // calling it a defect. A cancelled pan TRUNCATES: once the browser has taken
  // the pointer it stops telling the page about the gesture, so a low move
  // count on a cancelled pan is the very thing PROBE 2 is measuring showing up
  // a second way, not the instrument misfiring. Pinning the two together made
  // the guard disagree with its own subject.
  //
  // So the pin is on the pans where a full stream is what "nothing happened"
  // looks like: full size, no cancel.
  // THE OTHER STREAM, PINNED SO THE HEADER'S REASON FOR IGNORING IT CAN EXPIRE.
  //
  // `probePan`'s docstring says `touchmove` cancelability does not depend on
  // `touch-action` and is therefore not the signal. That is the justification
  // for resting PROBE 2 on the cancel count instead, and a justification with
  // nothing behind it is the shape this repository keeps finding in prose. The
  // pattern is `[true, false, false, …]`: the first move of a gesture is
  // cancelable and every one after it is not, whatever `touch-action` says.
  //
  // SCOPED TO FULL-SIZE PANS, and the scoping is a measurement rather than a
  // convenience. At `SMALL_PAN_PX` the stream reads `[true, true, true]` on the
  // fixed arm — 20px is not far enough for the engine to commit to anything, so
  // every move stays cancelable. Pinning the two sizes together would assert
  // something false about the short one; what the header claims, and all this
  // needs to back, is that at a gesture the engine HAS committed to, the stream
  // looks the same whatever `touch-action` is.
  const fullPanNames = panNames.filter((n) => pans[n].panPx === PRESS_PROBE.PAN_PX);
  const panCancelablePattern = fullPanNames.filter((n) => {
    const seq = pans[n].moveCancelable ?? [];
    return seq.length > 0 && seq[0] === true && seq.slice(1).every((c) => c === false);
  }).length;
  check(
    panCancelablePattern === fullPanNames.length,
    `ARM ${arm.id}: PROBE 2 — touchmove cancelability is [true, false…] on all ${fullPanNames.length} full-size pans whatever touch-action says, so it is not the discriminator and the cancel count is`,
    `${panCancelablePattern} of ${fullPanNames.length}; ${panNames.map((n) => `${n}@${pans[n].panPx}px(ta=${JSON.stringify(pans[n].forcedTo?.touchAction ?? pans[n].touchAction)})=${JSON.stringify(pans[n].moveCancelable)}`).join(' ')}`,
  );

  // ---- AND WHAT EACH PAN ACTUALLY RAN AT ---------------------------------
  //
  // THIS REPLACES A CHECK THAT HAD BECOME FALSE, AND THE REPLACEMENT IS NOT THE
  // SAME CLAIM MADE LOOSER. What stood here asserted that every UNCANCELLED
  // full-size pan delivered its whole `PAN_STEPS` stream, on the reasoning that
  // a short stream means the browser went quiet mid-gesture. Measured on the
  // fixed session surface: the as-shipped 200px pan delivers 4 of 10 with ZERO
  // cancels, because the pan starts a real rep and Chromium coalesces touchmoves
  // while Skia is drawing the descent. The inference "short stream implies
  // cancelled" is simply not true, and it was green before only because on the
  // BROKEN surface that pan was cancelled and so fell outside the check's own
  // filter. A check that passes on the defect and fails on the fix is measuring
  // the wrong thing.
  //
  // What goes here instead is a defect class CLAUDE.md names: "measured,
  // carried, displayed, never compared". Every pan's `touch-action` was read
  // back off the element and printed in the check messages below, and NOTHING
  // compared it to the value that pan was supposed to run at. A `forceProperties`
  // that silently failed would leave the neutralised pan running at `none`,
  // reporting 0 cancels, and the DOMAIN check would redden with a message about
  // a cancel count rather than about the control not having been applied.
  const panTouchActionMismatches = PAN_PLAN.filter((step) => {
    const p = pans[step.name];
    const seen = p.forcedTo?.touchAction ?? p.touchAction;
    const want = step.expectTouchAction === 'shipped' ? target.self.touchAction : step.expectTouchAction;
    return seen !== want;
  }).map((step) => {
    const p = pans[step.name];
    return `${step.name} ran at ${JSON.stringify(p.forcedTo?.touchAction ?? p.touchAction)}, its row says ${JSON.stringify(step.expectTouchAction)}`;
  });
  // ...with the census that stops the table collapsing to one value. Exact
  // counts in both directions: three pans on the shipped/none value and one
  // neutralised, or the "same element, only touch-action moved" claim is being
  // made about pans that all ran the same way.
  const ranNeutralised = PAN_PLAN.filter(
    (step) => (pans[step.name].forcedTo?.touchAction ?? pans[step.name].touchAction) === 'manipulation',
  ).length;
  check(
    panTouchActionMismatches.length === 0 &&
      ranNeutralised === PAN_PLAN.filter((step) => step.expectTouchAction === 'manipulation').length,
    `ARM ${arm.id}: PROBE 2 — every pan ran at the touch-action its row claims, and exactly ${PAN_PLAN.filter((step) => step.expectTouchAction === 'manipulation').length} of ${PAN_PLAN.length} was the neutralised one`,
    `${ranNeutralised} ran at manipulation; ${panNames.map((n) => `${n}=${JSON.stringify(pans[n].forcedTo?.touchAction ?? pans[n].touchAction)}`).join(', ')}` +
      (panTouchActionMismatches.length === 0 ? '' : `; MISMATCHES: ${panTouchActionMismatches.join('; ')}`),
  );
  // The move counts are REPORTED and not pinned, and this line is where that is
  // said rather than left as an absence. They are the engine's coalescing policy
  // under whatever load the rep is putting on the main thread, not a fact about
  // the app — measured at 10, 4 and 3 for the same dispatch on three arms.
  console.log(
    `  move stream (reported, not pinned): ${panNames.map((n) => `${n}=${pans[n].moves}/${PRESS_PROBE.PAN_STEPS}`).join(', ')}`,
  );

  // ---- THE CLAIM, AT TWO SCALES OF GESTURE --------------------------------
  // Two readings rather than one because "the browser takes the press away" is
  // a statement about a gesture that MOVED, and a reader cannot tell from a
  // single number whether that needed a swipe or a wobble.
  checkPan(
    'as-shipped',
    pans['as-shipped'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE,
    `ARM ${arm.id}: PROBE 2 — as shipped, a ${PRESS_PROBE.PAN_PX}px drag never has the press taken away from the app mid-gesture`,
    `pointercancel=${pans['as-shipped'].cancels} with touch-action ${JSON.stringify(pans['as-shipped'].touchAction)}, wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE}`,
  );
  checkPan(
    'as-shipped-small',
    pans['as-shipped-small'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE,
    `ARM ${arm.id}: PROBE 2 — nor does a ${PRESS_PROBE.SMALL_PAN_PX}px finger drift, which is the gesture the descent actually is`,
    `pointercancel=${pans['as-shipped-small'].cancels} at ${PRESS_PROBE.SMALL_PAN_PX}px vs ${pans['as-shipped'].cancels} at ${PRESS_PROBE.PAN_PX}px, both with touch-action ${JSON.stringify(pans['as-shipped-small'].touchAction)}; wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE}. The page heard ${pans['as-shipped-small'].moves} touchmove(s) of the ${PRESS_PROBE.PAN_STEPS} dispatched before that verdict`,
  );

  // ---------------------------------------------------------------------------
  // THE FULL REP CYCLE — session arm only, see probeFullRepCycle's header
  // ---------------------------------------------------------------------------
  let fullCycle = null;
  if (arm.id === 'session') {
    fullCycle = await probeFullRepCycle(page, url);
    for (const step of fullCycle.phases) {
      console.log(
        `  cycle ${step.phase.padEnd(38)} loop-prompt=${JSON.stringify(step.loopPrompt).padEnd(28)} ` +
          `loop-detail=${JSON.stringify(step.loopDetail).padEnd(96)} ` +
          `touch=${JSON.stringify(step.touch)}  text=${JSON.stringify(step.text)}`,
      );
    }
    // Non-vacuity for the subtitle read: at least one phase of a real driven
    // rep must show it verbatim, or the field above is just being printed,
    // not checked — the exact failure shape CLAUDE.md's "measured, carried,
    // displayed, never compared" section warns about.
    check(
      fullCycle.phases.some((step) => step.loopDetail === REAL_SUBTITLE_MIRROR),
      `ARM ${arm.id}: PROBE 3 — session-detail shows the real LIFT_COPY.SUBTITLE verbatim somewhere in a driven rep, not just at BRACE`,
      `matched at: ${fullCycle.phases.filter((step) => step.loopDetail === REAL_SUBTITLE_MIRROR).map((step) => step.phase).join(', ') || 'nowhere'}`,
    );
    // Non-vacuity is the phase-name filter, not the string match — see
    // REAL_ASCENT_AFTER_CUE_MIRROR's header. Only `-settled` phases count,
    // because those are the only ones this probe labels as coming after a
    // tap it recorded; a floor-wide search for 'RIDE IT' would also match
    // ASCENT_BEFORE_CUE, which this codebase already renders and was never
    // the open question.
    const settledDrivePhases = fullCycle.phases.filter((step) => step.phase.includes('-settled'));
    check(
      settledDrivePhases.some((step) => step.loopPrompt === REAL_ASCENT_AFTER_CUE_MIRROR),
      `ARM ${arm.id}: PROBE 3 — RIDE IT (ASCENT_AFTER_CUE) actually renders between drive cues in a real driven rep, not just traced as reachable`,
      settledDrivePhases.length === 0
        ? 'no drive-tap-settled phase was ever recorded this run — see the domain check below for why the rep never got that far'
        : `${settledDrivePhases.length} settled phase(s) checked; matched at: ${settledDrivePhases.filter((step) => step.loopPrompt === REAL_ASCENT_AFTER_CUE_MIRROR).map((step) => step.phase).join(', ') || 'none'}`,
    );
    check(
      fullCycle.drove && fullCycle.drovePastLockout,
      `ARM ${arm.id}: PROBE 3 DOMAIN — a real rep was driven through every phase to LOCKOUT (adaptively, up to ${FULL_CYCLE.MAX_ATTEMPTS} tries), so the check below has something to say`,
      fullCycle.drove
        ? `drove ${fullCycle.phases.length} phase reading(s) over ${fullCycle.attemptsUsed} attempt(s), drovePastLockout=${fullCycle.drovePastLockout}` +
          (fullCycle.misses.length === 0 ? '' : `; misses along the way: ${fullCycle.misses.map((m) => `#${m.attempt}@${m.holdMs}ms=${JSON.stringify(m.outcome)}`).join(', ')}`)
        : fullCycle.why,
    );
    if (fullCycle.drove) {
      const deviations = fullCycle.phases.filter((step) => {
        const touchOk = step.touch === null || (step.touch.userSelect === 'none' && step.touch.touchAction === 'none');
        const textOk = step.text === null || step.text.userSelect === 'none';
        return !touchOk || !textOk;
      });
      check(
        deviations.length === 0,
        `ARM ${arm.id}: PROBE 3 — user-select and touch-action hold at every phase of a real rep, not only at BRACE`,
        deviations.length === 0
          ? `${fullCycle.phases.length} phase(s) checked, none deviated`
          : deviations
              .map((step) => `${step.phase}: touch=${JSON.stringify(step.touch)} text=${JSON.stringify(step.text)}`)
              .join('; '),
      );
    }
  }

  const shotPath = path.join(outDir, `${arm.id}-surface.png`);
  await page.screenshot({ path: shotPath }).catch(() => {});

  results.push({
    arm: arm.id,
    what: arm.what,
    played: arm.played,
    reached: true,
    contextMenu,
    fullCycle,
    queryString: search,
    touchTestId: arm.touchTestId,
    textTestId: arm.textTestId,
    target,
    text,
    readings,
    pans,
    panSurfaces,
    shot: path.relative(outDir, shotPath),
  });
}

if (CROSS_ARM_REQUESTED) {
  // The meet arm's whole bookkeeping, in one place a reader can check the four
  // readings against. Reported, and then compared: the count is what says the
  // instrument spent four attempts rather than describing four.
  console.log(`\n  meet run: ${JSON.stringify({ probed: meetRun.probedLabels, drives: meetRun.drives, holds: holdsIn(meetRun.searches) })}`);
}

// ---------------------------------------------------------------------------
// THE LADDER SECTION — all three lifts, one instrument, one run
// ---------------------------------------------------------------------------
/**
 * `--arms ladder` runs THIS ONLY, which is what makes it iterable while the
 * three press arms above cost most of the tool's wall clock. `--arms all` runs
 * both, and that is the combination the committed record is taken from.
 */
const ladderRuns = {};
if (LADDER_REQUESTED) {
  // THE PARSER, FIRST. Every band below is read out of `liftTuning.ts` by
  // regex, and a regex that has stopped matching answers `null` — which read as
  // "not configured" is a check that has quietly stopped asking anything. Both
  // failures are checks rather than a thrown error, so the record still says
  // which one happened.
  check(
    DEADLIFT_LOCKOUT.parserComplaints.length === 0,
    'LADDER: readTuning.mjs still reads its own fixture, so the numbers below came from source',
    DEADLIFT_LOCKOUT.parserComplaints.join('; ') || 'no complaints',
  );
  // BENCH'S BEAT IS STEERED BY THE SAME KIND OF READ AND GETS THE SAME KIND OF
  // CHECK. A `null` from any of these would leave the driver tapping at a
  // cadence derived from nothing, and it would report the resulting weak grinds
  // as the app's fault — which is the exact shape `readTuning.mjs`'s header
  // warns about, arriving through a driver instead of through a comparison.
  check(
    BENCH_BEAT.missing.length === 0 && BENCH_BEAT.parserComplaints.length === 0,
    "LADDER: bench's descent deadline and grind cadence were DERIVED from liftTuning.ts, not typed into this tool",
    BENCH_BEAT.missing.length > 0 || BENCH_BEAT.parserComplaints.length > 0
      ? `unread: ${BENCH_BEAT.missing.join(', ')}; parser: ${BENCH_BEAT.parserComplaints.join('; ')}`
      : `tap period ${Math.round(BENCH_BEAT.refractoryMs * BENCH_DRIVE.TAP_PERIOD_FRACTION)}ms against a ${BENCH_BEAT.refractoryMs}ms refractory; charge decays ${BENCH_BEAT.chargeDecay}/tick toward a ceiling of ${BENCH_BEAT.chargeCeiling} at half-saturation ${BENCH_BEAT.chargeHalf}; a held descent takes ${BENCH_BEAT.heldDescentMs}ms at the heaviest load and the longest legal grind is ${BENCH_BEAT.longestGrindMs}ms`,
  );
  // ...AND THE CADENCE IT CHOSE CAN ACTUALLY REACH A FULL GRIND.
  //
  // WHAT THIS REPLACED, AND THE ANALYSIS. Until the 2026-08-25 replay steer this
  // slot held a non-vacuity control on a SEARCHED DUTY CYCLE — "the derived
  // cycle beats a committed hold at its worst load" — because a cycle that
  // graded zero everywhere printed the same shape of numbers as one that graded
  // well. Both halves of that are gone: there is no cycle, and a committed hold
  // is now the CORRECT play at every load rather than the losing one, so the
  // control's two sides had swapped. Re-pinning it the other way round would
  // have meant this tool re-deriving, through a second implementation of the
  // game's own descent recurrence, a property `liftTuning.test.ts` already
  // asserts in closed form from the constants — a check the suite dominates
  // outright. Deleted, with the domination recorded here and in
  // `sessionDrive.mjs`'s own block, rather than left as two checks where one
  // can never speak.
  //
  // WHAT STANDS IN ITS PLACE IS A COMPARISON THIS TOOL IS THE RIGHT PLACE FOR,
  // because it is about the ROBOT: at the mechanic's own refractory floor the
  // settled charge is the most any player can hold, so the force it implies is
  // 1 whenever `GRIND_CHARGE.CEILING` is reachable at all. A tuner who raises
  // that ceiling past what the floor can settle at makes the fastest legal
  // human unable to reach a full grind, and this goes red saying so.
  check(
    BENCH_BEAT.saturatedForce !== undefined &&
      BENCH_BEAT.saturatedForce !== null &&
      BENCH_BEAT.saturatedForce >= 1,
    "LADDER: the mechanic's own tap floor still settles at a FULL grind, so the driver's cadence has a ceiling to aim at",
    BENCH_BEAT.saturatedForce === undefined || BENCH_BEAT.saturatedForce === null
      ? 'the grind curve did not resolve'
      : `tapping every ${BENCH_BEAT.refractoryTicks} tick(s) settles at charge ${BENCH_BEAT.saturatedCharge.toFixed(3)} against a ceiling of ${BENCH_BEAT.chargeCeiling}, worth grind force ${BENCH_BEAT.saturatedForce.toFixed(3)}; the driver aims at ${Math.round(BENCH_BEAT.refractoryMs * BENCH_DRIVE.TAP_PERIOD_FRACTION)}ms and must clear ${BENCH_DRIVE.GRIND_FORCE_FLOOR} on what it achieves`,
  );

  check(
    DEADLIFT_LOCKOUT.missing.length === 0,
    'LADDER: every tick-denominated deadlift lockout value resolved out of source',
    DEADLIFT_LOCKOUT.missing.length === 0
      ? `DOWN_COMMAND_DELAY_TICKS ${DEADLIFT_LOCKOUT.downDelayMinTicks}..${DEADLIFT_LOCKOUT.downDelayMaxTicks}, grace ${DEADLIFT_LOCKOUT.gripGraceTicks}, slip-grind ${DEADLIFT_LOCKOUT.slipGrindTicks}, settle ${DEADLIFT_LOCKOUT.settleTicks}, at ${DEADLIFT_LOCKOUT.tickHz} Hz`
      : `unread: ${DEADLIFT_LOCKOUT.missing.join(', ')}`,
  );

  for (const kind of LADDER_KINDS) {
    console.log(`\n=== LADDER: ${kind} — GDD §3.2's daily set, opened by pressing ${checkInLiftTestId(kind)} ===`);
    const run = await probeLiftLadder(page, url, kind, {
      shots: kind === 'deadlift' ? { hold: path.join(outDir, 'deadlift-lockout-hold.png'), down: path.join(outDir, 'deadlift-down-command.png') } : null,
      alsoSlip: kind === 'deadlift',
    });
    ladderRuns[kind] = run;

    // ---- 1. THE PLAYER'S OWN CONTROL, AND THE ADDRESS BAR -------------------
    check(
      run.reached && run.landedOn === kind,
      `LADDER ${kind}: a work set was reached by pressing ${checkInLiftTestId(kind)} on the check-in and then playing in, and it is a ${kind} set`,
      run.reached
        ? `RPE choice ${run.rpeChoice}, check-in ${JSON.stringify(run.checkIn)}`
        : `${run.why}${run.landedOn === null || run.landedOn === undefined ? '' : ` — driven with ${run.landedOn}'s grammar anyway so the checks below have a real reading to disagree with`}`,
    );
    if (run.landedOn === null || run.landedOn === undefined) {
      skip(
        `LADDER ${kind}: every check below it`,
        `the ${kind} arm could not be driven at all — ${run.why}. NOT falling back to a debug URL: there is no ?lift= arm in resolveEntry to fall back to, and a section that looked complete here would be worse than a named gap`,
      );
      continue;
    }
    check(
      run.queryString === '',
      `LADDER ${kind}: the address bar carries NO query string at the moment the stage is read`,
      JSON.stringify(run.queryString),
    );

    const best = run.best;
    const ladder = best?.ladder ?? null;

    // ---- 2. THE INSTRUMENT'S OWN DOMAIN -------------------------------------
    // A recorder that stopped ticking returns the same empty ladder as a rep
    // that never happened, and every claim below reads that ladder. Both
    // samplers are asserted live, on the rep the claims are taken from.
    const counts = ladder?.counts ?? { raf: 0, interval: 0, dropped: 0 };
    // `counts.dropped` IS IN THE PREDICATE, not only in the message. It was
    // incremented page-side when `MAX_ROWS` is reached, carried through
    // `readLadder`, and printed here — and nowhere else. A recorder that
    // truncated would have printed its own truncation count beside a green
    // line, which is CLAUDE.md's "measured, carried, displayed, never
    // compared" exactly: the number a reader supplies the comparison for in
    // their head. Truncation matters because every claim below reads the row
    // list, and a truncated list is missing rungs it never says it is missing.
    check(
      counts.raf > 0 && counts.interval > 0 && (ladder?.rows.length ?? 0) > 0 && counts.dropped === 0,
      `LADDER ${kind} DOMAIN: the page-side frame recorder was live, and lost nothing, for the rep every claim below is read off`,
      `${counts.raf} animation-frame sample(s), ${counts.interval} interval sample(s), ${ladder?.rows.length ?? 0} recorded change(s), ${counts.dropped} dropped against a ${LIFT_LADDER.MAX_ROWS}-row cap`,
    );

    // ---- 3. WHICH LIFT THE SIM WAS CONFIGURED FOR ---------------------------
    // `SetView` fills `session-detail` from `LIFT_COPY.SUBTITLE[config.kind]`,
    // indexing the CONFIG's kind directly rather than routing through a phase.
    // So this is the read that says the chip retargeted the session, and it is
    // independent of the phase ladder below.
    const subtitles = subtitlesSeen(ladder);
    check(
      subtitles.includes(LIFT_PROMPTS[kind].SUBTITLE),
      `LADDER ${kind}: session-detail carries ${kind}'s own LIFT_COPY.SUBTITLE verbatim, so the sim ran THAT lift's config`,
      `saw ${JSON.stringify(subtitles)}`,
    );

    // ---- 4. THE PHASE LADDER, IN ORDER --------------------------------------
    const matched = best?.matched ?? { matchedCount: 0, wanted: requiredRungsFor(kind), at: [], rungs: [] };
    console.log(`  rungs seen: ${JSON.stringify(matched.rungs)}`);
    check(
      matched.matchedCount === matched.wanted.length,
      `LADDER ${kind}: the prompt ladder walked all ${matched.wanted.length} of ${kind}'s own beats, each one after the last`,
      `${matched.matchedCount} of ${matched.wanted.length}: ${matched.at.map((entry) => `${JSON.stringify(entry.line)}@${entry.at ?? 'never'}`).join(' -> ')}` +
        ` (over ${run.attempts.length} attempt(s): ${run.attempts.map((a) => `#${a.attempt}@${a.holdMs}ms=${JSON.stringify(a.outcome ?? a.why ?? null)}`).join(', ')})`,
    );

    // ---- 5. THE ECCENTRIC CENSUS -------------------------------------------
    // Counted for every lift so the deadlift's zero has this run's own non-zero
    // readings beside it. Exact counts, not bounds.
    const eccentric = eccentricLinesIn(ladder);
    check(
      eccentric.length === ECCENTRIC_LINE_COUNT[kind],
      `LADDER ${kind}: exactly ${ECCENTRIC_LINE_COUNT[kind]} of the game's ${ECCENTRIC_ONLY_PROMPTS.length} DESCENT/HOLE-only lines rendered`,
      `${eccentric.length}: ${JSON.stringify(eccentric)} — the ban list is ${JSON.stringify(ECCENTRIC_ONLY_PROMPTS)}`,
    );

    // ---- 5a. THE COMMAND BEAT, IN PIXELS -----------------------------------
    gradeStageBeat(kind, run);

    if (kind !== 'deadlift') continue;

    // ---- 6. THE DEADLIFT'S OWN BEAT ----------------------------------------
    check(
      best?.reachedLockout === true,
      `LADDER deadlift DOMAIN: a real rep was driven from the check-in to LOCKOUT, so the hold below has something to say`,
      best === null
        ? 'no rep was played at all'
        : `reachedLockout=${best.reachedLockout}, ${best.drivesTapped ?? 0} drive tap(s), outcome ${JSON.stringify(best.outcome)}`,
    );
    check(
      best?.downCommandSeen === true,
      `LADDER deadlift: the down command arrived — ${JSON.stringify(LIFT_PROMPTS.deadlift.DOWN)} rendered on a real frame, which for a round it could not (DOWN_COMMAND_SETTLE_TICKS was 0 and the verdict replaced the screen on the command's own tick)`,
      `downCommandSeen=${best?.downCommandSeen}, outcome ${JSON.stringify(best?.outcome)}`,
    );

    const lockoutAt = firstAt(ladder, LIFT_PROMPTS.deadlift.LOCKOUT);
    const downAt = firstAt(ladder, LIFT_PROMPTS.deadlift.DOWN);
    const holdMs = lockoutAt !== null && downAt !== null ? downAt - lockoutAt : null;
    check(
      holdMs !== null &&
        DEADLIFT_LOCKOUT.holdFloorMs !== null &&
        holdMs >= DEADLIFT_LOCKOUT.holdFloorMs &&
        holdMs <= DEADLIFT_LOCKOUT.holdCeilingMs,
      `LADDER deadlift: the hold ran inside DOWN_COMMAND_DELAY_TICKS' declared band, read out of liftTuning.ts rather than typed here`,
      holdMs === null
        ? `never measured — ${JSON.stringify(LIFT_PROMPTS.deadlift.LOCKOUT)} at ${lockoutAt}, ${JSON.stringify(LIFT_PROMPTS.deadlift.DOWN)} at ${downAt}`
        : `${holdMs}ms against ${DEADLIFT_LOCKOUT.downDelayMinTicks}-${DEADLIFT_LOCKOUT.downDelayMaxTicks} ticks at ${DEADLIFT_LOCKOUT.tickHz}Hz = ${Math.round(DEADLIFT_LOCKOUT.downDelayMinTicks * DEADLIFT_LOCKOUT.tickMs)}-${Math.round(DEADLIFT_LOCKOUT.downDelayMaxTicks * DEADLIFT_LOCKOUT.tickMs)}ms, widened by this recorder's own ${LIFT_LADDER.FRAME_ALLOWANCE_MS}ms grain to ${Math.round(DEADLIFT_LOCKOUT.holdFloorMs)}-${Math.round(DEADLIFT_LOCKOUT.holdCeilingMs)}ms`,
    );

    // ---- THE "NO INPUT" HALF, COUNTED BY THE PAGE AND NOT BY THE DRIVER ----
    //
    // A driver asserting it sent nothing would be checking its own control
    // flow, which is the self-referential vacuity shape this file refuses
    // elsewhere. The PAGE counts every pointerdown/pointerup it received, on
    // the same clock as the frames.
    //
    // THE SPAN STARTS AT THE RE-GRIP, NOT AT THE LOCKOUT FRAME — corrected
    // after the first real run, where it was written as starting at the lockout
    // frame and reddened on the robot's own clamp landing 122 ms inside it. The
    // beat is not "do nothing from the instant the bar locks": the player
    // arrives mid-tap-rhythm and `LOCKOUT_GRIP_GRACE_TICKS` exists precisely so
    // that getting the finger back on the bar is a transition rather than a
    // gotcha (`liftTuning.ts` says so in those words). What is asked for is
    // "clamp, then do nothing and keep doing it", and the span that must be
    // empty is the one after the clamp.
    const pointers = ladder?.pointers ?? [];
    const clamp =
      lockoutAt === null ? undefined : pointers.find((event) => event.kind === 'pointerdown' && event.t >= lockoutAt);
    const clampAt = clamp === undefined ? null : clamp.t;
    const reGripMs = clampAt === null || lockoutAt === null ? null : clampAt - lockoutAt;
    const noInputMs = clampAt === null || downAt === null ? null : downAt - clampAt;
    const duringNoInput =
      clampAt === null || downAt === null
        ? []
        : pointers.filter((event) => event.t > clampAt && event.t < downAt);
    const graceMs = DEADLIFT_LOCKOUT.tickMs === null ? null : DEADLIFT_LOCKOUT.gripGraceTicks * DEADLIFT_LOCKOUT.tickMs;
    // The floor the empty span must clear, derived from source and not chosen:
    // the command cannot fire sooner than DOWN_COMMAND_DELAY_TICKS.MIN, and the
    // most of that a legal re-grip may consume is the grace, so what is left is
    // the shortest no-input span the mechanic can produce.
    const noInputFloorMs =
      DEADLIFT_LOCKOUT.tickMs === null || DEADLIFT_LOCKOUT.missing.length > 0
        ? null
        : (DEADLIFT_LOCKOUT.downDelayMinTicks - DEADLIFT_LOCKOUT.gripGraceTicks) * DEADLIFT_LOCKOUT.tickMs -
          LIFT_LADDER.FRAME_ALLOWANCE_MS;
    // DELETED HERE, AND THE DOMINATION RECORDED RATHER THAN THE CHECK KEPT:
    // `the finger went back onto the bar at the lockout and was still on it
    // when the command came`, which asserted
    // `clampAt !== null && downAt !== null && clampAt < downAt`.
    //
    // It is STRICTLY DOMINATED by the zero-pointer-events check below.
    // Symbolically, that check requires `noInputMs >= noInputFloorMs` (333 ms),
    // and `noInputMs` is `downAt - clampAt` or null:
    //
    //     clampAt === null   -> noInputMs null  -> the check below is red
    //     downAt  === null   -> noInputMs null  -> the check below is red
    //     clampAt >= downAt  -> noInputMs <= 0  -> the check below is red
    //
    // Those are exactly the three states that reddened the deleted line, so no
    // state of the subject made it red while the one below stayed green.
    // Confirmed against a real mutant rather than only on paper: under
    // `DOWN_COMMAND_SETTLE_TICKS: 0` BOTH went red together, which is what
    // domination looks like from the outside and is why it survived a mutation
    // pass that only asked whether each line could go red at all.
    //
    // CLAUDE.md: "If the new rule fires first in every reachable case, the old
    // one is dead: delete it and record the domination." Nothing is lost —
    // `clampAt !== null` is still required by the grace check immediately
    // below (through `reGripMs`), and `clampAt !== null && downAt !== null` by
    // the zero-pointer check (through `noInputMs`).
    //
    // The general lesson is this repository's own, one direction out: the
    // domination analysis was run twenty lines further down, on
    // `slip.outcome !== null`, and not on the branch immediately ABOVE it.
    // THE RE-GRIP'S OWN LATENCY, COMPARED AND NOT MERELY PRINTED.
    //
    // CLAUDE.md's "measured, carried, displayed, never compared": three tools in
    // this repository shipped a quantity that reached a log line and never a
    // predicate. `reGripMs` appears in two details below it, so it gets one.
    //
    // WHAT A RED HERE MEANS, stated so it is not over-read: the held rep of the
    // control pair ALSO slipped, so the pair no longer differs in exactly one
    // thing and the discrimination check below it is comparing two slipped
    // reps. It is a statement about this run's instrument, not about the app —
    // and the instrument was fixed at the cause rather than fitted with a
    // wider threshold when it first went out of range (see the spacing-floor
    // wait in `tapDriveCuesToLockout`). Measured after that fix across three
    // real runs against `18ef5b7`: 90, 114 and 121 ms against a 167 ms grace.
    //
    // ===========================================================================
    // AND IT WENT OUT OF RANGE AGAIN ON 2026-08-26 — 218 ms, ON A RUN WHOSE
    // RE-RUN READ 42 ms. THE CAUSE IS OPEN.
    // ===========================================================================
    // BOTH NUMBERS ARE HERE BECAUSE ONLY ONE OF THEM MAKES IT INTO A GREEN
    // RECORD, and a reader who sees only the green one learns to re-run until
    // the check agrees with them. That is the crying-wolf failure this
    // repository has already paid for on three instruments, arriving through
    // non-determinism instead of noise. The spread across five real runs of the
    // bench difficulty round is now 42 / 90 / 114 / 121 / 218 ms against the
    // same 167 ms grace — one reading past the wall and one at a quarter of it,
    // which is not a rounding artefact.
    //
    // THE MERGE WAS RULED OUT STRUCTURALLY BEFORE THE RE-RUN, and the prediction
    // was written down while the red result was still the only evidence:
    // `LOCKOUT_GRIP_GRACE_TICKS` was unchanged; every constant that round moved
    // is bench-only (`DEMAND_BASE.bench` and `STICK_WIDTH.bench` are `PerKind`
    // tables read at `[kind]`, and `GRIND_BOOST_FORCE_MAX` is gated on
    // `kind === 'bench'` in `lift.ts`'s ascent branch); and all 85 of
    // `lift.test.ts`'s `BASELINE_DIGESTS` — every squat and deadlift rep in that
    // sweep — were byte-identical. So the app's deadlift did not move and the
    // reading is the robot's own dispatch latency.
    //
    // WHAT WAS NOT ESTABLISHED IS WHY IT VARIES BY A FACTOR OF FIVE. The
    // threshold is deliberately NOT widened to cover 218 — a threshold chosen to
    // stop a check failing hides the next real failure at the same site — so
    // this stays strict and the flake stays recorded. A future round that wants
    // it closed should instrument the gap the way `AIM_FOR_CENTER_DELAY_MS`'s
    // own header describes: measure the press-to-observation lag per attempt and
    // subtract it live, rather than assuming a fixed cost.
    check(
      reGripMs !== null && graceMs !== null && reGripMs <= graceMs,
      'LADDER deadlift: the re-grip landed inside LOCKOUT_GRIP_GRACE_TICKS, so the held rep is a clean hold and the pair below differs in exactly one thing',
      reGripMs === null
        ? 'no re-grip was measured'
        : `${reGripMs}ms against ${graceMs === null ? 'unread' : Math.round(graceMs)}ms (LOCKOUT_GRIP_GRACE_TICKS ${DEADLIFT_LOCKOUT.gripGraceTicks} at ${DEADLIFT_LOCKOUT.tickHz}Hz, read from liftTuning.ts)`,
    );
    check(
      duringNoInput.length === 0 && noInputMs !== null && noInputFloorMs !== null && noInputMs >= noInputFloorMs,
      'LADDER deadlift: the page received ZERO pointer events for the whole span between the re-grip and the down command — the one beat in this game where the correct play is no input, played that way and made',
      noInputMs === null
        ? 'the span was never measured, so this counted nothing'
        : `${duringNoInput.length} event(s) in ${noInputMs}ms, against a floor of ${noInputFloorMs === null ? 'unread' : Math.round(noInputFloorMs)}ms derived from (DOWN_COMMAND_DELAY_TICKS.MIN ${DEADLIFT_LOCKOUT.downDelayMinTicks} - LOCKOUT_GRIP_GRACE_TICKS ${DEADLIFT_LOCKOUT.gripGraceTicks}) ticks less this recorder's ${LIFT_LADDER.FRAME_ALLOWANCE_MS}ms grain; the rep's whole pointer stream was ${JSON.stringify(pointers.map((e) => `${e.kind}@${e.t}`))}`,
    );

    // ---- 7. THE CONTROL: THE SAME BEAT, NOT HELD ---------------------------
    const slip = run.slip;
    if (slip === null || slip.reachedLockout !== true) {
      skip(
        'LADDER deadlift CONTROL: a rep whose finger never returns at lockout',
        slip === null
          ? 'no control rep was played — the held rep never reached a lockout to contrast with, so there was nothing to hold constant'
          : `the control rep did not reach a lockout of its own (${JSON.stringify(slip.outcome ?? slip.why)}), so the pair would differ in more than the one thing`,
      );
    } else {
      // ---- THE INVARIANT, WHICH HOLDS AT EVERY SEED AND EVERY LOAD ---------
      // `LOCKOUT_GRIP_GRACE_TICKS` is 10 and `DOWN_COMMAND_DELAY_TICKS.MIN` is
      // 36, so a finger that never comes back sags for at LEAST 26 ticks, which
      // is past `LOCKOUT_SLIP_GRIND_TICKS` (6) whatever the load. Confirmed in
      // the pure sim at `8ef61c9` over 40 seeds at every rung of the RPE
      // ladder: 0 of 40 clean lifts at every one, against 40 of 40 held.
      //
      // `slip.outcome !== null` IS NOT BELT-AND-BRACES, IT IS WHAT KEEPS THIS
      // CHECK ABLE TO FAIL ON ITS OWN. Without it a control rep that never
      // resolved at all reads `null !== 'GOOD LIFT'` as TRUE here and ranks 0
      // in the comparison below — green on both, over a rep that did not
      // happen. It is also what stops this line being DOMINATED by that
      // comparison: with the null admitted, every state that reddens this one
      // reddens that one too, and CLAUDE.md requires a new rule to be checked
      // against the thresholds of the ones beside it. With the null refused,
      // an unresolved control reddens HERE and passes THERE, which is the
      // independent failure this line is for.
      // THE NAME SAYS "ANOTHER REP", NOT "THE SAME REP", AND THE CHANGE IS A
      // CORRECTION RATHER THAN A REWORD. The old name claimed the two reps were
      // "played identically except that the finger never returns", and the
      // record shipping beside it contradicted that in its own fields:
      // `drivesTapped` differs between them, and `repSeed(day, setIndex,
      // repIndex)` and `liftMomentFor` differ per rep, which moves the seeded
      // down-command delay and the cue window. CLAUDE.md rules a misdescribing
      // IDENTIFIER worse than misdescribing prose, because nobody re-verifies a
      // name. What IS held constant between them is the thing the claim needs —
      // the lift, the RPE, and the prescribed load — and that is asserted
      // directly in the discrimination check below rather than named here.
      check(
        slip.outcome !== null && slip.outcome !== 'GOOD LIFT',
        'LADDER deadlift CONTROL: another rep of the same session, differing in that the finger never returns to the bar at lockout, resolved, and is never a clean GOOD LIFT',
        `held rep: ${JSON.stringify(best?.outcome)} after ${best?.drivesTapped ?? 0} drive tap(s) — control rep: ${JSON.stringify(slip.outcome)} / ${JSON.stringify(slip.detail)} after ${slip.drivesTapped ?? 0}`,
      );
      // ---- AND THE DISCRIMINATION, WHICH IS THE POINT OF THE PAIR ----------
      // The invariant above is one-sided: it would still pass on a build where
      // the lockout asked for nothing and every deadlift graded GRINDER. What
      // says the HOLD is what made the rep is that the two reps came out
      // DIFFERENT, in the direction the beat claims, with the load, the RPE,
      // the lift and the ascent all identical between them.
      // THE LOAD IS NOW MEASURED RATHER THAN NAMED. The old name ruled the load
      // out as the alternative explanation and never compared it — true,
      // because `plan.loadRatio` is session-level and cannot move between reps,
      // but ASSERTED rather than checked, which is the thing this file refuses
      // when the reading is three fields away. `session-weight` is on both reps'
      // ladders, so the constancy is a comparison now.
      const heldWeights = weightsIn(best?.ladder);
      const slipWeights = weightsIn(slip.ladder);
      const sameBar =
        heldWeights.length === 1 && slipWeights.length === 1 && heldWeights[0] === slipWeights[0];
      check(
        sameBar && OUTCOME_RANK[best?.outcome ?? 'NO LIFT'] > OUTCOME_RANK[slip.outcome ?? 'NO LIFT'],
        'LADDER deadlift CONTROL: the two reps had the SAME weight on the bar, and the held one graded strictly better — so the hold is what made it and not the load',
        `bar: held ${JSON.stringify(heldWeights)} vs un-held ${JSON.stringify(slipWeights)}; verdict: held ${JSON.stringify(best?.outcome)} (rank ${OUTCOME_RANK[best?.outcome ?? 'NO LIFT']}) against un-held ${JSON.stringify(slip.outcome)} (rank ${OUTCOME_RANK[slip.outcome ?? 'NO LIFT']}); the held rep re-gripped ${reGripMs}ms into a ${graceMs === null ? 'unread' : Math.round(graceMs)}ms grace, so a held rep that graded GRINDER here means the re-grip missed that window`,
      );
      // ---- THE DEADLIFT'S OWN MISS COPY, WHEN THE SAG GOT THAT FAR ---------
      // Whether the un-held rep merely grinds or is lost outright depends on
      // the sag rate against THIS rep's own seeded delay (measured: 29 of 40
      // seeds lose it at RPE 8), so the losing branch is checked when it fires
      // and named as a gap when it does not. There is deliberately no assertion
      // on the other branch: 'it is a GRINDER' is exactly what the invariant
      // above already says once GOOD LIFT is excluded, and a second check that
      // no state of the subject can fail independently of the first is the
      // domination this file is required to look for.
      // ---- THE DEADLIFT'S OWN MISS COPY, FROM WHICHEVER CONTROL LOST IT ---
      //
      // IT READS BOTH CONTROLS, AND THAT IS A GAP BEING CLOSED RATHER THAN A
      // WIDENING. This used to read the slip control alone; when that rep's
      // seeded down command arrived before the sag reached
      // `LOCKOUT_DROP_HEIGHT_LOSS` it graded GRINDER, the losing branch never
      // rendered, and a named skip was filed — while the UNTOUCHED control in
      // the same run had already graded `NO LIFT` carrying this exact string,
      // and the tool printed it into a detail line and compared it to nothing.
      // The one sentence that distinguishes a deadlift's loss from a squat's
      // had zero browser assertions with the closing reading already in the
      // record. Either loss will do — both are the deadlift losing its
      // lockout — so the check takes whichever one happened.
      const droppedControls = [
        { name: 'the un-held rep', rep: slip },
        { name: 'the untouched rep', rep: run.neverPressed },
      ].filter((entry) => entry.rep !== null && entry.rep !== undefined && entry.rep.outcome === 'NO LIFT');
      if (droppedControls.length > 0) {
        const wrong = droppedControls.filter((entry) => entry.rep.detail !== DEADLIFT_DROPPED_REASON);
        check(
          wrong.length === 0,
          `LADDER deadlift CONTROL: the miss carries deadlift's OWN reason, ${JSON.stringify(DEADLIFT_DROPPED_REASON)}, and not the sticking-point line a squat would be given`,
          `${droppedControls.length} control(s) lost the bar: ${droppedControls.map((entry) => `${entry.name} -> ${JSON.stringify(entry.rep.detail)}`).join('; ')}`,
        );
      } else {
        skip(
          `LADDER deadlift CONTROL: the ${JSON.stringify(DEADLIFT_DROPPED_REASON)} miss copy`,
          `neither control lost the bar outright this run — the un-held rep graded ${JSON.stringify(slip.outcome)} and the untouched rep ${JSON.stringify(run.neverPressed?.outcome)}, so the losing branch never rendered. Whether a control merely grinds or is lost depends on its own seeded down-command delay against the sag rate: measured in the pure sim at 8ef61c9, 29 of 40 seeds lose it at this load and 11 survive as a grind, so this is a fact about these reps' seeds and not about the build`,
        );
      }
    }

    // ---- 7b. THE SECOND CONTROL: A REP NOBODY TOUCHES AT ALL ---------------
    // Not a duplicate of the pair above. See `driveLadderRep`'s `neverPress`
    // arm for the mutant that survived the first control and is killed by this
    // one, and for why the difference is the robot's own `mouse.up()`.
    const untouched = run.neverPressed;
    const untouchedPointers = (untouched?.ladder?.pointers ?? []).length;
    if (untouched === null || untouched === undefined || untouched.outcome === null) {
      skip(
        'LADDER deadlift CONTROL: a rep nobody touches at all',
        untouched === null || untouched === undefined
          ? 'no untouched rep was played — the held rep never reached a lockout to contrast with'
          : `the untouched rep never resolved inside ${LIFT_LADDER.NEVER_PRESS_TIMEOUT_MS}ms, so there is no verdict to read`,
      );
    } else {
      check(
        untouchedPointers === 0 && untouched.outcome !== 'GOOD LIFT',
        'LADDER deadlift CONTROL: a rep the page received NOT ONE pointer event for — brace clock to verdict — is never a clean GOOD LIFT',
        `${untouchedPointers} pointer event(s) reached the page across the whole rep; it graded ${JSON.stringify(untouched.outcome)} / ${JSON.stringify(untouched.detail)}. The zero is what makes the verdict evidence: a rep this instrument had quietly touched would grade like any other`,
      );
    }

    // ---- 8. THE PHOTOGRAPHS ------------------------------------------------
    await gradeTheLockoutPhotographs(run.shots ?? null);

    // ---- 9. WHAT THIS INSTRUMENT CANNOT SEE --------------------------------
    skip(
      'LADDER deadlift: nothing counts the player down to the down command',
      "`cueProgress` returns null for the whole of a deadlift LOCKOUT so no shrinking ring telegraphs the command — but a ring is drawn INTO the Skia <canvas>, which carries no testID and no text, so this instrument cannot read its absence. `lift.test.ts`'s no-countdown test is what keeps it true; this is a named gap rather than a green",
    );
  }

  // ---- 10. THE BAR ITSELF, THE ONE READING A COPY CHANGE CANNOT FAKE -------
  //
  // Every other claim in this section reads a STRING out of `LIFT_COPY` — the
  // brace lines, the eccentric census, the subtitle, the lockout pair. A build
  // that renamed a lift's copy and left its arithmetic alone would move all of
  // them together and none of them would notice.
  //
  // `session-weight` is different in kind: `SetView` renders
  // `totalKgFor(plan.loadRatio, plan.e1rmKg)`, and `plan.e1rmKg` is the CHOSEN
  // LIFT'S OWN `STARTING_E1RM` seed — three different numbers for three lifts.
  // So three distinct weights is the reading that says the chip retargeted the
  // PLAN and not merely the caption.
  //
  // It is also why that field is still in `WATCHED_IDS` while
  // `session-set-label` came out of it: this is the predicate it was missing,
  // and CLAUDE.md calls a watched value with no predicate worse than an absent
  // one.
  const ladderWeights = Object.fromEntries(
    LADDER_KINDS.map((kind) => [kind, weightsIn(ladderRuns[kind]?.best?.ladder)]),
  );
  const oneWeightEach = LADDER_KINDS.filter((kind) => ladderWeights[kind].length === 1);
  const distinctWeights = new Set(oneWeightEach.map((kind) => ladderWeights[kind][0]));
  if (oneWeightEach.length === LADDER_KINDS.length) {
    check(
      distinctWeights.size === LADDER_KINDS.length,
      `LADDER: the ${LADDER_KINDS.length} lifts were prescribed ${LADDER_KINDS.length} DIFFERENT weights, so the chip moved the PLAN and not only the copy`,
      `${distinctWeights.size} distinct: ${LADDER_KINDS.map((kind) => `${kind}=${ladderWeights[kind][0]}`).join(', ')}`,
    );
  } else {
    skip(
      `LADDER: the ${LADDER_KINDS.length} lifts were prescribed ${LADDER_KINDS.length} DIFFERENT weights`,
      `${oneWeightEach.length} of ${LADDER_KINDS.length} lifts reported exactly one weight on the bar this run (${LADDER_KINDS.map((kind) => `${kind}=${JSON.stringify(ladderWeights[kind])}`).join(', ')}), so there is no set of ${LADDER_KINDS.length} to be distinct. NOT re-pinned at the smaller number`,
    );
  }
}

// ---------------------------------------------------------------------------
// CROSS-ARM: three different components, so one is not the others
// ---------------------------------------------------------------------------
if (CROSS_ARM_REQUESTED) {
  const debug = results.find((r) => r.arm === 'debug');
  const played = PLAYED_ARMS.map((arm) => results.find((r) => r.arm === arm.id));
  const readable = (result) =>
    result?.reached === true && result.target !== null && result.target !== undefined;
  const usable = [debug, ...played].filter(readable);

  check(
    usable.length === ARMS.length,
    `CROSS-ARM: all ${ARMS.length} arms produced a reading to compare`,
    `${usable.length} of ${ARMS.length}: ${[debug, ...played].map((r) => `${r?.arm ?? '?'}=${readable(r) ? 'read' : 'no reading'}`).join(', ')}`,
  );

  if (usable.length === ARMS.length) {
    // Non-vacuity on the whole "drive three arms" premise, as a count: the three
    // touch targets must be DIFFERENT elements, and the played ones must have
    // been reached without a query string, or a played arm has silently fallen
    // back to the debug one and every played reading is a debug reading wearing
    // a played label.
    const targets = new Set(usable.map((r) => r.touchTestId));
    check(
      targets.size === ARMS.length,
      `CROSS-ARM: the ${ARMS.length} arms are ${ARMS.length} different elements`,
      `${targets.size} distinct: ${usable.map((r) => `${r.arm}=${r.touchTestId}@${JSON.stringify(r.queryString)}`).join(', ')}`,
    );
    const playedWithNoQuery = played.filter((r) => r.queryString === '').length;
    check(
      playedWithNoQuery === PLAYED_ARMS.length,
      `CROSS-ARM: both played arms were read with NO query string in the address bar`,
      `${playedWithNoQuery} of ${PLAYED_ARMS.length}; ${played.map((r) => `${r.arm}=${JSON.stringify(r.queryString)}`).join(', ')} against debug ${JSON.stringify(debug.queryString)}`,
    );

    // AND THE COMPARISON THE WHOLE TOOL EXISTS FOR. A fix that is on the debug
    // harness and not on a played screen is a fix a player never gets, and it is
    // invisible to every source scan that names one file. Compared per played
    // arm rather than in aggregate, so a report names which screen is bare.
    for (const arm of played) {
      const differing = READABLE_PROPERTIES.filter(
        (p) =>
          (p.on === 'target' ? arm.target.self : arm.text.self)[p.key] !==
          (p.on === 'target' ? debug.target.self : debug.text.self)[p.key],
      );
      check(
        differing.length === 0,
        `CROSS-ARM: the ${arm.arm} surface and the replay harness compute the SAME press properties`,
        differing.length === 0
          ? `every one of the ${READABLE_PROPERTIES.length} readable properties matches on both`
          : `${differing.length} of ${READABLE_PROPERTIES.length} differ: ${differing
              .map(
                (p) =>
                  `${p.cssName} on the ${p.on} — ${arm.arm}=${JSON.stringify((p.on === 'target' ? arm.target.self : arm.text.self)[p.key])} debug=${JSON.stringify((p.on === 'target' ? debug.target.self : debug.text.self)[p.key])}`,
              )
              .join('; ')}`,
      );
      // The behavioural consequence, stated as its own line so it is not read
      // off a style table by a human doing the inference.
      //
      // AND IT IS SKIPPED BY NAME RATHER THAN COMPARED AGAINST `undefined` when
      // the arm never got its pan. `undefined === 0` is false, so this used to
      // go RED with a message about a cancel count on an arm whose real problem
      // was three screens earlier — a failure that names the wrong thing is the
      // half-check this file's own header warns about.
      if (arm.pans?.['as-shipped'] === undefined) {
        skip(
          `CROSS-ARM: a press behaves the same on the ${arm.arm} surface as on the replay harness`,
          `the ${arm.arm} arm took no pan this run${arm.why === null || arm.why === undefined ? '' : ` (${arm.why})`}, so there is no reading to compare and nothing is substituted for one`,
        );
      } else {
        check(
          arm.pans['as-shipped'].cancels === debug.pans?.['as-shipped']?.cancels,
          `CROSS-ARM: a press behaves the same on the ${arm.arm} surface as on the replay harness`,
          `${arm.arm} pointercancel=${arm.pans['as-shipped'].cancels} vs debug pointercancel=${debug.pans?.['as-shipped']?.cancels}`,
        );
      }
    }
  }
}

check(pageErrors.length === 0, 'no page errors while driving', pageErrors.slice(0, 3).join(' | ') || 'none');

await browser.close();

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------
const record = {
  capturedFrom,
  probe: PRESS_PROBE,
  meetProbe: MEET_PROBE,
  meetRun: { ...meetRun, probesByLift: Object.fromEntries(meetRun.probesByLift) },
  properties: PRESS_PROPERTIES,
  calloutUnsupported: CALLOUT_UNSUPPORTED,
  arms: results,
  ladder: {
    kinds: LADDER_KINDS,
    prompts: LIFT_PROMPTS,
    ascentPrompts: ASCENT_PROMPTS,
    eccentricOnlyPrompts: ECCENTRIC_ONLY_PROMPTS,
    eccentricLineCount: ECCENTRIC_LINE_COUNT,
    droppedReason: DEADLIFT_DROPPED_REASON,
    tuning: LIFT_LADDER,
    lockoutTuning: DEADLIFT_LOCKOUT,
    runs: ladderRuns,
  },
  checks,
  skipped,
  failures: reds().map((c) => ({ what: c.what, detail: c.detail })),
  pageErrors,
};
const recordPath = path.join(outDir, 'press.json');
await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);

console.log('');
console.log(`record: ${recordPath}`);
console.log(`log:    ${RUN_LOG_PATH}`);
console.log(`skipped: ${skipped.length} named check(s)`);
if (failed > 0) {
  console.log(`\nFAILED ${failed} of ${checks.length} checks:`);
  for (const c of reds()) console.log(`  - ${c.what}${c.detail === null ? '' : ` — ${c.detail}`}`);
  process.exit(1);
}
console.log(`\nPASSED ${checks.length} checks against the running app.`);
