#!/usr/bin/env node
/**
 * capture-motion-proof.mjs — VL-3: the PRODUCTION MOTION PROOF. One member
 * in the persistent gym, followed on the played path through seeking →
 * queuing → using → leaving, with every movement number read DIRECTLY off
 * the renderer's own frame loop through a trace sink, and every verdict
 * printed beside the derivation of the bound it was judged against.
 *
 * Claude Code Session B's instrument (CLAUDE.md "VL-3"). Automated evidence
 * may close TECHNICAL MOTION, IDENTITY, OCCUPANCY and PERFORMANCE-WEB; it
 * does not and cannot close VISUAL, WORLD LEGIBILITY, ANIMATION FEEL,
 * SOFT-FEEL or OWNER PLAYTEST, and nothing here is a phone.
 *
 * ===========================================================================
 * THE THREE CONTRACTS THIS TOOL READS, AND WHAT IT DOES WHEN ONE IS ABSENT
 * ===========================================================================
 * VL-3 is built in parallel by three builders (CLAUDE.md "VL-3"): the rig,
 * the runtime and these instruments. This tool is written against the
 * contracts the other two publish, and when one is missing it FAILS LOUDLY
 * AND SPECIFICALLY — it names the missing global or export, lists the
 * verdicts that global blocks as SKIP, and exits 3 (never 0) — rather than
 * quietly passing on the DOM alone. A SKIP is printed in the verdict table
 * with the contract it is waiting on; it is never counted as a pass.
 *
 *   1. THE CLIP TABLE — `src/empire/memberMotionClips.ts`, loaded through
 *      Node's type stripping the way `tools/sprites.mjs` loads `src/art`:
 *      `MEMBER_MOTION_CLIPS`, `MEMBER_MOTION_CLIP_SPECS` (frames, drive,
 *      period, loop), `MEMBER_MOTION_TRANSITIONS` (the legal edges),
 *      `MEMBER_MOTION_CANVAS_PX`, `memberMotionStrideTiles()`. Required; the
 *      tool exits 2 without it.
 *
 *   2. THE FRAME-LOOP TRACE — `window.__empireMotionTrace`, an array this
 *      tool creates EMPTY in an init script before the page loads, into
 *      which `FloorGrid.tsx`'s frame loop pushes ONE RECORD PER MEMBER PER
 *      FRAME:
 *
 *        { memberId, now, elapsedMs, tick, lifecycle, clip, frame, phase,
 *          facing, drawnX, drawnY, scale, tileHere, contractX, contractY,
 *          pullX, pullY, settling, relocating, transition }
 *
 *      `now` is the frame timestamp the loop advanced by, `elapsedMs` the
 *      capped elapsed it applied, `drawnX`/`drawnY` the feet point it wrote
 *      in stage pixels (the box's bottom centre — the point the timeline
 *      moves), `scale` the depth scale it drew at, `frame` the strip frame
 *      index, `facing` 'left' | 'right'. A record missing any of those keys
 *      is reported by key name. If the array is still empty after the run
 *      the runtime contract is absent, and walkFootPlanted, noSkate,
 *      gaitCycle, noFamilySnap, stationAttached, facingStable and the trace
 *      half of identity / scaleContinuous / transitionsLegal are SKIP.
 *      The `MutationObserver` write log VL-2B measured is NOT used for any
 *      per-frame displacement here: it coalesces two frames into one record
 *      when this browser bunches frames (CLAUDE.md "VL-2B DELIVERED",
 *      measurement 5), so it is not proof of a per-frame step.
 *
 *   3. THE RIG'S PER-FRAME METADATA — an export of `src/empire/memberRig.ts`
 *      named `memberRigFrameMetadata`, a function of a production member
 *      type returning, per clip, an array of `frames` entries:
 *
 *        { foot: { x, y } | null, rootAdvance: { x, y }, bar: { x, y } | null,
 *          body: { x, y, width, height } }
 *
 *      in canvas pixels (`MEMBER_MOTION_CANVAS_PX` square, feet at the
 *      bottom centre, authored facing right), plus `strideCanvasPx` and
 *      `strideTiles`. `foot` is the PLANTED foot's sole point for a walk
 *      frame. Without it walkFootPlanted and noSkate are SKIP, named.
 *
 * ===========================================================================
 * THE VERDICTS, each judged against a bound whose derivation is printed
 * ===========================================================================
 *   playedPath        the gym reached through the shell's own control, no
 *                     query string in the address bar at the read.
 *   cycle             the followed member was seen seeking → queuing → using
 *                     → leaving, in that order, inside the budget.
 *   identity          DOM: the followed id resolves to exactly one drawn node
 *                     in every sampled frame, and every id to exactly one.
 *                     TRACE: one record per member per frame, no frame
 *                     between a member's first and last record without one
 *                     (`gaps`), and no record whose `elapsedMs` exceeds
 *                     FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS (the cap held).
 *   tickRate          sim ticks per second read off `data-tick` over the
 *                     whole sample, against 1000 / FLOOR_SIM_TICK_INTERVAL_MS,
 *                     within a tolerance DERIVED from the read itself: a
 *                     timer tick is seen one frame late at most, so
 *                     (mean frame interval / TICK_MS), plus the count
 *                     quantisation 1 / ticks advanced.
 *   transitionsLegal  every clip change on every member — DOM `data-clip`,
 *                     and the trace's `clip` when present — is an edge of
 *                     MEMBER_MOTION_TRANSITIONS; a clip name outside
 *                     MEMBER_MOTION_CLIPS is named (on a pre-VL-3 tree the
 *                     names are VL-2's, and that is reported as such).
 *                     The number of changes is pinned above zero, so an
 *                     empty domain reports itself.
 *   gaitCycle         TRACE, walk frames of the followed member: the frame
 *                     index advances monotonically modulo `frames`, never
 *                     repeats a non-zero step backwards, and skips at most
 *                     the frames one capped frame of walking can cover:
 *                     ceil(FRAME_STEP_BOUND_TILES × frames / stride tiles);
 *                     and all `frames` indices were seen at least once
 *                     across the walk (histogram printed).
 *   walkFootPlanted   TRACE + RIG, walk frames of the followed member: for
 *                     each STANCE (a maximal run of consecutive walk frames
 *                     whose rig `foot` is the same planted foot), the
 *                     planted foot's world x
 *                       = drawnX + (footOffsetX − CANVAS/2) × (bodySide / CANVAS)
 *                     (mirrored for a left facing) is constant within
 *                     FLOOR_MEMBER_MOTION_PROOF_FOOT_DRIFT_TOLERANCE_TILES,
 *                     where bodySide = FLOOR_MEMBER_DRAW_SCALE_TILES × the
 *                     front tile × scale. Max drift and the number of
 *                     stances are printed; zero stances is a SKIP.
 *   noSkate           the same measurement phrased per stance: the mean and
 *                     max drift per stance, both under the tolerance.
 *   noFamilySnap      TRACE: at every clip change the drawn point moved less
 *                     than one walking frame's step (FRAME_STEP_BOUND_TILES,
 *                     the loop's own capped catch-up frame at the fastest
 *                     seeded stride), and a frame index that restarts at 0
 *                     does so only on a clip change that is a legal edge or
 *                     on a looping clip's wrap from its last frame.
 *   stationAttached   TRACE, the followed member: during `bench-press` the
 *                     drawn point's offset from the bench it uses (the
 *                     nearest bench box's centre, read once off the DOM) is
 *                     constant within FLOOR_MEMBER_MOTION_PROOF_STATION_
 *                     OFFSET_TOLERANCE_TILES; during `bench-setup` the
 *                     offset's magnitude never grows by more than that
 *                     tolerance frame to frame, and during `bench-finish`
 *                     never shrinks by more than it.
 *   scaleContinuous   DOM `data-scale` per sampled frame and TRACE `scale`
 *                     per record: max |Δscale| per frame ≤ a bound derived
 *                     from the camera and the fastest per-frame move:
 *                     scale(t) = 1 / ((1 − t)/BACK + t), t = row / rows, so
 *                     |dscale/drow| ≤ (1/BACK − 1)/rows at the front row,
 *                     and one capped frame moves at most
 *                     SETTLE_FRAME_BOUND_TILES (cap × (3/SETTLE_MS + the
 *                     fastest walker's catch-up rate)), hence
 *                     bound = SETTLE_FRAME_BOUND_TILES × (1/BACK − 1)/rows.
 *                     The VL-2B seat-assignment size step (0.70 → 0.85)
 *                     is above it by design of the bound, and reads FAIL
 *                     until the runtime scales from the drawn point.
 *   facingStable      TRACE: whenever the drawn x-velocity's sign disagrees
 *                     with `facing` for a run of consecutive frames, that run
 *                     is at most N frames, N = ceil(FLOOR_MEMBER_GAIT_
 *                     TRANSITION_MS / mean frame interval) — the hysteresis
 *                     may hold a facing through one gait transition and no
 *                     longer. Sub-pixel motion (under a hundredth of a tile
 *                     per frame) has no sign and is not a disagreement.
 *   layout            no horizontal overflow, no uncaught page error.
 *
 * OBSERVATION, carried forward from VL-2B and never judged: the tick-28
 * shared-cell overlap. Every sampled frame in which two members carry the
 * same `data-cell` (exact, and rounded) while one of them is `using` is
 * reported with its ticks and ids. The renderer draws the contract as it
 * is; whether a seeking member may path through an occupied seat cell is
 * Grok's to rule on, and this tool reports the overlap rather than looking
 * away from it.
 *
 * Usage: node tools/capture-motion-proof.mjs [--url http://localhost:8081]
 *          [--out docs/design/living-gym-world/vl-3/motion] [--max-ms 120000]
 *
 * Exit: 0 every judged verdict true and no contract missing; 1 a judged
 * verdict false; 2 the clip table could not be loaded or a tuning read
 * failed; 3 a runtime or rig contract absent (verdicts SKIPPED) — 3 wins
 * over 1 so a missing contract is never mistaken for a graded run.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { numberInBlock, numberInSource, parserSelfTest } from './readTuning.mjs';

// ---------------------------------------------------------------------------
// TypeScript loading — `tools/sprites.mjs`'s resolve hook, so the clip table
// a critic sees is the exact table the app imports.
// ---------------------------------------------------------------------------
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (relative && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        const url = new URL(`${specifier}.ts`, context.parentURL ?? import.meta.url);
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
// `BASE_URL`, not `URL` as the sibling tools name it: the resolve hook above
// calls `new URL(...)`, and a module-level `const URL` string shadowed the
// global class, threw inside the hook's `catch`, and fell through to Node's
// default resolution — which cannot find `./empireTuning` without its
// extension. Found by the tool exiting 2 on a file that loads fine elsewhere.
const BASE_URL = arg('--url', 'http://localhost:8081');
const OUT = arg('--out', join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-3', 'motion'));
const MAX_MS = Number(arg('--max-ms', '120000'));
const TRACE_GLOBAL = '__empireMotionTrace';
const RIG_EXPORT = 'memberRigFrameMetadata';
const TRACE_KEYS = [
  'memberId', 'now', 'elapsedMs', 'tick', 'lifecycle', 'clip', 'frame', 'phase', 'facing',
  'drawnX', 'drawnY', 'scale', 'tileHere', 'contractX', 'contractY', 'pullX', 'pullY',
  'settling', 'relocating', 'transition',
];
/** A frame-to-frame move under this many tiles is sub-pixel at every size drawn here and carries no direction. */
const MOTIONLESS_TILES = 0.01;
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

