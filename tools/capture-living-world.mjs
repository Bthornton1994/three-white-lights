#!/usr/bin/env node
/**
 * capture-living-world.mjs — VL-1 evidence: ONE member, followed by its
 * contract identity, through a real lifecycle on the real Play surface.
 *
 * Claude Code Session B's instrument (CLAUDE.md "Crossing VL-1"). It does not
 * claim Visual, Animation, Soft-Feel or Owner-Playtest PASS. It produces the
 * continuous evidence the brief asks for — a video and a per-sample record —
 * and a handful of verdicts a reader can check against the record.
 *
 * WHAT IT DOES. Loads the built app with no query string, presses the real
 * GYM EMPIRE control, and waits for the contract to draw members. It then
 * picks ONE member whose contract `target` is the Competition Bench Bay and
 * follows that member by `data-memberid` — the `PresentationMember.id` the
 * renderer stamps on the drawn root — sampling every `SAMPLE_MS` for up to
 * `MAX_MS`: lifecycle, target, queue rank and the drawn bounding box, all
 * read from that one node. A screenshot is taken at every lifecycle
 * transition and periodically while walking; the whole run is recorded as
 * video by Playwright; the transition frames are composed into a strip.
 *
 * WHAT IT ASSERTS, each one a thing the run can fail:
 *
 *   identity   the followed id resolves to exactly one drawn node in every
 *              sample — the member never vanishes, duplicates or swaps.
 *   travel     the box moved across samples while `seeking` — the member
 *              visibly travelled, not teleported into place.
 *   noTeleport the box never moves faster than `ORDINARY_TILES_PER_100MS`
 *              between samples — a RATE, because a screenshot pause makes a
 *              sample gap longer than `SAMPLE_MS` while the sim keeps
 *              walking, so distance alone would call a long gap a jump. The
 *              one exception is the eased settle onto or off the bench: for
 *              `FLOOR_MEMBER_SETTLE_MS` (read from `empireTuning.ts`) after a
 *              lifecycle change into or out of `using`, the total displacement
 *              across the window is bounded by `SETTLE_TILES` instead. Both
 *              maxima are recorded. A room-image swap or a snap-to-bench
 *              would exceed these; the tween and the eased settle do not.
 *   using      the lifecycle reached `using`, and while it did the member's
 *              box overlapped the bench's own `floorsim-using-…` outline.
 *   release    `using` was followed by `leaving`.
 *   continues  `leaving` was followed by another state — the member went on.
 *   queue      whether `queuing` was observed is REPORTED, not required: the
 *              sim decides whether this member had to wait.
 *   station    the bench outline's id is the same string every time it is
 *              drawn — the station identity is stable.
 *   scene      the facility art `src` is the same in every sample — no
 *              room-image state swap.
 *   layout     no horizontal overflow at either viewport; no uncaught page
 *              error.
 *
 * Tile size is read off the drawn member box divided by
 * `FLOOR_MEMBER_DRAW_SCALE_TILES` read out of `empireTuning.ts` (the
 * `readTuning.mjs` rule: a number a check compares against is read from
 * source, not typed again here).
 *
 * Usage: node tools/capture-living-world.mjs [--url http://localhost:8081]
 *          [--out <dir>] [--max-ms 90000] [--sample-ms 100] [--no-video]
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
const OUT = arg('--out', join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-1'));
const MAX_MS = Number(arg('--max-ms', '90000'));
const SAMPLE_MS = Number(arg('--sample-ms', '100'));
const RECORD_VIDEO = !process.argv.includes('--no-video');
/**
 * Ordinary walking: the sim moves at most ~0.43 tile per 120 ms tick and the
 * tween is linear, so a real walk never exceeds ~0.36 tile per 100 ms. After
 * this harness stalls the page for a screenshot the tween catches the body up
 * to the sim's newest cell over one 120 ms tween — measured at up to ~0.5
 * tile per 100 ms across a stall, which is the instrument's artefact, not the
 * renderer's. A teleport is a whole tile or more between adjacent samples, so
 * one tile per 100 ms separates the two without excusing either.
 */
const ORDINARY_TILES_PER_100MS = 1;
/** Total displacement across one eased settle onto/off the bench: bounded by the bay footprint (2×4 tiles), nowhere near a room swap. */
const SETTLE_TILES = 3;
const WALK_FRAME_EVERY_MS = 700;
const MAX_WALK_FRAMES = 6;
const STATION_USING_ID = 'floorsim-using-training-competition-bench-bay';
const BAY_TARGET = 'training:competition-bench-bay';

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '375x812', width: 375, height: 812 },
];

