// probe-host-runtime-soak.mjs — THE MEASUREMENT SCRIPT BEHIND `soak.json` BESIDE IT.
//
// HOST-RUNTIME SOAK, not ATHLETE PERFORMANCE: the subject is the production
// host path the athlete stage will run on — `@rive-app/react-canvas` on the
// self-hosted engine (`src/session/riveWebEngine.ts`), mounted by React under
// the app's own routing, driven by a 60 Hz ViewModel write — on the licensed
// diagnostic asset (`assets/dev/quick_start.riv`, one bound number). There is
// no athlete in it, and nothing here says anything about how a forty-three
// input rig paces; it says whether the HOST survives the things a phone does
// to a page: sustained writes, resizes, being backgrounded, a stalled main
// thread, and being mounted and unmounted over and over.
//
// Not a harness tool — it is kept beside its record, like `../rive-spike/
// probe-rive-spike.mjs`, and does not gate on `tools/devServerSentinel.mjs`.
// To reproduce: `tools/dev-web.sh`, then
//   OUT_DIR=<dir> BASE_URL=http://localhost:8081 node probe-host-runtime-soak.mjs
// from a directory that resolves `playwright` (the repo root does). Knobs:
// SOAK_SECONDS (sustained window, default 90), ROUTE_CYCLES (route
// enter/leave, default 12), REMOUNT_SECONDS (in-page mount/unmount window on
// the `spike-cycle` mode, default 60), STALL_MS (deliberate main-thread stall,
// default 800).
//
// Phases, in order, each writing its own block into the record:
//   A baseline      spike route, bound; 5 s rAF; heap; canvas motion; listeners
//   B sustained     SOAK_SECONDS of 10 s pacing windows with heap samples; slope
//   C resize        375×812 ⇄ 390×844, six times, pacing and canvas size each
//   D visibility    another tab in front for 5 s (document.hidden true), back; recovery pacing
//   E stall         a STALL_MS busy loop on the main thread, three times; recovery
//   F route cycles  ROUTE_CYCLES × (player path ⇄ spike route): mount ms, canvases, heap, listeners
//   G remount       `?dev-mode=spike-cycle`: the stage unmounted/remounted in place for REMOUNT_SECONDS
//   H player path   `/` with no flag: the spike absent, 0 errors
// Console lines and page errors are captured per phase. Listener counts come
// from CDP `DOMDebugger.getEventListeners` on `window` and `document`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT = process.env.OUT_DIR;
if (!OUT) throw new Error('OUT_DIR is required');
mkdirSync(OUT, { recursive: true });
const SOAK_SECONDS = Number(process.env.SOAK_SECONDS ?? 90);
const ROUTE_CYCLES = Number(process.env.ROUTE_CYCLES ?? 12);
const REMOUNT_SECONDS = Number(process.env.REMOUNT_SECONDS ?? 60);
const STALL_MS = Number(process.env.STALL_MS ?? 800);
const SPIKE = `${BASE}/?dev-rive-spike=1`;
const CYCLE = `${BASE}/?dev-rive-spike=1&dev-mode=spike-cycle`;

const record = { label: 'HOST-RUNTIME SOAK', notA: ['ATHLETE PERFORMANCE', 'VISUAL', 'ANIMATION'], base: BASE, startedAt: new Date().toISOString(), knobs: { SOAK_SECONDS, ROUTE_CYCLES, REMOUNT_SECONDS, STALL_MS } };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
let consoleLines = [];
let pageErrors = [];
page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => pageErrors.push(String(e?.stack ?? e)));
const drain = () => { const c = { consoleLines, pageErrors }; consoleLines = []; pageErrors = []; return c; };

