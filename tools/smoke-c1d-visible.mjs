#!/usr/bin/env node
/**
 * Stage C.1d real-input smoke: ordinary visible-coordinate clicks.
 * Dock and chrome are clicked by visible label. Floor objects are clicked
 * at the centre of the drawn sprite's bounding box.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.gauntlet', 'shots', 'c1d');
mkdirSync(OUT, { recursive: true });

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:8081';

const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;

const browser = await chromium.launch({
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`wrote ${path}`);
}

async function clickBox(page, selector) {
  const loc = page.locator(selector).first();
  const box = await loc.boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(350);
  return box;
}

async function clickGrid(page, xTile, yTile) {
  const grid = page.locator('[data-testid="floorgrid-grid"]');
  const box = await grid.boundingBox();
  if (box === null) throw new Error('no gym floor');
  const tile = box.width / 8;
  await page.mouse.click(box.x + tile * (xTile + 0.5), box.y + tile * (yTile + 0.5));
  await page.waitForTimeout(350);
}

async function run(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: name === 'mobile' ? 2 : 1 });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.getByText('GYM EMPIRE').click({ timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.getByTestId('gymscreen-surface-play').click();
  await page.waitForTimeout(500);
  await clickBox(page, '[data-testid="floorgrid-ambient-0"]');
  await shot(page, `${name}-member`);
  await page.getByText('close', { exact: true }).click().catch(() => {});
  await page.waitForTimeout(200);

  await clickBox(page, '[data-testid="floorgrid-fixed-flat-bench"]');
  await page.waitForTimeout(300);
  await page.getByText('close', { exact: true }).click().catch(() => {});

  await page.getByTestId('gymscreen-surface-build').click();
  await page.waitForTimeout(300);
  await clickBox(page, '[data-testid="floorgrid-fixed-sprite-power-bar"]');
  await clickGrid(page, 6, 0);
  await shot(page, `${name}-move-1`);
  await clickBox(page, '[data-testid="floorgrid-fixed-sprite-power-bar"]');
  await clickGrid(page, 5, 2);
  await shot(page, `${name}-move-2`);
  await clickBox(page, '[data-testid="floorgrid-fixed-sprite-power-bar"]');
  await clickGrid(page, 0, 3);
  await shot(page, `${name}-move-3`);
  await clickBox(page, '[data-testid="floorgrid-fixed-sprite-power-bar"]');
  await clickGrid(page, 1, 0);
  await shot(page, `${name}-invalid`);
  const refused = await page.getByTestId('floorgrid-drop-refused').innerText({ timeout: 2000 }).catch(() => '');
  const refusedArea = await page.locator('[data-testid="floorgrid-drop-refused-area"]').boundingBox();
  if (!refused || refusedArea === null || refusedArea.width < 2) {
    throw new Error(`${name}: invalid placement stayed silent — refused="${refused}"`);
  }
  console.log(`${name}: invalid placement "${refused}" with ${Math.round(refusedArea.width)}x${Math.round(refusedArea.height)} outline`);
  await clickGrid(page, 6, 0);

  await page.getByTestId('gymscreen-surface-shop').click();
  await page.waitForTimeout(400);
  await shot(page, `${name}-shop`);
  await page.getByTestId('gymscreen-surface-staff').click();
  await page.waitForTimeout(400);
  await shot(page, `${name}-staff`);
  await context.close();
}

try {
  await run('desktop', { width: 1280, height: 800 });
  await run('mobile', { width: 390, height: 844 });
  console.log(`C.1d smoke screenshots in ${OUT}`);
} finally {
  await browser.close();
}