const PW_CHROMIUM = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const notes = [];
const note = (line) => {
  notes.push(line);
  console.log(line);
};

// `parserSelfTest()` returns the list of readers that failed their fixture;
// an empty list is the pass.
const selfTest = parserSelfTest();
if (!Array.isArray(selfTest) || selfTest.length > 0) {
  console.error('readTuning.mjs parser self-test failed:', selfTest);
  process.exit(2);
}
const tuningSource = readFileSync(join(ROOT, 'src', 'empire', 'empireTuning.ts'), 'utf8');
const DRAW_SCALE_TILES = numberInSource(tuningSource, 'FLOOR_MEMBER_DRAW_SCALE_TILES');
const SETTLE_MS = numberInSource(tuningSource, 'FLOOR_MEMBER_SETTLE_MS');
if (DRAW_SCALE_TILES === null || SETTLE_MS === null) {
  console.error('FLOOR_MEMBER_DRAW_SCALE_TILES / FLOOR_MEMBER_SETTLE_MS not found in empireTuning.ts');
  process.exit(2);
}

const SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim() !== '';

mkdirSync(OUT, { recursive: true });
const VIDEO_TMP = join(OUT, '.video-tmp');
mkdirSync(VIDEO_TMP, { recursive: true });

async function reachGym(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const gym = page.getByTestId('shell-open-gym');
  await gym.waitFor({ state: 'visible', timeout: 240000 });
  await gym.click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 30000 });
  // Members are drawn on the first coherent contract frame; wait for one.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-memberid]').length > 0,
    undefined,
    { timeout: 30000 },
  );
}

