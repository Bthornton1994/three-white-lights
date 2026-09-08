#!/usr/bin/env node
// tools/athleteAccept.mjs — the one-command post-delivery gate for the
// production athlete asset (`assets/athlete/athlete-01.riv`).
//
//   node tools/athleteAccept.mjs                       intake + the trace corpus, no browser
//   node tools/athleteAccept.mjs --web                 …and the dev-only acceptance harness in a real browser
//   ... [--dir assets/athlete] [--room assets/iron-amber/squat-room-side.jpg]
//       [--url http://localhost:8081] [--out .gauntlet/shots/athlete-accept]
//
// COMPOSES, NEVER WEAKENS. Every mechanical gate is another tool run as a
// subprocess, verbatim, and its verdict is copied, not re-decided:
//
//   intake      node tools/athleteIntake.mjs  — the room plate (§12a step 0),
//               the provenance package and its SHA-256 (step 1), and
//               `node tools/rivContract.mjs … --artboard squat` (steps 2–3).
//   corpus      node tools/athleteTraces.mjs check — the canonical mechanics
//               traces are what the engine produces on this tree, byte for
//               byte — then `replay` on each record: its own config + script
//               reproduce its own ticks. This is the input the harness plays.
//   composition --web only. At 375×812 and 390×844 the harness's guides (frame
//               outline, floor and crown lines, HUD bands) are read off the DOM
//               and held to the numbers `composeAthleteStage` put in the probe —
//               with or without an athlete, on the backdrop until the room
//               plate lands (ROOM_ASSET_MISSING is reported, never painted over).
//   web smoke   --web only. `gateDevServer({ url })` first — a server that
//               `tools/dev-web.sh` did not start is refused, not driven — then
//               Chromium (Playwright, 390×844, DPR 2) opens the dev-only
//               acceptance route (`?dev-rive-spike=1&dev-mode=athlete-accept`),
//               reads its status line, and if the stage is PLAYING follows
//               every corpus scenario through the probe while reading the
//               canvas back (changed pixels between samples: 0 is BOUND, not
//               DRIVEN — ADR-001 §7) and sampling rAF pacing. Screenshots and
//               `accept.json` go under --out (gitignored).
//
// WHAT IT NEVER DOES: write `ATHLETE_RIG.TRAINING_STAGE`, or any file under
// `src/`. The player-path mount (step 8) is a human's commit after the human
// gates; `tools/athleteAccept.test.ts` pins that this file names neither the
// gate nor its tuning home. VISUAL, ANIMATION, SOFT-FEEL and OWNER PLAYTEST
// are printed as OWED, never claimed. NATIVE_RUNTIME is a device fact.
//
// Exit: 0 every step that ran PASSED and the asset is present;
//       1 any step FAILED (the line names which);
//       2 nothing to accept yet — the asset is not there (ASSET_MISSING).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadTsModule } from './athleteTraces.mjs';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const argv = process.argv.slice(2);

function flag(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? fallback);
}
const has = (name) => argv.includes(`--${name}`);

const dir = flag('dir', 'assets/athlete');
const room = flag('room', 'assets/iron-amber/squat-room-side.jpg');
const url = flag('url', 'http://localhost:8081');
const out = path.resolve(REPO, flag('out', '.gauntlet/shots/athlete-accept'));
const web = has('web');

/** Synchronous stdout, so a `process.exit` from the sentinel gate cannot truncate the report. */
function say(line) {
  writeSync(1, `${line}\n`);
}

/** The route the harness lives on — the spike route plus its mode key. */
export const ACCEPTANCE_ROUTE = '/?dev-rive-spike=1&dev-mode=athlete-accept';
export const HUMAN_GATES_OWED = Object.freeze(['VISUAL', 'ANIMATION', 'SOFT-FEEL', 'OWNER PLAYTEST']);

const steps = [];
function record(step, verdict, detail) {
  steps.push({ step, verdict, detail });
  say(`athlete-accept: ${step}: ${verdict}${detail ? ` — ${detail}` : ''}`);
}

