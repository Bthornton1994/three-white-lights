#!/usr/bin/env node
/**
 * capture-living-world.mjs — VL-1 / VL-2 evidence: ONE member, followed by
 * its contract identity, through a real lifecycle on the real Play surface.
 *
 * Claude Code Session B's instrument (CLAUDE.md "Crossing VL-1", extended
 * under "Crossing VL-2"). It does not
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
 *              lifecycle change into or out of `using`, the displacement
 *              across the window BEYOND the walking ceiling for that interval
 *              is bounded by `SETTLE_TILES` instead. Both maxima are
 *              recorded, the raw settle displacement beside the excess. A room-image swap or a snap-to-bench
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
 * VL-2 adds four readings of the same run, each off the drawn DOM:
 *
 *   gait       while walking, the VISIBLE sprite image (the most opaque of
 *              the body's pre-mounted pose images, never a value the renderer
 *              reports about itself) cycled through at least
 *              `WALK_DISTINCT_FRAMES_MIN` distinct images — the contact and
 *              passing poses of the distance-phased walk.
 *   repCycle   while `using`, at least two distinct images were seen — the
 *              two keyposes of the held-and-crossfaded rep.
 *   depth      the body's `data-scale` (the camera's depth scale at its feet)
 *              took more than one value across the run, and the drawn box
 *              scaled with it: a member walking up the room got smaller.
 *   lag        the largest gap between where the drawn body was and where the
 *              renderer's own per-tick anchor (`data-anchor`, stage pixels)
 *              said the sim put it, in tiles, outside a settle — reported,
 *              not required, and measured by this tool from two DOM
 *              attributes rather than taken from the renderer. The renderer
 *              plays `FLOOR_MEMBER_RENDER_DELAY_TICKS` behind the sim by
 *              design, so about one step of lag is the design working.
 *
 * `noTeleport` is tighter than VL-1's: the walk is snapshot-interpolated at
 * the sim's own rate now, so the ordinary ceiling is that rate
 * (`FLOOR_SIM_STEP_PROGRESS_PER_TICK` / `FLOOR_SIM_TICK_INTERVAL_MS`, read from
 * source) times `RATE_TOLERANCE`, rather than a whole tile per 100 ms.
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
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { numberInSource, parserSelfTest } from './readTuning.mjs';

// VL-3, this round: TypeScript loading so the production clip vocabulary
// used below is READ FROM the shipped table (`tools/sprites.mjs`'s own
// resolve-hook shape, matching `tools/capture-motion-proof.mjs`) rather than
// hardcoded — a clip added or renamed there is a compile error here too.
// `globalThis.URL`, not the bare global — this file (unlike
// capture-motion-proof.mjs, which learned this the hard way and renamed its
// own to `BASE_URL`) declares a module-level `const URL = arg('--url', ...)`
// BELOW, which shadows the global `URL` constructor for the rest of this
// module's scope, including inside this hook. `new URL(...)` here threw
// "URL is not a constructor", was swallowed by the catch, and fell through
// to Node's default resolver — silently disabling the whole hook rather than
// failing loudly. Measured directly (temporary logging), not guessed:
// renaming this file's ~700 other `URL` references was the larger, riskier
// edit; qualifying the four call sites that need the real constructor is the
// smaller one.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        const url = new globalThis.URL(`${specifier}.ts`, context.parentURL ?? import.meta.url);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      } catch {
        /* fall through */
      }
    }
    return nextResolve(specifier, context);
  },
});

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] !== undefined ? process.argv[idx + 1] : fallback;
}

