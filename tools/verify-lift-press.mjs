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
 *   - the MEET arm — GDD §6.2's attempt, reached by pressing the shell's
 *     `shell-open-meet` pill and playing through weigh-in and openers, still
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
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { SESSION_PROMPTS, freshDepthSearch, openSessionToFirstSet, readLoop } from './sessionDrive.mjs';
import {
  MEET_DRIVE,
  driveMeetToItsEnd,
  meetSaying,
  readMeetLoop,
  untilMeet,
  waitUntilDrawn,
} from './meetDrive.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, '..');

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
  /** The shell pill that opens meet day. `AppShell` builds every pill's testID
   *  as `shell-${intent}`, and this is `shellRoute.ts`'s `open-meet` intent. */
  NAV_OPEN_MEET: 'shell-open-meet',
  /** The beat the pill is drawn on at boot: GDD §3.2's check-in. */
  CHECK_IN: 'session-check-in',
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
  /** The separator `AttemptView` builds `attempt-label` with, between the lift's
   *  name and which attempt it is. Split on rather than parsed. */
  LABEL_SEPARATOR: '·',
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
    ['verify-lift-press.mjs', 'sessionDrive.mjs', 'meetDrive.mjs'].map((name) => {
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
  search: freshDepthSearch(),
  /** How `driveMeetToItsEnd` ended, each time it was asked to advance. */
  drives: [],
};

/** The lift an attempt label names — `SQUAT · ATTEMPT 1 OF 3` -> `SQUAT`. */
const liftOf = (label) =>
  label === null ? null : String(label).split(MEET_PROBE.LABEL_SEPARATOR)[0].trim();

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
  return lifts.length >= MEET_DRIVE.SAFEST_OPTIONS.length;
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
        search: meetRun.search,
        recapSettleMs: MEET_PROBE.RECAP_SETTLE_MS,
        shouldStop: (state) => state.attempt && meetProbeAllowed(state.attemptLabel),
      });
      meetRun.search = drive.search ?? meetRun.search;
      meetRun.drives.push({ ended: drive.ended, why: drive.why, attempts: drive.attempts.length });
      if (drive.ended !== 'stopped') {
        return {
          ok: false,
          why: `the meet ended '${drive.ended}' before another attempt could be probed — ${drive.why}${whys.length === 0 ? '' : ` (after ${whys.join('; ')})`}`,
        };
      }
    }
    // The rep is pressable at the BRACE, not the instant the screen mounts.
    const braced = await untilMeet(
      page,
      (state) => meetSaying(state, SESSION_PROMPTS.BRACE) || !state.attempt,
      MEET_DRIVE.BRACE_TIMEOUT_MS,
    );
    if (!meetSaying(braced.state, SESSION_PROMPTS.BRACE)) {
      whys.push(`try ${attemptNumber + 1}: the attempt never braced — prompt was ${JSON.stringify(braced.state.prompt)}`);
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
    const pill = await waitUntilDrawn(page, MEET_PROBE.NAV_OPEN_MEET, MEET_PROBE.PILL_MS);
    if (!pill.drawn) {
      return { reached: false, why: `the way into meet day never finished being drawn — ${pill.why}` };
    }
    await page.getByTestId(MEET_PROBE.NAV_OPEN_MEET).click({ timeout: MEET_PROBE.PILL_MS }).catch(() => {});
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
  const opened = await openSessionToFirstSet(page, url);
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
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));

