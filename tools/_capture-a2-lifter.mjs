#!/usr/bin/env node
/**
 * Photographs the A2 Career path at 390×844 with no `?meet=` query:
 * Create Your Lifter, My Lifter, Career calendar, weigh-in, live board, recap.
 * Longest legal platform name on those surfaces.
 *
 * Not a debug route. First-run Create is the identity gate.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import {
  completeCreateIfNeeded,
  CREATE_LIFTER,
  CALENDAR_ENTRY,
} from './enterMeetFromCalendar.mjs';
import { driveMeetToItsEnd } from './meetDrive.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
gateDevServer({ url });
const outDir = path.resolve(flag('out', '.gauntlet/shots/a2-lifter'));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));
const LONGEST = 'W. MONTGOMERY-LEES';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
});
await armFreshLifterPerBoot(context);
const page = await context.newPage();
page.setDefaultTimeout(120000);

await page.goto(url, { waitUntil: 'load' });
await page.getByTestId(CREATE_LIFTER.SCREEN).waitFor({ state: 'visible', timeout: 120000 });
await page.getByTestId(CREATE_LIFTER.NAME).fill(LONGEST);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '01-create.png') });

const created = await completeCreateIfNeeded(page, {
  name: LONGEST,
  bodyweight: '72',
  sexTestId: CREATE_LIFTER.SEX_FEMALE,
  leaveAfter: false,
});
if (created.why) {
  console.error(`create failed: ${created.why}`);
  await browser.close();
  process.exit(1);
}
await page.getByTestId(CREATE_LIFTER.CARD).waitFor({ state: 'visible', timeout: 120000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '02-my-lifter.png') });

const leave = page.getByTestId(CREATE_LIFTER.LEAVE);
await leave.waitFor({ state: 'visible', timeout: 40000 });
await leave.click();
await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 120000 });

const careerPill = page.getByTestId(CALENDAR_ENTRY.NAV_OPEN_CAREER);
await careerPill.waitFor({ state: 'visible', timeout: 40000 });
await careerPill.click();
await page.getByTestId(CALENDAR_ENTRY.CALENDAR).waitFor({ state: 'visible', timeout: 40000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '03-career.png') });

await page.getByTestId(CALENDAR_ENTRY.ENTER_LOCAL).click({ timeout: 40000 });
await page.getByTestId('meet-weigh-in').waitFor({ state: 'visible', timeout: 120000 });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '04-weigh-in.png') });
const weighInName = await page.getByTestId('meet-lifter').textContent().catch(() => null);

let boardShot = false;
const driven = await driveMeetToItsEnd(page, {
  recapSettleMs: 5200,
  onSelectSeen: async () => {
    if (boardShot) return;
    const boardUp = await page.getByTestId('meet-board').isVisible().catch(() => false);
    if (boardUp) {
      await page.screenshot({ path: path.join(outDir, '05-board.png') });
      boardShot = true;
    }
  },
});
if (driven.ended !== 'recap' && driven.ended !== 'bombed') {
  console.error(`meet ended ${driven.ended}: ${JSON.stringify(driven)}`);
  await page.screenshot({ path: path.join(outDir, 'fail-meet.png') });
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '06-recap.png') });
const card = page.getByTestId('result-card-screen');
if (await card.isVisible().catch(() => false)) {
  await page.screenshot({ path: path.join(outDir, '07-card.png') });
} else {
  const recapAction = page.getByTestId('recap-action');
  if (await recapAction.isVisible().catch(() => false)) {
    await recapAction.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, '07-card.png') });
  }
}

const nameOnWeighIn = weighInName;
console.log(
  JSON.stringify(
    {
      viewport: `${width}x${height}`,
      name: LONGEST,
      created: created.created,
      entered: true,
      ending: driven.ended,
      boardShot,
      weighInName: nameOnWeighIn,
      outDir,
    },
    null,
    2,
  ),
);

await browser.close();
