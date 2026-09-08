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
 *   settle stall VL-2B: the same stall placed EXACTLY at a member's `using`
 *                edge — the moment its eased pull onto the bench starts —
 *                then the body's drawn box sampled every frame. The settle
 *                used to be a pure function of wall-clock time, so a stall
 *                during it landed the stall's worth of easing in the first
 *                frame after (measured 0.700 tiles for a 400 ms stall on
 *                the uncapped tree). `FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS`
 *                bounds what one frame may advance, and this arm JUDGES
 *                it: the largest post-stall single-frame step, pairs whose
 *                depth scale changed excluded (that is the disclosed size
 *                step below, a React render, not the frame loop), must be
 *                at or under 3 × cap / FLOOR_MEMBER_SETTLE_MS — an ease-out
 *                cubic's steepest `cap` milliseconds, whatever the pull's
 *                length — times SETTLE_STALL_TOLERANCE for the sampler
 *                seeing two writes in one frame. Red exits 1. If no member
 *                enters `using` inside SETTLE_EDGE_BUDGET_MS the arm is a
 *                named SKIP, recorded as such, never a silent pass.
 *
 * Usage: node tools/measure-world-performance.mjs [--url http://localhost:8081]
 *          [--out <dir>] [--sample-ms 15000] [--stall-ms 400]
 *
 * WHAT THE STALL PROBE'S "SINGLE-FRAME STEP" READS, stated after measuring
 * it on 9479c7f0 rather than trusting the label: it is the per-frame move
 * of the drawn body's box bottom-centre. At the moment the sim assigns a
 * member to a bench the body's depth SCALE steps from the approach cell's
 * to the bench's in one render (0.70 -> 0.85 on the garage, a 22% size
 * step), and the box bottom read in the same frame moves by half that
 * size change before the frame loop repositions it — 0.342 tiles at
 * 375x812, the number this tool reports as its largest step on that run.
 * The position glides (the settle is per-tile, at about walking speed);
 * the SIZE does not ease, and that is a disclosed residual, not a stall
 * artefact. The "drawn-vs-contract lag" likewise counts the settle's own
 * pull while the glide is in flight, so it reads ~2.5 tiles at the start
 * of every bench glide by design; the timeline's real lag is the number
 * on a member that only walks and waits (0.23-0.63 tiles here).
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
const SETTLE_EDGE_BUDGET_MS = 60000;
/** The rAF sampler can see two renderer writes in one frame (it races the frame loop for order); 1.3 is the same allowance capture-living-world.mjs gives its walking-rate ceiling. */
const SETTLE_STALL_TOLERANCE = 1.3;
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
const SETTLE_MS = numberInSource(tuningSource, 'FLOOR_MEMBER_SETTLE_MS');
const FRAME_CAP_MS = numberInSource(tuningSource, 'FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS');
if (DRAW_SCALE_TILES === null || TICK_MS === null || STEP_PER_TICK === null || SETTLE_MS === null || FRAME_CAP_MS === null) {
  console.error('could not read FLOOR_MEMBER_DRAW_SCALE_TILES / FLOOR_SIM_TICK_INTERVAL_MS / FLOOR_SIM_STEP_PROGRESS_PER_TICK / FLOOR_MEMBER_SETTLE_MS / FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS from empireTuning.ts');
  process.exit(2);
}
/** VL-2B: an ease-out cubic's steepest `cap` milliseconds, in tiles, whatever the pull's length — the most the capped settle can move in one frame. */
const SETTLE_STALL_STEP_BOUND_TILES = ((3 * FRAME_CAP_MS) / SETTLE_MS) * SETTLE_STALL_TOLERANCE;
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

/**
 * VL-2B: wait for the next member to enter `using`, stall the main thread
 * IN THAT SAME TASK (so the settle's first frame is the first frame after
 * the stall), then sample the body's drawn box every frame. Resolves null
 * if no member enters `using` inside `SETTLE_EDGE_BUDGET_MS`.
 */
