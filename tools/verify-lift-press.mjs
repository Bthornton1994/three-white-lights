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
 * IT IS EARNED AGAIN HERE, AND HARDER. The two arms are not the same component:
 *
 *   - the DEBUG arm renders `LiftScreen` (`AppShell.tsx`: `route.surface ===
 *     'replay'`), whose touch target is `lift-touch` and which carries the fix;
 *   - the PLAYED arm — the daily session, GDD §3.2, no query string — renders
 *     `SessionScreen` → `SetView`, whose touch target is `session-touch`.
 *     `SetView.tsx` says in its own header that "`LiftScreen` itself is
 *     deliberately NOT reused whole".
 *
 * So a claim about `lift-touch` is not a claim about what a player presses, and
 * this tool refuses to make one. Both arms are driven, both are reported, and
 * the played arm asserts the address bar carries no query string at the moment
 * the styles are read.
 *
 * ===========================================================================
 * THE PROBE'S OWN DOMAIN IS MEASURED, NOT ASSUMED
 * ===========================================================================
 * CLAUDE.md: "an assertion is vacuous if no state of the code it is meant to be
 * checking would make it red", and the sharpest shape it lists is an EMPTY
 * DOMAIN — a sweep whose generator never produces the failing case. A probe
 * that reports "no selection" on a surface where a selection is impossible is
 * exactly that, and it would read as the strongest check in this file.
 *
 * So every selection reading is taken FOUR ways at the same coordinates:
 *
 *   1. AS SHIPPED          — the subject.
 *   2. CONTROL, GESTURE    — the same gesture on a named element on the SAME
 *                            page that carries none of the three properties. If
 *                            this does not select, the gesture is not a
 *                            selection gesture and reading 1 means nothing.
 *   3. CONTROL, SUBJECT    — the same gesture on the same element with the fix
 *                            NEUTRALISED at runtime. If this does not select,
 *                            reading 1 is not evidence about the fix, whatever
 *                            it says.
 *   4. RESTORED            — neutralisation undone; must reproduce 1, or the
 *                            experiment contaminated its own subject.
 *
 * Reading 3 is the one that decides whether this tool is an instrument or a
 * decoration, and it is checked rather than assumed. `document.
 * caretRangeFromPoint` is recorded at every probe point beside it, because that
 * is the browser's own statement about whether a text position exists there at
 * all — the direct cause of an empty domain, rather than an inference from one.
 *
 * ===========================================================================
 * WHAT THIS TOOL CANNOT SAY
 * ===========================================================================
 * - It is headless desktop Chromium with touch emulation, not a phone. It
 *   cannot reproduce iOS Safari's press-and-hold callout, and
 *   `-webkit-touch-callout` is not implemented by this engine at all — see
 *   `CALLOUT_UNSUPPORTED` below, which is reported as a NAMED SKIPPED check
 *   rather than folded into a green.
 * - It does not judge whether the lift FEELS right (GDD §12.1). It judges
 *   whether the browser takes the press.
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

import { openSessionToFirstSet, readLoop, SESSION_PROMPTS } from './sessionDrive.mjs';

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
 * shape, kept here for the same reason `SESSION_DRIVE` keeps its own: somebody
 * re-tuning the mechanic gets one place to look when the robot stops keeping up
 * with it.
 *
 * HOLD_MS IS NOT A GUESS AT THE MECHANIC'S BAND. `sessionDrive.mjs` derives
 * ~710-1150ms as the legal depth window and holds 1000. This gesture is not
 * trying to play a legal rep — it is trying to look like a finger that stayed
 * down long enough for a browser to call it a long press. Chromium's own
 * long-press threshold is ~500ms, so anything comfortably past that is the
 * whole requirement, and 900 sits above it while staying inside the mechanic's
 * band so the played arm's rep resolves normally instead of hanging.
 */
