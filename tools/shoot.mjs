#!/usr/bin/env node
/**
 * Screenshot harness.
 *
 * The Gauntlet Loop depends on critics inspecting *real rendered pixels*
 * rather than a builder's description of them. This drives the Expo web
 * build in headless Chromium and writes a PNG a critic can open with Read.
 *
 * Usage: node tools/shoot.mjs <out.png> [--url URL] [--w 390] [--h 844] [--wait ms] [--sel testID]
 */
import { chromium } from 'playwright';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const out = args[0];
if (!out) {
  console.error('usage: node tools/shoot.mjs <out.png> [--url URL] [--w N] [--h N] [--wait ms] [--sel S]');
  process.exit(2);
}
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
// Refuses (with the reason and the fix named) unless tools/dev-web.sh started the
// server this URL names and it is still that process on that port — see
// devServerSentinel.mjs's header. UNMANAGED_DEV_SERVER=1 skips it, loudly.
gateDevServer({ url });
// iPhone 14-ish logical viewport: the GDD judges readability at phone scale.
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const wait = Number(flag('wait', '3500'));
const sel = flag('sel', null);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: Number(flag('dpr', '2')),
});
// Sprint 2: the server persists a lifter across boots. Every goto in this tool
// means a FRESH one, so the boundary is armed rather than assumed.
await armFreshLifterPerBoot(page.context());

const consoleLines = [];
page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));

let status = 'ok';
try {
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  if (resp && !resp.ok()) status = `http ${resp.status()}`;
} catch (e) {
  status = `nav-failed: ${e.message}`;
}

if (sel) {
  try {
    await page.waitForSelector(`[data-testid="${sel}"]`, { timeout: 20000 });
  } catch {
    consoleLines.push(`[warn] selector ${sel} not found`);
  }
}

await page.waitForTimeout(wait);
await mkdir(path.dirname(path.resolve(out)), { recursive: true });
await page.screenshot({ path: out, fullPage: false });

// Report what the page actually contains so a failed render can't masquerade
// as a successful screenshot of a blank page.
const probe = await page.evaluate(() => ({
  text: (document.body.innerText || '').slice(0, 400),
  canvases: Array.from(document.querySelectorAll('canvas')).map((c) => ({
    w: c.width,
    h: c.height,
  })),
  html: document.body.innerHTML.length,
}));

console.log(JSON.stringify({ status, out, probe, console: consoleLines.slice(0, 40) }, null, 2));
await browser.close();