// ---------------------------------------------------------------------------
// Contract 1: the clip table.
// ---------------------------------------------------------------------------
let clips;
try {
  clips = await import(pathToFileURL(join(ROOT, 'src', 'empire', 'memberMotionClips.ts')).href);
} catch (error) {
  console.error(`could not load src/empire/memberMotionClips.ts through type stripping: ${error.message}`);
  process.exit(2);
}
const CLIP_EXPORTS = ['MEMBER_MOTION_CLIPS', 'MEMBER_MOTION_CLIP_SPECS', 'MEMBER_MOTION_TRANSITIONS', 'MEMBER_MOTION_CANVAS_PX', 'memberMotionStrideTiles', 'MEMBER_MOTION_PRODUCTION_TYPES'];
const missingClipExports = CLIP_EXPORTS.filter((name) => clips[name] === undefined);
if (missingClipExports.length > 0) {
  console.error(`memberMotionClips.ts is missing: ${missingClipExports.join(', ')}`);
  process.exit(2);
}
const MOTION_CLIPS = [...clips.MEMBER_MOTION_CLIPS];
const CLIP_SPECS = clips.MEMBER_MOTION_CLIP_SPECS;
const TRANSITIONS = clips.MEMBER_MOTION_TRANSITIONS.map(([a, b]) => `${a}>${b}`);
const CANVAS_PX = clips.MEMBER_MOTION_CANVAS_PX;
const STRIDE_TILES = clips.memberMotionStrideTiles();
const PRODUCTION_TYPES = [...clips.MEMBER_MOTION_PRODUCTION_TYPES];
const edgeAllowed = (from, to) => from === to || TRANSITIONS.includes(`${from}>${to}`);

// ---------------------------------------------------------------------------
// Contract 3: the rig's per-frame metadata (optional at this tool's birth).
// ---------------------------------------------------------------------------
let rigMetadata = null;
let rigStatus;
const rigPath = join(ROOT, 'src', 'empire', 'memberRig.ts');
if (!existsSync(rigPath)) {
  rigStatus = `MISSING CONTRACT: src/empire/memberRig.ts does not exist (export ${RIG_EXPORT} expected)`;
} else {
  try {
    const rig = await import(pathToFileURL(rigPath).href);
    if (typeof rig[RIG_EXPORT] !== 'function') {
      rigStatus = `MISSING CONTRACT: src/empire/memberRig.ts exports no function ${RIG_EXPORT} (exports: ${Object.keys(rig).join(', ') || 'none'})`;
    } else {
      rigMetadata = rig[RIG_EXPORT](PRODUCTION_TYPES[0]);
      const problems = [];
      for (const clip of MOTION_CLIPS) {
        const frames = rigMetadata?.[clip]?.frames;
        if (!Array.isArray(frames)) problems.push(`${clip}: no frames array`);
        else if (frames.length !== CLIP_SPECS[clip].frames) problems.push(`${clip}: ${frames.length} frames, table says ${CLIP_SPECS[clip].frames}`);
      }
      if (typeof rigMetadata?.strideCanvasPx !== 'number' || typeof rigMetadata?.strideTiles !== 'number') problems.push('strideCanvasPx / strideTiles missing');
      rigStatus = problems.length === 0 ? `rig metadata loaded from ${RIG_EXPORT}('${PRODUCTION_TYPES[0]}'): stride ${rigMetadata.strideCanvasPx} canvas px = ${rigMetadata.strideTiles} tiles` : `MISSING CONTRACT: ${RIG_EXPORT} shape — ${problems.join('; ')}`;
      if (problems.length > 0) rigMetadata = null;
    }
  } catch (error) {
    rigStatus = `MISSING CONTRACT: src/empire/memberRig.ts failed to load: ${error.message.split('\n')[0]}`;
  }
}

