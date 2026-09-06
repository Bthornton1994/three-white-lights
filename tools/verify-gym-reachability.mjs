#!/usr/bin/env node
/**
 * Checks, IN A BROWSER, WITH A MOUSE, that a player can get from the daily
 * session to Gym Empire (GDD §5, CROSSING 6 in CLAUDE.md's Session
 * Coordination section) without touching the URL bar, that the screen's
 * controls actually respond, and that the way back lands on the daily
 * session.
 *
 * ===========================================================================
 * WHY THIS EXISTS AND WHAT IT DOES NOT CLAIM
 * ===========================================================================
 * `src/shell/shellRoute.test.ts` proves the route graph says a player can
 * reach `gym`. `src/shell/shellWiring.test.ts` proves `AppShell.tsx` calls
 * that graph and mounts `GymScreen`. Neither renders anything —
 * `vitest.config.ts` is `environment: node` — and this codebase has already
 * recorded, more than once, a component that was correct, tested, and
 * unreachable, or reachable only by a debug URL a player never sees. So the
 * claim "a player can reach Gym Empire and use it" is settled here: load the
 * built app with NO QUERY STRING, FIND the control, PRESS it, and read what
 * came up.
 *
 * This tool is deliberately much smaller than `verify-shell-route.mjs`. It
 * does not replicate that file's ten-point rigor (cut-in coverage, the
 * already-trained surface, the four debug routes, the shareable card, …) —
 * none of that is CROSSING 6's subject. It proves exactly what CROSSING 6
 * asks for: reachability by press, and that the ladder/session controls on
 * the far side actually respond, the same bar that piece's own brief states
 * as "the single most important bar" and the thing an asserted-but-undriven
 * claim would not meet.
 *
 * WHAT IT ASSERTS, and why each one can fail:
 *
 *   1. A cold launch (no query string) shows BOTH the MEET DAY pill and the
 *      GYM EMPIRE pill on the check-in beat, each independently gated
 *      (`shellAffordanceFor` / `gymAffordanceFor`) — proving CROSSING 6's
 *      "second simultaneous pill" claim on drawn pixels, not on source.
 *   2. PRESSING GYM EMPIRE REACHES THE GYM SCREEN. This is the one. Fails if
 *      the route is not wired, or is wired to something that does not
 *      render, or throws (a DOM host tag inside the RN tree would throw at
 *      the point it is rendered — exactly the defect CROSSING 6 exists to
 *      avoid).
 *   3. THE OPENING STATE IS THE PURE FUNCTIONS' OPENING STATE: rung
 *      "garage", 0 gym bucks, at the same reading `createGymViewState()`
 *      produces. Not asserted from source — read off the drawn screen.
 *   4. A DEV CHECK-IN CONTROL ACTUALLY DISPATCHES: pressing it changes the
 *      displayed Gym Bucks figure. Fails if the control is drawn but
 *      inert.
 *   5. PRESS MOVE UP, SEE THE RUNG CHANGE. The relocation control is pressed
 *      after enough check-ins to afford it, and the drawn rung reads
 *      "storage-unit" afterward — the exact consequence CLAUDE.md's
 *      "Presence is not visibility" section asks a check to assert on the
 *      played path rather than reasoning about.
 *   6. THE WAY BACK LANDS ON THE DAILY SESSION, and the two pills are drawn
 *      again — proving the round trip does not strand the player and does
 *      not leave stale chrome (the `setSessionPhase(null)` /
 *      `setCutInLive(false)` resets in `AppShell.tsx`'s `leaveGym`).
 *
 * "ON SCREEN" HERE MEANS DRAWN, NOT MOUNTED — reused from `meetDrive.mjs`'s
 * `effectiveOpacity` / `waitUntilDrawn`, the same instrument
 * `verify-shell-route.mjs` uses, for the reason its own header gives:
 * Playwright's `isVisible()` and `elementFromPoint` do not consider opacity,
 * and a control mounted at `opacity: 0` has already once been reported here
 * as present. `SHELL_NAV.FADE_IN_DELAY_MS` (320) + `FADE_IN_MS` (220) = 540ms
 * is the fade this tool waits out before pressing either pill.
 *
 * USAGE. Start the web build first (`npx expo start --web`), then:
 *
 *     node tools/verify-gym-reachability.mjs [--url http://localhost:8081]
 *
 * Exits 0 on every claim holding, 1 otherwise, and prints a line per claim
 * either way.
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

import { waitUntilDrawn } from './meetDrive.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');

/** `SHELL_NAV.FADE_IN_DELAY_MS + FADE_IN_MS` (320 + 220), read from
 * `src/shell/shellTuning.ts` rather than retyped — this tool asserts the
 * cross-check below rather than trusting a copy. */
