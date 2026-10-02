#!/usr/bin/env node
/**
 * Photographs Iron & Amber training graphics at 375×812 and 390×844.
 * Create Lifter, check-in, briefing gym plate, close-out, live squat/bench/deadlift.
 * Deadlift and bench are the played check-in path — `?session=set` is squat.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { completeCreateIfNeeded } from './enterMeetFromCalendar.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
gateDevServer({ url });
const outDir = path.resolve(flag('out', '.gauntlet/shots/iron-amber-training'));
await mkdir(outDir, { recursive: true });

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });

function attachConsole(page, bucket) {
  page.on('pageerror', (err) => {
    bucket.push({ type: 'pageerror', text: String(err) });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') bucket.push({ type: 'console', text: msg.text() });
  });
}

async function visibleTestIds(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('[data-testid]')) {
      const id = el.getAttribute('data-testid');
      const style = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0 &&
        r.width > 0 &&
        r.height > 0
      ) {
        out.push(id);
      }
    }
    return out;
  });
}

async function overflowReport(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const hits = [];
    for (const el of document.querySelectorAll('[data-testid]')) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        hits.push({
          id: el.getAttribute('data-testid'),
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
        });
      }
    }
    return { vw, vh, hits, docWidth: document.documentElement.scrollWidth };
  });
}

/** First-run Create is forced; session-check-in is mounted but display:none under it. */
async function waitForCreateOrCheckIn(page) {
  await page.waitForFunction(
    () => {
      const ids = ['lifter-create', 'lifter-card', 'session-check-in'];
      return ids.some((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    },
    null,
    { timeout: 90000 },
  );
}

async function shotQuery(width, height, name, search, waitId) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  attachConsole(page, errors);
  page.setDefaultTimeout(120000);
  await page.goto(`${url}${search}`, { waitUntil: 'load' });
  await page.getByTestId(waitId).waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, name) });
  const overflow = await overflowReport(page);
  const visible = await visibleTestIds(page);
  await context.close();
  return { waitId, overflow, visible, errors };
}

async function liveCreateAndCheckIn(width, height, createName, checkInName) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  attachConsole(page, errors);
  page.setDefaultTimeout(120000);
  await page.goto(url, { waitUntil: 'load' });
  await waitForCreateOrCheckIn(page);
  await page.waitForTimeout(600);
  const createVisible = await page.getByTestId('lifter-create').isVisible().catch(() => false);
  if (createVisible) {
    await page.screenshot({ path: path.join(outDir, createName) });
  }
  const created = await completeCreateIfNeeded(page, { leaveAfter: true });
  if (created.why) {
    const visible = await visibleTestIds(page);
    await page.screenshot({ path: path.join(outDir, `FAIL-${checkInName}`) });
    await context.close();
    throw new Error(`Create refused (${created.why}); visible=${JSON.stringify(visible)}`);
  }
  await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('iron-amber-check-in-gym').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, checkInName) });
  const overflow = await overflowReport(page);
  const visible = await visibleTestIds(page);
  await context.close();
  return { created: created.created, overflow, visible, errors };
}

async function liveLift(width, height, name, lift) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  attachConsole(page, errors);
  page.setDefaultTimeout(120000);
  await page.goto(url, { waitUntil: 'load' });
  await waitForCreateOrCheckIn(page);
  const created = await completeCreateIfNeeded(page, { leaveAfter: true });
  if (created.why) {
    const visible = await visibleTestIds(page);
    throw new Error(`Create refused (${created.why}); visible=${JSON.stringify(visible)}`);
  }
  try {
    await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 60000 });
  } catch (err) {
    const visible = await visibleTestIds(page);
    await page.screenshot({ path: path.join(outDir, `FAIL-${name}`) });
    await context.close();
    throw new Error(
      `check-in stayed hidden after Create created=${created.created}; visible=${JSON.stringify(visible)}; ${err.message}`,
    );
  }
  await page.getByTestId(`check-in-lift-${lift}`).click();
  await page.getByTestId('check-in-sleep-ok').click();
  await page.getByTestId('check-in-soreness-normal').click();
  await page.getByTestId('check-in-motivation-steady').click();
  await page.getByTestId('session-briefing').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('iron-amber-briefing-gym').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(600);
  if (name.includes('briefing')) {
    await page.screenshot({ path: path.join(outDir, name) });
    const gym = await page.getByTestId('iron-amber-briefing-gym').count();
    await context.close();
    return { gym, stage: 0, lift, errors };
  }
  await page.getByTestId('session-rpe-8').click();
  await page.getByTestId('session-set').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('iron-amber-stage').waitFor({ state: 'visible', timeout: 30000 });
  const plateTestId = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-testid^="iron-amber-plate-"]')];
    return nodes.map((n) => n.getAttribute('data-testid'));
  });
  await page.waitForTimeout(800);
  const prompt = await page.getByTestId('session-prompt').textContent();
  await page.screenshot({ path: path.join(outDir, name) });
  const overflow = await overflowReport(page);
  const stage = await page.getByTestId('iron-amber-stage').count();
  await context.close();
  return { gym: 0, stage, lift, prompt, plateTestId, overflow, errors };
}

const report = {
  create: [],
  checkIn: [],
  briefing: [],
  closeOut: [],
  squat: [],
  deadlift: [],
  bench: [],
};
for (const vp of VIEWPORTS) {
  report.checkIn.push(
    await shotQuery(
      vp.width,
      vp.height,
      `${vp.name}-check-in.png`,
      '?session=check-in',
      'iron-amber-check-in-gym',
    ),
  );
  report.briefing.push(
    await shotQuery(
      vp.width,
      vp.height,
      `${vp.name}-briefing.png`,
      '?session=briefing',
      'iron-amber-briefing-gym',
    ),
  );
  report.closeOut.push(
    await shotQuery(
      vp.width,
      vp.height,
      `${vp.name}-close-out-pr.png`,
      '?session=close-out-pr',
      'iron-amber-close-out-gym',
    ),
  );
}
report.create.push(
  await liveCreateAndCheckIn(390, 844, '390x844-create.png', '390x844-check-in-live.png'),
);
report.create.push(
  await liveCreateAndCheckIn(375, 812, '375x812-create.png', '375x812-check-in-live.png'),
);
report.squat.push(await liveLift(390, 844, '390x844-set-squat.png', 'squat'));
report.squat.push(await liveLift(375, 812, '375x812-set-squat.png', 'squat'));
report.deadlift.push(await liveLift(390, 844, '390x844-live-deadlift.png', 'deadlift'));
report.deadlift.push(await liveLift(375, 812, '375x812-live-deadlift.png', 'deadlift'));
report.bench.push(await liveLift(390, 844, '390x844-live-bench.png', 'bench'));
report.bench.push(await liveLift(375, 812, '375x812-live-bench.png', 'bench'));

await writeFile(path.join(outDir, 'report.json'), JSON.stringify({ outDir, report }, null, 2));
console.log(JSON.stringify({ outDir, report }, null, 2));
await browser.close();