// ---------------------------------------------------------------------------
// Tuning, read from source.
// ---------------------------------------------------------------------------
const selfTest = parserSelfTest();
if (!Array.isArray(selfTest) || selfTest.length > 0) {
  console.error('readTuning.mjs parser self-test failed:', selfTest);
  process.exit(2);
}
const tuningSource = readFileSync(join(ROOT, 'src', 'empire', 'empireTuning.ts'), 'utf8');
const T = {
  FLOOR_MEMBER_DRAW_SCALE_TILES: numberInSource(tuningSource, 'FLOOR_MEMBER_DRAW_SCALE_TILES'),
  FLOOR_SIM_TICK_INTERVAL_MS: numberInSource(tuningSource, 'FLOOR_SIM_TICK_INTERVAL_MS'),
  FLOOR_SIM_STEP_PROGRESS_PER_TICK: numberInSource(tuningSource, 'FLOOR_SIM_STEP_PROGRESS_PER_TICK'),
  FLOOR_SIM_SPEED_JITTER_FRACTION: numberInSource(tuningSource, 'FLOOR_SIM_SPEED_JITTER_FRACTION'),
  FLOOR_MEMBER_CATCH_UP_RATE: numberInSource(tuningSource, 'FLOOR_MEMBER_CATCH_UP_RATE'),
  FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS: numberInSource(tuningSource, 'FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS'),
  FLOOR_MEMBER_SETTLE_MS: numberInSource(tuningSource, 'FLOOR_MEMBER_SETTLE_MS'),
  FLOOR_CAMERA_BACK_SCALE: numberInSource(tuningSource, 'FLOOR_CAMERA_BACK_SCALE'),
  FLOOR_MEMBER_GAIT_TRANSITION_MS: numberInSource(tuningSource, 'FLOOR_MEMBER_GAIT_TRANSITION_MS'),
  FLOOR_MEMBER_MOTION_PROOF_FOOT_DRIFT_TOLERANCE_TILES: numberInSource(tuningSource, 'FLOOR_MEMBER_MOTION_PROOF_FOOT_DRIFT_TOLERANCE_TILES'),
  FLOOR_MEMBER_MOTION_PROOF_STATION_OFFSET_TOLERANCE_TILES: numberInSource(tuningSource, 'FLOOR_MEMBER_MOTION_PROOF_STATION_OFFSET_TOLERANCE_TILES'),
  // The garage is the first row of the FLOOR_GRID_SIZE block, and the first
  // `height:` inside it — the rung the persistent gym starts on.
  'FLOOR_GRID_SIZE.garage.height': numberInBlock(tuningSource, 'FLOOR_GRID_SIZE', 'height'),
};
const missingTuning = Object.entries(T).filter(([, v]) => v === null).map(([k]) => k);
if (missingTuning.length > 0) {
  console.error(`not found in empireTuning.ts: ${missingTuning.join(', ')}`);
  process.exit(2);
}
const DRAW_SCALE_TILES = T.FLOOR_MEMBER_DRAW_SCALE_TILES;
const TICK_MS = T.FLOOR_SIM_TICK_INTERVAL_MS;
const STEP_PER_TICK = T.FLOOR_SIM_STEP_PROGRESS_PER_TICK;
const JITTER = T.FLOOR_SIM_SPEED_JITTER_FRACTION;
const CATCH_UP = T.FLOOR_MEMBER_CATCH_UP_RATE;
const CAP_MS = T.FLOOR_MEMBER_FRAME_ELAPSED_CAP_MS;
const SETTLE_MS = T.FLOOR_MEMBER_SETTLE_MS;
const BACK_SCALE = T.FLOOR_CAMERA_BACK_SCALE;
const GAIT_TRANSITION_MS = T.FLOOR_MEMBER_GAIT_TRANSITION_MS;
const FOOT_TOLERANCE = T.FLOOR_MEMBER_MOTION_PROOF_FOOT_DRIFT_TOLERANCE_TILES;
const STATION_TOLERANCE = T.FLOOR_MEMBER_MOTION_PROOF_STATION_OFFSET_TOLERANCE_TILES;
const GRID_ROWS = T['FLOOR_GRID_SIZE.garage.height'];
/** The loop's largest per-frame WALKING step: one capped frame at the bounded catch-up on the fastest seeded stride (capture-capacity-proof.mjs's bound, same formula). */
const FRAME_STEP_BOUND_TILES = (CAP_MS / TICK_MS) * (1 + CATCH_UP) * STEP_PER_TICK * (1 + JITTER);
/** The most one capped frame moves a body settling AND stepping (measure-world-performance.mjs's settle-stall bound, same formula). */
const SETTLE_FRAME_BOUND_TILES = CAP_MS * (3 / SETTLE_MS + ((STEP_PER_TICK * (1 + JITTER)) * (1 + CATCH_UP)) / TICK_MS);
/** The camera's steepest scale change per tile of row — at the front row, where scale is 1. */
const SCALE_PER_TILE_MAX = (1 / BACK_SCALE - 1) / GRID_ROWS;
const SCALE_STEP_BOUND = SETTLE_FRAME_BOUND_TILES * SCALE_PER_TILE_MAX;
/** Walk frames one capped walking frame may skip: the frames that many tiles of stride cover, rounded up. */
const WALK_FRAMES = CLIP_SPECS.walk.frames;
const GAIT_MAX_SKIP = Math.ceil((FRAME_STEP_BOUND_TILES * WALK_FRAMES) / STRIDE_TILES);

const SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim() !== '';
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------
async function reachGym(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const gym = page.getByTestId('shell-open-gym');
  await gym.waitFor({ state: 'visible', timeout: 240000 });
  await gym.click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-memberid]').length > 0, undefined, { timeout: 30000 });
  await page.getByTestId('gymscreen-build-fab').waitFor({ state: 'attached', timeout: 10000 });
}

