#!/usr/bin/env node
/**
 * Stage G.2D drawn-card evidence: open Gym Empire at 390×844, tap a visible
 * member, read floorgrid-member-panel-dues off the live tree, and photograph
 * the card. Critics grade pixels, not FloorGrid source order.
 *
 * Usage: start the web build (`tools/dev-web.sh`), then:
 *     node tools/capture-g2d-dues.mjs [--url http://localhost:8081]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

import { waitUntilDrawn } from './meetDrive.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.gauntlet', 'shots', 'g2d');
const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:8081';

const VIEWPORT = Object.freeze({ WIDTH: 390, HEIGHT: 844 });
const PILL_FADE_MS = 320 + 220 + 1200;
const BEAT_TIMEOUT_MS = 20000;

mkdirSync(OUT, { recursive: true });

const SYSTEM_CHROME = existsSync('/opt/google/chrome/chrome')
  ? '/opt/google/chrome/chrome'
  : existsSync('/usr/local/bin/chrome')
    ? '/usr/local/bin/chrome'
    : undefined;
const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : SYSTEM_CHROME;

function capturedFrom() {
  const commit = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
  return Object.freeze({
    commit,
    branch,
    dirty: dirty.length > 0,
    capturedAt: new Date().toISOString(),
  });
}

const browser = await chromium.launch({
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: VIEWPORT.WIDTH, height: VIEWPORT.HEIGHT },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 });
  await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(PILL_FADE_MS);
  const gymPill = await waitUntilDrawn(page, 'shell-open-gym', BEAT_TIMEOUT_MS);
  if (!gymPill.drawn) {
    throw new Error(`shell-open-gym never drawn (${gymPill.why})`);
  }
  await page.getByTestId('shell-open-gym').click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForTimeout(800);

  const memberHit = await waitUntilDrawn(page, 'floorgrid-ambient-0', BEAT_TIMEOUT_MS);
  if (!memberHit.drawn) {
    throw new Error(`floorgrid-ambient-0 never drawn (${memberHit.why})`);
  }
  const memberBox = await page.getByTestId('floorgrid-ambient-0').boundingBox();
  if (memberBox === null) {
    throw new Error('floorgrid-ambient-0 is attached but has no bounding box');
  }
  await page.mouse.click(memberBox.x + memberBox.width / 2, memberBox.y + memberBox.height / 2);

  const panel = await waitUntilDrawn(page, 'floorgrid-member-panel', BEAT_TIMEOUT_MS);
  if (!panel.drawn) {
    throw new Error(`floorgrid-member-panel never drawn (${panel.why})`);
  }
  const dues = await waitUntilDrawn(page, 'floorgrid-member-panel-dues', BEAT_TIMEOUT_MS);
  if (!dues.drawn) {
    throw new Error(`floorgrid-member-panel-dues never drawn (${dues.why})`);
  }
  const duesText = ((await page.getByTestId('floorgrid-member-panel-dues').innerText()) ?? '').trim();
  if (!/^DUES /.test(duesText) || !/gym bucks a day/.test(duesText)) {
    throw new Error(`dues line is missing the daily-rate copy (${duesText})`);
  }
  if (/%/.test(duesText) || /reputation|countdown|visits left/i.test(duesText)) {
    throw new Error(`dues line exposes a percent, reputation claim, or countdown (${duesText})`);
  }

  const shotPath = join(OUT, '390x844-member-dues.png');
  await page.screenshot({ path: shotPath, fullPage: false });
  const record = Object.freeze({
    capturedFrom: capturedFrom(),
    viewport: VIEWPORT,
    duesText,
    shot: '390x844-member-dues.png',
  });
  writeFileSync(join(OUT, 'dues.json'), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`G.2D dues line drawn: ${duesText}`);
  console.log(`wrote ${shotPath}`);
} finally {
  await browser.close();
}
