// probe-rive-spike.mjs — THE MEASUREMENT SCRIPT BEHIND `probe.json` BESIDE IT.
//
// Not a harness tool. It does not gate on `tools/devServerSentinel.mjs`
// (`gateDevServer`) and is not in `tools/` for that reason: the CLAUDE.md rule
// that every browser tool refuses an unmanaged dev server is for the GDD
// evidence harness, and this is a one-off runtime spike measurement kept
// beside its record so the record can be reproduced, not a grader anybody
// runs on a schedule. To reproduce: start the server with `tools/dev-web.sh`,
// then `OUT_DIR=<dir> BASE_URL=http://localhost:8081 node probe-rive-spike.mjs`
// from a directory that can resolve `playwright` (the repo root does).
//
// What it drives: the dev-only spike route (`?dev-rive-spike=1`), then the
// player path with no flag, then a wrong flag value — and records mount time,
// the status line, canvas count, 5 s of rAF pacing under the 60 Hz write loop,
// a 10 s heap sample, every console line and page error, and whether the
// spike is absent from the player path. See ADR-001 §7.
//
// SECOND RUN, 2026-09-08, on a REAL asset (`assets/dev/quick_start.riv`): the
// record also carries `sceneMotion` — two `getImageData` samples of the Rive
// canvas a quarter of a synthetic rep apart, compared pixel by pixel — so
// "the graphic moves under the 60 Hz ViewModel write" is a count, not a
// reading of two screenshots by eye. The canvas is a 2D context (this is
// `@rive-app/canvas`, not the WebGL build), so `getImageData` reads it back
// directly. `spike-route-later.png` is the second instant, photographed.
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT = process.env.OUT_DIR;
const record = { base: BASE, startedAt: new Date().toISOString(), spike: {}, playerPath: {} };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const consoleLines = [];
const pageErrors = [];
page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => pageErrors.push(String(e?.stack ?? e)));

async function dumpFailure(label, err) {
  record.failure = { label, error: String(err?.message ?? err) };
  record.consoleAtFailure = consoleLines.slice();
  record.pageErrorsAtFailure = pageErrors.slice();
  try { record.bodyTextAtFailure = (await page.evaluate(() => document.body?.innerText ?? '')).slice(0, 4000); } catch {}
  try { await page.screenshot({ path: `${OUT}/failure-${label}.png` }); } catch {}
  writeFileSync(`${OUT}/probe.json`, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
  await browser.close();
  process.exit(2);
}

try {
// --- 1. the spike route ------------------------------------------------------
const t0 = Date.now();
await page.goto(`${BASE}/?dev-rive-spike=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
// Wait for the dev screen root (Metro's first bundle can take a minute).
await page.waitForSelector('[data-testid="dev-rive-spike"]', { timeout: 240_000 });
record.spike.msToMount = Date.now() - t0;
// Wait for the status line to leave "loading…" — bound or error — up to 60s.
let statusText = '';
const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  statusText = (await page.textContent('[data-testid="dev-rive-spike-status"]')) ?? '';
  if (!statusText.startsWith('loading')) break;
  await page.waitForTimeout(250);
}
record.spike.msToSettledStatus = Date.now() - t0;
record.spike.status = statusText;
record.spike.addressBar = await page.evaluate(() => window.location.search);
record.spike.canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);

// Does the scene MOVE under the write loop? Two readbacks of the Rive canvas,
// SAMPLE_GAP_MS apart (a quarter of `SPIKE_SIGNAL.REP_PERIOD_MS`, 1800 ms, so
// the health bar's fill differs between them), compared pixel by pixel.
const SAMPLE_GAP_MS = 450;
record.spike.sceneMotion = await page.evaluate(async (gapMs) => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { error: 'no canvas' };
  const ctx = canvas.getContext('2d');
  if (!ctx) return { error: 'no 2d context on the canvas' };
  const read = () => ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const a = read();
  await new Promise((r) => setTimeout(r, gapMs));
  const b = read();
  let changedPixels = 0; let maxChannelDelta = 0; let nonBlankA = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== 0) nonBlankA += 1;
    let d = 0;
    for (let c = 0; c < 4; c += 1) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    if (d > 0) changedPixels += 1;
    if (d > maxChannelDelta) maxChannelDelta = d;
  }
  return { width: canvas.width, height: canvas.height, totalPixels: a.length / 4, nonBlankPixelsAtFirstSample: nonBlankA, sampleGapMs: gapMs, changedPixels, maxChannelDelta };
}, SAMPLE_GAP_MS);

// Frame pacing while the 60fps write loop runs: sample rAF intervals for 5s.
record.spike.framePacing = await page.evaluate(() => new Promise((resolve) => {
  const gaps = []; let last = performance.now(); const end = last + 5000;
  function tick(now) { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else finish(); }
  function finish() {
    gaps.shift();
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    resolve({ frames: gaps.length, meanMs: +(gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2),
      p50Ms: +q(0.5).toFixed(2), p95Ms: +q(0.95).toFixed(2), maxMs: +Math.max(...gaps).toFixed(2),
      over33ms: gaps.filter((g) => g > 33).length });
  }
  requestAnimationFrame(tick);
}));
// Heap, if the browser exposes it (Chromium does, non-standard).
record.spike.heap = await page.evaluate(async () => {
  const m = performance.memory; if (!m) return null;
  const a = m.usedJSHeapSize; await new Promise((r) => setTimeout(r, 10_000)); const b = performance.memory.usedJSHeapSize;
  return { usedJSHeapStart: a, usedJSHeapAfter10s: b, deltaBytes: b - a };
});
await page.screenshot({ path: `${OUT}/spike-route.png`, fullPage: false });
await page.waitForTimeout(SAMPLE_GAP_MS);
await page.screenshot({ path: `${OUT}/spike-route-later.png`, fullPage: false });
record.spike.consoleLines = consoleLines.slice();
record.spike.pageErrors = pageErrors.slice();
consoleLines.length = 0; pageErrors.length = 0;

// --- 2. the player path: NO spike, the real shell ----------------------------
const t1 = Date.now();
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForSelector('[data-testid="app-shell"]', { timeout: 240_000 });
record.playerPath.msToShell = Date.now() - t1;
record.playerPath.addressBar = await page.evaluate(() => window.location.search);
record.playerPath.devSpikePresent = await page.evaluate(() => !!document.querySelector('[data-testid="dev-rive-spike"]'));
record.playerPath.appShellPresent = await page.evaluate(() => !!document.querySelector('[data-testid="app-shell"]'));
await page.screenshot({ path: `${OUT}/player-path.png`, fullPage: false });
record.playerPath.consoleLines = consoleLines.slice();
record.playerPath.pageErrors = pageErrors.slice();

// --- 3. the flag WITHOUT __DEV__ cannot be simulated here; the flag with a
//        wrong value must not open the spike either.
await page.goto(`${BASE}/?dev-rive-spike=0`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForSelector('[data-testid="app-shell"]', { timeout: 240_000 });
record.playerPath.wrongFlagValueOpensSpike = await page.evaluate(() => !!document.querySelector('[data-testid="dev-rive-spike"]'));

record.finishedAt = new Date().toISOString();
writeFileSync(`${OUT}/probe.json`, JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
await browser.close();
} catch (err) {
  await dumpFailure('probe', err);
}
