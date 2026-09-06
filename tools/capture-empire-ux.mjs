#!/usr/bin/env node
/**
 * SF-TWL-GYM-EMPIRE-UX-01 evidence: 390×844 Play / Build / Shop / Staff / More
 * (and Return when a return card is drawn). Pass --out <dir> relative to
 * .gauntlet/shots/empire-ux-01/.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PHASE = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'after';
const OUT = join(ROOT, '.gauntlet', 'shots', 'empire-ux-01', PHASE);
const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:8081';

mkdirSync(OUT, { recursive: true });

const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;

const PILL_FADE_MS = 320 + 220 + 1200;

async function openGym(page) {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(PILL_FADE_MS);
  await page.getByTestId('shell-open-gym').click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForTimeout(800);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`wrote ${path}`);
}

async function openSurface(page, name) {
  const btn = page.getByTestId(`gymscreen-surface-${name}`);
  await btn.waitFor({ state: 'attached', timeout: 10000 });
  await btn.click({ timeout: 10000 });
  await page.waitForTimeout(450);
}

async function logChrome(page, label) {
  try {
    const lines = await page.locator('[data-testid^="floorgrid-line-"]').count();
    const texture = await page.getByTestId('floorgrid-floor-texture').count();
    const tray = page.getByTestId('floorgrid-tray');
    const trayDisplay =
      (await tray.count()) === 0
        ? 'missing'
        : await tray.evaluate((el) => getComputedStyle(el).display);
    const fab = page.getByTestId('gymscreen-surface-build');
    const fabText = (await fab.count()) === 0 ? 'missing' : (await fab.innerText()).trim();
    const fabDisplay =
      (await fab.count()) === 0
        ? 'missing'
        : await fab.evaluate((el) => getComputedStyle(el).display);
    console.log(JSON.stringify({ label, lines, texture, trayDisplay, fabText, fabDisplay }));
  } catch (err) {
    console.log(JSON.stringify({ label, error: String(err) }));
  }
}

async function logMoreA64(page) {
  const moreDev = await page
    .locator('[data-testid="gymscreen-more-drawer"] [data-testid="gymscreen-surface-developer"]')
    .count();
  const dockDev = await page
    .locator('[data-testid="gymscreen-dock"] [data-testid="gymscreen-surface-developer"]')
    .count();
  const moreText = await page.getByTestId('gymscreen-more-drawer').innerText();
  const shellLeave = await page.getByTestId('shell-leave-gym').count();
  const moreLeave = await page
    .locator('[data-testid="gymscreen-more-drawer"] [data-testid="gymscreen-leave-gym"]')
    .count();
  console.log(
    JSON.stringify({
      label: 'more-settings',
      moreDeveloperControls: moreDev,
      dockDeveloperControls: dockDev,
      moreHasDeveloperWord: /\bDeveloper\b/.test(moreText),
      shellLeaveGym: shellLeave,
      moreLeaveGym: moreLeave,
    }),
  );
}

async function logVoid(page, label) {
  const probe = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement).backgroundColor;
    const body = getComputedStyle(document.body).backgroundColor;
    const rootEl = document.getElementById('root');
    const root = rootEl === null ? 'missing' : getComputedStyle(rootEl).backgroundColor;
    const gym = document.querySelector('[data-testid="gymscreen-root"]');
    const gymBox = gym === null ? null : gym.getBoundingClientRect();
    return {
      html,
      body,
      root,
      gym: gymBox,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });
  console.log(JSON.stringify({ label: `void-${label}`, ...probe }));
}

/** Developer chrome is an explicit web route, never player More/dock. */
async function openDeveloperSurface(page) {
  await page.evaluate(() => {
    window.location.hash = 'empire-developer';
  });
  await page.getByTestId('gymscreen-developer-drawer').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(400);
}