async function settleStallProbe(page) {
  return page.evaluate(
    ({ stallMs, followMs, drawScaleTiles, edgeBudgetMs }) =>
      new Promise((resolve) => {
        const samples = [];
        const start = performance.now();
        let target = null;
        let stalledAt = null;
        const read = (node, now) => {
          const r = node.getBoundingClientRect();
          return {
            t: now - start,
            x: r.x + r.width / 2,
            y: r.y + r.height,
            tilePx: r.width / drawScaleTiles,
            scale: Number(node.getAttribute('data-scale') || '1'),
            clip: node.getAttribute('data-clip'),
            lifecycle: node.getAttribute('data-lifecycle'),
            cell: node.getAttribute('data-cell'),
          };
        };
        const observer = new MutationObserver((records) => {
          if (target !== null) return;
          for (const record of records) {
            const node = record.target;
            if (!(node instanceof HTMLElement)) continue;
            if (record.oldValue === 'using' || node.getAttribute('data-lifecycle') !== 'using') continue;
            target = node.getAttribute('data-memberid');
            observer.disconnect();
            const edgeAt = performance.now() - start;
            samples.push(read(node, performance.now()));
            const until = performance.now() + stallMs;
            while (performance.now() < until) {
              // busy-wait: the main thread is blocked at the settle's first frame
            }
            stalledAt = performance.now() - start;
            const step = (now) => {
              const live = document.querySelector(`[data-memberid="${target}"]`);
              if (live !== null) samples.push(read(live, now));
              if (now - start - stalledAt < followMs) requestAnimationFrame(step);
              else resolve({ target, edgeAt, stalledAt, samples });
            };
            requestAnimationFrame(step);
            return;
          }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-lifecycle'], attributeOldValue: true, subtree: true });
        setTimeout(() => {
          if (target === null) {
            observer.disconnect();
            resolve(null);
          }
        }, edgeBudgetMs);
      }),
    { stallMs: STALL_MS, followMs: STALL_FOLLOW_MS, drawScaleTiles: DRAW_SCALE_TILES, edgeBudgetMs: SETTLE_EDGE_BUDGET_MS },
  );
}

function analyseSettleStall(probe) {
  if (probe === null) return null;
  const { samples, stalledAt } = probe;
  let firstStepTiles = null;
  let maxStepTiles = 0;
  let maxStepAt = null;
  let scaleStepsSkipped = 0;
  let pairs = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const s = samples[i];
    if (s.t < stalledAt) continue;
    // A pair whose depth scale changed is the assignment size step — a React
    // render of the box, the disclosed residual in this file's header — not
    // a frame-loop write, so it is counted and excluded rather than judged.
    if (s.scale !== prev.scale) {
      scaleStepsSkipped += 1;
      continue;
    }
    const dist = Math.hypot(s.x - prev.x, s.y - prev.y) / Math.max(s.tilePx, 1);
    pairs += 1;
    if (firstStepTiles === null) firstStepTiles = dist;
    if (dist > maxStepTiles) {
      maxStepTiles = dist;
      maxStepAt = s.t;
    }
  }
  return {
    memberId: probe.target,
    edgeAtMs: probe.edgeAt,
    stalledAtMs: stalledAt,
    samples: samples.length,
    pairsJudged: pairs,
    scaleStepsSkipped,
    firstStepAfterStallTiles: firstStepTiles,
    maxStepAfterStallTiles: maxStepTiles,
    maxStepAfterStallAtMs: maxStepAt,
    boundTiles: SETTLE_STALL_STEP_BOUND_TILES,
    bounded: pairs > 0 && maxStepTiles <= SETTLE_STALL_STEP_BOUND_TILES,
  };
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
  const settleStall = analyseSettleStall(await settleStallProbe(page));

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
    settleStall: settleStall === null ? { skipped: `no member entered using within ${SETTLE_EDGE_BUDGET_MS} ms` } : { stallMs: STALL_MS, ...settleStall },
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
  if (settleStall === null) {
    note(`${viewport.name} settle stall SKIPPED: no member entered using within ${SETTLE_EDGE_BUDGET_MS} ms — the arm did not run`);
  } else {
    note(
      `${viewport.name} settle stall ${STALL_MS}ms at ${settleStall.memberId}'s using edge (t=${settleStall.edgeAtMs.toFixed(0)}ms): first post-stall step ${settleStall.firstStepAfterStallTiles?.toFixed(3)} tiles, max ${settleStall.maxStepAfterStallTiles.toFixed(3)} tiles at t=${settleStall.maxStepAfterStallAtMs?.toFixed(0)}ms over ${settleStall.pairsJudged} pairs (${settleStall.scaleStepsSkipped} size-step pair(s) excluded), bound ${SETTLE_STALL_STEP_BOUND_TILES.toFixed(3)} = 3 x ${FRAME_CAP_MS} / ${SETTLE_MS} x ${SETTLE_STALL_TOLERANCE}: ${settleStall.bounded ? 'ok' : 'FAIL'}`,
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
    if (result.settleStall !== null && result.settleStall.bounded === false) exitCode = 1;
  }
  const summary = {
    sha: SHA,
    dirty: DIRTY,
    url: URL,
    generatedAt: new Date().toISOString(),
    harness: 'headless desktop browser in a container; not a device',
    sampleMs: SAMPLE_MS,
    stallMs: STALL_MS,
    settleStallStepBoundTiles: SETTLE_STALL_STEP_BOUND_TILES,
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
