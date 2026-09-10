#!/usr/bin/env node
/**
 * tools/athleteWebglCapture.mjs — WebGL2 runtime PNG captures of athlete-01.riv.
 *
 *   node tools/athleteWebglCapture.mjs
 *     [--riv assets/athlete/athlete-01.riv]
 *     [--out docs/design/evidence/athlete-webgl2-qa]
 *
 * WHY THIS EXISTS. MCP `capture_artboard` on this host returns solid black
 * (`No WebGL support. Image mesh will not be drawn.`). A black MCP frame is
 * not visual evidence. This tool loads the exported `.riv` through
 * `@rive-app/webgl2` inside Playwright Chromium (real WebGL2), writes the
 * Athlete ViewModel to named beats, and screenshots the canvas.
 *
 * Declares no dev-server URL and does not drive Expo — it serves a one-shot
 * local static page over loopback. Does not write TRAINING_STAGE or flip the
 * placeholder flag.
 *
 * Exit: 0 when every beat PNG is non-blank (some non-transparent / non-black
 * pixels); 1 on load/write failure; 2 when a capture is blank (NO-GO evidence).
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? fallback);
}

const runtimeName = flag('runtime', 'webgl2'); // webgl2 | canvas
const runtimePkg = runtimeName === 'canvas' ? '@rive-app/canvas' : '@rive-app/webgl2';
const rivRel = flag('riv', 'assets/athlete/athlete-01.riv');
const outRel = flag('out', 'docs/design/evidence/athlete-webgl2-qa');
const rivPath = path.resolve(REPO, rivRel);
const outDir = path.resolve(REPO, outRel);

if (!existsSync(rivPath)) {
  console.error(`athlete-webgl-capture: missing ${rivRel}`);
  process.exit(1);
}

const runtimeDir = path.dirname(require.resolve(`${runtimePkg}/package.json`));
const wasmPath = path.join(runtimeDir, 'rive.wasm');
const riveJsPath = path.join(runtimeDir, 'rive.js');

/** Named beats the human asked for — ViewModel writes, not pose-image swaps. */
const BEATS = Object.freeze([
  { id: 'brace', barHeight: 1, depth: 0, phase: 'BRACE', grindIntensity: 0, complete: false, outcome: 'none', missReason: 'none' },
  { id: 'judged-depth', barHeight: 0.12, depth: 0.88, phase: 'DESCENT', grindIntensity: 0, complete: false, outcome: 'none', missReason: 'none' },
  { id: 'hole', barHeight: 0, depth: 1, phase: 'HOLE', grindIntensity: 0, complete: false, outcome: 'none', missReason: 'none' },
  { id: 'reversal', barHeight: 0.08, depth: 0.92, phase: 'ASCENT', grindIntensity: 0.2, complete: false, outcome: 'none', missReason: 'none' },
  { id: 'grind', barHeight: 0.45, depth: 0.55, phase: 'ASCENT', grindIntensity: 0.85, complete: false, outcome: 'none', missReason: 'none' },
  { id: 'lockout', barHeight: 1, depth: 0, phase: 'LOCKOUT', grindIntensity: 0.1, complete: true, outcome: 'good-lift', missReason: 'none', lockedOut: true },
  { id: 'no-depth', barHeight: 0.55, depth: 0.45, phase: 'RESOLVED', grindIntensity: 0, complete: true, outcome: 'miss', missReason: 'no-depth' },
  { id: 'buried', barHeight: 0, depth: 1.15, phase: 'RESOLVED', grindIntensity: 0, complete: true, outcome: 'miss', missReason: 'buried' },
  { id: 'stalled', barHeight: 0.35, depth: 0.65, phase: 'RESOLVED', grindIntensity: 0.9, complete: true, outcome: 'miss', missReason: 'stalled' },
  { id: 'timeout', barHeight: 0.7, depth: 0.3, phase: 'RESOLVED', grindIntensity: 0.4, complete: true, outcome: 'miss', missReason: 'timeout' },
  { id: 'dropped', barHeight: 0.2, depth: 0.8, phase: 'RESOLVED', grindIntensity: 0, complete: true, outcome: 'miss', missReason: 'dropped' },
]);

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>athlete-webgl2-qa</title>
<style>html,body{margin:0;background:#1a120e}#c{display:block;width:390px;height:585px;background:#1a120e}</style>
</head><body>
<canvas id="c" width="780" height="1170"></canvas>
<script src="/rive.js"></script>
<script>
window.__qa = { ready: false, error: null, webgl2: false, beats: {} };
(async () => {
  try {
    const canvas = document.getElementById('c');
    // Probe WebGL2 on a throwaway canvas — Rive owns #c's context.
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    window.__qa.webgl2 = !!(gl && typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext);
    if ('${runtimeName}' === 'webgl2' && !window.__qa.webgl2) throw new Error('WebGL2 context unavailable');
    if (rive.RuntimeLoader) {
      rive.RuntimeLoader.setWasmUrl('/rive.wasm');
      if (rive.RuntimeLoader.setWasmFallbackUrl) rive.RuntimeLoader.setWasmFallbackUrl(null);
    }
    const bytes = await fetch('/athlete.riv').then(r => r.arrayBuffer());
    await new Promise((resolve, reject) => {
      const inst = new rive.Rive({
        buffer: bytes,
        canvas,
        autoplay: true,
        autoBind: true,
        artboard: 'squat',
        stateMachine: 'squat',
        onLoad: () => {
          try {
            const vmi = inst.viewModelInstance;
            if (!vmi) throw new Error('no viewModelInstance after autoBind');
            window.__rive = inst;
            window.__vmi = vmi;
            window.__qa.ready = true;
            window.__qa.runtime = '${runtimeName}';
            resolve();
          } catch (e) { reject(e); }
        },
        onLoadError: (e) => reject(e || new Error('Rive onLoadError')),
      });
    });
  } catch (e) {
    window.__qa.error = String(e && e.message ? e.message : e);
  }
})();
window.__applyBeat = (beat) => {
  const vmi = window.__vmi;
  if (!vmi) throw new Error('vmi missing');
  const num = (name, v) => { const p = vmi.number(name); if (p) p.value = v; };
  const bool = (name, v) => { const p = vmi.boolean(name); if (p) p.value = v; };
  const en = (name, v) => { const p = vmi.enum(name); if (p) p.value = v; };
  en('lift', 'squat');
  en('phase', beat.phase);
  num('barHeight', beat.barHeight);
  num('depth', beat.depth);
  num('grindIntensity', beat.grindIntensity);
  num('strain', beat.grindIntensity * 0.8);
  num('chalk', 0.4);
  num('totalKg', 180);
  bool('complete', !!beat.complete);
  bool('lockedOut', !!beat.lockedOut);
  bool('depthAchieved', beat.depth >= 0.85);
  bool('held', false);
  bool('motionSampleValid', true);
  en('outcome', beat.outcome);
  en('missReason', beat.missReason);
  en('effortBand', beat.grindIntensity > 0.7 ? 'grind' : 'normal');
  if (window.__rive) window.__rive.resizeDrawingSurfaceToCanvas();
};
window.__sample = () => {
  const canvas = document.getElementById('c');
  const w = canvas.width;
  const h = canvas.height;
  const totalPixels = w * h;
  let nonBlack = 0;
  let nonTransparent = 0;
  let maxChannel = 0;
  const ctx2d = canvas.getContext('2d');
  if (ctx2d) {
    const data = ctx2d.getImageData(0, 0, w, h).data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a > 0) nonTransparent += 1;
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      if (a > 0 && m > 8) nonBlack += 1;
      if (m > maxChannel) maxChannel = m;
    }
    return { mode: '2d', width: w, height: h, totalPixels, nonTransparent, nonBlack, maxChannel, blank: nonBlack === 0 };
  }
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return { mode: 'none', width: w, height: h, totalPixels, nonTransparent: 0, nonBlack: 0, maxChannel: 0, blank: true, error: 'no gl' };
  const data = new Uint8Array(totalPixels * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 0) nonTransparent += 1;
    const m = Math.max(data[i], data[i + 1], data[i + 2]);
    if (a > 0 && m > 8) nonBlack += 1;
    if (m > maxChannel) maxChannel = m;
  }
  return { mode: 'webgl-readPixels', width: w, height: h, totalPixels, nonTransparent, nonBlack, maxChannel, blank: nonBlack === 0 };
};
</script></body></html>`;

function contentType(p) {
  if (p.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (p.endsWith('.wasm')) return 'application/wasm';
  if (p.endsWith('.riv')) return 'application/octet-stream';
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

const rivBytes = readFileSync(rivPath);
const rivSha = createHash('sha256').update(rivBytes).digest('hex');
const wasmBytes = readFileSync(wasmPath);
const riveJs = readFileSync(riveJsPath);

const server = createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  try {
    if (u === '/' || u === '/index.html') {
      res.writeHead(200, { 'content-type': contentType('.html') });
      res.end(PAGE);
      return;
    }
    if (u === '/rive.js') {
      res.writeHead(200, { 'content-type': contentType('.js') });
      res.end(riveJs);
      return;
    }
    if (u === '/rive.wasm' || u === '/node_modules/@rive-app/webgl2/rive.wasm') {
      res.writeHead(200, { 'content-type': contentType('.wasm') });
      res.end(wasmBytes);
      return;
    }
    if (u === '/athlete.riv') {
      res.writeHead(200, { 'content-type': contentType('.riv') });
      res.end(rivBytes);
      return;
    }
    res.writeHead(404);
    res.end('not found');
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

mkdirSync(outDir, { recursive: true });

const report = {
  tool: 'athleteWebglCapture.mjs',
  startedAt: new Date().toISOString(),
  riv: rivRel,
  rivSha256: rivSha,
  runtime: runtimePkg,
  runtimeFlag: runtimeName,
  beats: [],
  webgl2: null,
  verdict: null,
};

let browser;
try {
  browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 585 }, deviceScaleFactor: 2 });
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e}`));

  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const qa = await page.evaluate(() => window.__qa);
    if (qa.error) throw new Error(`page load: ${qa.error}`);
    if (qa.ready) {
      report.webgl2 = qa.webgl2;
      break;
    }
    await page.waitForTimeout(100);
  }
  if (runtimeName === 'webgl2' && !report.webgl2) throw new Error('WebGL2 not ready — refused to claim WebGL2 evidence');
  if (!report.webgl2 && runtimeName === 'webgl2') throw new Error('unreachable');
  // Canvas runtime is the production AthleteStage.web path; WebGL2 is the
  // requested QA renderer. Either may proceed once Rive is ready.

  let blankCount = 0;
  for (const beat of BEATS) {
    await page.evaluate((b) => window.__applyBeat(b), beat);
    // Let the state machine + draw advance a few frames.
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      if (window.__rive) {
        for (let i = 0; i < 3; i += 1) window.__rive.drawFrame?.();
      }
    });
    await page.waitForTimeout(50);
    const sample = await page.evaluate(() => window.__sample());
    const pngPath = path.join(outDir, `${beat.id}.png`);
    await page.locator('#c').screenshot({ path: pngPath });
    const pngSha = createHash('sha256').update(readFileSync(pngPath)).digest('hex');
    const row = { id: beat.id, file: path.relative(REPO, pngPath).replace(/\\/g, '/'), pngSha256: pngSha, sample };
    report.beats.push(row);
    console.log(
      `${beat.id}: blank=${sample.blank} nonBlack=${sample.nonBlack}/${sample.totalPixels} maxChannel=${sample.maxChannel} ${row.file}`,
    );
    if (sample.blank) blankCount += 1;
  }

  report.console = consoleLines.slice(-40);
  report.blankBeats = blankCount;
  report.verdict = blankCount === 0 ? 'PIXELS_PRESENT' : 'BLANK_FRAMES';
  writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(report, null, 2));
  console.log(`athlete-webgl-capture: ${report.verdict} — ${BEATS.length - blankCount}/${BEATS.length} non-blank`);
  process.exitCode = blankCount === 0 ? 0 : 2;
} catch (e) {
  report.verdict = 'FAIL';
  report.error = String(e?.stack ?? e);
  writeFileSync(path.join(outDir, 'capture.json'), JSON.stringify(report, null, 2));
  console.error(`athlete-webgl-capture: FAIL — ${e?.message ?? e}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
