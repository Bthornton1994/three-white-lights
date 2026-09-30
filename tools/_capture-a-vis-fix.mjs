#!/usr/bin/env node
/**
 * 390×844 critic stills for A-VIS-01/02/03.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/design/evidence');
await mkdir(outDir, { recursive: true });

const width = 390;
const height = 844;
const dpr = 2;

const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
await armFreshLifterPerBoot(context);
const page = await context.newPage();

async function waitTestId(id, ms = 60000) {
  await page.waitForFunction(
    (testId) => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      if (el === null) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && Number(style.opacity || '1') > 0.05;
    },
    id,
    { timeout: ms },
  );
}

async function probe(id) {
  return page.evaluate((testId) => {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    if (el === null) return { id: testId, present: false };
    const r = el.getBoundingClientRect();
    return {
      id: testId,
      present: true,
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      topFrac: Number((r.y / window.innerHeight).toFixed(3)),
      heightFrac: Number((r.height / window.innerHeight).toFixed(3)),
    };
  }, id);
}

page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
const created = await completeCreateIfNeeded(page);
console.log('create', created);
await waitTestId('session-check-in');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, '01-check-in-first-paint.png') });
console.log('check-in', await probe('session-check-in'), await probe('iron-amber-check-in-gym'), await probe('check-in-disclosures'));

await page.goto(`${url}/?session=close-out-pr`, { waitUntil: 'networkidle', timeout: 90000 });
await waitTestId('session-close-out');
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(outDir, '02-close-out-drawer.png') });
console.log('close-out', await probe('session-close-out'), await probe('iron-amber-close-out-gym'), await probe('close-out-action'));

await page.goto(`${url}/?cutin=personal-record`, { waitUntil: 'networkidle', timeout: 90000 });
await completeCreateIfNeeded(page, { leaveAfter: true });
await waitTestId('cut-in');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(outDir, '03-cut-in-still.png') });
console.log('cut-in', await probe('cut-in'), await probe('cut-in-art'), await probe('cut-in-identity'), await probe('cut-in-line'));

const body = await page.evaluate(() => (document.body.innerText || '').slice(0, 500));
console.log('cut-in text', JSON.stringify(body));

await browser.close();
console.log('wrote', outDir);
