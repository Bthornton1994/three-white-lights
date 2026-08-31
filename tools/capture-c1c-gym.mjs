#!/usr/bin/env node
/**
 * Stage C.1c visual evidence: desktop + mobile screenshots of the playable gym.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.gauntlet', 'shots', 'c1c');
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

async function runViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
  const page = await context.newPage();
  await openGym(page);
  await shot(page, `${name}-play`);
  const member = page.getByTestId('floorgrid-member-0');
  if (await member.count()) {
    await member.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `${name}-member`);
    await page.getByTestId('floorgrid-member-panel-dismiss').click({ timeout: 5000 }).catch(() => {});
  }
  const station = page.getByTestId('floorgrid-fixed-power-bar');
  if (await station.count()) {
    await station.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `${name}-station`);
    await page.getByTestId('floorgrid-station-panel-dismiss').click({ timeout: 5000 }).catch(() => {});
  }
  await page.getByTestId('gymscreen-surface-build').click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, `${name}-build`);
  await page.getByTestId('gymscreen-surface-shop').click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, `${name}-shop`);
  await page.getByTestId('gymscreen-surface-staff').click({ timeout: 10000 });
  await page.waitForTimeout(400);
  await shot(page, `${name}-staff`);
  await page.getByTestId('gymscreen-surface-play').click({ timeout: 10000 }).catch(() => {});
  await context.close();
}

const browser = await chromium.launch({
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  await runViewport(browser, 'desktop', { width: 1280, height: 800 });
  await runViewport(browser, 'mobile', { width: 390, height: 844 });
} finally {
  await browser.close();
}
console.log(`C.1c screenshots in ${OUT}`);