const PRESS_PROBE = Object.freeze({
  /** How long the finger stays down. See the paragraph above. */
  HOLD_MS: 900,
  /**
   * A real thumb does not stay on one pixel. The drift is what turns a press
   * into a drag as far as the browser is concerned, and a drag is what starts a
   * selection — a perfectly still press selects nothing anywhere, on any
   * element, which would make every reading below trivially clean.
   */
  DRIFT_PX: 10,
  /** How many move events the drift is broken into. */
  DRIFT_STEPS: 8,
  /** How long a settle after the gesture before the selection is read. */
  READ_SETTLE_MS: 250,
  /** Skia's first paint of a frozen replay frame. */
  DEBUG_SETTLE_MS: 1200,
  /** How long to wait for a work set to come back after a rest. */
  STAGE_RETURN_MS: 90000,
  /** Poll interval while waiting for a stage. */
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
 *
 * `cssName` is what `getComputedStyle` is asked for. `expected` is the value a
 * fixed surface must report.
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
 * `-webkit-touch-callout` is a WebKit/iOS property. Blink parses it in no
 * version this tool has run against: `getComputedStyle(el)
 * .getPropertyValue('-webkit-touch-callout')` returns the empty string on an
 * element that declares it, and the declaration is dropped from the parsed
 * stylesheet too. So its computed value is unreadable HERE, and an
 * `expected === actual` check on it would be a check on Chromium's property
 * table rather than on the app.
 *
 * It is therefore reported as a NAMED SKIPPED check, which is what CLAUDE.md
 * asks for when an arm cannot be driven: "the honest output is a named SKIPPED
 * check, not a quiet fallback that leaves the section looking complete."
 * Whether the declaration is present at all stays covered by the source scan in
 * `src/lift/liftInput.test.ts`, and that division is stated in both files.
 */
const CALLOUT_UNSUPPORTED = 'WebkitTouchCallout';

/**
 * The arms, with the element a finger lands on and a named CONTROL element on
 * the SAME screen that carries none of the three properties.
 *
 * The control is what makes the selection probe an instrument. It has to be on
 * the same page, read by the same gesture, in the same browser, or it is
 * measuring something else.
 */
const ARMS = Object.freeze([
  Object.freeze({
    id: 'played',
    what: 'the daily session (GDD §3.2) — reached through the app’s own controls, no query string',
    touchTestId: 'session-touch',
    controlTestId: 'session-prompt',
    /** Asserted at the moment the styles are read. See `queryString` below. */
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

/** The four readings every probe point is taken at. Order is the order run. */
const READINGS = Object.freeze(['as-shipped', 'control-gesture', 'control-subject', 'restored']);

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
/** A check that could not be run, recorded as neither a pass nor a failure. */
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
 * means: turn `PRESS_PROBE.DRIFT_PX` to 0 and every "no selection" reading here
 * becomes true of every element on the page, with the same SHA and every "ok"
 * line intact.
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
 * target is not the whole story if a descendant re-enables it, and an `auto` on
 * the target can still compute to `none` under a `none` parent. `touch-action`
 * does not inherit, which is why the target's own value is the one that decides
 * it — both facts are recorded rather than assumed, so a reader can check the
 * reasoning against the numbers.
 *
 * `hitTarget` is what `elementFromPoint` says is actually under the finger,
 * which on this screen is the Skia `<canvas>` and NOT the element carrying the
 * style. That distinction is the whole reason the domain question below exists.
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
      chain.push({
        tag: n.tagName,
        testid: n.getAttribute('data-testid'),
        ...readAll(n),
      });
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
      hitTarget:
        hit === null
          ? null
          : { tag: hit.tagName, testid: hit.getAttribute('data-testid'), ...readAll(hit) },
      /**
       * The browser's own answer to "is there a text position here". A CANVAS
       * node at offset 0 means there is not one INSIDE anything — which is the
       * direct cause of an empty selection domain, recorded as a measurement
       * rather than inferred from a run of empty readings.
       */
      caretAtCentre:
        caret === null
          ? null
          : {
              node: caret.startContainer.nodeName,
              offset: caret.startOffset,
              text: String(caret.startContainer.textContent ?? '').slice(0, 40),
            },
      textInside: (el.textContent ?? '').trim().slice(0, 80),
    };
  }, testId);

/** What the document thinks is selected, in full. */
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
 * Turn the three properties off (`force: 'off'`) or on (`force: 'on'`) on one
 * element, or put it back (`force: null`).
 *
 * `user-select: text`, NOT `auto`. Per CSS UI 4 an `auto` under a `none` parent
 * COMPUTES to `none`, so "neutralise the fix" written as `auto` would be a
 * no-op wherever an ancestor also carries `none` — a control that quietly does
 * nothing, which is worse than no control. `text` is unconditional.
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
      } else {
        for (const p of props) el.style.removeProperty(p);
      }
      const cs = getComputedStyle(el);
      return {
        userSelect: cs.getPropertyValue('user-select'),
        touchAction: cs.getPropertyValue('touch-action'),
      };
    },
    { id: testId, force },
  );

// ---------------------------------------------------------------------------
// The gesture
// ---------------------------------------------------------------------------
/**
 * A press-and-hold with a finger's drift, at the centre of one element.
 *
 * Mouse rather than `Input.dispatchTouchEvent`, and the reason is measured
 * rather than preferred: a CDP touch hold on this page places a COLLAPSED caret
 * (`rangeCount 1`, `toString()` empty) on selectable text and nothing at all on
 * the stage, so it discriminates only between "a text position exists here" and
 * "one does not" — the same thing `caretAtCentre` already reports, with more
 * moving parts. The mouse press-and-drift produces a real, non-collapsed,
 * readable RANGE on selectable text, which is the thing a player would see
 * highlighted, so it is the stronger of the two and it is what the control
 * proves bites.
 */
