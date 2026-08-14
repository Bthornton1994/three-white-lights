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
 * The fix is `PRESS_NOT_SELECT` in `src/lift/LiftScreen.tsx`. `src/lift/
 * liftInput.test.ts` guards it and SAYS IN ITS OWN HEADER what it cannot do:
 * `vitest.config.ts` is `environment: node`, nothing renders, so it proves the
 * three properties are DECLARED and can say nothing about whether they reached
 * a DOM node or whether a press behaves. This tool is that missing half.
 *
 * ===========================================================================
 * WHICH ARM IS DRIVEN, AND WHY BOTH
 * ===========================================================================
 * CLAUDE.md: "A screen a player reaches needs a check that reaches it the way a
 * player does." `tools/capture-lift.mjs` and `tools/verify-lift-shots.mjs` both
 * reach the lift renderer through `?replay=<load>&moment=<id>`, a debug route.
 * That rule was earned on `frozenMeetFor`, where the debug arm and the played
 * arm were literally different code and 103 green checks had never pressed an
 * exit on a meet a player opened.
 *
 * IT IS EARNED AGAIN HERE. The two arms are not the same component:
 *
 *   - the DEBUG arm renders `LiftScreen` (`AppShell.tsx`: `route.surface ===
 *     'replay'`), whose touch target is `lift-touch`;
 *   - the PLAYED arm — the daily session, GDD §3.2, no query string — renders
 *     `SessionScreen` → `SetView`, whose touch target is `session-touch`.
 *     `SetView.tsx` says in its own header that "`LiftScreen` itself is
 *     deliberately NOT reused whole".
 *
 * So a claim about `lift-touch` is not a claim about what a player presses, and
 * this tool refuses to make one. Both arms are driven, both are reported, the
 * played arm asserts the address bar carries no query string at the moment the
 * styles are read, and a cross-arm check compares the two directly.
 *
 * ===========================================================================
 * TWO PROBES, AND ONLY ONE OF THEM HAS A LIVE DOMAIN HERE
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
 *     DOMAIN: DEAD on both arms, MEASURED rather than assumed. The touch target
 *     is a Skia `<canvas>` filling the whole element (`STAGE_W x STAGE_H`), and
 *     `document.caretRangeFromPoint` at the probe point returns the CANVAS node
 *     at offset 0 — there is no text position under the finger. Forcing
 *     `user-select: text` onto the element changes nothing: Blink will not
 *     start a selection inside a replaced element, so no value of the fix makes
 *     this probe red. It is reported as unproven, not as green.
 *
 *   PROBE 2 — THE BROWSER TAKING THE GESTURE. Dispatch a real touch pan and
 *     count `pointercancel` events. A `pointercancel` is the browser saying it
 *     has claimed the pointer for its own gesture and the app will not hear
 *     about it again — literally `touchAction`'s half of the bug, the half
 *     `LiftScreen.tsx`'s own comment calls "the one a screenshot cannot show".
 *     DOMAIN: LIVE, demonstrated in both directions on the same element —
 *     `touch-action: none` gives 0 cancels, `manipulation` gives 1, `auto`
 *     gives 1. That is the behavioural check this tool actually rests on.
 *
 * ===========================================================================
 * TWO GESTURES, BECAUSE A PERFECTLY STILL PRESS SELECTS NOTHING ANYWHERE
 * ===========================================================================
 * Measured on this engine: a press held 900ms with no movement leaves a
 * COLLAPSED caret on plain selectable text — `rangeCount 1`, `toString()`
 * empty. So "a still press-and-hold produced no selection" is true of every
 * element on the page including the ones with no fix on them, and reading it as
 * evidence about the fix would be the empty-domain shape one level out. Both
 * gestures are run and both are reported; the drifting one is the only one
 * whose control selects, and `stillGestureIsInert` below asserts that
 * limitation is still true so it cannot silently stop being the reason.
 *
 * ===========================================================================
 * THE RECORD IS DELIBERATELY UNTRACKED WHILE THIS TOOL IS RED
 * ===========================================================================
 * `.gauntlet/shots/lift-press/press.json` carries `capturedFrom` and a
 * per-check `failures` list, which is the shape `tools/evidence.mjs` requires
 * of a tracked record — but CLAUDE.md also says "do not commit a browser record
 * while its check is red; a red record tracked as evidence is worse than an
 * absent one", and `checkCommittedShots` reports any tracked record with a
 * non-empty `failures` as a problem for every session on this host.
 *
 * So the record is written and left untracked, and the two edits that track it
 * the day this goes green are named here rather than left to be rediscovered:
 * a `!.gauntlet/shots/lift-press/` negation in `.gitignore` (the CONTENTS rule
 * that file already explains), and a `'.gauntlet/shots/lift-press/press.json'`
 * row in `REQUIRED_SHOT_RECORDS` in `tools/evidence.mjs`.
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
 *
 * Usage:
 *   node tools/verify-lift-press.mjs [--url URL] [--out DIR] [--arms both|played|debug]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { openSessionToFirstSet, readLoop } from './sessionDrive.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(HERE, '..');

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/lift-press'));
const armsWanted = flag('arms', 'both');

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
 * The three properties the fix is made of, with what each one alone leaves
 * broken and how it is read off a live element.
 *
 * Restated here rather than imported from `LiftScreen.tsx`: CLAUDE.md's rule
 * for `capture-lift.mjs`'s moment list applies identically — a check that reads
 * its expectations out of the module under test agrees with a broken module.
 */
