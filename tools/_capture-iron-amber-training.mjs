#!/usr/bin/env node
/**
 * Photographs Iron & Amber training graphics at 375×812 and 390×844.
 * Briefing gym plate, live squat set, live deadlift set, live bench set.
 * Deadlift and bench are the played check-in path — `?session=set` is squat.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { completeCreateIfNeeded } from './enterMeetFromCalendar.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://127.0.0.1:8080');
gateDevServer({ url });
const outDir = path.resolve(flag('out', '.gauntlet/shots/iron-amber-training'));
await mkdir(outDir, { recursive: true });

const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });

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

async function shotQuery(width, height, name, search) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${url}${search}`, { waitUntil: 'load' });
  if (search.includes('briefing')) {
    await page.getByTestId('iron-amber-briefing-gym').waitFor({ state: 'visible', timeout: 60000 });
  } else {
    await page.getByTestId('iron-amber-stage').waitFor({ state: 'visible', timeout: 60000 });
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, name) });
  const gym = await page.getByTestId('iron-amber-briefing-gym').count();
  const stage = await page.getByTestId('iron-amber-stage').count();
  await context.close();
  return { gym, stage };
}

async function liveLift(width, height, name, lift) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
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
    return { gym, stage: 0, lift };
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
  const stage = await page.getByTestId('iron-amber-stage').count();
  await context.close();
  return { gym: 0, stage, lift, prompt, plateTestId };
}

const report = { briefing: [], squat: [], deadlift: [], bench: [] };
for (const vp of VIEWPORTS) {
  report.briefing.push(
    await shotQuery(vp.width, vp.height, `${vp.name}-briefing.png`, '?session=briefing'),
  );
}
report.squat.push(await liveLift(390, 844, '390x844-set-squat.png', 'squat'));
report.squat.push(await liveLift(375, 812, '375x812-set-squat.png', 'squat'));
report.deadlift.push(await liveLift(390, 844, '390x844-live-deadlift.png', 'deadlift'));
report.deadlift.push(await liveLift(375, 812, '375x812-live-deadlift.png', 'deadlift'));
report.bench.push(await liveLift(390, 844, '390x844-live-bench.png', 'bench'));
report.bench.push(await liveLift(375, 812, '375x812-live-bench.png', 'bench'));

console.log(JSON.stringify({ outDir, report }, null, 2));
await browser.close();