async function run() {
  const browser = await chromium.launch({
    ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await openGym(page);
  await logVoid(page, 'play-390');
  await shot(page, 'play');
  await logChrome(page, 'play');
  await page.getByTestId('floorgrid-fixed-flat-bench').click({ timeout: 10000 });
  await page.waitForTimeout(400);
  const inspectGeom = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="floorgrid-station-panel"]');
    const equipment = document.querySelector('[data-testid="floorgrid-equipment-panel"]');
    const card = document.querySelector('[data-testid="gymscreen-action-card"]');
    const boxOf = (el) => {
      if (el === null) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        width: Math.round(r.width),
        inView: r.height > 0 && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight,
      };
    };
    const fab = document.querySelector('[data-testid="gymscreen-surface-build"]');
    const floor = document.querySelector('[data-testid="gymscreen-floor"]');
    const hitAtFab = (() => {
      if (fab === null) return null;
      const r = fab.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (hit === null) return { x, y, testId: null };
      const tagged = hit.closest('[data-testid]');
      return {
        x: Math.round(x),
        y: Math.round(y),
        testId: tagged === null ? hit.tagName : tagged.getAttribute('data-testid'),
      };
    })();
    return {
      stationPanel: boxOf(panel),
      equipmentPanel: boxOf(equipment),
      actionCard: boxOf(card),
      fab: boxOf(fab),
      floorContainsFab: floor !== null && fab !== null && floor.contains(fab),
      hitAtFab,
    };
  });
  console.log(
    JSON.stringify({
      label: 'play-inspect',
      stationPanel: await page.getByTestId('floorgrid-station-panel').count(),
      equipmentPanel: await page.getByTestId('floorgrid-equipment-panel').count(),
      ...inspectGeom,
    }),
  );
  await shot(page, 'play-inspect');
  const inspectDismiss = page.getByTestId('floorgrid-station-panel-dismiss');
  if ((await inspectDismiss.count()) > 0) {
    await inspectDismiss.click({ timeout: 5000 }).catch(() => {});
  }
  const equipDismiss = page.getByTestId('floorgrid-equipment-panel-dismiss');
  if ((await equipDismiss.count()) > 0) {
    await equipDismiss.click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(300);
  await openSurface(page, 'build');
  await shot(page, 'build');
  await logChrome(page, 'build');
  await page.getByTestId('floorgrid-fixed-power-bar').click({ timeout: 8000 });
  await page.waitForTimeout(350);
  console.log(
    JSON.stringify({
      label: 'build-moving',
      ghost: await page.getByTestId('floorgrid-place-ghost').count(),
      cancel: await page.getByTestId('floorgrid-place-cancel').count(),
    }),
  );
  await shot(page, 'build-moving');
  const dropCell = page.getByTestId('floorgrid-cell-6-3');
  if ((await dropCell.count()) > 0) {
    await dropCell.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  console.log(
    JSON.stringify({
      label: 'build-after-place',
      refused: await page.getByTestId('floorgrid-drop-refused').count(),
      ghost: await page.getByTestId('floorgrid-place-ghost').count(),
    }),
  );
  await shot(page, 'build-after-place');
  // A6-2: Exit Build → Play via Done (same FAB testID as Build).
  await openSurface(page, 'build');
  await shot(page, 'play-after-exit-build');
  await logChrome(page, 'play-after-exit-build');
  await openSurface(page, 'shop');
  await logChrome(page, 'shop');
  await shot(page, 'shop');
  await openSurface(page, 'staff');
  await logChrome(page, 'staff');
  await shot(page, 'staff');
  await openSurface(page, 'more');
  await shot(page, 'more');
  await logMoreA64(page);
  const returnCard = page.getByTestId('gymscreen-return');
  if ((await returnCard.count()) > 0) {
    await openSurface(page, 'play');
    await shot(page, 'return');
  }
  await openDeveloperSurface(page);
  await shot(page, 'developer');
  const advance = page.getByTestId('gymscreen-advance-offline-259200');
  if ((await advance.count()) > 0) {
    await advance.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    await openSurface(page, 'play');
    if ((await page.getByTestId('gymscreen-return').count()) > 0) {
      await shot(page, 'return');
    }
  }
  await context.close();
  for (const vp of [
    { width: 375, height: 812, name: 'play-375' },
    { width: 430, height: 932, name: 'play-430' },
    { width: 768, height: 1024, name: 'play-tablet' },
    { width: 1280, height: 800, name: 'play-desktop' },
  ]) {
    const extra = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const extraPage = await extra.newPage();
    await openGym(extraPage);
    await logVoid(extraPage, vp.name);
    await logChrome(extraPage, vp.name);
    await shot(extraPage, vp.name);
    if (vp.name === 'play-375' || vp.name === 'play-430') {
      await extraPage.getByTestId('floorgrid-fixed-flat-bench').click({ timeout: 10000 });
      await extraPage.waitForTimeout(400);
      const hit = await extraPage.evaluate(() => {
        const fab = document.querySelector('[data-testid="gymscreen-surface-build"]');
        if (fab === null) return { testId: null };
        const r = fab.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const el = document.elementFromPoint(x, y);
        const tagged = el === null ? null : el.closest('[data-testid]');
        return {
          testId:
            tagged === null
              ? el === null
                ? null
                : el.tagName
              : tagged.getAttribute('data-testid'),
        };
      });
      console.log(JSON.stringify({ label: `${vp.name}-inspect-fab-hit`, ...hit }));
      await shot(extraPage, `${vp.name}-inspect`);
    }
    await extra.close();
  }
  await browser.close();
  console.log(`empire-ux-01 ${PHASE} screenshots in ${OUT}`);
}

await run();
