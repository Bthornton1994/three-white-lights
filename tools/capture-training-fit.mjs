#!/usr/bin/env node
/**
 * SF-TWL-SESSION-A-TRAINING-FIT-01 evidence: phone viewports, overflow, and
 * the no-check-in training path.
 *
 * Usage:
 *   bash tools/dev-web.sh
 *   node tools/capture-training-fit.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { completeCreateIfNeeded, CREATE_LIFTER } from './enterMeetFromCalendar.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
gateDevServer({ url });

const outDir = path.resolve(flag('out', 'docs/evidence/sf-twl-session-a-training-fit-01'));
const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 },
];
const MOMENTS = [
  { id: 'briefing', query: '?session=briefing', wait: 'session-briefing' },
  { id: 'briefing-heavy', query: '?session=briefing-heavy', wait: 'session-briefing' },
  { id: 'briefing-recovered', query: '?session=briefing-recovered', wait: 'session-briefing' },
  { id: 'set', query: '?session=set', wait: 'session-set' },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

function overflowReport() {
  const doc = document.documentElement;
  const body = document.body;
  const clipped = [];
  for (const el of document.querySelectorAll('[data-testid]')) {
    const id = el.getAttribute('data-testid');
    if (id === null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right > window.innerWidth + 1 || rect.left < -1) {
      clipped.push({
        id,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        innerWidth: window.innerWidth,
      });
    }
  }
  const sleep = document.querySelector('[data-testid="check-in-sleep-ok"]');
  const checkIn = document.querySelector('[data-testid="session-check-in"]');
  const text = (id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    return node === null ? null : (node.textContent ?? '').trim();
  };
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
    scrollHeight: Math.max(doc.scrollHeight, body.scrollHeight),
    overflowX: Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth + 1,
    sleepChipPresent: sleep !== null,
    checkInPresent: checkIn !== null,
    modifier: text('session-modifier'),
    readinessDetail: text('session-readiness-detail'),
    instruction: text('session-detail'),
    instructionToggle: text('session-instruction-toggle'),
    clipped,
  };
}

const report = {
  capturedAt: new Date().toISOString(),
  url,
  viewports: [],
  live: null,
};

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  const rows = [];
  for (const moment of MOMENTS) {
    await page.goto(`${url}${moment.query}`, { waitUntil: 'load' });
    await page.getByTestId(moment.wait).waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(700);
    const file = `${viewport.name}-${moment.id}.png`;
    await page.screenshot({ path: path.join(outDir, file), fullPage: false });
    const metrics = await page.evaluate(overflowReport);
    if (moment.id === 'set') {
      const toggle = page.getByTestId('session-instruction-toggle');
      if ((await toggle.count()) > 0) {
        await page.screenshot({
          path: path.join(outDir, `${viewport.name}-set-instructions-open.png`),
        });
        await toggle.click();
        await page.waitForTimeout(200);
        await page.screenshot({
          path: path.join(outDir, `${viewport.name}-set-instructions-collapsed.png`),
        });
        const collapsed = await page.evaluate(overflowReport);
        rows.push({
          moment: `${moment.id}-collapsed`,
          file: `${viewport.name}-set-instructions-collapsed.png`,
          ...collapsed,
        });
      }
    }
    rows.push({ moment: moment.id, file, ...metrics });
    console.log(
      `${viewport.name} ${moment.id.padEnd(20)} overflowX=${metrics.overflowX} ` +
        `scroll=${metrics.scrollWidth}/${metrics.innerWidth} ` +
        `checkIn=${metrics.checkInPresent} sleep=${metrics.sleepChipPresent} ` +
        `modifier=${JSON.stringify(metrics.modifier)}`,
    );
  }
  await context.close();
  report.viewports.push({ ...viewport, frames: rows });
}

{
  const viewport = VIEWPORTS[1];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  const file = '390x844-live-set-no-check-in.png';
  let live = {
    reached: false,
    why: 'did not start',
    file: null,
  };
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.getByTestId(CREATE_LIFTER.SCREEN).waitFor({ state: 'visible', timeout: 40000 });
    const created = await completeCreateIfNeeded(page);
    if (created.why) throw new Error(created.why);
    await page.getByTestId('session-briefing').waitFor({ state: 'visible', timeout: 40000 });
    await page.waitForTimeout(700);
    const sleepCount = await page.getByTestId('check-in-sleep-ok').count();
    await page.getByTestId('check-in-lift-squat').click({ timeout: 20000 });
    await page.getByTestId('session-rpe-8').click({ timeout: 20000 });
    await page.getByTestId('session-set').waitFor({ state: 'visible', timeout: 40000 });
    const metrics = await page.evaluate(overflowReport);
    await page.screenshot({ path: path.join(outDir, file) });
    live = {
      reached: true,
      why: null,
      file,
      sleepChipCount: sleepCount,
      ...metrics,
    };
  } catch (error) {
    const metrics = await page.evaluate(overflowReport).catch(() => ({}));
    live = {
      reached: false,
      why: error instanceof Error ? error.message : String(error),
      file: null,
      ...metrics,
    };
  }
  report.live = live;
  console.log(
    `live squat set        reached=${live.reached} ` +
      `checkIn=${live.checkInPresent ?? '?'} sleep=${live.sleepChipPresent ?? live.sleepChipCount ?? '?'} ` +
      (live.reached ? '' : live.why),
  );
  await context.close();
}

await writeFile(path.join(outDir, 'overflow.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();

const overflowHits = report.viewports.flatMap((v) =>
  v.frames.filter((f) => f.overflowX || f.clipped.length > 0 || f.checkInPresent || f.sleepChipPresent),
);
if (overflowHits.length > 0 || (report.live && (report.live.overflowX || report.live.checkInPresent))) {
  console.error('TRAINING-FIT EVIDENCE HAS FINDINGS — see overflow.json');
  process.exit(1);
}
console.log(`wrote ${outDir}`);