const URL = arg('--url', 'http://localhost:8081');
const OUT = arg('--out', join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-2'));
const MAX_MS = Number(arg('--max-ms', '90000'));
const SAMPLE_MS = Number(arg('--sample-ms', '100'));
const RECORD_VIDEO = !process.argv.includes('--no-video');
/**
 * Ordinary walking: VL-2 draws the walk by snapshot interpolation over one
 * tick, so the drawn rate is the sim's own step rate and never more — a
 * stalled frame is drawn as a hold, not as a catch-up burst (VL-1's tween
 * measured ~0.5 tile per 100 ms across a harness stall; that is what this
 * bound now excludes). The ceiling is that rate, read from source below,
 * times a tolerance for sampling jitter. A teleport is a whole tile or more
 * between adjacent samples and sits far above it.
 */
/**
 * Sampling tolerance on the ordinary ceiling, and every factor in it is
 * named: a ~100 ms interval holds six or seven 16.7 ms frames, so one
 * interval can carry up to ~17% more playback than the next; and the tile
 * a step is measured in is the body's tile at the END of the interval,
 * which on a body walking toward the back is up to ~8% smaller than at the
 * start (the camera's depth scale changes by that much across a front
 * row). 1.17 × 1.08 ≈ 1.26; 1.3 leaves a little for frame jitter. A real
 * teleport is a whole tile or more in an interval — well above.
 */
const RATE_TOLERANCE = 1.3;
/** A walk cycle shows contact, passing, contact — three distinct images at the current art set. */
const WALK_DISTINCT_FRAMES_MIN = 3;
/**
 * Displacement across one eased settle onto/off the bench BEYOND what
 * ordinary walking could cover in the same interval: bounded by the bay
 * footprint (2×4 tiles), nowhere near a room swap. Measured as an EXCESS
 * because the transition screenshot stalls this tool (not the page) for
 * several hundred milliseconds, and the sim keeps walking the member
 * through that interval — so a settle-window sample carries the settle
 * plus that walk, and only the part above the walking ceiling is the settle.
 */
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
const TICK_MS = numberInSource(tuningSource, 'FLOOR_SIM_TICK_INTERVAL_MS');
const STEP_PER_TICK = numberInSource(tuningSource, 'FLOOR_SIM_STEP_PROGRESS_PER_TICK');
if (DRAW_SCALE_TILES === null || SETTLE_MS === null || TICK_MS === null || STEP_PER_TICK === null) {
  console.error('FLOOR_MEMBER_DRAW_SCALE_TILES / FLOOR_MEMBER_SETTLE_MS / FLOOR_SIM_TICK_INTERVAL_MS / FLOOR_SIM_STEP_PROGRESS_PER_TICK not found in empireTuning.ts');
  process.exit(2);
}
const CATCH_UP_RATE = numberInSource(tuningSource, 'FLOOR_MEMBER_CATCH_UP_RATE');
if (CATCH_UP_RATE === null) {
  console.error('FLOOR_MEMBER_CATCH_UP_RATE not found in empireTuning.ts');
  process.exit(2);
}
const SPEED_JITTER_FRACTION = numberInSource(tuningSource, 'FLOOR_SIM_SPEED_JITTER_FRACTION');
if (SPEED_JITTER_FRACTION === null) {
  console.error('FLOOR_SIM_SPEED_JITTER_FRACTION not found in empireTuning.ts');
  process.exit(2);
}
/**
 * The ceiling on ordinary movement, in tiles per 100 ms: the sim's FASTEST
 * seeded step rate — `speedOf` in floorSim.ts jitters each member's step by
 * ±FLOOR_SIM_SPEED_JITTER_FRACTION, so the base step alone under-derives
 * the ceiling by that fraction for half the roster (VL-2B: a member at
 * +20% sat at 93% of the old ceiling before any sampling error) — times
 * the renderer's bounded catch-up, times a tolerance for the sampling grain
 * (a ~100 ms interval holds six or seven 16.7 ms frames, so one interval
 * can carry up to ~17% more playback than the next). The step is measured
 * on the longer axis of the feet's movement: the sim steps between
 * four-neighbour cells, so one step is one axis, and the projected row
 * height is a little under a tile width, so the axis read is the larger of
 * the two anyway.
 */
const ORDINARY_TILES_PER_100MS =
  ((STEP_PER_TICK * (1 + SPEED_JITTER_FRACTION)) / TICK_MS) * 100 * (1 + CATCH_UP_RATE) * RATE_TOLERANCE;

// VL-3, this round: the production clip vocabulary, loaded from
// `memberMotionClips.ts` — optional (an old tree has no such file), so its
// absence degrades gait/repCycle back to the pre-VL-3 pose-stack reading
// rather than failing this whole tool.
let stripStems = null;
try {
  const clips = await import(pathToFileURL(join(ROOT, 'src', 'empire', 'memberMotionClips.ts')).href);
  if (typeof clips.memberMotionStripStem === 'function' && Array.isArray(clips.MEMBER_MOTION_CLIPS) && Array.isArray(clips.MEMBER_MOTION_PRODUCTION_TYPES)) {
    stripStems = new Set(
      clips.MEMBER_MOTION_PRODUCTION_TYPES.flatMap((type) => clips.MEMBER_MOTION_CLIPS.map((clip) => clips.memberMotionStripStem(type, clip))),
    );
  }
} catch {
  stripStems = null;
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
        clip: node.getAttribute('data-clip'),
        tick: node.getAttribute('data-tick'),
        cell: node.getAttribute('data-cell'),
        anchor: node.getAttribute('data-anchor'),
        scale: node.getAttribute('data-scale'),
        // VL-3: the production strip's frame index — `data-frame`, written
        // by the frame loop per frame (`FloorGrid.tsx`'s own header). Only
        // meaningful when `sprite` below is a strip file (a strip's `src`
        // never changes as its frame advances — translateX moves inside a
        // clipping box — so `sprite` alone under-counts a production body's
        // distinct poses; see `poseIdentity` below).
        frame: node.getAttribute('data-frame'),
        box: boxOf(node),
        // VL-2: the sprite is a stack of pose images; the visible one is the
        // most opaque, read off the DOM rather than reported by the renderer.
        // The web renderer draws an `Image` as a div carrying the picture as
        // a background, with an accessibility `<img>` inside it at opacity 0
        // — so the opacity that matters starts at the img's PARENT, not the
        // img (reading the img's own opacity made every layer 0 and the
        // first one "visible", which is how a first trial of this reading
        // reported a walking body as standing).
        sprite: (() => {
          let best = null;
          for (const img of node.querySelectorAll('img')) {
            let opacity = 1;
            let at = img.parentElement;
            while (at !== null && at !== node.parentElement) {
              opacity *= Number(getComputedStyle(at).opacity);
              at = at.parentElement;
            }
            if (best === null || opacity > best.opacity) best = { src: img.getAttribute('src'), opacity };
          }
          return best === null ? null : best.src;
        })(),
      }));
      const followed = followId === null ? [] : members.filter((m) => m.id === followId);
      // The page's own clock at the moment of THIS read. A rate measured
      // against the tool's clock is wrong by however unevenly the two reads
      // were delayed on the page's main thread (a stall before one read and
      // not the next shortens the true interval while the tool's interval
      // reads as 100 ms); the interval between two DOM reads is the interval
      // between the page clock at each.
      const readAt = performance.now();
      const grid = document.querySelector('[data-testid="floorgrid-grid"]');
      const gridBox = boxOf(grid);
      const stationNode = document.querySelector(`[data-testid="${stationUsingId}"]`);
      const art = document.querySelector('[data-testid="gymscreen-facility-art"]');
      const artImg = art && (art.tagName === 'IMG' ? art : art.querySelector('img'));
      return {
        members,
        followed,
        gridBox,
        readAt,
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

/** The bottom-centre of a drawn box — where the feet stand. */
function feetOf(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h };
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
    maxSettleRawTiles: 0,
    maxLagTiles: 0,
    maxLagAt: null,
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
  let lastReadAt = null;
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
  const scalesSeen = new Set();
  const walkSprites = new Set();
  const useSprites = new Set();
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
    let lagNow = null;
    // VL-2: the drawn box is the front-row tile times the depth scale at the
    // body's feet, so the tile at THIS body's depth is the box over the draw
    // scale, and a rate in tiles is a rate at that depth.
    const tilePx = me.box.w / DRAW_SCALE_TILES;
    result.tilePx = tilePx;
    if (me.scale !== null) scalesSeen.add(me.scale);
    // VL-3: a production body's `sprite` src is one strip FILE per clip —
    // every frame of that clip shares the same src, the frame moves inside
    // it via `translateX` — so `sprite` alone answers "which clip", not
    // "which pose". `poseIdentity` is `sprite` for a legacy pose (unchanged
    // reading) and `sprite#frame` for a strip, extending the existing
    // gait/repCycle checks FROM THE CLIP TABLE (`stripStems`, loaded above)
    // rather than hardcoding a filename pattern.
    const spriteStem = me.sprite === null ? null : me.sprite.split('/').pop()?.replace(/\.png$/, '') ?? null;
    const isStrip = stripStems !== null && spriteStem !== null && stripStems.has(spriteStem);
    const poseIdentity = me.sprite === null ? null : isStrip ? `${me.sprite}#${me.frame}` : me.sprite;
    if (poseIdentity !== null) {
      if (me.clip === 'walk') walkSprites.add(poseIdentity);
      if (me.lifecycle === 'using') useSprites.add(poseIdentity);
    }
    // Motion is measured at the FEET — the bottom-centre of the drawn box,
    // the point the renderer's timeline moves. The box's top-left also moves
    // when the body's depth scale changes (a bigger body has its corner
    // further from its feet), which a first version of this read as extra
    // speed on a member walking down the room.
    const feet = feetOf(me.box);
    const lastFeet = lastBox === null ? null : feetOf(lastBox);
    const stepTiles =
      lastFeet === null ? 0 : Math.max(Math.abs(feet.x - lastFeet.x), Math.abs(feet.y - lastFeet.y)) / tilePx;
    // dt is the PAGE clock's interval between the two DOM reads, not the
    // tool's; see `worldSnapshot`.
    const dt = lastReadAt === null ? SAMPLE_MS : Math.max(snap.readAt - lastReadAt, 1);
    const settleEdge =
      lastLifecycle !== null && lastLifecycle !== me.lifecycle && (me.lifecycle === 'using' || lastLifecycle === 'using');
    if (settleEdge) {
      settleUntil = t + SETTLE_MS;
      settleFrom = lastBox;
    }
    // The window covers every sample whose INTERVAL touches it: a sample taken
    // right after the transition screenshot spans the whole settle, so the
    // previous sample's time is what says whether this interval is a settle.
    let settleWindow = false;
    if ((t <= settleUntil || (lastT !== null && lastT <= settleUntil)) && settleFrom !== null) {
      settleWindow = true;
      const settled = Math.hypot(feet.x - feetOf(settleFrom).x, feet.y - feetOf(settleFrom).y) / tilePx;
      const walkAllowance = (ORDINARY_TILES_PER_100MS * (t - (lastT ?? t))) / 100;
      result.maxSettleRawTiles = Math.max(result.maxSettleRawTiles, settled);
      result.maxSettleTiles = Math.max(result.maxSettleTiles, Math.max(0, settled - walkAllowance));
    } else {
      const rate = stepTiles / (dt / 100);
      result.maxOrdinaryTilesPer100ms = Math.max(result.maxOrdinaryTilesPer100ms, rate);
    }
    if (me.anchor !== null && me.anchor.includes(',') && snap.gridBox !== null) {
      // The anchor is in stage pixels; the drawn box is in viewport pixels;
      // the stage's own box is the offset between them. The lag is the
      // distance from the drawn feet to the anchor of the latest tick, in
      // tiles at this body's depth — at most one sim step while walking,
      // larger only while a settle eases across a bigger gap, which is why
      // the settle window is excluded.
      const [ax, ay] = me.anchor.split(',').map(Number);
      const lag = Math.hypot(feet.x - (snap.gridBox.x + ax), feet.y - (snap.gridBox.y + ay)) / tilePx;
      lagNow = Number(lag.toFixed(3));
      if (!settleWindow && lag > result.maxLagTiles) {
        result.maxLagTiles = lag;
        result.maxLagAt = { t, tick: me.tick, lifecycle: me.lifecycle, clip: me.clip };
      }
    }
    if (me.lifecycle === 'using' && snap.station && overlaps(me.box, snap.station.box)) usingOverlap = true;
    result.samples.push({
      t,
      dt,
      lifecycle: me.lifecycle,
      target: me.target,
      queueRank: me.queueRank,
      box: me.box,
      clip: me.clip,
      scale: me.scale,
      cell: me.cell,
      tick: me.tick,
      anchor: me.anchor,
      lagTiles: lagNow,
      sprite: me.sprite === null ? null : me.sprite.split('/').pop(),
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
    lastReadAt = snap.readAt;
    lastLifecycle = me.lifecycle;
    if (continuedAfterLeaving) break;
    await page.waitForTimeout(SAMPLE_MS);
  }

  const seekingSamples = result.samples.filter((s) => s.lifecycle === 'seeking' && s.box);
  let travelled = 0;
  for (let i = 1; i < seekingSamples.length; i += 1) {
    const here = feetOf(seekingSamples[i].box);
    const before = feetOf(seekingSamples[i - 1].box);
    travelled += Math.hypot(here.x - before.x, here.y - before.y);
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
    // VL-2
    gait: walkSprites.size >= WALK_DISTINCT_FRAMES_MIN,
    repCycle: useSprites.size >= 2,
    depth: scalesSeen.size > 1,
  };
  result.walkSprites = [...walkSprites].map((s) => s.split('/').pop());
  result.useSprites = [...useSprites].map((s) => s.split('/').pop());
  result.scalesSeen = [...scalesSeen].sort();
  result.ordinaryCeilingTilesPer100ms = ORDINARY_TILES_PER_100MS;
  result.travelledTiles = result.tilePx === null ? null : Number((travelled / result.tilePx).toFixed(2));
  result.stationIds = [...stationIds];
  result.artSrcs = [...artSrcs];
  note(
    `${vp} verdicts ${JSON.stringify(result.verdicts)} samples=${result.samples.length} travelled=${result.travelledTiles} tiles maxOrdinaryRate=${result.maxOrdinaryTilesPer100ms.toFixed(3)} tiles/100ms (ceiling ${ORDINARY_TILES_PER_100MS.toFixed(3)}) maxSettleExcess=${result.maxSettleTiles.toFixed(3)} (raw ${result.maxSettleRawTiles.toFixed(3)}) tiles maxLag=${result.maxLagTiles.toFixed(3)} tiles tile=${result.tilePx === null ? '-' : result.tilePx.toFixed(1)}px walkFrames=${result.walkSprites.join(',')} useFrames=${result.useSprites.join(',')} scales=${result.scalesSeen.join(',')}`,
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
  note(`VL-2 living-world capture at ${SHA}${DIRTY ? ' (DIRTY TREE)' : ''} url=${URL}`);
  const results = [];
  for (const viewport of VIEWPORTS) {
    const result = await runViewport(browser, viewport);
    results.push(result);
    const required = ['identity', 'travel', 'noTeleport', 'using', 'release', 'continues', 'station', 'scene', 'layout', 'gait', 'repCycle', 'depth'];
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