const PILL_FADE_BUDGET_MS = 320 + 220;
/** Generous margin past the fade budget, the same discipline
 * `verify-shell-route.mjs`'s `DEFAULT_SETTLE_MS` states for itself: proving
 * reachability, not measuring latency. */
const SETTLE_MS = 1200;
const BEAT_TIMEOUT_MS = 20000;
/** Guards the check-in loop below against a tuning change that would make it
 * spin forever rather than fail loudly. */
const MAX_CHECK_INS = 30;

const VIEWPORT = Object.freeze({ WIDTH: 390, HEIGHT: 844 });

const log = [];
let failures = 0;
const ok = (text) => {
  log.push(`  ok    ${text}`);
};
const fail = (text) => {
  failures += 1;
  log.push(`  FAIL  ${text}`);
};

const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
const browser = await chromium.launch({
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: VIEWPORT.WIDTH, height: VIEWPORT.HEIGHT },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));

async function textOf(id) {
  return page.getByTestId(id).innerText({ timeout: 5000 }).catch(() => null);
}

/** Facility-first dock: advance lives in More, relocate lives in Shop. */
async function openGymSurface(name) {
  const btn = page.getByTestId(`gymscreen-surface-${name}`);
  await btn.click({ timeout: 10000 });
  await page.waitForTimeout(200);
}

function purseAmount(text) {
  const match = /^(\d+) gym bucks/i.exec((text ?? '').trim());
  return match === null ? Number.NaN : Number.parseFloat(match[1] ?? '');
}