/** Everything the run reads, from one DOM pass. */
async function worldSnapshot(page, followId) {
  return page.evaluate(
    ({ followId, stationUsingId }) => {
      const boxOf = (node) => {
        if (!node) return null;
        const b = node.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const members = [...document.querySelectorAll('[data-memberid]')].map((node) => ({
        id: node.getAttribute('data-memberid'),
        lifecycle: node.getAttribute('data-lifecycle'),
        target: node.getAttribute('data-target'),
        queueRank: node.getAttribute('data-queuerank'),
        testId: node.getAttribute('data-testid'),
        box: boxOf(node),
        sprite: (node.querySelector('img') && node.querySelector('img').getAttribute('src')) || null,
      }));
      const followed = followId === null ? [] : members.filter((m) => m.id === followId);
      const stationNode = document.querySelector(`[data-testid="${stationUsingId}"]`);
      const art = document.querySelector('[data-testid="gymscreen-facility-art"]');
      const artImg = art && (art.tagName === 'IMG' ? art : art.querySelector('img'));
      return {
        members,
        followed,
        station: stationNode
          ? { id: stationNode.getAttribute('data-testid'), box: boxOf(stationNode), opacity: Number(getComputedStyle(stationNode).opacity) }
          : null,
        artSrc: artImg ? artImg.getAttribute('src') : null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    },
    { followId, stationUsingId: STATION_USING_ID },
  );
}

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pickSubject(members) {
  // Prefer a member still walking to the bay (so the run sees travel), then
  // the lowest-ranked claimant; deterministic given the sim's fixed seed.
  const claimants = members.filter((m) => m.target === BAY_TARGET);
  const seeking = claimants.filter((m) => m.lifecycle === 'seeking');
  if (seeking.length > 0) return seeking[0].id;
  const ranked = claimants
    .filter((m) => m.queueRank !== null)
    .sort((a, b) => Number(a.queueRank) - Number(b.queueRank));
  if (ranked.length > 0) return ranked[0].id;
  return members.length > 0 ? members[0].id : null;
}

async function composeStrip(browser, frames, dest, thumbWidth) {
  if (frames.length === 0) return;
  const page = await browser.newPage({ viewport: { width: thumbWidth * frames.length, height: 10 }, deviceScaleFactor: 1 });
  const imgs = frames
    .map((f) => {
      const b64 = readFileSync(f.path).toString('base64');
      return `<figure style="margin:0;display:inline-block;vertical-align:top;width:${thumbWidth}px"><img src="data:image/png;base64,${b64}" style="width:${thumbWidth}px;display:block"/><figcaption style="font:11px monospace;color:#eee;background:#111;padding:2px 4px">${f.label}</figcaption></figure>`;
    })
    .join('');
  await page.setContent(`<body style="margin:0;background:#111;white-space:nowrap">${imgs}</body>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: dest, fullPage: true });
  await page.close();
}

async function runViewport(browser, viewport) {
  const vp = viewport.name;
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    ...(RECORD_VIDEO ? { recordVideo: { dir: VIDEO_TMP, size: { width: viewport.width, height: viewport.height } } } : {}),
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  const result = {
    viewport: vp,
    subject: null,
    samples: [],
    transitions: [],
    frames: [],
    verdicts: {},
    maxOrdinaryTilesPer100ms: 0,
    maxSettleTiles: 0,
    tilePx: null,
    pageErrors,
  };

  await reachGym(page);
  const first = await worldSnapshot(page, null);
  const subject = pickSubject(first.members);
  result.subject = subject;
  note(`${vp} following ${subject} — ${first.members.length} members drawn, targets ${JSON.stringify(first.members.map((m) => `${m.lifecycle}@${m.target || '-'}`))}`);
  if (subject === null) {
    result.verdicts.identity = false;
    await page.close();
    await context.close();
    return result;
  }

  const t0 = Date.now();
  let lastBox = null;
  let lastT = null;
  let lastLifecycle = null;
  let settleUntil = -Infinity;
  let settleFrom = null;
  let lastWalkFrameAt = -Infinity;
  let walkFrames = 0;
  let seenUsing = false;
  let seenLeaving = false;
  let continuedAfterLeaving = false;
  let usingOverlap = false;
  let identityOk = true;
  const stationIds = new Set();
  const artSrcs = new Set();
  let n = 0;

  while (Date.now() - t0 < MAX_MS) {
    const snap = await worldSnapshot(page, subject);
    const t = Date.now() - t0;
    if (snap.artSrc) artSrcs.add(snap.artSrc);
    if (snap.station) stationIds.add(snap.station.id);
    if (snap.followed.length !== 1) {
      identityOk = false;
      result.samples.push({ t, found: snap.followed.length });
      await page.waitForTimeout(SAMPLE_MS);
      continue;
    }
    const me = snap.followed[0];
    const tilePx = me.box.w / DRAW_SCALE_TILES;
    result.tilePx = tilePx;
    const stepTiles = lastBox === null ? 0 : Math.hypot(me.box.x - lastBox.x, me.box.y - lastBox.y) / tilePx;
    const dt = lastT === null ? SAMPLE_MS : Math.max(t - lastT, 1);
    const settleEdge =
      lastLifecycle !== null && lastLifecycle !== me.lifecycle && (me.lifecycle === 'using' || lastLifecycle === 'using');
    if (settleEdge) {
      settleUntil = t + SETTLE_MS;
      settleFrom = lastBox;
    }
    let settleWindow = false;
    if (t <= settleUntil && settleFrom !== null) {
      settleWindow = true;
      const settled = Math.hypot(me.box.x - settleFrom.x, me.box.y - settleFrom.y) / tilePx;
      result.maxSettleTiles = Math.max(result.maxSettleTiles, settled);
    } else {
      const rate = stepTiles / (dt / 100);
      result.maxOrdinaryTilesPer100ms = Math.max(result.maxOrdinaryTilesPer100ms, rate);
    }
    if (me.lifecycle === 'using' && snap.station && overlaps(me.box, snap.station.box)) usingOverlap = true;
    result.samples.push({
      t,
      dt,
      lifecycle: me.lifecycle,
      target: me.target,
      queueRank: me.queueRank,
      box: me.box,
      stepTiles: Number(stepTiles.toFixed(3)),
      settleWindow,
      station: snap.station ? snap.station.id : null,
      overflowX: snap.overflowX,
    });
    if (me.lifecycle !== lastLifecycle) {
      n += 1;
      const label = `${String(n).padStart(2, '0')}-${me.lifecycle}`;
      const path = join(OUT, `${vp}-${label}.png`);
      // A frame at the instant of a settle edge photographs the START of the
      // ease; wait the settle out so the frame shows where the body ends up.
      if (settleEdge) await page.waitForTimeout(SETTLE_MS + SAMPLE_MS);
      await page.screenshot({ path, fullPage: false });
      result.transitions.push({ t, lifecycle: me.lifecycle, queueRank: me.queueRank, target: me.target, frame: `${vp}-${label}.png` });
      result.frames.push({ path, label: `${(t / 1000).toFixed(1)}s ${me.lifecycle}${me.queueRank !== null ? ` q${me.queueRank}` : ''}` });
      note(`${vp} t=${(t / 1000).toFixed(1)}s ${me.lifecycle} target=${me.target || '-'} rank=${me.queueRank || '-'} box=(${me.box.x.toFixed(0)},${me.box.y.toFixed(0)})`);
      if (me.lifecycle === 'using') seenUsing = true;
      if (me.lifecycle === 'leaving' && seenUsing) seenLeaving = true;
      if (seenLeaving && me.lifecycle !== 'leaving' && lastLifecycle === 'leaving') continuedAfterLeaving = true;
    } else if (me.lifecycle === 'seeking' && walkFrames < MAX_WALK_FRAMES && t - lastWalkFrameAt >= WALK_FRAME_EVERY_MS && stepTiles > 0) {
      walkFrames += 1;
      lastWalkFrameAt = t;
      // Walking frames live only in the strip (and the video); the loose
      // PNGs go to the temp dir so the committed evidence stays small.
      const path = join(VIDEO_TMP, `${vp}-walk-${walkFrames}.png`);
      await page.screenshot({ path, fullPage: false });
      result.frames.push({ path, label: `${(t / 1000).toFixed(1)}s walking` });
    }
    lastBox = me.box;
    lastT = t;
    lastLifecycle = me.lifecycle;
    if (continuedAfterLeaving) break;
    await page.waitForTimeout(SAMPLE_MS);
  }

  const seekingSamples = result.samples.filter((s) => s.lifecycle === 'seeking' && s.box);
  let travelled = 0;
  for (let i = 1; i < seekingSamples.length; i += 1) {
    travelled += Math.hypot(
      seekingSamples[i].box.x - seekingSamples[i - 1].box.x,
      seekingSamples[i].box.y - seekingSamples[i - 1].box.y,
    );
  }
  const lifecycles = result.samples.map((s) => s.lifecycle).filter(Boolean);

  result.verdicts = {
    identity: identityOk,
    travel: result.tilePx !== null && travelled / result.tilePx >= 1,
    noTeleport: result.maxOrdinaryTilesPer100ms <= ORDINARY_TILES_PER_100MS && result.maxSettleTiles <= SETTLE_TILES,
    using: seenUsing && usingOverlap,
    release: seenLeaving,
    continues: continuedAfterLeaving,
    queueObserved: lifecycles.includes('queuing'),
    station: stationIds.size === 1,
    scene: artSrcs.size === 1,
    layout: !result.samples.some((s) => s.overflowX) && pageErrors.length === 0,
  };
  result.travelledTiles = result.tilePx === null ? null : Number((travelled / result.tilePx).toFixed(2));
  result.stationIds = [...stationIds];
  result.artSrcs = [...artSrcs];
  note(
    `${vp} verdicts ${JSON.stringify(result.verdicts)} samples=${result.samples.length} travelled=${result.travelledTiles} tiles maxOrdinaryRate=${result.maxOrdinaryTilesPer100ms.toFixed(3)} tiles/100ms maxSettle=${result.maxSettleTiles.toFixed(3)} tiles tile=${result.tilePx === null ? '-' : result.tilePx.toFixed(1)}px`,
  );

  const video = RECORD_VIDEO ? page.video() : null;
  await page.close();
  if (video !== null) {
    const dest = join(OUT, `${vp}-lifecycle.webm`);
    await video.saveAs(dest);
    await video.delete();
    result.video = `${vp}-lifecycle.webm`;
  }
  await context.close();
  await composeStrip(browser, result.frames, join(OUT, `${vp}-lifecycle-strip.png`), Math.round(viewport.width / 2));
  result.strip = `${vp}-lifecycle-strip.png`;
  return result;
}

const browser = await chromium.launch({
  headless: true,
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let exitCode = 0;
try {
  note(`VL-1 living-world capture at ${SHA}${DIRTY ? ' (DIRTY TREE)' : ''} url=${URL}`);
  const results = [];
  for (const viewport of VIEWPORTS) {
    const result = await runViewport(browser, viewport);
    results.push(result);
    const required = ['identity', 'travel', 'noTeleport', 'using', 'release', 'continues', 'station', 'scene', 'layout'];
    const failed = required.filter((k) => result.verdicts[k] !== true);
    if (failed.length > 0) {
      exitCode = 1;
      note(`${viewport.name} FAILED: ${failed.join(', ')}`);
    }
  }
  const summary = { sha: SHA, dirty: DIRTY, url: URL, generatedAt: new Date().toISOString(), drawScaleTiles: DRAW_SCALE_TILES, results, notes };
  writeFileSync(join(OUT, 'notes.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'notes.txt'), notes.join('\n') + '\n');
  note(`wrote ${OUT}`);
} finally {
  await browser.close();
  rmSync(VIDEO_TMP, { recursive: true, force: true });
}
process.exit(exitCode);