const status = async () => (await page.textContent('[data-testid="dev-rive-spike-status"]')) ?? '';
async function openSpike(url = SPIKE) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForSelector('[data-testid="dev-rive-spike"]', { timeout: 240_000 });
  const deadline = Date.now() + 60_000;
  let text = '';
  while (Date.now() < deadline) { text = await status(); if (!text.startsWith('loading')) break; await page.waitForTimeout(100); }
  return { ms: Date.now() - t0, status: text };
}
const pacing = (ms) => page.evaluate((window_) => new Promise((resolve) => {
  const gaps = []; let last = performance.now(); const end = last + window_;
  function tick(now) { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else finish(); }
  function finish() {
    gaps.shift();
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
    resolve({ frames: gaps.length, meanMs: +(gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)).toFixed(2), p50Ms: +q(0.5).toFixed(2), p95Ms: +q(0.95).toFixed(2), maxMs: +Math.max(0, ...gaps).toFixed(2), over33ms: gaps.filter((g) => g > 33).length, over50ms: gaps.filter((g) => g > 50).length });
  }
  requestAnimationFrame(tick);
}), ms);
const heap = () => page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
const canvasCount = () => page.evaluate(() => document.querySelectorAll('canvas').length);
const canvasSize = () => page.evaluate(() => { const c = document.querySelector('canvas'); return c ? { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight } : null; });
const motion = (gapMs) => page.evaluate(async (gap) => {
  const canvas = document.querySelector('canvas'); if (!canvas) return { error: 'no canvas' };
  const ctx = canvas.getContext('2d'); if (!ctx) return { error: 'no 2d context' };
  const read = () => ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const a = read(); await new Promise((r) => setTimeout(r, gap)); const b = read();
  let changed = 0; let maxDelta = 0;
  for (let i = 0; i < a.length; i += 4) { let d = 0; for (let c = 0; c < 4; c += 1) d = Math.max(d, Math.abs(a[i + c] - b[i + c])); if (d > 0) changed += 1; if (d > maxDelta) maxDelta = d; }
  return { totalPixels: a.length / 4, changedPixels: changed, maxChannelDelta: maxDelta, gapMs: gap };
}, gapMs);
async function listeners() {
  const out = {};
  for (const expr of ['window', 'document']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
    const { listeners: ls } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    const byType = {};
    for (const l of ls) byType[l.type] = (byType[l.type] ?? 0) + 1;
    out[expr] = { total: ls.length, byType };
    await cdp.send('Runtime.releaseObject', { objectId: result.objectId });
  }
  return out;
}
function slope(points) {
  // least squares bytes per second over {t (s), v}
  const n = points.length; if (n < 2) return null;
  const mt = points.reduce((a, p) => a + p.t, 0) / n; const mv = points.reduce((a, p) => a + p.v, 0) / n;
  const num = points.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0); const den = points.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  return den === 0 ? null : +(num / den).toFixed(1);
}
function fail(label, err) {
  record.failure = { label, error: String(err?.message ?? err), ...drain() };
  writeFileSync(`${OUT}/soak.json`, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
}

try {
  // --- A. baseline ------------------------------------------------------------
  const open = await openSpike();
  record.baseline = { ...open, pacing5s: await pacing(5000), heapBytes: await heap(), motion: await motion(450), canvases: await canvasCount(), canvas: await canvasSize(), listeners: await listeners(), addressBar: await page.evaluate(() => window.location.search), ...drain() };
  await page.screenshot({ path: `${OUT}/baseline.png` });

  // --- B. sustained writes -----------------------------------------------------
  const windows = [];
  const heapSeries = [];
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < SOAK_SECONDS) {
    const p = await pacing(10_000);
    const h = await heap();
    heapSeries.push({ t: +((Date.now() - t0) / 1000).toFixed(1), v: h });
    windows.push({ atSeconds: heapSeries.at(-1).t, ...p, heapBytes: h });
  }
  const totals = windows.reduce((a, w) => ({ frames: a.frames + w.frames, over33ms: a.over33ms + w.over33ms, over50ms: a.over50ms + w.over50ms, maxMs: Math.max(a.maxMs, w.maxMs) }), { frames: 0, over33ms: 0, over50ms: 0, maxMs: 0 });
  record.sustained = { seconds: +((Date.now() - t0) / 1000).toFixed(1), windows, totals, heapSlopeBytesPerSecond: slope(heapSeries), heapDeltaBytes: heapSeries.at(-1).v - heapSeries[0].v, motionAtEnd: await motion(450), status: await status(), canvases: await canvasCount(), ...drain() };

  // --- C. resize -----------------------------------------------------------------
  const resizes = [];
  for (let i = 0; i < 6; i += 1) {
    const v = i % 2 === 0 ? { width: 375, height: 812 } : { width: 390, height: 844 };
    await page.setViewportSize(v);
    await page.waitForTimeout(500);
    resizes.push({ viewport: v, pacing2s: await pacing(2000), canvas: await canvasSize(), canvases: await canvasCount(), motion: await motion(300), status: await status() });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  record.resize = { steps: resizes, ...drain() };
  await page.screenshot({ path: `${OUT}/after-resize.png` });

  // --- D. visibility -------------------------------------------------------------
  const other = await context.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await page.waitForTimeout(5000);
  const hiddenWhileBehind = await page.evaluate(() => document.visibilityState);
  await page.bringToFront();
  await other.close();
  await page.waitForTimeout(300);
  record.visibility = { visibilityStateWhileBehind: hiddenWhileBehind, recoveryPacing3s: await pacing(3000), motionAfter: await motion(450), status: await status(), canvases: await canvasCount(), ...drain() };

  // --- E. main-thread stall ------------------------------------------------------
  const stalls = [];
  for (let i = 0; i < 3; i += 1) {
    const r = await page.evaluate((stallMs) => new Promise((resolve) => {
      const gaps = []; let last = performance.now(); const end = last + 4000;
      setTimeout(() => { const t = performance.now(); while (performance.now() - t < stallMs) { /* stall */ } }, 1000);
      function tick(now) { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else finish(); }
      function finish() {
        gaps.shift();
        const worst = Math.max(...gaps);
        const after = gaps.slice(gaps.indexOf(worst) + 1);
        resolve({ frames: gaps.length, worstGapMs: +worst.toFixed(1), framesAfterStall: after.length, afterMeanMs: +(after.reduce((a, b) => a + b, 0) / Math.max(1, after.length)).toFixed(2), afterOver33ms: after.filter((g) => g > 33).length });
      }
      requestAnimationFrame(tick);
    }), STALL_MS);
    stalls.push({ ...r, status: await status(), motion: await motion(300) });
  }
  record.stall = { stallMs: STALL_MS, runs: stalls, ...drain() };

  // --- F. route enter / leave ----------------------------------------------------
  const cycles = [];
  for (let i = 0; i < ROUTE_CYCLES; i += 1) {
    const t1 = Date.now();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForSelector('[data-testid="app-shell"]', { timeout: 240_000 });
    const shellMs = Date.now() - t1;
    const spikeAbsentOnShell = await page.evaluate(() => !document.querySelector('[data-testid="dev-rive-spike"]'));
    const back = await openSpike();
    cycles.push({ cycle: i + 1, shellMs, spikeAbsentOnShell, spikeMountMs: back.ms, status: back.status, canvases: await canvasCount(), heapBytes: await heap(), listeners: await listeners() });
  }
  const heapCycles = cycles.map((c, i) => ({ t: i, v: c.heapBytes }));
  record.routeCycles = { cycles, heapSlopeBytesPerCycle: slope(heapCycles), heapDeltaBytes: cycles.at(-1).heapBytes - cycles[0].heapBytes, windowListenersFirst: cycles[0].listeners.window.total, windowListenersLast: cycles.at(-1).listeners.window.total, pacingAfter: await pacing(3000), motionAfter: await motion(450), ...drain() };

  // --- G. in-page remount ---------------------------------------------------------
  const cycleOpen = await openSpike(CYCLE);
  const readCycle = async () => Number((await page.textContent('[data-testid="dev-rive-spike-cycle"]')) ?? '0');
  const startHeap = await heap(); const startListeners = await listeners(); const startCycle = await readCycle();
  const remountWindows = [];
  const t2 = Date.now();
  while ((Date.now() - t2) / 1000 < REMOUNT_SECONDS) {
    remountWindows.push({ atSeconds: +((Date.now() - t2) / 1000).toFixed(1), cycle: await readCycle(), canvases: await canvasCount(), pacing5s: await pacing(5000), heapBytes: await heap(), status: await status() });
  }
  const endCycle = await readCycle();
  record.remount = { open: cycleOpen, remountsObserved: endCycle - startCycle, windows: remountWindows, heapStart: startHeap, heapEnd: await heap(), heapSlopeBytesPerSecond: slope(remountWindows.map((w) => ({ t: w.atSeconds, v: w.heapBytes }))), listenersStart: startListeners, listenersEnd: await listeners(), maxCanvases: Math.max(...remountWindows.map((w) => w.canvases)), motionAtEnd: await motion(450), ...drain() };
  await page.screenshot({ path: `${OUT}/remount.png` });

  // --- H. player path ----------------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 240_000 });
  record.playerPath = { spikePresent: await page.evaluate(() => !!document.querySelector('[data-testid="dev-rive-spike"]')), appShellPresent: true, addressBar: await page.evaluate(() => window.location.search), ...drain() };

  record.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/soak.json`, JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
  await browser.close();
} catch (err) {
  fail('soak', err);
  await browser.close();
  process.exit(2);
}