const armsToRun = ARMS.filter((a) => armsWanted === 'all' || armsWanted === a.id);
const results = [];

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
  check(
    panBlocked === null && gesturesTaken === GESTURE_PLAN.length,
    `ARM ${arm.id}: all ${GESTURE_PLAN.length} stage gestures were taken on a live stage`,
    panBlocked === null
      ? `${gesturesTaken} of ${GESTURE_PLAN.length}${arm.id === 'meet' ? `, on attempts ${JSON.stringify(panSurfaces)}` : ''}`
      : panBlocked,
  );
  if (panBlocked !== null) {
    results.push({ arm: arm.id, reached: true, queryString: search, target, text, readings, pans, panSurfaces, why: panBlocked });
    continue;
  }

  // AND ON THE MEET ARM, THAT THE FOUR PANS WERE FOUR DIFFERENT ATTEMPTS. A pan
  // that silently re-used a screen would report the same cancel count under two
  // names, which is the strongest-looking and emptiest thing this arm could do.
  if (arm.id === 'meet') {
    const spent = PAN_PLAN.map((step) => panSurfaces[step.name]);
    check(
      new Set(spent).size === PAN_PLAN.length,
      `ARM ${arm.id}: the ${PAN_PLAN.length} pans were spent on ${PAN_PLAN.length} DIFFERENT attempts, so no reading is a copy of another`,
      `${new Set(spent).size} distinct of ${spent.length}: ${spent.join(' | ')}`,
    );
    // AND THE QUOTA ITSELF, ASSERTED RATHER THAN DESCRIBED.
    //
    // `MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND` claims a rule: no lift takes
    // a second instrument gesture until every lift has taken one. That is the
    // whole reason the readings survive to be taken, and a rule with nothing
    // behind it is the shape this repository keeps finding in prose. Walked in
    // order over the attempts the instrument actually held.
    const seenLifts = new Set();
    const heldPerLift = new Map();
    const tooEarly = [];
    for (const label of meetRun.probedLabels) {
      const lift = liftOf(label);
      seenLifts.add(lift);
      const held = (heldPerLift.get(lift) ?? 0) + 1;
      heldPerLift.set(lift, held);
      if (held > MEET_PROBE.PROBES_PER_LIFT_BEFORE_A_SECOND && seenLifts.size < MEET_DRIVE.SAFEST_OPTIONS.length) {
        tooEarly.push(`${label} was this instrument's ${held}${'th'} on ${lift} while only ${seenLifts.size} lift(s) had been touched`);
      }
    }
    check(
      tooEarly.length === 0 && seenLifts.size === MEET_DRIVE.SAFEST_OPTIONS.length,
      `ARM ${arm.id}: no lift took a second gesture from this instrument until all ${MEET_DRIVE.SAFEST_OPTIONS.length} lifts had taken one`,
      `held in order: ${meetRun.probedLabels.join(' | ')}; per lift ${[...meetRun.probesByLift.entries()].map(([lift, n]) => `${lift}x${n}`).join(', ')}` +
        (tooEarly.length === 0 ? '' : `; VIOLATIONS: ${tooEarly.join('; ')}`),
    );
    // ...and the driver really played the ones in between, so "the meet was
    // driven" is not four gestures and nothing else. A count, not a bound.
    const drivenAttempts = meetRun.drives.reduce((total, drive) => total + drive.attempts, 0);
    check(
      drivenAttempts > 0,
      `ARM ${arm.id}: the shared driver played the attempts this instrument did not`,
      `${drivenAttempts} attempt(s) played by driveMeetToItsEnd against ${meetRun.probedLabels.length} held here; drives: ${JSON.stringify(meetRun.drives)}`,
    );
  }

  // ---- PROBE 1's OTHER READING, WHICH IS NOT A CHECK, WITH ITS EVIDENCE ---
  // CLAUDE.md asks for a NAMED SKIPPED check rather than a quiet fallback that
  // leaves the section looking complete. The stage's "no selection" reading is
  // TRUE and is NOT EVIDENCE, and this is where that is said on every run.
  const stageNeutralised = readings['stage-neutralised-drift'];
  skip(
    `ARM ${arm.id}: PROBE 1 on ${arm.touchTestId} itself — a press-and-hold on the STAGE leaves no selection`,
    stageNeutralised === undefined
      ? `NOT TAKEN ON THIS ARM. A press-and-hold on the stage spends a meet attempt, GDD §6.2 has nine, and PROBE 1's screen plus the four pans plus the four the driver needs to keep a lift off three misses is all nine. What it measures is a fact about Blink and about \`LiftStage\`, which every arm mounts identically, and it is measured on the session and debug arms in this same run. caretRangeFromPoint at this arm's probe point still reads ${JSON.stringify(target.caretAtCentre)}, which is the same CANVAS node with no text position in it.`
      : `DOMAIN DEAD, re-measured this run rather than cited: with user-select forced to ${JSON.stringify(stageNeutralised.forcedTo?.userSelect)} on the stage, the same gesture that selects ${JSON.stringify(neutralised.selection?.text)} on ${arm.textTestId} selects ${JSON.stringify(stageNeutralised.selection?.text)} here (rangeCount=${stageNeutralised.selection?.rangeCount}). caretRangeFromPoint at the probe point is ${JSON.stringify(target.caretAtCentre)}: the node under the finger is a Skia <canvas> with no text position in it, and Blink will not start a selection inside a replaced element. No value of the fix makes this red, so it is not counted either way.`,
  );

  // ---- THE PROBE'S DOMAIN, DEMONSTRATED IN BOTH DIRECTIONS ---------------
  // Same element, same pan, only `touch-action` moved. Counts pinned exactly,
  // not bounded — `>= 0` would be true of a probe that never fired at all.
  check(
    pans['neutralised'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_BROWSER_MAY_PAN,
    `ARM ${arm.id}: PROBE 2 DOMAIN — with touch-action neutralised to manipulation, the browser TAKES the gesture`,
    `pointercancel=${pans['neutralised'].cancels}, wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_BROWSER_MAY_PAN} (touch-action read back as ${JSON.stringify(pans['neutralised'].forcedTo?.touchAction)})`,
  );
  check(
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
  check(
    pansThePageSaw === panNames.length,
    `ARM ${arm.id}: PROBE 2 — the page saw all ${panNames.length} pans, so none of the cancel counts is a count of nothing`,
    `${pansThePageSaw} of ${panNames.length}; ${panNames.map((n) => `${n}=${pans[n].moves} moves @${pans[n].panPx}px, ${pans[n].cancels} cancel(s)`).join('; ')}`,
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
  check(
    pans['as-shipped'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE,
    `ARM ${arm.id}: PROBE 2 — as shipped, a ${PRESS_PROBE.PAN_PX}px drag never has the press taken away from the app mid-gesture`,
    `pointercancel=${pans['as-shipped'].cancels} with touch-action ${JSON.stringify(pans['as-shipped'].touchAction)}, wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE}`,
  );
  check(
    pans['as-shipped-small'].cancels === PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE,
    `ARM ${arm.id}: PROBE 2 — nor does a ${PRESS_PROBE.SMALL_PAN_PX}px finger drift, which is the gesture the descent actually is`,
    `pointercancel=${pans['as-shipped-small'].cancels} at ${PRESS_PROBE.SMALL_PAN_PX}px vs ${pans['as-shipped'].cancels} at ${PRESS_PROBE.PAN_PX}px, both with touch-action ${JSON.stringify(pans['as-shipped-small'].touchAction)}; wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE}. The page heard ${pans['as-shipped-small'].moves} touchmove(s) of the ${PRESS_PROBE.PAN_STEPS} dispatched before that verdict`,
  );

  const shotPath = path.join(outDir, `${arm.id}-surface.png`);
  await page.screenshot({ path: shotPath }).catch(() => {});

  results.push({
    arm: arm.id,
    what: arm.what,
    played: arm.played,
    reached: true,
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

if (armsWanted === 'all') {
  // The meet arm's whole bookkeeping, in one place a reader can check the four
  // readings against. Reported, and then compared: the count is what says the
  // instrument spent four attempts rather than describing four.
  console.log(`\n  meet run: ${JSON.stringify({ probed: meetRun.probedLabels, drives: meetRun.drives, search: meetRun.search })}`);
}

// ---------------------------------------------------------------------------
// CROSS-ARM: three different components, so one is not the others
// ---------------------------------------------------------------------------
if (armsWanted === 'all') {
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
      check(
        arm.pans?.['as-shipped']?.cancels === debug.pans?.['as-shipped']?.cancels,
        `CROSS-ARM: a press behaves the same on the ${arm.arm} surface as on the replay harness`,
        `${arm.arm} pointercancel=${arm.pans?.['as-shipped']?.cancels} vs debug pointercancel=${debug.pans?.['as-shipped']?.cancels}`,
      );
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
  checks,
  skipped,
  failures: reds().map((c) => ({ what: c.what, detail: c.detail })),
  pageErrors,
};
const recordPath = path.join(outDir, 'press.json');
await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);

console.log('');
console.log(`record: ${recordPath}`);
console.log(`skipped: ${skipped.length} named check(s)`);
if (failed > 0) {
  console.log(`\nFAILED ${failed} of ${checks.length} checks:`);
  for (const c of reds()) console.log(`  - ${c.what}${c.detail === null ? '' : ` — ${c.detail}`}`);
  process.exit(1);
}
console.log(`\nPASSED ${checks.length} checks against the running app.`);