async function pressAndHold(page, box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const per = PRESS_PROBE.HOLD_MS / PRESS_PROBE.DRIFT_STEPS;
  const stepPx = PRESS_PROBE.DRIFT_PX / PRESS_PROBE.DRIFT_STEPS;
  for (let i = 1; i <= PRESS_PROBE.DRIFT_STEPS; i += 1) {
    await page.waitForTimeout(per);
    await page.mouse.move(cx + i * stepPx, cy + i * stepPx);
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
async function probe(page, testId, label) {
  await clearSelection(page);
  const before = await readSelection(page);
  const box = await page.getByTestId(testId).boundingBox().catch(() => null);
  if (box === null) return { label, testId, reached: false, why: `${testId} has no box` };
  await pressAndHold(page, box);
  const after = await readSelection(page);
  return {
    label,
    testId,
    reached: true,
    clearedBefore: before !== null && before.rangeCount === 0,
    box,
    selection: after,
    /** The one derived boolean every check below reads. */
    selected: after !== null && after.rangeCount > 0 && after.text.length > 0 && !after.isCollapsed,
  };
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
    await page
      .getByTestId(arm.touchTestId)
      .waitFor({ state: 'visible', timeout: PRESS_PROBE.BOOT_MS });
    await page.waitForTimeout(PRESS_PROBE.DEBUG_SETTLE_MS);
    return { reached: true };
  }
  // THE PLAYED PATH. `openSessionToFirstSet` launches with NO query string and
  // plays GDD §3.2's opening beats with a mouse — three readiness answers and an
  // RPE — which is the only way to a work set. No `?session=` frame: those set
  // `preview`, and a previewed set is not a set a player pressed.
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

  for (const prop of PRESS_PROPERTIES) {
    if (prop.key === CALLOUT_UNSUPPORTED) {
      skip(
        `ARM ${arm.id}: ${prop.cssName} on ${arm.touchTestId} — without it ${prop.leaves}`,
        `Blink does not implement ${prop.cssName}; getComputedStyle returns ${JSON.stringify(target.self.webkitTouchCallout)} on an element that declares it, so no reading here is about the app. The declaration stays covered by src/lift/liftInput.test.ts.`,
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
  // not inherit and is the target's own business, so only the inherited one is
  // asserted here and the other is reported.
  check(
    target.hitTarget !== null && target.hitTarget.userSelect === 'none',
    `ARM ${arm.id}: the element UNDER the finger inherits user-select: none`,
    `${target.hitTarget?.tag} reads ${JSON.stringify(target.hitTarget?.userSelect)}`,
  );

  // NON-VACUITY ON THE STYLE READS, AS A COUNT RATHER THAN A BOUND: the control
  // element must NOT carry the fix, or "the target has it and the control does
  // not" is being read off two elements that are the same.
  const controlCarrying = PRESS_PROPERTIES.filter(
    (p) => p.key !== CALLOUT_UNSUPPORTED && control.self[p.key] === p.expected,
  ).length;
  check(
    controlCarrying === 0,
    `ARM ${arm.id}: the control element carries 0 of the ${PRESS_PROPERTIES.length - 1} readable properties`,
    `${controlCarrying} of ${PRESS_PROPERTIES.length - 1}; control reads ${JSON.stringify({
      userSelect: control.self.userSelect,
      touchAction: control.self.touchAction,
    })}`,
  );

  // -------------------------------------------------------------------------
  // 2 & 3. THE SELECTION PROBE, AND ITS OWN DOMAIN
  // -------------------------------------------------------------------------
  const readings = {};

  // (1) as shipped
  await waitForStage(page, arm.touchTestId);
  readings['as-shipped'] = await probe(page, arm.touchTestId, 'as-shipped');

  // (2) the gesture, on an element that carries none of the three
  readings['control-gesture'] = await probe(page, arm.controlTestId, 'control-gesture');

  // (3) the same element, fix neutralised
  await waitForStage(page, arm.touchTestId);
  const forcedOff = await forceProperties(page, arm.touchTestId, 'off');
  readings['control-subject'] = await probe(page, arm.touchTestId, 'control-subject');
  readings['control-subject'].forcedTo = forcedOff;

  // (4) restored
  const restored = await forceProperties(page, arm.touchTestId, null);
  await waitForStage(page, arm.touchTestId);
  readings['restored'] = await probe(page, arm.touchTestId, 'restored');
  readings['restored'].restoredTo = restored;

  for (const name of READINGS) {
    const r = readings[name];
    console.log(
      `  ${name.padEnd(16)} on ${String(r.testId).padEnd(14)} -> ${JSON.stringify(r.selection)}`,
    );
  }

  // Every reading cleared before it pressed. Without this the run could be
  // reading its own residue and calling it a finding.
  const cleared = READINGS.filter((n) => readings[n].clearedBefore === true).length;
  check(
    cleared === READINGS.length,
    `ARM ${arm.id}: all ${READINGS.length} readings started from an empty selection`,
    `${cleared} of ${READINGS.length}`,
  );

  // ---- THE POSITIVE CONTROL ON THE GESTURE -------------------------------
  // If this is not red-capable, nothing below it is evidence.
  const cg = readings['control-gesture'];
  check(
    cg.selected === true,
    `ARM ${arm.id}: CONTROL — the same press-and-hold on ${arm.controlTestId} DOES select`,
    `rangeCount=${cg.selection?.rangeCount} collapsed=${cg.selection?.isCollapsed} text=${JSON.stringify(cg.selection?.text)}`,
  );

  // ---- THE CLAIM ---------------------------------------------------------
  const shipped = readings['as-shipped'];
  check(
    shipped.selected === false && shipped.selection?.rangeCount === 0,
    `ARM ${arm.id}: a press-and-hold on ${arm.touchTestId} leaves NO selection on the page`,
    `rangeCount=${shipped.selection?.rangeCount} collapsed=${shipped.selection?.isCollapsed} text=${JSON.stringify(shipped.selection?.text)}`,
  );

  // ---- THE CLAIM'S OWN DOMAIN --------------------------------------------
  // The reading that decides whether the line above is an instrument or a
  // decoration. If neutralising the fix on this very element does not produce a
  // selection, then no state of the fix makes that check red and it is vacuous
  // by CLAUDE.md's definition — reported as a finding here rather than left for
  // a reader to notice, because a green line and a vacuous line look identical.
  const cs = readings['control-subject'];
  const domainLive = cs.selected === true;
  check(
    domainLive,
    `ARM ${arm.id}: DOMAIN — with the fix NEUTRALISED on ${arm.touchTestId}, the same gesture selects`,
    domainLive
      ? `rangeCount=${cs.selection?.rangeCount} text=${JSON.stringify(cs.selection?.text)} (so the line above can go red)`
      : `rangeCount=${cs.selection?.rangeCount} with user-select forced to ${JSON.stringify(cs.forcedTo?.userSelect)} — NOTHING selects here whatever the fix says, so the "leaves NO selection" line above is VACUOUS on this arm. caretRangeFromPoint at the probe point returns ${JSON.stringify(target.caretAtCentre)}: there is no text position under the finger, because the touch target is a Skia <canvas>.`,
  );

  // ---- THE EXPERIMENT DID NOT CONTAMINATE ITS SUBJECT ---------------------
  const rs = readings['restored'];
  check(
    rs.selected === shipped.selected && rs.selection?.rangeCount === shipped.selection?.rangeCount,
    `ARM ${arm.id}: restoring the fix reproduces the as-shipped reading`,
    `restored rangeCount=${rs.selection?.rangeCount} vs as-shipped ${shipped.selection?.rangeCount}; computed back to ${JSON.stringify(rs.restoredTo)}`,
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
    // touch targets must be DIFFERENT elements, or the played arm has silently
    // fallen back to the debug one and every played reading is a debug reading
    // wearing a played label.
    check(
      played.touchTestId !== debug.touchTestId && played.queryString !== debug.queryString,
      'CROSS-ARM: the two arms are different elements reached by different URLs',
      `played ${played.touchTestId} at ${JSON.stringify(played.queryString)} vs debug ${debug.touchTestId} at ${JSON.stringify(debug.queryString)}`,
    );
    // AND THE COMPARISON THE WHOLE TOOL EXISTS FOR. A fix that is on the debug
    // harness and not on the played screen is a fix a player never gets, and it
    // is invisible to every source scan that names one file.
    const differing = PRESS_PROPERTIES.filter(
      (p) => p.key !== CALLOUT_UNSUPPORTED && played.target.self[p.key] !== debug.target.self[p.key],
    );
    check(
      differing.length === 0,
      'CROSS-ARM: the played surface and the replay harness compute the SAME press properties',
      differing.length === 0
        ? 'every readable property matches on both arms'
        : `${differing.length} differ: ${differing
            .map((p) => `${p.cssName} played=${JSON.stringify(played.target.self[p.key])} debug=${JSON.stringify(debug.target.self[p.key])}`)
            .join('; ')}`,
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
console.log(`skipped: ${skipped.length}`);
if (failed > 0) {
  console.log(`\nFAILED ${failed} of ${checks.length} checks:`);
  for (const c of reds()) console.log(`  - ${c.what}${c.detail === null ? '' : ` — ${c.detail}`}`);
  process.exit(1);
}
console.log(`\nPASSED ${checks.length} checks against the running app.`);
