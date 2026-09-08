#!/usr/bin/env node
/**
 * measure-world-performance.mjs — VL-2: frame pacing, entity count,
 * interaction latency, heap and a deliberate main-thread stall, measured
 * on the real Play surface at both phone viewports.
 *
 * Claude Code Session B's instrument (CLAUDE.md "Crossing VL-2"). It does not
 * claim Performance PASS — there is no agreed budget yet — it produces the
 * numbers a budget would be set against, and it names what it cannot
 * measure: nothing here is a phone. A headless desktop browser in a
 * container is a different machine from the target device on every axis
 * that matters (GPU, thermal state, JS engine, screen refresh), so these
 * are the web build's numbers under this harness, and the report says so
 * in its own header.
 *
 * WHAT IT MEASURES, per viewport, after reaching the gym through the real
 * `shell-open-gym` control with no query string:
 *
 *   entities     what is drawn: member roots, pose images, station chips,
 *                DOM nodes under the floor, and the whole document.
 *   frames       `requestAnimationFrame` intervals over `SAMPLE_MS`: count,
 *                mean, p50 / p95 / p99 / max, long frames (over 50 ms) and
 *                very long frames (over 100 ms). A frame-time histogram is
 *                the direct read of pacing; FPS is derived from it and
 *                reported alongside, not instead.
 *   interaction  the latency from a real click on the bench to the station
 *                panel being attached, read by a `MutationObserver` armed
 *                before the click and stamped with the same clock as the
 *                click; and the same for closing it.
 *   heap         `Performance.getMetrics` through the devtools protocol —
 *                JS heap used / total, DOM nodes, layout count — at the start
 *                and end of the sample, so growth over the window is visible.
 *   stall        a deliberate `STALL_MS` busy-wait on the page's main thread
 *                while the world is running, then the followed member's
 *                drawn box sampled every frame for `STALL_FOLLOW_MS`: the
 *                largest single-frame displacement (in tiles, at that
 *                body's own scale) and, from `data-cell` / `data-anchor`,
 *                the largest drawn-versus-contract lag. That is the "tween
 *                catch-up after a stall" question asked directly: the
 *                renderer's rule is that a stall is drawn as a stall and
 *                never as a faster walk, and this is where that rule is
 *                measured rather than described.
 *
 * Usage: node tools/measure-world-performance.mjs [--url http://localhost:8081]
 *          [--out <dir>] [--sample-ms 15000] [--stall-ms 400]
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { numberInSource, parserSelfTest } from './readTuning.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] !== undefined ? process.argv[idx + 1] : fallback;
}
const URL = arg('--url', 'http://localhost:8081');
const OUT = arg('--out', join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-2'));
const SAMPLE_MS = Number(arg('--sample-ms', '15000'));
const STALL_MS = Number(arg('--stall-ms', '400'));
const STALL_FOLLOW_MS = 2000;
const LONG_FRAME_MS = 50;
const VERY_LONG_FRAME_MS = 100;
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '375x812', width: 375, height: 812 },
];
const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const selfTest = parserSelfTest();
if (selfTest.length > 0) {
  console.error(`readTuning.mjs self-test failed:\n${selfTest.join('\n')}`);
  process.exit(2);
}
const tuningSource = readFileSync(join(ROOT, 'src', 'empire', 'empireTuning.ts'), 'utf8');
const DRAW_SCALE_TILES = numberInSource(tuningSource, 'FLOOR_MEMBER_DRAW_SCALE_TILES');
const TICK_MS = numberInSource(tuningSource, 'FLOOR_SIM_TICK_INTERVAL_MS');
const STEP_PER_TICK = numberInSource(tuningSource, 'FLOOR_SIM_STEP_PROGRESS_PER_TICK');
if (DRAW_SCALE_TILES === null || TICK_MS === null || STEP_PER_TICK === null) {
  console.error('could not read FLOOR_MEMBER_DRAW_SCALE_TILES / FLOOR_SIM_TICK_INTERVAL_MS / FLOOR_SIM_STEP_PROGRESS_PER_TICK from empireTuning.ts');
  process.exit(2);
}
const SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim() !== '';

mkdirSync(OUT, { recursive: true });
const notes = [];
const note = (line) => {
  notes.push(line);
  console.log(line);
};

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const at = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[at];
}

async function reachGym(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const gym = page.getByTestId('shell-open-gym');
  await gym.waitFor({ state: 'visible', timeout: 120000 });
  await gym.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-memberid]').length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(1000);
}

async function metrics(session) {
  const { metrics: rows } = await session.send('Performance.getMetrics');
  const pick = (name) => {
    const row = rows.find((r) => r.name === name);
    return row === undefined ? null : row.value;
  };
  return {
    jsHeapUsedBytes: pick('JSHeapUsedSize'),
    jsHeapTotalBytes: pick('JSHeapTotalSize'),
    domNodes: pick('Nodes'),
    layoutCount: pick('LayoutCount'),
    recalcStyleCount: pick('RecalcStyleCount'),
    scriptDurationS: pick('ScriptDuration'),
    layoutDurationS: pick('LayoutDuration'),
  };
}

async function entityCount(page) {
  return page.evaluate(() => {
    const floor = document.querySelector('[data-testid="floorgrid-grid"]');
    return {
      members: document.querySelectorAll('[data-memberid]').length,
      poseImages: document.querySelectorAll('[data-testid^="floorgrid-member-pose-"]').length,
      stationChips: document.querySelectorAll('[data-testid^="floorgrid-fixed-"], [data-testid^="floorgrid-placed-"], [data-testid="floorgrid-bay-expansion"]').length,
      floorNodes: floor === null ? null : floor.querySelectorAll('*').length,
      documentNodes: document.querySelectorAll('*').length,
    };
  });
}

async function frameTimes(page, ms) {
  return page.evaluate(
    (durationMs) =>
      new Promise((resolve) => {
        const intervals = [];
        let last = null;
        const start = performance.now();
        const step = (now) => {
          if (last !== null) intervals.push(now - last);
          last = now;
          if (now - start < durationMs) requestAnimationFrame(step);
          else resolve(intervals);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );
}

function summarise(intervals) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((s, v) => s + v, 0);
  return {
    frames: intervals.length,
    meanMs: intervals.length === 0 ? null : total / intervals.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted.length === 0 ? null : sorted[sorted.length - 1],
    longFrames: intervals.filter((v) => v > LONG_FRAME_MS).length,
    veryLongFrames: intervals.filter((v) => v > VERY_LONG_FRAME_MS).length,
    fpsFromMean: intervals.length === 0 ? null : 1000 / (total / intervals.length),
  };
}

async function interactionLatency(page) {
  // Arm an observer for the panel, stamp the click from the page's own
  // clock via a pointerdown listener, and read the gap.
  const bench = page.getByTestId('floorgrid-fixed-flat-bench');
  await bench.waitFor({ state: 'attached', timeout: 15000 });
  await page.evaluate(() => {
    window.__vl2 = { down: null, attached: null, detached: null };
    document.addEventListener('pointerdown', () => { window.__vl2.down = performance.now(); }, { once: true, capture: true });
    const observer = new MutationObserver(() => {
      const panel = document.querySelector('[data-testid="floorgrid-station-panel"]');
      if (panel !== null && window.__vl2.attached === null) window.__vl2.attached = performance.now();
      if (panel === null && window.__vl2.attached !== null && window.__vl2.detached === null) window.__vl2.detached = performance.now();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__vl2.observer = observer;
  });
  await bench.click({ timeout: 15000 });
  await page.getByTestId('floorgrid-station-panel').waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const open = await page.evaluate(() => ({ down: window.__vl2.down, attached: window.__vl2.attached }));
  // Close it the same way, re-arming the pointerdown stamp.
  await page.evaluate(() => {
    window.__vl2.down = null;
    document.addEventListener('pointerdown', () => { window.__vl2.down = performance.now(); }, { once: true, capture: true });
  });
  await bench.click({ timeout: 15000 });
  await page.getByTestId('floorgrid-station-panel').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  const close = await page.evaluate(() => {
    const out = { down: window.__vl2.down, detached: window.__vl2.detached };
    window.__vl2.observer.disconnect();
    return out;
  });
  return {
    openMs: open.down === null || open.attached === null ? null : open.attached - open.down,
    closeMs: close.down === null || close.detached === null ? null : close.detached - close.down,
  };
}

async function followedMemberId(page) {
  return page.evaluate(() => {
    const walking = [...document.querySelectorAll('[data-memberid]')].find((n) => n.getAttribute('data-clip') === 'walk');
    const any = document.querySelector('[data-memberid]');
    const pick = walking || any;
    return pick === undefined || pick === null ? null : pick.getAttribute('data-memberid');
  });
}

async function stallProbe(page, memberId) {
  // Sample the followed member's drawn box every frame across a window in
  // the middle of which the main thread is deliberately blocked. Drawn-box
  // displacement per frame is what a viewer sees; the contract cell and
  // projected anchor (data attributes the renderer stamps per TICK) give the
  // lag between where the sim says the body is and where it is drawn.
  return page.evaluate(
    ({ id, stallMs, followMs, drawScaleTiles }) =>
      new Promise((resolve) => {
        const samples = [];
        const start = performance.now();
        let stalled = false;
        let stalledAt = null;
        const read = (now) => {
          const node = document.querySelector(`[data-memberid="${id}"]`);
          if (node === null) return null;
          const r = node.getBoundingClientRect();
          const scale = Number(node.getAttribute('data-scale') || '1');
          const tilePx = r.width / drawScaleTiles;
          const anchor = (node.getAttribute('data-anchor') || '').split(',').map(Number);
          return {
            t: now - start,
            x: r.x + r.width / 2,
            y: r.y + r.height,
            tilePx,
            scale,
            clip: node.getAttribute('data-clip'),
            lifecycle: node.getAttribute('data-lifecycle'),
            anchorX: anchor[0],
            anchorY: anchor[1],
            cell: node.getAttribute('data-cell'),
          };
        };
        const step = (now) => {
          const sample = read(now);
          if (sample !== null) samples.push(sample);
          if (!stalled && now - start > followMs / 4) {
            stalled = true;
            stalledAt = now - start;
            const until = performance.now() + stallMs;
            while (performance.now() < until) {
              // busy-wait: the main thread is blocked, no frame can run
            }
          }
          if (now - start < followMs) requestAnimationFrame(step);
          else resolve({ samples, stalledAt });
        };
        requestAnimationFrame(step);
      }),
    { id: memberId, stallMs: STALL_MS, followMs: STALL_FOLLOW_MS, drawScaleTiles: DRAW_SCALE_TILES },
  );
}

function analyseStall(probe) {
  const { samples, stalledAt } = probe;
  let maxStepTiles = 0;
  let maxStepAt = null;
  let maxGapMs = 0;
  let maxLagTiles = 0;
  let maxLagAt = null;
  let maxRateTilesPer100ms = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    // Lag: drawn feet point vs the projected anchor of the latest tick. The
    // anchor is in stage coordinates; the drawn box is in viewport
    // coordinates; both share the same tile scale, and the offset between
    // the two frames is constant, so the DIFFERENCE over time is what is
    // read — the resting offset is subtracted below.
    if (i > 0) {
      const prev = samples[i - 1];
      const dist = Math.hypot(s.x - prev.x, s.y - prev.y) / Math.max(s.tilePx, 1);
      const gap = s.t - prev.t;
      maxGapMs = Math.max(maxGapMs, gap);
      if (dist > maxStepTiles) {
        maxStepTiles = dist;
        maxStepAt = s.t;
      }
      const rate = dist / Math.max(gap / 100, 0.01);
      maxRateTilesPer100ms = Math.max(maxRateTilesPer100ms, rate);
    }
  }
  // The lag: (drawn - anchor) minus its resting value, in tiles.
  const offsets = samples
    .filter((s) => Number.isFinite(s.anchorX) && Number.isFinite(s.anchorY))
    .map((s) => ({ t: s.t, dx: s.x - s.anchorX, dy: s.y - s.anchorY, tilePx: s.tilePx }));
  if (offsets.length > 0) {
    const restDx = offsets[0].dx;
    const restDy = offsets[0].dy;
    for (const o of offsets) {
      const lag = Math.hypot(o.dx - restDx, o.dy - restDy) / Math.max(o.tilePx, 1);
      if (lag > maxLagTiles) {
        maxLagTiles = lag;
        maxLagAt = o.t;
      }
    }
  }
  return {
    samples: samples.length,
    stalledAtMs: stalledAt,
    maxFrameGapMs: maxGapMs,
    maxSingleFrameStepTiles: maxStepTiles,
    maxSingleFrameStepAtMs: maxStepAt,
    maxRateTilesPer100ms,
    // The sim's own walking rate: one step per tick.
    simRateTilesPer100ms: (STEP_PER_TICK / TICK_MS) * 100,
    maxDrawnVsContractLagTiles: maxLagTiles,
    maxLagAtMs: maxLagAt,
    clipsSeen: [...new Set(samples.map((s) => s.clip))],
  };
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const session = await context.newCDPSession(page);
  await session.send('Performance.enable');
  await reachGym(page);

  const entities = await entityCount(page);
  const heapStart = await metrics(session);
  const intervals = await frameTimes(page, SAMPLE_MS);
  const frames = summarise(intervals);
  // The heap before and after a forced collection: a browser lets the heap
  // grow until it decides to collect, so the raw end figure mostly measures
  // when the collector last ran. The post-GC figure is what the world
  // actually holds; the raw one is kept beside it so a reader can see both.
  const heapEndRaw = await metrics(session);
  await session.send('HeapProfiler.collectGarbage').catch(() => {});
  const heapEnd = await metrics(session);
  const interaction = await interactionLatency(page);
  const memberId = await followedMemberId(page);
  const stall = memberId === null ? null : analyseStall(await stallProbe(page, memberId));

  const result = {
    viewport: viewport.name,
    entities,
    frames,
    heapStart,
    heapEndRaw,
    heapEnd,
    heapGrowthBytes:
      heapStart.jsHeapUsedBytes === null || heapEnd.jsHeapUsedBytes === null
        ? null
        : heapEnd.jsHeapUsedBytes - heapStart.jsHeapUsedBytes,
    interaction,
    stall: stall === null ? null : { memberId, stallMs: STALL_MS, ...stall },
    pageErrors,
  };
  note(
    `${viewport.name} entities members=${entities.members} poseImages=${entities.poseImages} stations=${entities.stationChips} floorNodes=${entities.floorNodes} docNodes=${entities.documentNodes}`,
  );
  note(
    `${viewport.name} frames n=${frames.frames} mean=${frames.meanMs?.toFixed(2)}ms p50=${frames.p50Ms?.toFixed(2)} p95=${frames.p95Ms?.toFixed(2)} p99=${frames.p99Ms?.toFixed(2)} max=${frames.maxMs?.toFixed(2)} long(>${LONG_FRAME_MS}ms)=${frames.longFrames} veryLong(>${VERY_LONG_FRAME_MS}ms)=${frames.veryLongFrames} fps(mean)=${frames.fpsFromMean?.toFixed(1)}`,
  );
  note(
    `${viewport.name} heap used ${(heapStart.jsHeapUsedBytes / 1048576).toFixed(1)}MB -> ${(heapEndRaw.jsHeapUsedBytes / 1048576).toFixed(1)}MB raw, ${(heapEnd.jsHeapUsedBytes / 1048576).toFixed(1)}MB after a forced GC, over ${SAMPLE_MS}ms; DOM nodes ${heapStart.domNodes} -> ${heapEnd.domNodes}; layouts ${heapStart.layoutCount} -> ${heapEnd.layoutCount}`,
  );
  note(`${viewport.name} interaction bench-tap -> panel ${interaction.openMs === null ? 'n/a' : interaction.openMs.toFixed(1) + 'ms'}, tap -> closed ${interaction.closeMs === null ? 'n/a' : interaction.closeMs.toFixed(1) + 'ms'}`);
  if (stall !== null) {
    note(
      `${viewport.name} stall ${STALL_MS}ms on ${memberId} (${stall.clipsSeen.join('/')}): max frame gap ${stall.maxFrameGapMs.toFixed(0)}ms, max single-frame step ${stall.maxSingleFrameStepTiles.toFixed(3)} tiles at t=${stall.maxSingleFrameStepAtMs?.toFixed(0)}ms, max rate ${stall.maxRateTilesPer100ms.toFixed(3)} tiles/100ms vs sim ${stall.simRateTilesPer100ms.toFixed(3)}, max drawn-vs-contract lag ${stall.maxDrawnVsContractLagTiles.toFixed(3)} tiles`,
    );
  }
  if (pageErrors.length > 0) note(`${viewport.name} PAGE ERRORS: ${pageErrors.join(' | ')}`);
  await session.detach().catch(() => {});
  await page.close();
  await context.close();
  return result;
}

const browser = await chromium.launch({
  headless: true,
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let exitCode = 0;
try {
  note(`VL-2 performance measurement at ${SHA}${DIRTY ? ' (DIRTY TREE)' : ''} url=${URL} sample=${SAMPLE_MS}ms stall=${STALL_MS}ms — headless desktop browser in a container, NOT a phone`);
  const results = [];
  for (const viewport of VIEWPORTS) {
    const result = await runViewport(browser, viewport);
    results.push(result);
    if (result.pageErrors.length > 0) exitCode = 1;
  }
  const summary = {
    sha: SHA,
    dirty: DIRTY,
    url: URL,
    generatedAt: new Date().toISOString(),
    harness: 'headless desktop browser in a container; not a device',
    sampleMs: SAMPLE_MS,
    stallMs: STALL_MS,
    longFrameMs: LONG_FRAME_MS,
    veryLongFrameMs: VERY_LONG_FRAME_MS,
    results,
    notes,
  };
  writeFileSync(join(OUT, 'perf.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'perf.txt'), notes.join('\n') + '\n');
  note(`wrote ${join(OUT, 'perf.json')}`);
} finally {
  await browser.close();
}
process.exit(exitCode);
