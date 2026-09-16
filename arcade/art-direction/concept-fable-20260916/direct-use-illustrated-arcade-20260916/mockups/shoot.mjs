// Screenshot harness for the direct-use mockups. Read-only over the reference files; writes PNGs to ./shots/.
// Run from this folder: PLAYWRIGHT_PKG=/opt/node22/lib/node_modules/playwright node shoot.mjs   (or `npm i playwright` here and run plain)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PKG || 'playwright');
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(join(here, 'index.html')).href;
mkdirSync(join(here, 'shots'), { recursive: true });

const VIEWPORTS = { phone: { width: 390, height: 844, deviceScaleFactor: 2 }, desktop: { width: 1280, height: 800, deviceScaleFactor: 1 } };
const STATES = [
  ['title', 'screen=title'],
  ['lift', 'screen=lift'],
  ['results', 'screen=results'],
  ['results-bomb', 'screen=results&bomb=1'],
  ['timing-squat-light-p0.10', 'screen=timing&lift=squat&effort=light&p=0.10'],
  ['timing-squat-light-p0.42', 'screen=timing&lift=squat&effort=light&p=0.42'],
  ['timing-squat-max-p0.55', 'screen=timing&lift=squat&effort=max&p=0.55'],
  ['timing-bench-light-p0.40', 'screen=timing&lift=bench&effort=light&p=0.40'],
  ['timing-deadlift-max-p0.28', 'screen=timing&lift=deadlift&effort=max&p=0.28'],
  ['timing-deadlift-max-p0.85', 'screen=timing&lift=deadlift&effort=max&p=0.85'],
  // the rejected phone policy, kept for comparison: tight hold that crops the plate stacks
  ['timing-squat-max-p0.55-cam-lifter', 'screen=timing&lift=squat&effort=max&p=0.55&cam=lifter'],
];

const browser = await chromium.launch();
const scales = [];
for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
  const page = await ctx.newPage();
  for (const [name, qs] of STATES) {
    await page.goto(`${page_url}?${qs}`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
    await page.waitForTimeout(150);
    const out = join(here, 'shots', `${vpName}-${name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    const k = await page.$$eval('.cam', els => els.map(e => `${e.className.replace('cam', '').trim() || 'main'}:${e.dataset.scale}`));
    scales.push(`${vpName}-${name}: ${k.join(' ')}`);
    console.log('shot', out);
  }
  await ctx.close();
}
await browser.close();
console.log('\nCamera scales (source px -> screen px):\n' + scales.join('\n'));
