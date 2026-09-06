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
    console.log(JSON.stringify({ label, lines, texture, trayDisplay, fabText }));
  } catch (err) {
    console.log(JSON.stringify({ label, error: String(err) }));
  }
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
  await shot(page, 'play');
  await logChrome(page, 'play');
  await openSurface(page, 'build');
  await shot(page, 'build');
  await logChrome(page, 'build');
  // A6-2: Exit Build → Play via Done (same FAB testID as Build).
  await openSurface(page, 'build');
  await shot(page, 'play-after-exit-build');
  await logChrome(page, 'play-after-exit-build');
  await openSurface(page, 'shop');
  await shot(page, 'shop');
  await openSurface(page, 'staff');
  await shot(page, 'staff');
  await openSurface(page, 'more');
  await shot(page, 'more');
  const returnCard = page.getByTestId('gymscreen-return');
  if ((await returnCard.count()) > 0) {
    await openSurface(page, 'play');
    await shot(page, 'return');
  }
  const developer = page.getByTestId('gymscreen-surface-developer');
  if ((await developer.count()) > 0) {
    await openSurface(page, 'more').catch(() => {});
    await developer.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
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
  }
  await context.close();
  await browser.close();
  console.log(`empire-ux-01 ${PHASE} screenshots in ${OUT}`);
}

await run();