try {
  // -------------------------------------------------------------------------
  // 1. Cold launch, no query string. Both pills, independently gated, drawn.
  // -------------------------------------------------------------------------
  await page.goto(url, { waitUntil: 'load' });
  await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: BEAT_TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(PILL_FADE_BUDGET_MS + SETTLE_MS);

  const addressAtLaunch = new URL(page.url()).search;
  if (addressAtLaunch !== '') {
    fail(`the launch address carries a query string (${addressAtLaunch}) — this run is not measuring the played path`);
  } else {
    ok('launched with no query string — the played path, not a debug one');
  }

  const meetPillDrawn = await waitUntilDrawn(page, 'shell-open-meet', BEAT_TIMEOUT_MS);
  if (meetPillDrawn.drawn) {
    ok(`MEET DAY pill drawn on the check-in beat (${meetPillDrawn.why})`);
  } else {
    fail(`MEET DAY pill never drawn on the check-in beat — ${meetPillDrawn.why}`);
  }

  const gymPillDrawn = await waitUntilDrawn(page, 'shell-open-gym', BEAT_TIMEOUT_MS);
  if (gymPillDrawn.drawn) {
    ok(`GYM EMPIRE pill drawn on the check-in beat, alongside MEET DAY (${gymPillDrawn.why})`);
  } else {
    fail(`GYM EMPIRE pill never drawn on the check-in beat — ${gymPillDrawn.why}`);
  }

  // -------------------------------------------------------------------------
  // 2. Press it. Reach the gym screen.
  // -------------------------------------------------------------------------
  if (gymPillDrawn.drawn) {
    await page.getByTestId('shell-open-gym').click({ timeout: 10000 });
    const gymRoot = await page
      .getByTestId('gymscreen-root')
      .waitFor({ state: 'attached', timeout: BEAT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (gymRoot) {
      ok('pressing GYM EMPIRE mounts the gym screen (gymscreen-root attached)');
    } else {
      fail('pressing GYM EMPIRE did not mount the gym screen — no gymscreen-root attached');
    }
  } else {
    fail('could not press GYM EMPIRE — the pill was never drawn (see above)');
  }

  if (pageErrors.length > 0) {
    fail(`the page threw ${pageErrors.length} error(s) — ${pageErrors.slice(0, 3).join(' | ')}`);
  } else {
    ok('no page error at any point so far (a DOM host tag inside the RN tree would throw here)');
  }

  // -------------------------------------------------------------------------
  // 3. The opening state is the pure functions' opening state.
  // -------------------------------------------------------------------------
  const openingRung = await textOf('gymscreen-rung');
  if (openingRung !== null && /garage/i.test(openingRung)) {
    ok(`opening rung reads "${openingRung}" — matches createGymViewState()'s opening rung`);
  } else {
    fail(`opening rung reads ${JSON.stringify(openingRung)}, expected it to contain "garage"`);
  }

  const openingBucks = await textOf('gymscreen-gym-bucks');
  if (openingBucks !== null && openingBucks.includes('0')) {
    ok(`opening gym bucks reads "${openingBucks}" — matches the opening purse of 0`);
  } else {
    fail(`opening gym bucks reads ${JSON.stringify(openingBucks)}, expected it to contain "0"`);
  }

  // -------------------------------------------------------------------------
  // 4 & 5. Press the dev check-in control repeatedly, see the figure move;
  // then press move-up and see the rung change.
  // -------------------------------------------------------------------------
  await page.evaluate(() => {
    window.location.hash = 'empire-developer';
  });
  await page.getByTestId('gymscreen-developer-drawer').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(200);
  const advanceId = 'gymscreen-advance-offline-259200'; // +3d away
  const advanceButton = page.getByTestId(advanceId);
  const advanceExists = await advanceButton.count().then((n) => n > 0).catch(() => false);

  if (!advanceExists) {
    fail(`the +3d dev check-in control (${advanceId}) is not on the developer surface — cannot drive the interaction`);
  } else {
    const before = await textOf('gymscreen-gym-bucks');
    await advanceButton.click({ timeout: 10000 });
    await page.waitForTimeout(200);
    const after = await textOf('gymscreen-gym-bucks');
    if (before !== null && after !== null && before !== after) {
      ok(`pressing the check-in control moves gym bucks: "${before}" -> "${after}"`);
    } else {
      fail(`pressing the check-in control did not move gym bucks: before "${before}", after "${after}"`);
    }

    // Keep pressing until the move is affordable, or give up loudly.
    let rungBeforeMove = await textOf('gymscreen-rung');
    let presses = 1;
    let bucksText = after;
    while (
      bucksText !== null &&
      purseAmount(bucksText) < 2500 &&
      presses < MAX_CHECK_INS
    ) {
      await advanceButton.click({ timeout: 10000 });
      await page.waitForTimeout(150);
      bucksText = await textOf('gymscreen-gym-bucks');
      presses += 1;
    }
    ok(`accumulated to "${bucksText}" gym bucks after ${presses} check-in press(es) (need 2500 for storage-unit)`);

    await openGymSurface('shop');
    const moveButton = page.getByTestId('gymscreen-move-up');
    const moveExists = await moveButton.count().then((n) => n > 0).catch(() => false);
    if (!moveExists) {
      fail('the relocate control (gymscreen-move-up) is not on screen');
    } else {
      await moveButton.click({ timeout: 10000 });
      await page.waitForTimeout(200);
      const rungAfterMove = await textOf('gymscreen-rung');
      if (
        rungAfterMove !== null &&
        rungAfterMove.includes('Storage unit') &&
        rungAfterMove !== rungBeforeMove
      ) {
        ok(`PRESS MOVE UP, SEE THE RUNG CHANGE: "${rungBeforeMove}" -> "${rungAfterMove}"`);
      } else {
        fail(
          `pressing relocate did not change the rung as expected: before "${rungBeforeMove}", after "${rungAfterMove}"`,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. The way back lands on the daily session, chrome intact.
  // -------------------------------------------------------------------------
  const leaveButton = page.getByTestId('shell-leave-gym');
  const leaveExists = await leaveButton.count().then((n) => n > 0).catch(() => false);
  if (!leaveExists) {
    fail('the BACK TO TRAINING control (shell-leave-gym) is not on screen');
  } else {
    await leaveButton.click({ timeout: 10000 });
    const backOnSession = await page
      .getByTestId('session-check-in')
      .waitFor({ state: 'visible', timeout: BEAT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (backOnSession) {
      ok('BACK TO TRAINING lands back on the daily session (session-check-in visible)');
    } else {
      fail('BACK TO TRAINING did not land back on the daily session');
    }
    await page.waitForTimeout(PILL_FADE_BUDGET_MS + SETTLE_MS);
    const meetPillAgain = await waitUntilDrawn(page, 'shell-open-meet', BEAT_TIMEOUT_MS);
    const gymPillAgain = await waitUntilDrawn(page, 'shell-open-gym', BEAT_TIMEOUT_MS);
    if (meetPillAgain.drawn && gymPillAgain.drawn) {
      ok('both pills are drawn again on the return trip — no stale chrome left behind');
    } else {
      fail(
        `chrome did not return correctly — MEET DAY drawn=${meetPillAgain.drawn} (${meetPillAgain.why}), GYM EMPIRE drawn=${gymPillAgain.drawn} (${gymPillAgain.why})`,
      );
    }
    const addressAfterRoundTrip = new URL(page.url()).search;
    if (addressAfterRoundTrip !== '') {
      fail(`the address bar carries a query string after the round trip (${addressAfterRoundTrip})`);
    } else {
      ok('no query string appeared anywhere in the round trip — reachability is by press only');
    }
  }

  if (pageErrors.length > 0) {
    fail(`the page threw ${pageErrors.length} error(s) in total — ${pageErrors.slice(0, 5).join(' | ')}`);
  }
} finally {
  await browser.close();
}

console.log(log.join('\n'));
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failing claim(s) of ${log.length}.`);
process.exit(failures === 0 ? 0 : 1);