const PRESS_PROPERTIES = Object.freeze([
  Object.freeze({
    key: 'userSelect',
    cssName: 'user-select',
    expected: 'none',
    leaves: 'the surface highlights and selection handles appear',
  }),
  Object.freeze({
    key: 'touchAction',
    cssName: 'touch-action',
    expected: 'none',
    leaves: 'the browser claims the gesture before the handler sees it',
  }),
  Object.freeze({
    key: 'WebkitTouchCallout',
    cssName: '-webkit-touch-callout',
    expected: 'none',
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
 * The arms, with the element a finger lands on and a named CONTROL element on
 * the SAME screen that carries none of the three properties.
 *
 * The control is what makes the selection probe an instrument. It has to be on
 * the same page, driven by the same gesture, in the same browser, or it is
 * measuring something else.
 */
const ARMS = Object.freeze([
  Object.freeze({
    id: 'played',
    what: 'the daily session (GDD §3.2) — reached through the app’s own controls, no query string',
    touchTestId: 'session-touch',
    controlTestId: 'session-prompt',
    expectQueryString: '',
  }),
  Object.freeze({
    id: 'debug',
    what: `the replay harness — reached by ?${PRESS_PROBE.DEBUG_REPLAY}, which no player can type`,
    touchTestId: 'lift-touch',
    controlTestId: 'lift-prompt',
    expectQueryString: `?${PRESS_PROBE.DEBUG_REPLAY}`,
  }),
]);

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
    ['verify-lift-press.mjs', 'sessionDrive.mjs'].map((name) => {
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
        // the played arm was measured carrying. React Native Web's `Pressable`
        // ships `touchAction: 'manipulation'` on its own `active` style, so
        // this is not an invented worst case — it is the default a Pressable
        // has when nobody adds the fix.
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
 * `touchmove` cancelability is recorded beside it and deliberately NOT asserted
 * on: measured, it reads `[true, false, false, ...]` identically at
 * `touch-action: none`, `manipulation` and `auto`, so it does not discriminate
 * and a check on it would be decoration. The cancel count does discriminate,
 * and both numbers are in the record so the next reader can see which one was
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

async function openArm(page, arm) {
  if (arm.id === 'debug') {
    await page.goto(`${url}/?${PRESS_PROBE.DEBUG_REPLAY}`, { waitUntil: 'load', timeout: PRESS_PROBE.BOOT_MS });
    await page.getByTestId(arm.touchTestId).waitFor({ state: 'visible', timeout: PRESS_PROBE.BOOT_MS });
    await page.waitForTimeout(PRESS_PROBE.DEBUG_SETTLE_MS);
    return { reached: true };
  }
  // THE PLAYED PATH. `openSessionToFirstSet` launches with NO query string and
  // plays GDD §3.2's opening beats with a mouse — three readiness answers and
  // an RPE — which is the only way to a work set. No `?session=` frame: those
  // set `preview`, and a previewed set is not a set a player pressed.
  const opened = await openSessionToFirstSet(page, url);
  if (!opened.reached) return { reached: false, why: opened.why ?? 'the session never reached a work set' };
  const back = await waitForStage(page, arm.touchTestId);
  if (!back.ok) return { reached: false, why: `no ${arm.touchTestId} on the first work set` };
  return { reached: true, firstPrompt: opened.state?.prompt ?? null };
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

const armsToRun = ARMS.filter((a) => armsWanted === 'both' || armsWanted === a.id);
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
  // 1. COMPUTED STYLE, off the live element
  // -------------------------------------------------------------------------
  const target = await readTarget(page, arm.touchTestId);
  const control = await readTarget(page, arm.controlTestId);
  check(target !== null, `ARM ${arm.id}: ${arm.touchTestId} is in the DOM`, target === null ? 'absent' : target.tag);
  check(
    control !== null,
    `ARM ${arm.id}: the control element ${arm.controlTestId} is in the DOM`,
    control === null ? 'absent' : `${control.tag} "${control.textInside}"`,
  );
  if (target === null || control === null) {
    results.push({ arm: arm.id, reached: true, target, control });
    continue;
  }

  console.log(`  computed on ${arm.touchTestId}: ${JSON.stringify(target.self)}`);
  console.log(`  under the finger (${target.hitTarget?.tag}): ${JSON.stringify(target.hitTarget)}`);
  console.log(`  computed on ${arm.controlTestId}: ${JSON.stringify(control.self)}`);
  console.log(`  caretRangeFromPoint at the probe point: ${JSON.stringify(target.caretAtCentre)}`);

  for (const prop of PRESS_PROPERTIES) {
    if (prop.key === CALLOUT_UNSUPPORTED) {
      skip(
        `ARM ${arm.id}: ${prop.cssName} on ${arm.touchTestId} — without it ${prop.leaves}`,
        `Blink does not implement ${prop.cssName}; getComputedStyle returns ${JSON.stringify(target.self.webkitTouchCallout)} on an element that declares it, so no reading here would be about the app. The declaration stays covered by the source scan in src/lift/liftInput.test.ts.`,
      );
      continue;
    }
    const seen = target.self[prop.key];
    check(
      seen === prop.expected,
      `ARM ${arm.id}: ${arm.touchTestId} computes ${prop.cssName}: ${prop.expected} — without it ${prop.leaves}`,
      `read ${JSON.stringify(seen)}, wanted ${JSON.stringify(prop.expected)}`,
    );
  }

  // The element the finger actually lands on. `user-select` inherits, so the
  // canvas inside the stage should carry the value down; `touch-action` does
  // not, so only the inherited one is asserted here and the other is reported.
  check(
    target.hitTarget !== null && target.hitTarget.userSelect === 'none',
    `ARM ${arm.id}: the element UNDER the finger inherits user-select: none`,
    `${target.hitTarget?.tag} reads ${JSON.stringify(target.hitTarget?.userSelect)}`,
  );

  // NON-VACUITY ON THE STYLE READS, AS A COUNT RATHER THAN A BOUND: the control
  // must NOT carry the fix, or "the target has it and the control does not" is
  // being read off two elements that are the same.
  const controlCarrying = READABLE_PROPERTIES.filter((p) => control.self[p.key] === p.expected).length;
  check(
    controlCarrying === 0,
    `ARM ${arm.id}: the control element carries 0 of the ${READABLE_PROPERTIES.length} readable properties`,
    `${controlCarrying} of ${READABLE_PROPERTIES.length}; control reads ${JSON.stringify({ userSelect: control.self.userSelect, touchAction: control.self.touchAction })}`,
  );

  // -------------------------------------------------------------------------
  // 2. PROBE 1 — SELECTION, and its own domain
  // -------------------------------------------------------------------------
  // ORDER MATTERS ON THE PLAYED ARM AND IT IS NOT COSMETIC. Every press on the
  // stage plays a rep, and three reps end the set and swap the screen for a
  // rest. The control reading is taken FIRST, while the set is still the one
  // that was opened — an earlier version of this file took it last and read a
  // REST screen through a `session-prompt` selector that still resolved.
  const readings = {};
  readings['control-drift'] = await probeSelection(page, arm.controlTestId, 'control-drift', true);
  readings['control-still'] = await probeSelection(page, arm.controlTestId, 'control-still', false);

  await waitForStage(page, arm.touchTestId);
  readings['as-shipped-drift'] = await probeSelection(page, arm.touchTestId, 'as-shipped-drift', true);
  await waitForStage(page, arm.touchTestId);
  readings['as-shipped-still'] = await probeSelection(page, arm.touchTestId, 'as-shipped-still', false);

  await waitForStage(page, arm.touchTestId);
  const forcedOff = await forceProperties(page, arm.touchTestId, 'off');
  readings['neutralised-drift'] = await probeSelection(page, arm.touchTestId, 'neutralised-drift', true);
  readings['neutralised-drift'].forcedTo = forcedOff;

  const restoredTo = await forceProperties(page, arm.touchTestId, null);
  await waitForStage(page, arm.touchTestId);
  readings['restored-drift'] = await probeSelection(page, arm.touchTestId, 'restored-drift', true);
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
  // If this is not red-capable, nothing that reads a selection is evidence.
  const cd = readings['control-drift'];
  check(
    cd.selected === true,
    `ARM ${arm.id}: CONTROL — the same press-hold-and-drift on ${arm.controlTestId} DOES select`,
    `rangeCount=${cd.selection?.rangeCount} collapsed=${cd.selection?.isCollapsed} text=${JSON.stringify(cd.selection?.text)}`,
  );

  // ---- THE LIMIT THAT DECIDES WHY THERE ARE TWO GESTURES ------------------
  // Asserted rather than described, so it cannot silently stop being true and
  // leave the header explaining a limitation that has gone away.
  const cst = readings['control-still'];
  check(
    cst.selected === false,
    `ARM ${arm.id}: LIMIT — a STILL press-and-hold selects nothing even on unfixed text, so still-press readings are not evidence`,
    `rangeCount=${cst.selection?.rangeCount} collapsed=${cst.selection?.isCollapsed} text=${JSON.stringify(cst.selection?.text)}`,
  );

  // ---- THE CLAIM, WHICH MAY ONLY PASS IF IT COULD HAVE FAILED -------------
  // CLAUDE.md: "a pointer to a test that cannot fail is the same defect one
  // level out." So the claim's `ok` carries its own domain: no selection AND a
  // demonstration that neutralising the fix on THIS element produces one.
  const shipped = readings['as-shipped-drift'];
  const neutralised = readings['neutralised-drift'];
  const domainLive = neutralised.selected === true;
  const noSelection = shipped.selected === false && shipped.selection?.rangeCount === 0;
  check(
    noSelection && domainLive,
    `ARM ${arm.id}: PROBE 1 — a press-and-hold on ${arm.touchTestId} leaves NO selection, AND that could have gone the other way`,
    `as-shipped rangeCount=${shipped.selection?.rangeCount} text=${JSON.stringify(shipped.selection?.text)}; ` +
      (domainLive
        ? `DOMAIN LIVE — neutralised rangeCount=${neutralised.selection?.rangeCount} text=${JSON.stringify(neutralised.selection?.text)}`
        : `DOMAIN DEAD — with user-select forced to ${JSON.stringify(neutralised.forcedTo?.userSelect)} the same gesture still selects nothing (rangeCount=${neutralised.selection?.rangeCount}), so no value of the fix makes this red. caretRangeFromPoint at the probe point is ${JSON.stringify(target.caretAtCentre)}: the touch target is a Skia <canvas> with no text position under the finger, and Blink will not start a selection inside a replaced element. The "no selection" half is TRUE and is NOT EVIDENCE.`),
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
  const pans = {};
  await waitForStage(page, arm.touchTestId);
  pans['as-shipped'] = await probePan(page, cdp, arm.touchTestId, 'as-shipped');
  pans['as-shipped'].touchAction = target.self.touchAction;

  await waitForStage(page, arm.touchTestId);
  pans['as-shipped-small'] = await probePan(page, cdp, arm.touchTestId, 'as-shipped-small', PRESS_PROBE.SMALL_PAN_PX);
  pans['as-shipped-small'].touchAction = target.self.touchAction;

  await waitForStage(page, arm.touchTestId);
  const panNeutralised = await forceProperties(page, arm.touchTestId, 'pan');
  pans['neutralised'] = await probePan(page, cdp, arm.touchTestId, 'neutralised');
  pans['neutralised'].forcedTo = panNeutralised;

  await waitForStage(page, arm.touchTestId);
  const panFixed = await forceProperties(page, arm.touchTestId, 'on');
  pans['forced-fixed'] = await probePan(page, cdp, arm.touchTestId, 'forced-fixed');
  pans['forced-fixed'].forcedTo = panFixed;
  await forceProperties(page, arm.touchTestId, null);

  for (const name of Object.keys(pans)) {
    const p = pans[name];
    console.log(
      `  pan ${name.padEnd(18)} ${String(p.panPx).padStart(3)}px  touch-action=${JSON.stringify(p.forcedTo?.touchAction ?? p.touchAction)} -> pointercancel=${p.cancels} over ${p.moves} touchmoves`,
    );
  }

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
  // fewer — measured at 3 on both arms, and not pinned at 3 because that number
  // is the engine's coalescing policy rather than anything about this app.
  //
  // What IS pinned exactly is a count of PANS, in both directions: how many ran
  // at full size and landed all their moves, and how many of all the pans put
  // at least one touchmove on the page. Neither is a bound on a measurement.
  const panNames = Object.keys(pans);
  const pansThePageSaw = panNames.filter((n) => pans[n].moves > 0).length;
  check(
    pansThePageSaw === panNames.length,
    `ARM ${arm.id}: PROBE 2 — all ${panNames.length} pans put a touchmove on the page, so none of the cancel counts is a count of nothing`,
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
  const quietFull = panNames.filter((n) => pans[n].panPx === PRESS_PROBE.PAN_PX && pans[n].cancels === 0);
  const quietFullIntact = quietFull.filter((n) => pans[n].moves === PRESS_PROBE.PAN_STEPS).length;
  const truncated = panNames.filter((n) => pans[n].cancels > 0 && pans[n].moves < PRESS_PROBE.PAN_STEPS);
  check(
    quietFullIntact === quietFull.length,
    `ARM ${arm.id}: PROBE 2 — every uncancelled full-size pan delivered its whole ${PRESS_PROBE.PAN_STEPS}-move stream`,
    `${quietFullIntact} of ${quietFull.length} uncancelled full pans intact` +
      (truncated.length === 0
        ? '; no pan was cancelled here'
        : `; and the ${truncated.length} cancelled pan(s) truncated — ${truncated.map((n) => `${n} stopped at ${pans[n].moves}/${PRESS_PROBE.PAN_STEPS}`).join(', ')}, which is the browser going quiet on the app mid-gesture`),
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
    `pointercancel=${pans['as-shipped-small'].cancels} at ${PRESS_PROBE.SMALL_PAN_PX}px vs ${pans['as-shipped'].cancels} at ${PRESS_PROBE.PAN_PX}px, both with touch-action ${JSON.stringify(pans['as-shipped-small'].touchAction)}; wanted exactly ${PRESS_PROBE.PAN_CANCELS_WHEN_TOUCH_ACTION_NONE}`,
  );

  await waitForStage(page, arm.touchTestId);
  const shotPath = path.join(outDir, `${arm.id}-surface.png`);
  await page.screenshot({ path: shotPath }).catch(() => {});

  results.push({
    arm: arm.id,
    what: arm.what,
    reached: true,
    queryString: search,
    touchTestId: arm.touchTestId,
    controlTestId: arm.controlTestId,
    target,
    control,
    readings,
    pans,
    shot: path.relative(outDir, shotPath),
  });
}

// ---------------------------------------------------------------------------
// CROSS-ARM: the two arms are different components, so one is not the other
// ---------------------------------------------------------------------------
if (armsWanted === 'both') {
  const played = results.find((r) => r.arm === 'played');
  const debug = results.find((r) => r.arm === 'debug');
  const both = played?.reached === true && debug?.reached === true && played.target && debug.target;
  if (!both) {
    check(false, 'CROSS-ARM: both arms produced a reading to compare', JSON.stringify({ played: played?.reached, debug: debug?.reached }));
  } else {
    // Non-vacuity on the whole "drive both arms" premise, as a count: the two
    // touch targets must be DIFFERENT elements reached by DIFFERENT URLs, or
    // the played arm has silently fallen back to the debug one and every played
    // reading is a debug reading wearing a played label.
    check(
      played.touchTestId !== debug.touchTestId && played.queryString !== debug.queryString,
      'CROSS-ARM: the two arms are different elements reached by different URLs',
      `played ${played.touchTestId} at ${JSON.stringify(played.queryString)} vs debug ${debug.touchTestId} at ${JSON.stringify(debug.queryString)}`,
    );
    // AND THE COMPARISON THE WHOLE TOOL EXISTS FOR. A fix that is on the debug
    // harness and not on the played screen is a fix a player never gets, and it
    // is invisible to every source scan that names one file.
    const differing = READABLE_PROPERTIES.filter((p) => played.target.self[p.key] !== debug.target.self[p.key]);
    check(
      differing.length === 0,
      'CROSS-ARM: the played surface and the replay harness compute the SAME press properties',
      differing.length === 0
        ? `every one of the ${READABLE_PROPERTIES.length} readable properties matches on both arms`
        : `${differing.length} of ${READABLE_PROPERTIES.length} differ: ${differing
            .map((p) => `${p.cssName} played=${JSON.stringify(played.target.self[p.key])} debug=${JSON.stringify(debug.target.self[p.key])}`)
            .join('; ')}`,
    );
    // The behavioural consequence of that difference, stated as its own line so
    // it is not read off a style table by a human doing the inference.
    check(
      played.pans?.['as-shipped']?.cancels === debug.pans?.['as-shipped']?.cancels,
      'CROSS-ARM: a press behaves the same on the played surface as on the replay harness',
      `played pointercancel=${played.pans?.['as-shipped']?.cancels} vs debug pointercancel=${debug.pans?.['as-shipped']?.cancels}`,
    );
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