/** Start the in-page rAF sampler: one DOM read per frame into `window.__motionProofSamples`. */
async function startSampler(page) {
  await page.evaluate(() => {
    const samples = [];
    window.__motionProofSamples = samples;
    window.__motionProofLive = true;
    const boxOf = (node) => {
      const b = node.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const step = (now) => {
      const members = [...document.querySelectorAll('[data-memberid]')].map((node) => {
        const b = node.getBoundingClientRect();
        return {
          id: node.getAttribute('data-memberid'),
          lifecycle: node.getAttribute('data-lifecycle'),
          target: node.getAttribute('data-target'),
          queueRank: node.getAttribute('data-queuerank'),
          cell: node.getAttribute('data-cell'),
          tick: node.getAttribute('data-tick'),
          clip: node.getAttribute('data-clip'),
          scale: node.getAttribute('data-scale'),
          facing: node.getAttribute('data-facing'),
          frame: node.getAttribute('data-frame'),
          fx: b.x + b.width / 2,
          fy: b.y + b.height,
          w: b.width,
        };
      });
      const benches = [...document.querySelectorAll('[data-testid="floorgrid-fixed-flat-bench"], [data-testid="floorgrid-bay-expansion"]')].map((n) => ({ id: n.getAttribute('data-testid'), box: boxOf(n) }));
      samples.push({ t: now, wall: performance.now(), members, benches, traceLength: Array.isArray(window.__empireMotionTrace) ? window.__empireMotionTrace.length : null });
      if (window.__motionProofLive) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function subjectStatus(page, id) {
  return page.evaluate((id) => {
    const nodes = [...document.querySelectorAll(`[data-memberid="${id}"]`)];
    const n = nodes[0];
    return {
      count: nodes.length,
      lifecycle: n === undefined ? null : n.getAttribute('data-lifecycle'),
      clip: n === undefined ? null : n.getAttribute('data-clip'),
      tick: n === undefined ? null : n.getAttribute('data-tick'),
      samples: window.__motionProofSamples?.length ?? 0,
      traceLength: Array.isArray(window.__empireMotionTrace) ? window.__empireMotionTrace.length : null,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  }, id);
}

async function stopAndCollect(page) {
  return page.evaluate(() => {
    window.__motionProofLive = false;
    const samples = window.__motionProofSamples ?? [];
    const trace = Array.isArray(window.__empireMotionTrace) ? window.__empireMotionTrace : null;
    const grid = document.querySelector('[data-testid="floorgrid-grid"]');
    const g = grid === null ? null : grid.getBoundingClientRect();
    return { samples, trace, gridBox: g === null ? null : { x: g.x, y: g.y, w: g.width, h: g.height }, traceIsArray: trace !== null, traceType: typeof window.__empireMotionTrace };
  });
}

function pickSubject(members) {
  // The production member: one whose `data-clip` is a name in
  // MEMBER_MOTION_CLIPS and whose target is the bay; else the living-world
  // capture's rule (a seeking bay claimant, then the lowest rank), so the
  // run sees travel. Which rule chose is recorded. A clip NAME is not proof
  // of the production pipeline — VL-2's `walk` / `idle` / `wait` share
  // their names with the table — so the label says "table clip name" and
  // `transitionsLegal` (which sees VL-2's `use-bench` and its direct
  // walk→wait edges) is what tells the two apart.
  const tableClip = members.filter((m) => MOTION_CLIPS.includes(m.clip));
  const bay = (list) => list.filter((m) => m.target === BAY_TARGET);
  const seeking = (list) => list.filter((m) => m.lifecycle === 'seeking');
  for (const [rule, pool] of [
    ['table clip name, seeking the bay', seeking(bay(tableClip))],
    ['table clip name, bay claimant', bay(tableClip)],
    ['table clip name', tableClip],
    ['no table clip name drawn, seeking the bay', seeking(bay(members))],
    ['no table clip name drawn, bay claimant', bay(members)],
    ['first drawn member', members],
  ]) {
    if (pool.length > 0) return { id: pool[0].id, rule };
  }
  return { id: null, rule: 'no member drawn' };
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
const tileAt = (frontTile, scale) => frontTile * scale;
const fmt = (n, d = 3) => (n === null || n === undefined || Number.isNaN(n) ? '-' : Number(n).toFixed(d));

/** The front-row tile in px: a drawn box is DRAW_SCALE_TILES × front tile × scale. */
function frontTileFromSamples(samples) {
  for (const s of samples) {
    for (const m of s.members) {
      const scale = Number(m.scale);
      if (m.w > 0 && Number.isFinite(scale) && scale > 0) return m.w / (DRAW_SCALE_TILES * scale);
    }
  }
  return null;
}

function analyseDomIdentity(samples, subjectId) {
  let subjectMissing = 0;
  let duplicates = 0;
  const idsSeen = new Set();
  for (const s of samples) {
    const counts = new Map();
    for (const m of s.members) {
      counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
      idsSeen.add(m.id);
    }
    if ((counts.get(subjectId) ?? 0) !== 1) subjectMissing += 1;
    for (const n of counts.values()) if (n > 1) duplicates += 1;
  }
  return { samples: samples.length, subjectFramesNotExactlyOne: subjectMissing, duplicateIdFrames: duplicates, ids: [...idsSeen], ok: samples.length > 0 && subjectMissing === 0 && duplicates === 0 };
}

function analyseTickRate(samples) {
  const carried = samples.map((s) => ({ t: s.t, tick: Math.max(...s.members.map((m) => Number(m.tick)).filter(Number.isFinite), -Infinity) })).filter((s) => Number.isFinite(s.tick));
  if (carried.length < 2) return { ok: false, reason: 'fewer than two frames carried a tick' };
  const spanMs = carried[carried.length - 1].t - carried[0].t;
  const advance = carried[carried.length - 1].tick - carried[0].tick;
  const intervals = samples.slice(1).map((s, i) => s.t - samples[i].t);
  const meanFrameMs = intervals.reduce((a, b) => a + b, 0) / Math.max(intervals.length, 1);
  const measured = advance / (spanMs / 1000);
  const nominal = 1000 / TICK_MS;
  const tolerance = meanFrameMs / TICK_MS + (advance > 0 ? 1 / advance : 1);
  const deviation = Math.abs(measured - nominal) / nominal;
  return { ok: advance > 0 && deviation <= tolerance, ticksPerSecond: measured, nominal, spanMs, tickAdvance: advance, meanFrameMs, tolerance, deviation };
}

function analyseClipChanges(rows, clipOf, label) {
  // rows: per member, an ordered list of records with a clip
  const changes = [];
  const foreign = new Set();
  const illegal = [];
  for (const [id, list] of rows) {
    for (let i = 0; i < list.length; i += 1) {
      const clip = clipOf(list[i]);
      if (clip !== null && !MOTION_CLIPS.includes(clip)) foreign.add(clip);
      if (i === 0) continue;
      const prev = clipOf(list[i - 1]);
      if (prev === clip || clip === null || prev === null) continue;
      const legal = edgeAllowed(prev, clip);
      changes.push({ id, at: list[i].at, from: prev, to: clip, legal });
      if (!legal) illegal.push({ id, at: list[i].at, from: prev, to: clip });
    }
  }
  return { source: label, changes: changes.length, illegal, foreignClips: [...foreign], ok: changes.length > 0 && illegal.length === 0 && foreign.size === 0 };
}

function analyseScale(rows, scaleOf) {
  let max = 0;
  let at = null;
  let pairs = 0;
  for (const [id, list] of rows) {
    for (let i = 1; i < list.length; i += 1) {
      const a = scaleOf(list[i - 1]);
      const b = scaleOf(list[i]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      pairs += 1;
      const d = Math.abs(b - a);
      if (d > max) {
        max = d;
        at = { id, at: list[i].at, from: a, to: b, lifecycle: list[i].lifecycle };
      }
    }
  }
  return { pairs, maxStep: max, at, bound: SCALE_STEP_BOUND, ok: pairs > 0 && max <= SCALE_STEP_BOUND };
}

/** Frames where two members share a cell while one is using — reported, never judged. */
function sharedCellFrames(samples) {
  const exact = [];
  const rounded = [];
  const roundCell = (cell) => (cell === null ? null : cell.split(',').map((v) => String(Math.round(Number(v)))).join(','));
  samples.forEach((s, i) => {
    const byExact = new Map();
    const byRounded = new Map();
    for (const m of s.members) {
      (byExact.get(m.cell) ?? byExact.set(m.cell, []).get(m.cell)).push(m);
      const rc = roundCell(m.cell);
      (byRounded.get(rc) ?? byRounded.set(rc, []).get(rc)).push(m);
    }
    for (const [cell, ms] of byExact) if (ms.length > 1 && ms.some((m) => m.lifecycle === 'using')) exact.push({ frame: i, t: Number(s.t.toFixed(1)), cell, members: ms.map((m) => `${m.id}:${m.lifecycle}@tick${m.tick}`) });
    for (const [cell, ms] of byRounded) if (ms.length > 1 && ms.some((m) => m.lifecycle === 'using')) rounded.push({ frame: i, t: Number(s.t.toFixed(1)), cell, members: ms.map((m) => `${m.id}:${m.lifecycle}@tick${m.tick}`) });
  });
  return { exact, roundedOnly: rounded.filter((r) => !exact.some((e) => e.frame === r.frame && e.cell === r.cell)) };
}

// ---- trace analysis ---------------------------------------------------------

function traceShape(trace) {
  if (trace === null) return { present: false, reason: `window.${TRACE_GLOBAL} is not an array after the run (the init script set it to [])` };
  if (trace.length === 0) return { present: false, reason: `window.${TRACE_GLOBAL} is empty after the run: FloorGrid.tsx pushed no record — the runtime trace contract is absent on this tree` };
  const first = trace[0];
  const missing = TRACE_KEYS.filter((k) => !(k in first));
  if (missing.length > 0) return { present: false, reason: `window.${TRACE_GLOBAL} records lack keys: ${missing.join(', ')} (first record has ${Object.keys(first).join(', ')})` };
  return { present: true, records: trace.length };
}

function traceByMember(trace) {
  const by = new Map();
  for (const r of trace) (by.get(r.memberId) ?? by.set(r.memberId, []).get(r.memberId)).push({ ...r, at: r.now });
  for (const list of by.values()) list.sort((a, b) => a.now - b.now);
  return by;
}

function analyseTraceIdentity(trace, by) {
  const frames = [...new Set(trace.map((r) => r.now))].sort((a, b) => a - b);
  const index = new Map(frames.map((now, i) => [now, i]));
  let gaps = 0;
  let overCap = 0;
  let duplicates = 0;
  const perMember = {};
  for (const [id, list] of by) {
    const seen = new Set();
    for (const r of list) {
      if (seen.has(r.now)) duplicates += 1;
      seen.add(r.now);
      if (r.elapsedMs > CAP_MS + 1e-6) overCap += 1;
    }
    const first = index.get(list[0].now);
    const last = index.get(list[list.length - 1].now);
    const expected = last - first + 1;
    gaps += expected - seen.size;
    perMember[id] = { records: list.length, framesSpanned: expected, gaps: expected - seen.size };
  }
  return { frames: frames.length, gaps, duplicates, overCap, perMember, ok: frames.length > 0 && gaps === 0 && duplicates === 0 && overCap === 0 };
}

function analyseGait(subject) {
  const walk = subject.filter((r) => r.clip === 'walk');
  if (walk.length < 2) return { ok: null, skip: `only ${walk.length} walk record(s) for the followed member` };
  const seen = new Array(WALK_FRAMES).fill(0);
  let backwards = 0;
  let skips = 0;
  let maxSkip = 0;
  let pairs = 0;
  for (let i = 0; i < walk.length; i += 1) {
    const f = Number(walk[i].frame);
    if (Number.isInteger(f) && f >= 0 && f < WALK_FRAMES) seen[f] += 1;
    if (i === 0) continue;
    if (walk[i].now - walk[i - 1].now > CAP_MS * 4) continue; // a break in the walk, not a step within it
    const prev = Number(walk[i - 1].frame);
    const d = ((f - prev) % WALK_FRAMES + WALK_FRAMES) % WALK_FRAMES;
    pairs += 1;
    // d is 0 (hold), 1..maxSkip (advance), else either backwards or a skip.
    if (d > GAIT_MAX_SKIP && d < WALK_FRAMES - GAIT_MAX_SKIP) skips += 1;
    if (d >= WALK_FRAMES - GAIT_MAX_SKIP && d !== 0) backwards += 1;
    if (d > 0 && d <= GAIT_MAX_SKIP) maxSkip = Math.max(maxSkip, d);
  }
  const unseen = seen.map((n, i) => (n === 0 ? i : null)).filter((i) => i !== null);
  return { ok: pairs > 0 && backwards === 0 && skips === 0 && unseen.length === 0, pairs, backwards, skips, maxSkip, maxSkipAllowed: GAIT_MAX_SKIP, histogram: seen, unseen };
}

function analyseFoot(subject, frontTile) {
  if (rigMetadata === null) return { ok: null, skip: rigStatus };
  const walkFrames = rigMetadata.walk.frames;
  const stances = [];
  let current = null;
  for (const r of subject) {
    const isWalk = r.clip === 'walk';
    const meta = isWalk ? walkFrames[Number(r.frame)] : undefined;
    const foot = meta?.foot ?? null;
    if (!isWalk || foot === null) {
      if (current !== null) stances.push(current);
      current = null;
      continue;
    }
    const footKey = meta.plantedFoot ?? `${foot.x},${foot.y}`;
    const side = DRAW_SCALE_TILES * tileAt(frontTile, r.scale);
    const mirror = r.facing === 'left' ? -1 : 1;
    const worldX = r.drawnX + mirror * (foot.x - CANVAS_PX / 2) * (side / CANVAS_PX);
    const tile = tileAt(frontTile, r.scale);
    if (current !== null && current.key === footKey && r.now - current.lastNow <= CAP_MS * 4) {
      current.xs.push(worldX / tile);
      current.lastNow = r.now;
    } else {
      if (current !== null) stances.push(current);
      current = { key: footKey, xs: [worldX / tile], startNow: r.now, lastNow: r.now, tick: r.tick };
    }
  }
  if (current !== null) stances.push(current);
  const measured = stances.filter((s) => s.xs.length >= 2);
  if (measured.length === 0) return { ok: null, skip: `zero stances with two or more frames (walk records ${subject.filter((r) => r.clip === 'walk').length})` };
  const drifts = measured.map((s) => ({ startNow: s.startNow, tick: s.tick, frames: s.xs.length, driftTiles: Math.max(...s.xs) - Math.min(...s.xs) }));
  const max = Math.max(...drifts.map((d) => d.driftTiles));
  const mean = drifts.reduce((a, d) => a + d.driftTiles, 0) / drifts.length;
  return { ok: max <= FOOT_TOLERANCE, stances: drifts.length, maxDriftTiles: max, meanDriftTiles: mean, worst: drifts.find((d) => d.driftTiles === max), tolerance: FOOT_TOLERANCE };
}

function analyseFamilySnap(by, frontTile) {
  const changes = [];
  const resets = [];
  for (const [id, list] of by) {
    for (let i = 1; i < list.length; i += 1) {
      const a = list[i - 1];
      const b = list[i];
      const tile = tileAt(frontTile, b.scale);
      const moved = Math.hypot(b.drawnX - a.drawnX, b.drawnY - a.drawnY) / tile;
      if (a.clip !== b.clip) changes.push({ id, at: b.now, from: a.clip, to: b.clip, movedTiles: moved, legal: edgeAllowed(a.clip, b.clip) });
      const fa = Number(a.frame);
      const fb = Number(b.frame);
      if (fb === 0 && fa !== 0) {
        const spec = CLIP_SPECS[a.clip];
        const wrap = a.clip === b.clip && spec !== undefined && spec.loop && fa === spec.frames - 1;
        const edge = a.clip !== b.clip && edgeAllowed(a.clip, b.clip);
        if (!wrap && !edge) resets.push({ id, at: b.now, clip: b.clip, fromFrame: fa, sameClip: a.clip === b.clip });
      }
    }
  }
  const maxMove = changes.length === 0 ? 0 : Math.max(...changes.map((c) => c.movedTiles));
  return { ok: changes.length > 0 && maxMove < FRAME_STEP_BOUND_TILES && resets.length === 0, changes: changes.length, maxMoveAtChangeTiles: maxMove, bound: FRAME_STEP_BOUND_TILES, worst: changes.find((c) => c.movedTiles === maxMove) ?? null, frameResets: resets };
}

function analyseStation(subject, samples, gridBox, frontTile) {
  const press = subject.filter((r) => r.clip === 'bench-press');
  const setup = subject.filter((r) => r.clip === 'bench-setup');
  const finish = subject.filter((r) => r.clip === 'bench-finish');
  if (press.length < 2) return { ok: null, skip: `only ${press.length} bench-press record(s) for the followed member` };
  // Bench boxes in STAGE coordinates: the sampler's viewport boxes minus the grid's box.
  const benches = (samples.find((s) => s.benches.length > 0)?.benches ?? []).map((b) => ({ id: b.id, cx: b.box.x + b.box.w / 2 - (gridBox?.x ?? 0), cy: b.box.y + b.box.h / 2 - (gridBox?.y ?? 0) }));
  if (benches.length === 0) return { ok: null, skip: 'no bench box was read off the DOM' };
  const mid = press[Math.floor(press.length / 2)];
  const bench = benches.reduce((best, b) => (best === null || Math.hypot(b.cx - mid.drawnX, b.cy - mid.drawnY) < Math.hypot(best.cx - mid.drawnX, best.cy - mid.drawnY) ? b : best), null);
  const tile = tileAt(frontTile, mid.scale);
  const offset = (r) => ({ x: (r.drawnX - bench.cx) / tile, y: (r.drawnY - bench.cy) / tile });
  const offs = press.map(offset);
  const spread = Math.max(Math.max(...offs.map((o) => o.x)) - Math.min(...offs.map((o) => o.x)), Math.max(...offs.map((o) => o.y)) - Math.min(...offs.map((o) => o.y)));
  const monotone = (list, direction) => {
    let violations = 0;
    for (let i = 1; i < list.length; i += 1) {
      const a = offset(list[i - 1]);
      const b = offset(list[i]);
      const d = Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y);
      if (direction === 'shrinks' && d > STATION_TOLERANCE) violations += 1;
      if (direction === 'grows' && d < -STATION_TOLERANCE) violations += 1;
    }
    return violations;
  };
  const setupViolations = monotone(setup, 'shrinks');
  const finishViolations = monotone(finish, 'grows');
  return { ok: spread <= STATION_TOLERANCE && setupViolations === 0 && finishViolations === 0, bench: bench.id, pressFrames: press.length, offsetSpreadTiles: spread, tolerance: STATION_TOLERANCE, setupFrames: setup.length, setupViolations, finishFrames: finish.length, finishViolations };
}

function analyseFacing(subject, frontTile, meanFrameMs) {
  const N = Math.ceil(GAIT_TRANSITION_MS / Math.max(meanFrameMs, 1));
  let run = 0;
  let maxRun = 0;
  let runs = 0;
  let judged = 0;
  let flips = 0;
  let worstAt = null;
  for (let i = 1; i < subject.length; i += 1) {
    const a = subject[i - 1];
    const b = subject[i];
    if (a.facing !== b.facing) flips += 1;
    const dx = (b.drawnX - a.drawnX) / tileAt(frontTile, b.scale);
    if (Math.abs(dx) < MOTIONLESS_TILES) {
      run = 0;
      continue;
    }
    judged += 1;
    const velocityFacing = dx > 0 ? 'right' : 'left';
    if (velocityFacing !== b.facing) {
      run += 1;
      if (run === 1) runs += 1;
      if (run > maxRun) {
        maxRun = run;
        worstAt = { at: b.now, tick: b.tick, clip: b.clip, facing: b.facing, dxTiles: dx };
      }
    } else run = 0;
  }
  return { ok: judged > 0 && maxRun <= N, N, meanFrameMs, framesJudged: judged, flips, disagreementRuns: runs, longestRun: maxRun, worstAt };
}

// ---------------------------------------------------------------------------
// One viewport
// ---------------------------------------------------------------------------
async function runViewport(browser, viewport) {
  const vp = viewport.name;
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  // Contract 2: the trace sink, created empty BEFORE any page script runs.
  await context.addInitScript(`window.${TRACE_GLOBAL} = [];`);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const result = { viewport: vp, verdicts: {}, skipped: {}, frames: [], pageErrors };
  const shot = async (label) => {
    const file = `${vp}-${label}.png`;
    await page.screenshot({ path: join(OUT, file), fullPage: false });
    result.frames.push(file);
    return file;
  };

  await reachGym(page);
  result.address = page.url();
  result.verdicts.playedPath = !result.address.includes('?');
  note(`${vp} reached the gym at ${result.address} (${result.verdicts.playedPath ? 'no query string' : 'QUERY STRING PRESENT'})`);

  const initial = await page.evaluate(() =>
    [...document.querySelectorAll('[data-memberid]')].map((n) => ({ id: n.getAttribute('data-memberid'), lifecycle: n.getAttribute('data-lifecycle'), target: n.getAttribute('data-target'), queueRank: n.getAttribute('data-queuerank'), clip: n.getAttribute('data-clip') })),
  );
  const subject = pickSubject(initial);
  result.subject = subject;
  note(`${vp} following ${subject.id} (${subject.rule}); drawn: ${JSON.stringify(initial.map((m) => `${m.id}=${m.lifecycle}/${m.clip}@${m.target ?? '-'}`))}`);
  if (subject.id === null) {
    result.verdicts.identity = false;
    await page.close();
    await context.close();
    return result;
  }

  await startSampler(page);
  const t0 = Date.now();
  const lifecycles = [];
  const clipsSeen = new Set();
  let last = null;
  let n = 0;
  while (Date.now() - t0 < MAX_MS) {
    const s = await subjectStatus(page, subject.id);
    if (s.lifecycle !== null && s.lifecycle !== last) {
      n += 1;
      lifecycles.push({ t: Date.now() - t0, lifecycle: s.lifecycle, tick: s.tick });
      note(`${vp} t=${((Date.now() - t0) / 1000).toFixed(1)}s ${s.lifecycle} (clip ${s.clip}, tick ${s.tick}, ${s.samples} samples, trace ${s.traceLength ?? 'not an array'} records)`);
      // Photograph the state after its settle so the frame shows where the body ends up.
      if (s.lifecycle === 'using' || last === 'using') await page.waitForTimeout(SETTLE_MS * 3);
      await shot(`${String(n).padStart(2, '0')}-${s.lifecycle}`);
      last = s.lifecycle;
    }
    if (s.clip !== null && !clipsSeen.has(s.clip)) {
      clipsSeen.add(s.clip);
      await shot(`clip-${s.clip}`);
    }
    const order = lifecycles.map((l) => l.lifecycle);
    const cycleDone = order.includes('seeking') && order.includes('queuing') && order.includes('using') && order.includes('leaving') && order.lastIndexOf('leaving') > order.indexOf('using') && order.indexOf('using') > order.indexOf('queuing') && last !== 'leaving' && order.length > order.lastIndexOf('leaving') + 1;
    if (cycleDone) break;
    await page.waitForTimeout(250);
  }
  const collected = await stopAndCollect(page);
  const { samples, trace, gridBox } = collected;
  result.lifecycles = lifecycles;
  const order = lifecycles.map((l) => l.lifecycle);
  const iS = order.indexOf('seeking');
  const iQ = order.indexOf('queuing', Math.max(iS, 0));
  const iU = order.indexOf('using', Math.max(iQ, 0));
  const iL = order.indexOf('leaving', Math.max(iU, 0));
  result.verdicts.cycle = iS >= 0 && iQ > iS && iU > iQ && iL > iU;
  note(`${vp} lifecycle order ${order.join(' > ')} over ${((Date.now() - t0) / 1000).toFixed(1)}s: cycle seeking>queuing>using>leaving ${result.verdicts.cycle ? 'observed' : 'NOT observed'}`);

  const frontTile = frontTileFromSamples(samples);
  result.frontTilePx = frontTile;
  const meanFrameMs = samples.length > 1 ? (samples[samples.length - 1].t - samples[0].t) / (samples.length - 1) : null;

  // ---- DOM verdicts ----
  const domRows = new Map();
  for (const s of samples) for (const m of s.members) (domRows.get(m.id) ?? domRows.set(m.id, []).get(m.id)).push({ ...m, at: s.t, scaleNum: Number(m.scale) });
  const domIdentity = analyseDomIdentity(samples, subject.id);
  const tickRate = analyseTickRate(samples);
  const domClips = analyseClipChanges(domRows, (r) => r.clip, 'DOM data-clip');
  const domScale = analyseScale(domRows, (r) => r.scaleNum);
  const shared = sharedCellFrames(samples);
  result.dom = { samples: samples.length, meanFrameMs, identity: domIdentity, tickRate, clipChanges: domClips, scale: domScale };
  result.observation = { sharedCell: shared };

  // ---- trace verdicts ----
  const shape = traceShape(trace);
  result.trace = { shape, records: trace === null ? 0 : trace.length };
  let traceIdentity = null;
  let traceClips = null;
  let traceScale = null;
  let gait = null;
  let foot = null;
  let snap = null;
  let station = null;
  let facing = null;
  if (shape.present) {
    const by = traceByMember(trace);
    const subjectTrace = by.get(subject.id) ?? [];
    traceIdentity = analyseTraceIdentity(trace, by);
    traceClips = analyseClipChanges(by, (r) => r.clip, 'trace clip');
    traceScale = analyseScale(by, (r) => r.scale);
    gait = analyseGait(subjectTrace);
    foot = analyseFoot(subjectTrace, frontTile);
    snap = analyseFamilySnap(by, frontTile);
    station = analyseStation(subjectTrace, samples, gridBox, frontTile);
    facing = analyseFacing(subjectTrace, frontTile, meanFrameMs ?? TICK_MS);
    result.trace = { ...result.trace, identity: traceIdentity, clipChanges: traceClips, scale: traceScale, gait, foot, familySnap: snap, station, facing, subjectRecords: subjectTrace.length, members: [...by.keys()] };
  }

  const judge = (name, dom, tr, skipReason) => {
    // A verdict is judged on what exists: DOM-only verdicts on the DOM,
    // trace verdicts on the trace; when a trace verdict's contract is
    // absent it is SKIP with the reason, never a pass.
    if (tr === null && dom === null) {
      result.skipped[name] = skipReason;
      return;
    }
    if (tr !== null && tr.ok === null) {
      result.skipped[name] = tr.skip;
      return;
    }
    result.verdicts[name] = (dom === null || dom.ok === true) && (tr === null || tr.ok === true);
  };
  const traceSkip = shape.present ? null : shape.reason;
  judge('identity', domIdentity, traceIdentity, traceSkip);
  judge('tickRate', tickRate, null, null);
  judge('transitionsLegal', domClips, traceClips, traceSkip);
  judge('gaitCycle', null, gait, traceSkip);
  judge('walkFootPlanted', null, foot, traceSkip);
  judge('noSkate', null, foot === null ? null : { ...foot, ok: foot.ok === null ? null : foot.meanDriftTiles <= FOOT_TOLERANCE && foot.maxDriftTiles <= FOOT_TOLERANCE }, traceSkip);
  judge('noFamilySnap', null, snap, traceSkip);
  judge('stationAttached', null, station, traceSkip);
  judge('scaleContinuous', domScale, traceScale, null);
  judge('facingStable', null, facing, traceSkip);
  result.verdicts.layout = pageErrors.length === 0 && !samples.some((s) => s.overflowX);

  // ---- the numbers, each beside its derivation ----
  note(`${vp} identity DOM: ${domIdentity.samples} frames, followed id resolved to exactly one node in all but ${domIdentity.subjectFramesNotExactlyOne}, duplicate-id frames ${domIdentity.duplicateIdFrames}, ids ${domIdentity.ids.join(', ')}${traceIdentity === null ? '' : ` | TRACE: ${traceIdentity.frames} frames, gaps ${traceIdentity.gaps}, duplicate records ${traceIdentity.duplicates}, records over the ${CAP_MS} ms cap ${traceIdentity.overCap}, per member ${JSON.stringify(traceIdentity.perMember)}`}`);
  note(`${vp} tickRate ${tickRate.ok === undefined ? tickRate.reason : `${fmt(tickRate.ticksPerSecond)}/s measured (${tickRate.tickAdvance} ticks over ${fmt(tickRate.spanMs, 0)} ms) vs nominal ${fmt(tickRate.nominal)}/s = 1000/${TICK_MS}; deviation ${fmt(tickRate.deviation * 100, 2)}% vs tolerance ${fmt(tickRate.tolerance * 100, 2)}% = mean frame ${fmt(tickRate.meanFrameMs, 2)} ms / ${TICK_MS} + 1/${tickRate.tickAdvance}`}`);
  note(`${vp} transitionsLegal DOM: ${domClips.changes} clip change(s), ${domClips.illegal.length} off the table${domClips.illegal.length > 0 ? ` — first ${JSON.stringify(domClips.illegal[0])}` : ''}${domClips.foreignClips.length > 0 ? `; clip names NOT in MEMBER_MOTION_CLIPS: ${domClips.foreignClips.join(', ')} (VL-2's vocabulary, so this tree draws no production clip yet)` : ''}${traceClips === null ? '' : ` | TRACE: ${traceClips.changes} change(s), ${traceClips.illegal.length} off the table${traceClips.foreignClips.length > 0 ? `, foreign ${traceClips.foreignClips.join(', ')}` : ''}`}; edges read from memberMotionClips.ts: ${TRANSITIONS.length}`);
  note(`${vp} scaleContinuous DOM: max |Δscale| per frame ${fmt(domScale.maxStep, 4)} over ${domScale.pairs} pairs at ${JSON.stringify(domScale.at)}${traceScale === null ? '' : ` | TRACE: ${fmt(traceScale.maxStep, 4)} over ${traceScale.pairs} pairs at ${JSON.stringify(traceScale.at)}`}; bound ${fmt(SCALE_STEP_BOUND, 4)} = ${fmt(SETTLE_FRAME_BOUND_TILES)} tiles/frame × (1/${BACK_SCALE} − 1)/${GRID_ROWS} rows (settle-frame bound ${CAP_MS} × (3/${SETTLE_MS} + ${STEP_PER_TICK}×(1+${JITTER})×(1+${CATCH_UP})/${TICK_MS}))`);
  if (gait !== null) note(`${vp} gaitCycle ${gait.ok === null ? `SKIP: ${gait.skip}` : `${gait.pairs} walk pairs, backwards ${gait.backwards}, skips over ${gait.maxSkipAllowed} ${gait.skips} (max skip seen ${gait.maxSkip}; allowed = ceil(${fmt(FRAME_STEP_BOUND_TILES)} tiles × ${WALK_FRAMES} / ${STRIDE_TILES})), histogram ${JSON.stringify(gait.histogram)}, unseen ${JSON.stringify(gait.unseen)}`}`);
  if (foot !== null) note(`${vp} walkFootPlanted / noSkate ${foot.ok === null ? `SKIP: ${foot.skip}` : `${foot.stances} stance(s), max drift ${fmt(foot.maxDriftTiles, 4)} tiles, mean ${fmt(foot.meanDriftTiles, 4)}, tolerance ${FOOT_TOLERANCE} (FLOOR_MEMBER_MOTION_PROOF_FOOT_DRIFT_TOLERANCE_TILES); worst ${JSON.stringify(foot.worst)}; foot world x = drawnX + (footX − ${CANVAS_PX}/2) × (bodySide/${CANVAS_PX}), bodySide = ${DRAW_SCALE_TILES} × ${fmt(frontTile, 1)} px × scale`}`);
  if (snap !== null) note(`${vp} noFamilySnap ${snap.changes} clip change(s) across all members, max move at a change ${fmt(snap.maxMoveAtChangeTiles, 4)} tiles vs a walking frame's ${fmt(FRAME_STEP_BOUND_TILES)} = (${CAP_MS}/${TICK_MS})×(1+${CATCH_UP})×${STEP_PER_TICK}×(1+${JITTER}); worst ${JSON.stringify(snap.worst)}; frame resets off an edge or a wrap ${snap.frameResets.length}${snap.frameResets.length > 0 ? ` — first ${JSON.stringify(snap.frameResets[0])}` : ''}`);
  if (station !== null) note(`${vp} stationAttached ${station.ok === null ? `SKIP: ${station.skip}` : `${station.bench}: ${station.pressFrames} bench-press frames, offset spread ${fmt(station.offsetSpreadTiles, 4)} tiles vs ${STATION_TOLERANCE}; setup ${station.setupFrames} frames with ${station.setupViolations} growth(s) over the tolerance; finish ${station.finishFrames} frames with ${station.finishViolations} shrink(s)`}`);
  if (facing !== null) note(`${vp} facingStable ${facing.flips} facing flip(s); ${facing.framesJudged} moving frames judged, ${facing.disagreementRuns} disagreement run(s), longest ${facing.longestRun} vs N=${facing.N} = ceil(${GAIT_TRANSITION_MS} / ${fmt(facing.meanFrameMs, 2)} ms mean frame); worst ${JSON.stringify(facing.worstAt)}`);
  note(`${vp} OBSERVATION (tick-28, unjudged) shared cell while one is using: ${shared.exact.length} frame(s) exact${shared.exact.length > 0 ? ` — ticks ${[...new Set(shared.exact.flatMap((s) => s.members.map((m) => m.split('@tick')[1])))].join(',')}, first ${JSON.stringify(shared.exact[0])}` : ''}; ${shared.roundedOnly.length} more on the rounded cell only`);
  if (pageErrors.length > 0) note(`${vp} PAGE ERRORS: ${pageErrors.join(' | ')}`);

  result.samples = samples.map((s) => ({ t: Number(s.t.toFixed(1)), traceLength: s.traceLength, members: s.members.map((m) => ({ id: m.id, lifecycle: m.lifecycle, cell: m.cell, tick: m.tick, clip: m.clip, scale: m.scale, facing: m.facing, frame: m.frame, fx: Number(m.fx.toFixed(2)), fy: Number(m.fy.toFixed(2)), w: Number(m.w.toFixed(2)) })) }));
  result.traceRecords = trace === null ? null : trace.length;
  if (trace !== null && trace.length > 0) writeFileSync(join(OUT, `${vp}-trace.json`), JSON.stringify(trace));
  await page.close();
  await context.close();
  return result;
}

const VERDICT_ORDER = ['playedPath', 'cycle', 'identity', 'tickRate', 'transitionsLegal', 'gaitCycle', 'walkFootPlanted', 'noSkate', 'noFamilySnap', 'stationAttached', 'scaleContinuous', 'facingStable', 'layout'];

const browser = await chromium.launch({
  headless: true,
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let exitCode = 0;
try {
  note(`VL-3 motion proof at ${SHA}${DIRTY ? ' (DIRTY TREE)' : ''} url=${BASE_URL} — headless desktop browser in a container, NOT a phone`);
  note(`clip table: ${MOTION_CLIPS.length} clips (${MOTION_CLIPS.map((c) => `${c}:${CLIP_SPECS[c].frames}`).join(' ')}), ${TRANSITIONS.length} edges, canvas ${CANVAS_PX} px, stride ${STRIDE_TILES} tiles, production types ${PRODUCTION_TYPES.join(',')}`);
  note(`rig: ${rigStatus}`);
  note(`bounds: walking frame step ${fmt(FRAME_STEP_BOUND_TILES)} tiles, settle frame ${fmt(SETTLE_FRAME_BOUND_TILES)} tiles, scale step ${fmt(SCALE_STEP_BOUND, 4)}, gait max skip ${GAIT_MAX_SKIP} frames, foot tolerance ${FOOT_TOLERANCE} tiles, station tolerance ${STATION_TOLERANCE} tiles, grid rows ${GRID_ROWS}`);
  const results = [];
  let anyMissing = rigMetadata === null;
  for (const viewport of VIEWPORTS) {
    const result = await runViewport(browser, viewport);
    results.push(result);
    for (const k of VERDICT_ORDER) {
      if (k in result.skipped) {
        note(`${viewport.name} SKIP ${k} — ${result.skipped[k]}`);
        anyMissing = true;
        continue;
      }
      const v = result.verdicts[k];
      note(`${viewport.name} ${v === true ? 'ok  ' : 'FAIL'} ${k}`);
      if (v !== true) exitCode = 1;
    }
    if (result.pageErrors.length > 0) exitCode = 1;
  }
  if (anyMissing) {
    exitCode = 3;
    note(`MISSING CONTRACT(S): one or more verdicts were SKIPPED for want of a contract — see the SKIP lines above (rig: ${rigStatus}). Exit 3: this run is not a graded pass.`);
  }
  const summary = {
    sha: SHA,
    dirty: DIRTY,
    url: BASE_URL,
    generatedAt: new Date().toISOString(),
    harness: 'headless desktop browser in a container; not a device',
    contracts: { clipTable: 'loaded', trace: results.map((r) => r.trace?.shape ?? null), rig: rigStatus },
    tuning: { ...T, FRAME_STEP_BOUND_TILES, SETTLE_FRAME_BOUND_TILES, SCALE_STEP_BOUND, GAIT_MAX_SKIP, STRIDE_TILES, CANVAS_PX, WALK_FRAMES, TRANSITIONS },
    results,
    notes,
  };
  writeFileSync(join(OUT, 'notes.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'notes.txt'), notes.join('\n') + '\n');
  note(`wrote ${OUT}`);
} finally {
  await browser.close();
}
process.exit(exitCode);
