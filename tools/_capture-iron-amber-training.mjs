#!/usr/bin/env node
/**
 * Photographs Iron & Amber training graphics at 375×812 and 390×844.
 * Briefing, live set (braced), a driven grind/ascent, and close-out.
 * Debug `?session=` beats skip Create and skip photographing check-in.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';

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

async function forbiddenResidue(page) {
  return page.evaluate(() => {
    const body = (document.body?.innerText ?? '').toLowerCase();
    const hits = [];
    for (const word of ['check-in', 'accelerated', 'diagnostics', 'clock']) {
      if (body.includes(word)) hits.push(word);
    }
    const ids = [...document.querySelectorAll('[data-testid]')]
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => id && /check-in|debug|accelerated|clock/.test(id));
    return { hits, ids };
  });
}

async function overflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

async function openMoment(width, height, search) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${url}${search}`, { waitUntil: 'load' });
  return { context, page };
}

async function shotBriefing(vp) {
  const { context, page } = await openMoment(vp.width, vp.height, '?session=briefing');
  await page.getByTestId('iron-amber-briefing-gym').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('session-rpe-ladder').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  const name = `${vp.name}-briefing.png`;
  await page.screenshot({ path: path.join(outDir, name) });
  const residue = await forbiddenResidue(page);
  const box = await overflow(page);
  const rpe = await page.getByTestId('session-rpe-8').boundingBox();
  await context.close();
  return { name, residue, overflowX: box.scrollWidth > box.clientWidth + 1, rpeVisible: rpe !== null };
}

async function shotCloseOut(vp) {
  const { context, page } = await openMoment(vp.width, vp.height, '?session=close-out-held');
  await page.getByTestId('session-close-out').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('iron-amber-close-out-gym').waitFor({ state: 'visible', timeout: 30000 });
  await page.getByTestId('close-out-action').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(800);
  const name = `${vp.name}-close-out.png`;
  await page.screenshot({ path: path.join(outDir, name) });
  const residue = await forbiddenResidue(page);
  const action = await page.getByTestId('close-out-action').boundingBox();
  await context.close();
  return { name, residue, actionVisible: action !== null };
}

async function shotLive(vp) {
  const { context, page } = await openMoment(vp.width, vp.height, '?session=set');
  await page.getByTestId('session-set').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('iron-amber-stage').waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  const plateTestId = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="iron-amber-plate-"]')].map((n) =>
      n.getAttribute('data-testid'),
    ),
  );
  const prompt = await page.getByTestId('session-prompt').textContent();
  const activeName = `${vp.name}-active-lift.png`;
  await page.screenshot({ path: path.join(outDir, activeName) });

  const box = await page.getByTestId('session-touch').boundingBox();
  if (box === null) {
    await context.close();
    throw new Error('session-touch missing for grind drive');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="session-prompt"]');
      const text = (el?.textContent ?? '').toUpperCase();
      return text.includes('DRIVE') || text.includes('GRIND') || text.includes('TAP');
    },
    null,
    { timeout: 8000 },
  ).catch(() => null);
  await page.mouse.down();
  await page.waitForTimeout(700);
  const grindPrompt = await page.getByTestId('session-prompt').textContent();
  const grindName = `${vp.name}-grinder.png`;
  await page.screenshot({ path: path.join(outDir, grindName) });
  await page.mouse.up();
  const residue = await forbiddenResidue(page);
  const overflowBox = await overflow(page);
  await context.close();
  return {
    activeName,
    grindName,
    plateTestId,
    prompt,
    grindPrompt,
    residue,
    overflowX: overflowBox.scrollWidth > overflowBox.clientWidth + 1,
  };
}

const report = { briefing: [], closeOut: [], live: [] };
for (const vp of VIEWPORTS) {
  report.briefing.push(await shotBriefing(vp));
  report.live.push(await shotLive(vp));
  report.closeOut.push(await shotCloseOut(vp));
}

console.log(JSON.stringify({ outDir, report }, null, 2));
await browser.close();