function run(tool, args) {
  const r = spawnSync(process.execPath, [path.join(HERE, tool), ...args], { cwd: REPO, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// --- 1. intake --------------------------------------------------------------
const intake = run('athleteIntake.mjs', ['--dir', dir, '--room', room]);
for (const line of intake.out.trimEnd().split('\n')) say(`  intake | ${line}`);
let assetMissing = false;
if (intake.status === 0) record('intake', 'PASS', 'steps 0–3 of pipeline §12a clear');
else if (intake.status === 2) {
  assetMissing = true;
  record('intake', 'WAITING', 'ASSET_MISSING — nothing to accept yet');
} else record('intake', 'FAIL', `athleteIntake.mjs exit ${intake.status}`);

// --- 2. the corpus ----------------------------------------------------------
const check = run('athleteTraces.mjs', ['check']);
if (check.status === 0) {
  const traceDir = path.join(REPO, 'docs/design/athlete-traces');
  const records = readdirSync(traceDir).filter((f) => f.endsWith('.json')).sort();
  const failed = [];
  for (const file of records) {
    const replay = run('athleteTraces.mjs', ['replay', path.join('docs/design/athlete-traces', file)]);
    if (replay.status !== 0) failed.push(file);
  }
  if (records.length === 0) record('corpus', 'FAIL', 'no trace records found');
  else if (failed.length === 0) record('corpus', 'PASS', `${records.length} records current; each replays from its own config + script`);
  else record('corpus', 'FAIL', `records whose ticks no longer follow from their recipe: ${failed.join(', ')}`);
} else {
  record('corpus', 'FAIL', 'docs/design/athlete-traces drifted from the mechanic — run: node tools/athleteTraces.mjs write');
  for (const line of check.out.trimEnd().split('\n')) say(`  corpus | ${line}`);
}

// --- 3. the web smoke -------------------------------------------------------
if (!web) {
  record('web smoke', 'SKIPPED', 'pass --web with a server from tools/dev-web.sh to drive the acceptance harness');
} else {
  gateDevServer({ url });
  const verdict = await webSmoke();
  record('web smoke', verdict.verdict, verdict.detail);
}

async function webSmoke() {
  mkdirSync(out, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  // Every browser tool arms the fresh-lifter boundary (src/shell/shellWiring.test.ts
  // reads the sibling list from the tree). The dev route reads no save, but the
  // rule is mechanical and a tool that quietly skips it is the drift it exists to catch.
  await armFreshLifterPerBoot(context);
  const page = await context.newPage();
  const consoleLines = [];
  const pageErrors = [];
  page.on('console', (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => pageErrors.push(String(e?.stack ?? e)));
  const report = { route: `${url}${ACCEPTANCE_ROUTE}`, startedAt: new Date().toISOString(), scenarios: [] };
  try {
    const t0 = Date.now();
    await page.goto(report.route, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForSelector('[data-testid="dev-athlete-accept-status"]', { timeout: 240_000 });
    report.msToMount = Date.now() - t0;
    report.addressBar = await page.evaluate(() => window.location.search);
    const readProbe = async () => JSON.parse((await page.textContent('[data-testid="dev-athlete-accept-probe"]')) ?? '{}');
    const readStatus = async () => (await page.textContent('[data-testid="dev-athlete-accept-status"]')) ?? '';
    report.status = await readStatus();
    report.probe = await readProbe();
    await page.screenshot({ path: path.join(out, 'route.png') });

    // The composition, verified on the real DOM at both phone viewports — with
    // or without an athlete: the harness draws the frame outline, the floor and
    // crown lines and the HUD bands from `composeAthleteStage`, and the probe
    // carries the numbers; each guide's bounding box must sit where the
    // numbers say, and the frame must keep the canvas aspect.
    report.composition = [];
    for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(400);
      const probe = await readProbe();
      const box = async (id) => page.locator(`[data-testid="dev-athlete-accept-${id}"]`).boundingBox();
      const frame = await box('frame'); const floor = await box('floor'); const crown = await box('crown'); const hudTop = await box('hud-top'); const hudBottom = await box('hud-bottom');
      const c = probe.composition ?? {};
      const near = (a, b) => a !== null && a !== undefined && Math.abs(a - b) <= 1;
      const checks = {
        probeViewportMatches: c.viewport?.width === viewport.width && c.viewport?.height === viewport.height,
        frameX: near(frame?.x, c.frame?.x), frameY: near(frame?.y, c.frame?.y), frameWidth: near(frame?.width, c.frame?.width), frameHeight: near(frame?.height, c.frame?.height),
        frameAspectIsCanvas: frame ? Math.abs(frame.width / frame.height - 1152 / 1728) < 0.002 : false,
        floorAtFloorY: near(floor?.y, c.floorY), crownAtCrownY: near(crown?.y, c.crownY),
        hudTopBandHeight: near(hudTop?.height, c.band?.top), hudBottomBandY: near(hudBottom?.y, c.band?.bottom),
        floorInsideBand: c.floorY !== undefined && c.floorY <= c.band?.bottom && c.floorY >= c.band?.top,
        crownInsideBand: c.crownY !== undefined && c.crownY >= c.band?.top && c.crownY <= c.band?.bottom,
        fitCoverOnPhone: c.fit === 'cover',
        roomAssetMissing: probe.roomAssetMissing,
      };
      await page.screenshot({ path: path.join(out, `composition-${viewport.width}x${viewport.height}.png`) });
      report.composition.push({ viewport, composition: c, boxes: { frame, floor, crown, hudTop, hudBottom }, checks, ok: Object.entries(checks).every(([k, v]) => k === 'roomAssetMissing' || v === true) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const compositionOk = report.composition.every((c) => c.ok);
    const compositionDetail = report.composition.map((c) => `${c.viewport.width}x${c.viewport.height} ${c.ok ? 'ok' : 'MISMATCH'}`).join(', ');
    record('composition', compositionOk ? 'PASS' : 'FAIL', `frame, floor, crown and HUD bands on the DOM where composeAthleteStage puts them: ${compositionDetail}${report.probe.roomAssetMissing ? '; ROOM_ASSET_MISSING (backdrop under the rig, no painted scene)' : ''}`);
    if (report.status.startsWith('ASSET_MISSING')) {
      finish(report, consoleLines, pageErrors);
      await browser.close();
      return { verdict: 'WAITING', detail: 'the harness route is live and reports ASSET_MISSING; no stage mounted (no substitute athlete)' };
    }
    if (report.status.startsWith('RUNTIME_ERROR')) {
      finish(report, consoleLines, pageErrors);
      await browser.close();
      return { verdict: 'FAIL', detail: report.status };
    }
    // PLAYING: follow each scenario through the probe, reading the canvas back.
    const frameMetrics = loadTsModule('src/dev/athleteAcceptance/frameMetrics.ts');
    const memorySamples = [];
    const ids = report.probe.scenarioIds ?? [];
    for (const id of ids) {
      const deadline = Date.now() + 120_000;
      let probe = await readProbe();
      while (probe.scenario !== id && Date.now() < deadline) {
        await page.waitForTimeout(100);
        probe = await readProbe();
      }
      const entry = { scenario: id, reached: probe.scenario === id, probeAtStart: probe };
      if (entry.reached) {
        entry.sceneMotion = await page.evaluate(async () => {
          const canvas = document.querySelector('[data-testid="dev-athlete-accept-stage"] canvas') ?? document.querySelector('canvas');
          if (!canvas) return { error: 'no canvas' };
          const ctx = canvas.getContext('2d');
          if (!ctx) return { error: 'no 2d context' };
          const read = () => ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const samples = [];
          let previous = read();
          const started = performance.now();
          while (performance.now() - started < 1500) {
            await new Promise((r) => setTimeout(r, 150));
            const next = read();
            let changed = 0;
            for (let i = 0; i < next.length; i += 4) {
              if (next[i] !== previous[i] || next[i + 1] !== previous[i + 1] || next[i + 2] !== previous[i + 2] || next[i + 3] !== previous[i + 3]) changed += 1;
            }
            samples.push(changed);
            previous = next;
          }
          return { width: canvas.width, height: canvas.height, totalPixels: previous.length / 4, changedPerSample: samples, maxChanged: Math.max(...samples) };
        });
        // Raw samples out of the page; the arithmetic is `frameMetricsFrom` /
        // `memoryTrendFrom` (src/dev/athleteAcceptance/frameMetrics.ts, tested),
        // loaded once below — no second copy of the formula lives in this tool.
        const raw = await page.evaluate(() => new Promise((resolve) => {
          const gaps = []; const longTasks = []; const memory = [];
          const mem = () => (performance.memory ? { tMs: performance.now(), bytes: performance.memory.usedJSHeapSize } : null);
          let observer = null;
          try {
            observer = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(+e.duration.toFixed(1)); });
            observer.observe({ type: 'longtask', buffered: false });
          } catch { observer = null; }
          const m0 = mem(); if (m0) memory.push(m0);
          let last = performance.now(); const end = last + 2000;
          function tick(now) { gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(tick); else finish(); }
          function finish() {
            gaps.shift();
            if (observer) observer.disconnect();
            const m1 = mem(); if (m1) memory.push(m1);
            resolve({ gaps, longTasks, memory, canvases: document.querySelectorAll('canvas').length, memoryApi: performance.memory ? 'performance.memory' : null });
          }
          requestAnimationFrame(tick);
        }));
        entry.framePacing = { ...frameMetrics.frameMetricsFrom(raw.gaps), longTasks: raw.longTasks.length, longTaskMs: +raw.longTasks.reduce((a, b) => a + b, 0).toFixed(1), worstLongTaskMs: raw.longTasks.length ? Math.max(...raw.longTasks) : 0 };
        entry.canvases = raw.canvases;
        entry.memory = raw.memory;
        memorySamples.push(...raw.memory);
        entry.probeAfter = await readProbe();
        await page.screenshot({ path: path.join(out, `${id}.png`) });
      }
      report.scenarios.push(entry);
    }
    report.memoryTrend = frameMetrics.memoryTrendFrom(memorySamples);
    report.performance = summarisePerformance(report.scenarios, report.memoryTrend);
    finish(report, consoleLines, pageErrors);
    await browser.close();
    const unreached = report.scenarios.filter((s) => !s.reached).map((s) => s.scenario);
    const bound = report.scenarios.filter((s) => s.reached && (s.sceneMotion?.maxChanged ?? 0) === 0).map((s) => s.scenario);
    const slow = report.scenarios.filter((s) => (s.framePacing?.over33ms ?? 0) > 0).map((s) => s.scenario);
    if (pageErrors.length > 0) return { verdict: 'FAIL', detail: `${pageErrors.length} page error(s) — see accept.json` };
    if (unreached.length > 0) return { verdict: 'FAIL', detail: `scenarios never reached: ${unreached.join(', ')}` };
    if (bound.length > 0) return { verdict: 'FAIL', detail: `BOUND, not DRIVEN — 0 changed pixels on: ${bound.join(', ')}` };
    if (slow.length > 0) return { verdict: 'FAIL', detail: `frames over 33 ms on: ${slow.join(', ')}` };
    const extraCanvases = report.scenarios.filter((s) => s.reached && s.canvases !== 1).map((s) => `${s.scenario}=${s.canvases}`);
    if (extraCanvases.length > 0) return { verdict: 'FAIL', detail: `one artboard and one state machine means ONE canvas; read: ${extraCanvases.join(', ')}` };
    return { verdict: 'PASS', detail: `${report.scenarios.length} scenarios driven; canvas moved on each; no frame over 33 ms; one canvas throughout; 0 page errors; ${report.performance}` };
  } catch (err) {
    report.failure = String(err?.message ?? err);
    finish(report, consoleLines, pageErrors);
    await browser.close();
    return { verdict: 'FAIL', detail: report.failure };
  }
}

/** One line of the numbers the ruling asks for — never a screenshot-only claim. */
function summarisePerformance(scenarios, memoryTrend) {
  const paced = scenarios.filter((s) => s.framePacing);
  if (paced.length === 0) return 'no pacing samples';
  const fps = paced.map((s) => s.framePacing.meanFps);
  const p95 = Math.max(...paced.map((s) => s.framePacing.p95Ms));
  const worst = Math.max(...paced.map((s) => s.framePacing.worstMs));
  const longTasks = paced.reduce((a, s) => a + s.framePacing.longTasks, 0);
  const mem = memoryTrend ? `heap ${memoryTrend.startMb}→${memoryTrend.endMb} MB (${memoryTrend.slopeMbPerMin} MB/min)` : 'heap n/a';
  return `mean FPS ${Math.min(...fps)}–${Math.max(...fps)}, p95 ${p95} ms, worst ${worst} ms, long tasks ${longTasks}, ${mem}, canvases ${[...new Set(paced.map((s) => s.canvases))].join('/')}`;
}

function finish(report, consoleLines, pageErrors) {
  report.finishedAt = new Date().toISOString();
  report.consoleLines = consoleLines;
  report.pageErrors = pageErrors;
  writeFileSync(path.join(out, 'accept.json'), `${JSON.stringify(report, null, 2)}\n`);
  say(`  web smoke | record: ${path.relative(REPO, path.join(out, 'accept.json'))}`);
}

// --- verdict ----------------------------------------------------------------
const failed = steps.filter((s) => s.verdict === 'FAIL');
say(`OWED (human, never claimed here): ${HUMAN_GATES_OWED.join(', ')}; NATIVE_RUNTIME is a device fact (EAS development build, owner)`);
if (failed.length > 0) {
  say(`ATHLETE_ACCEPT: FAIL — ${failed.map((s) => s.step).join(', ')}`);
  process.exit(1);
}
if (assetMissing) {
  say('ATHLETE_ACCEPT: ASSET_MISSING — the mechanical gates are armed; nothing has arrived');
  process.exit(2);
}
say('ATHLETE_ACCEPT: PASS — mechanical gates clear; the human gates above remain');
process.exit(0);
