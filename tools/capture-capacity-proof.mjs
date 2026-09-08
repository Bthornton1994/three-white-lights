#!/usr/bin/env node
/**
 * capture-capacity-proof.mjs — VL-2B evidence: the VISIBLE capacity-1 →
 * queue → buy Capacity → capacity-2 → relief slice, on the real Play
 * surface, on one persistent page per viewport.
 *
 * Claude Code Session B's instrument (CLAUDE.md "Crossing VL-2"; the
 * capacity slice named at the end of "VL-2 DELIVERED"). It does not claim
 * Visual, Animation, Soft-Feel or Owner-Playtest PASS. It produces the
 * continuous evidence — three frames, a strip, a video and a per-frame
 * record of the purchase transition — and a set of verdicts a reader can
 * check against the record.
 *
 * THE PATH IS THE PLAYED ONE. The app is cold-launched with no query string,
 * the real GYM EMPIRE pill is pressed, the real dock is used to reach MORE
 * (for the dev clock) and to return to PLAY, and the panel is opened off the
 * bench art itself — the same control a player taps. The address bar is
 * asserted to carry no query string at the moment the gym is read, so a
 * debug fallback cannot happen silently. Two controls are pressed with a
 * synthetic `MouseEvent` on the element rather than Playwright's hit-test
 * click: the bench (members ride over it on Play with their own Pressable)
 * and the station panel's buttons (the panel sits under the dock for
 * Playwright's hit-test; `tools/verify-floor-reachability.mjs`'s `pressRnWeb`
 * measured that `force: true` does not fire `onPress` there). Both dispatch
 * the same click the app's own `onPress` receives; neither bypasses the
 * reducer.
 *
 * NEVER RELOADED BETWEEN BEFORE AND AFTER. The whole point is that the same
 * members, by contract id, are on the floor before the purchase, through
 * it, and after it — a reload would let a fresh sim stand in for continuity.
 *
 * WHAT IT DOES, per viewport:
 *
 *   1. Reach the gym; open MORE; press the +3d away dev-clock control until
 *      the HUD's Gym Bucks reach the Capacity price (read from
 *      `EMPIRE_TUNING.STATION_UPGRADE_COST_GYM_BUCKS.capacity` in source);
 *      return to PLAY.
 *   2. BEFORE: poll `[data-memberid]` until one member is `using` and at
 *      least one is `queuing`; record the id set, ranks, cells, ticks; assert
 *      `floorgrid-bay-expansion` is ABSENT (capacity 1); photograph.
 *   3. PURCHASE: open the panel off the bench; if the Capacity row is
 *      `-unavailable`, report its text and fail the purchase verdicts; else
 *      press it and, IN THE SAME PAGE TASK, start sampling every animation
 *      frame — so no frame between the press and the first sample is lost.
 *   4. TRANSITION: `requestAnimationFrame` samples for `TRANSITION_SAMPLE_MS`
 *      on the page's own clock (`performance.now()`), each frame recording
 *      every member's id, lifecycle, cell, anchor, tick, feet point (box
 *      bottom-centre) and box width. Then read the HUD, the panel's rows,
 *      photograph with the panel open, dismiss.
 *   5. AFTER: poll until the expansion bench and its sprite are attached
 *      with real boxes and DRAWN (effective opacity up the parent chain,
 *      a picture behind the node), and until two members are `using` at
 *      once; photograph; compose before|purchase|after; save the video.
 *
 * WHAT IT ASSERTS, each one a thing the run can fail:
 *
 *   playedPath        the gym was read with no query string in the address
 *                     bar — the played arm, not a debug URL.
 *   funded            Gym Bucks reached the Capacity price via the dock and
 *                     the dev clock (the price is read from source).
 *   capacityOne       BEFORE, `floorgrid-bay-expansion` is absent.
 *   beforeState       BEFORE, one member `using` and one `queuing` at once.
 *   capacityOffered   the panel's Capacity row is the purchasable control,
 *                     not `-unavailable` (whose text is reported if it is).
 *   priceCharged      the HUD dropped by exactly the price, within a
 *                     tolerance DERIVED from the HUD's own "earning N per
 *                     hour" rate over the page-clock interval between the
 *                     two reads (the clock accrues while the run reads).
 *   capacityDone      `floorgrid-station-panel-upgrade-capacity-done` present
 *                     after the press.
 *   throughputUnchanged the Throughput row is STILL the purchasable control
 *                     (not `-done`) after buying Capacity — the
 *                     "bayThroughput unchanged" witness.
 *   identity          at EVERY sampled frame the set of drawn member ids
 *                     equals the BEFORE set, with exactly one node per id —
 *                     none added, none missing, none duplicated.
 *   noTeleport        `tools/capture-living-world.mjs`'s formula, REUSED, not
 *                     re-derived: outside a settle window the feet never move
 *                     faster than `ORDINARY_TILES_PER_100MS` (sim step ÷ tick
 *                     × (1 + catch-up) × `RATE_TOLERANCE`, every factor read
 *                     from source or from that tool's text), measured over a
 *                     sliding `WINDOW_MS` window on the page clock; inside a
 *                     settle window (`FLOOR_MEMBER_SETTLE_MS` after a
 *                     lifecycle edge into or out of `using`) the displacement
 *                     beyond that interval's walking allowance is bounded by
 *                     `SETTLE_TILES`. The ghost member — `using` before the
 *                     press and relocated by the sim to a new seat — has no
 *                     lifecycle edge, so its whole move is judged against the
 *                     ORDINARY ceiling: a glide at walking speed passes, a
 *                     one-tick slide or a snap does not. Observed maxima and
 *                     the ceiling are recorded either way.
 *                     WHY A WINDOW AND NOT A SINGLE FRAME: the ceiling's
 *                     tolerance was derived for ~100 ms intervals ("six or
 *                     seven 16.7 ms frames"). Measured on this tree, a member
 *                     that was only WALKING read 0.58 tiles per 100 ms at
 *                     single-frame grain against a 0.405 ceiling — the
 *                     renderer's frame loop and this sampler race for order
 *                     within a frame, so one interval can carry two frames
 *                     of playback and the next none. A per-frame verdict at
 *                     this ceiling would therefore fail ordinary walking,
 *                     which is a stricter formula, not the same one. The
 *                     per-frame maxima are RECORDED as numbers, not judged.
 *   secondBenchVisible AFTER, `floorgrid-bay-expansion` and its sprite are
 *                     attached, have non-empty boxes inside the viewport,
 *                     effective opacity above zero up the parent chain, and a
 *                     picture behind the sprite — drawn, not merely mounted.
 *   twoUsing          two members `using` at the same sampled moment.
 *   sameIds           the AFTER id set equals the BEFORE id set.
 *   queueHeadTookSeat the member with `data-queuerank` 0 at the press is one
 *                     of the two `using` members when twoUsing first holds.
 *   queueShortened    QUEUE PRESSURE — the number of members holding a
 *                     `data-queuerank` (queuing, or approaching with a rank;
 *                     the contract's `queueRank`) — at the AFTER read is
 *                     below the number at the press. Read at the settled
 *                     AFTER state rather than at the first two-using frame,
 *                     because a member mid-walk toward the queue is counted
 *                     by its rank whichever tick the sample lands on; the
 *                     `queuing`-only counts at both instants are recorded
 *                     beside it as numbers, not judged.
 *   layout            no horizontal overflow, no uncaught page error.
 *
 * OBSERVATIONS (recorded, never judged): every sampled frame in which two
 * members carry the same `data-cell` while one of them is `using` — the
 * pure-sim probe saw a seeking member standing on an occupied seat cell for
 * a few ticks after the upgrade — with the ticks and ids; the ghost's
 * relocation (from-cell, to-cell, the tick it landed, its per-frame trace,
 * and BOTH its net displacement start-to-end and its peak excursion from
 * the start — on the pre-glide tree those read 0 and 2.0 tiles: the body
 * left the bench and came back, which "net 0" alone would have called
 * standing still); the frame and tick at which the second bench first
 * appeared and at which two members were first `using`.
 *
 * Usage: node tools/capture-capacity-proof.mjs [--url http://localhost:8081]
 *          [--out <dir>] [--transition-ms 2500] [--after-budget-ms 60000]
 *          [--no-video]
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { numberInBlock, numberInSource, parserSelfTest } from './readTuning.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] !== undefined ? process.argv[idx + 1] : fallback;
}

const URL = arg('--url', 'http://localhost:8081');
const OUT = arg('--out', join(ROOT, 'docs', 'design', 'living-gym-world', 'vl-2b'));
/**
 * How long the purchase transition is sampled frame by frame. The sim
 * relocates the ghost on its first post-purchase tick and the renderer plays
 * `FLOOR_MEMBER_RENDER_DELAY_TICKS` behind, so the move lands within a few
 * ticks; a glide at one `FLOOR_MEMBER_SETTLE_MS` per tile across the ~3-4
 * tile relocation the sim produces on the garage takes ~1.1-1.4 s. 2.5 s
 * holds both with margin and is a flag, not a fact about the app.
 */
const TRANSITION_SAMPLE_MS = Number(arg('--transition-ms', '2500'));
const AFTER_BUDGET_MS = Number(arg('--after-budget-ms', '60000'));
const BEFORE_BUDGET_MS = Number(arg('--before-budget-ms', '60000'));
const RECORD_VIDEO = !process.argv.includes('--no-video');
/**
 * The sliding window a rate is measured over, in ms: the unit the ceiling
 * is expressed in ("tiles per 100 ms") and the sampling grain
 * `capture-living-world.mjs` derived its tolerance for. Not a game value.
 */
const WINDOW_MS = 100;
/** The dev-clock control pressed to earn: +3 days away, the largest step `LADDER_DEV_TIME_STEPS_SECONDS` offers. */
const ADVANCE_TEST_ID = 'gymscreen-advance-offline-259200';
/** A bound on dev-clock presses so a HUD that never moves cannot loop forever; one press earned ~2× the price when measured. */
const MAX_ADVANCE_PRESSES = 8;
const CAPACITY_ROW = 'floorgrid-station-panel-upgrade-capacity';
const THROUGHPUT_ROW = 'floorgrid-station-panel-upgrade-throughput';

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
// an empty list is the pass. A reader that has stopped matching answers
// `null`, and a `null` treated as a value is a check that asks nothing.
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
const CATCH_UP_RATE = numberInSource(tuningSource, 'FLOOR_MEMBER_CATCH_UP_RATE');
const RENDER_DELAY_TICKS = numberInSource(tuningSource, 'FLOOR_MEMBER_RENDER_DELAY_TICKS');
// The price is a key INSIDE a block; `numberInSource` would answer with the
// first `capacity:` anywhere in the file, which is the wrong question.
const CAPACITY_PRICE = numberInBlock(tuningSource, 'STATION_UPGRADE_COST_GYM_BUCKS', 'capacity');
const missing = Object.entries({
  FLOOR_MEMBER_DRAW_SCALE_TILES: DRAW_SCALE_TILES,
  FLOOR_MEMBER_SETTLE_MS: SETTLE_MS,
  FLOOR_SIM_TICK_INTERVAL_MS: TICK_MS,
  FLOOR_SIM_STEP_PROGRESS_PER_TICK: STEP_PER_TICK,
  FLOOR_MEMBER_CATCH_UP_RATE: CATCH_UP_RATE,
  FLOOR_MEMBER_RENDER_DELAY_TICKS: RENDER_DELAY_TICKS,
  'STATION_UPGRADE_COST_GYM_BUCKS.capacity': CAPACITY_PRICE,
})
  .filter(([, v]) => v === null)
  .map(([k]) => k);
if (missing.length > 0) {
  console.error(`not found in empireTuning.ts: ${missing.join(', ')}`);
  process.exit(2);
}

/**
 * The two constants of the sibling's formula that live in THAT tool rather
 * than in source, read out of its text so the two cannot drift: a ceiling
 * restated by hand here would be the "same fact typed twice" that
 * `readTuning.mjs`'s header exists to refuse.
 */
const siblingSource = readFileSync(join(ROOT, 'tools', 'capture-living-world.mjs'), 'utf8');
function constNumberInTool(source, name) {
  const found = new RegExp(`\\bconst ${name} = (-?[0-9]+(?:\\.[0-9]+)?);`).exec(source);
  return found === null ? null : Number(found[1]);
}
const RATE_TOLERANCE = constNumberInTool(siblingSource, 'RATE_TOLERANCE');
const SETTLE_TILES = constNumberInTool(siblingSource, 'SETTLE_TILES');
if (RATE_TOLERANCE === null || SETTLE_TILES === null) {
  console.error('RATE_TOLERANCE / SETTLE_TILES not found in tools/capture-living-world.mjs');
  process.exit(2);
}
/** The sibling's ceiling, its formula verbatim: sim rate × bounded catch-up × sampling tolerance. */
const ORDINARY_TILES_PER_100MS = (STEP_PER_TICK / TICK_MS) * 100 * (1 + CATCH_UP_RATE) * RATE_TOLERANCE;
/** The sim's own walking rate, for the reader: what a glide "at walking speed" should read. */
const WALK_TILES_PER_100MS = (STEP_PER_TICK / TICK_MS) * 100;
/** The settle's per-tile pace, for the reader: one `FLOOR_MEMBER_SETTLE_MS` per tile of pull. */
const SETTLE_TILES_PER_100MS = 100 / SETTLE_MS;

const SHA = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain --untracked-files=no', { cwd: ROOT }).toString().trim() !== '';

mkdirSync(OUT, { recursive: true });
const VIDEO_TMP = join(OUT, '.video-tmp');
mkdirSync(VIDEO_TMP, { recursive: true });

/** The HUD's number, parsed as a float — never digit-stripped (the clock credits fractions). */
function numberInText(text, pattern) {
  if (text === null) return null;
  const found = pattern.exec(text);
  return found === null ? null : Number(found[1]);
}

async function textOf(page, testId) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    return node === null ? null : node.textContent;
  }, testId);
}

async function countOf(page, testId) {
  return page.evaluate((id) => document.querySelectorAll(`[data-testid="${id}"]`).length, testId);
}

/** The HUD's Gym Bucks and the page clock at the same read. */
async function readBucks(page) {
  const read = await page.evaluate(() => {
    const node = document.querySelector('[data-testid="gymscreen-gym-bucks"]');
    const rate = document.querySelector('[data-testid="gymscreen-rate"]');
    return { text: node === null ? null : node.textContent, rateText: rate === null ? null : rate.textContent, at: performance.now() };
  });
  return {
    text: read.text,
    value: numberInText(read.text, /gym bucks: ([\d.]+)/),
    ratePerHour: numberInText(read.rateText, /earning ([\d.]+) gym bucks per hour/),
    at: read.at,
  };
}

/**
 * The click RN-web's Pressable answers, dispatched on the element itself —
 * `tools/verify-floor-reachability.mjs`'s `pressRnWeb`, for controls
 * Playwright's hit-test cannot reach (the panel under the dock) or would
 * reach through a member's own Pressable (the bench on Play).
 */
async function syntheticClick(page, testId) {
  return page.evaluate((id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (node === null) return false;
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: false, view: window }));
    return true;
  }, testId);
}

/** Every drawn member, from one DOM pass, with the page clock of the read. */
async function membersSnapshot(page) {
  return page.evaluate(() => {
    const members = [...document.querySelectorAll('[data-memberid]')].map((node) => {
      const b = node.getBoundingClientRect();
      return {
        id: node.getAttribute('data-memberid'),
        lifecycle: node.getAttribute('data-lifecycle'),
        queueRank: node.getAttribute('data-queuerank'),
        cell: node.getAttribute('data-cell'),
        anchor: node.getAttribute('data-anchor'),
        tick: node.getAttribute('data-tick'),
        scale: node.getAttribute('data-scale'),
        clip: node.getAttribute('data-clip'),
        box: { x: b.x, y: b.y, w: b.width, h: b.height },
      };
    });
    const boxOf = (node) => {
      if (!node) return null;
      const b = node.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    return {
      readAt: performance.now(),
      members,
      expansionCount: document.querySelectorAll('[data-testid="floorgrid-bay-expansion"]').length,
      benchBox: boxOf(document.querySelector('[data-testid="floorgrid-fixed-flat-bench"]')),
      gridBox: boxOf(document.querySelector('[data-testid="floorgrid-grid"]')),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

/** Wait, on a budget, until `predicate(snapshot)` holds; returns the snapshot that satisfied it or null. */
async function pollMembers(page, predicate, budgetMs, everyMs = 50) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < budgetMs) {
    last = await membersSnapshot(page);
    if (predicate(last)) return last;
    await page.waitForTimeout(everyMs);
  }
  return null;
}

/**
 * The second bench, read as DRAWN rather than mounted: box, effective
 * opacity up the parent chain, and the picture behind the sprite (RN-web
 * draws an `Image` as a div with the picture as a background and an
 * accessibility `<img>` inside at opacity 0, so the img's src names the
 * picture and the opacity that matters is the node's own chain).
 */
async function expansionRead(page) {
  return page.evaluate(() => {
    const effectiveOpacity = (node) => {
      let opacity = 1;
      let at = node;
      while (at !== null && at !== document.body) {
        opacity *= Number(getComputedStyle(at).opacity);
        at = at.parentElement;
      }
      return opacity;
    };
    const boxOf = (node) => {
      if (!node) return null;
      const b = node.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const bay = document.querySelector('[data-testid="floorgrid-bay-expansion"]');
    const sprite = document.querySelector('[data-testid="floorgrid-bay-expansion-sprite"]');
    const img = sprite === null ? null : sprite.querySelector('img');
    let background = null;
    if (sprite !== null) {
      for (const el of [sprite, ...sprite.querySelectorAll('*')]) {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          background = bg;
          break;
        }
      }
    }
    return {
      readAt: performance.now(),
      bay: bay === null ? null : { box: boxOf(bay), opacity: effectiveOpacity(bay) },
      sprite:
        sprite === null
          ? null
          : {
              box: boxOf(sprite),
              opacity: effectiveOpacity(sprite),
              src: img === null ? null : img.getAttribute('src'),
              background,
            },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      usingIds: [...document.querySelectorAll('[data-memberid]')]
        .filter((n) => n.getAttribute('data-lifecycle') === 'using')
        .map((n) => n.getAttribute('data-memberid')),
    };
  });
}

function expansionDrawn(read) {
  const realBox = (b) => b !== null && b.w > 0 && b.h > 0 && b.x >= 0 && b.y >= 0 && b.x + b.w <= read.viewport.w && b.y + b.h <= read.viewport.h;
  return (
    read.bay !== null &&
    read.sprite !== null &&
    realBox(read.bay.box) &&
    realBox(read.sprite.box) &&
    read.bay.opacity > 0 &&
    read.sprite.opacity > 0 &&
    (read.sprite.src !== null || read.sprite.background !== null)
  );
}

/**
 * Press the Capacity row and sample every animation frame from that moment,
 * all inside ONE page task so no frame between the press and the first
 * sample is lost. Times are the page's `performance.now()` relative to the
 * press. Each frame carries every member plus whether the expansion node is
 * attached and the HUD's Gym Bucks text, so the frame at which the purchase
 * landed can be read off the record.
 */
async function pressAndSample(page, pressTestId, sampleMs) {
  return page.evaluate(
    async ({ pressTestId, sampleMs }) => {
      const readMembers = () =>
        [...document.querySelectorAll('[data-memberid]')].map((node) => {
          const b = node.getBoundingClientRect();
          return {
            id: node.getAttribute('data-memberid'),
            lifecycle: node.getAttribute('data-lifecycle'),
            queueRank: node.getAttribute('data-queuerank'),
            cell: node.getAttribute('data-cell'),
            anchor: node.getAttribute('data-anchor'),
            tick: node.getAttribute('data-tick'),
            clip: node.getAttribute('data-clip'),
            scale: node.getAttribute('data-scale'),
            // The feet: bottom-centre of the drawn box, the point the
            // renderer's timeline moves. The box's corner also moves when
            // the depth scale changes, which reads as extra speed.
            fx: b.x + b.width / 2,
            fy: b.y + b.height,
            w: b.width,
          };
        });
      const bucksText = () => {
        const n = document.querySelector('[data-testid="gymscreen-gym-bucks"]');
        return n === null ? null : n.textContent;
      };
      const target = document.querySelector(`[data-testid="${pressTestId}"]`);
      if (target === null) return { pressed: false };
      const pre = readMembers();
      const preBucks = bucksText();
      const pressAt = performance.now();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: false, view: window }));
      const frames = [];
      await new Promise((resolve) => {
        const step = () => {
          const now = performance.now();
          frames.push({
            t: now - pressAt,
            members: readMembers(),
            expansion: document.querySelectorAll('[data-testid="floorgrid-bay-expansion"]').length,
            bucks: bucksText(),
          });
          if (now - pressAt < sampleMs) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
      return { pressed: true, pressAt, pre, preBucks, frames, endAt: performance.now() };
    },
    { pressTestId, sampleMs },
  );
}

/**
 * The sibling's motion measurement, applied per member over the frame
 * record. Rates are over a sliding `WINDOW_MS` window (the nearest earlier
 * frame at least that far back); per-frame steps are recorded as numbers.
 * The tile a step is measured in is the body's own box at the END of the
 * interval over `FLOOR_MEMBER_DRAW_SCALE_TILES` — the tile at that body's
 * depth, as `capture-living-world.mjs` reads it.
 */
function analyseMotion(frames) {
  const byId = new Map();
  for (let i = 0; i < frames.length; i += 1) {
    for (const m of frames[i].members) {
      if (!byId.has(m.id)) byId.set(m.id, []);
      byId.get(m.id).push({ t: frames[i].t, frame: i, ...m });
    }
  }
  const perMember = {};
  for (const [id, trace] of byId) {
    const r = {
      id,
      lifecycles: [...new Set(trace.map((s) => s.lifecycle))],
      cells: [],
      maxFrameStepTiles: 0,
      maxFrameStepAt: null,
      maxFrameRateTilesPer100ms: 0,
      maxWindowRateTilesPer100ms: 0,
      maxWindowRateAt: null,
      maxSettleExcessTiles: 0,
      maxSettleRawTiles: 0,
      settleEdges: [],
      // Where the feet ENDED relative to where they started, and the
      // FURTHEST they were from the start at any frame. The two differ when
      // a body leaves and comes back: on the pre-glide tree the ghost's net
      // displacement read 0 while its excursion read 2 tiles, and a record
      // that reported only the first would have called an out-and-back
      // whoosh "did not move".
      netDisplacementTiles: 0,
      maxExcursionTiles: 0,
      maxExcursionAt: null,
      firstMoveT: null,
      lastMoveT: null,
    };
    let lastCell = null;
    for (const s of trace) {
      if (s.cell !== lastCell) {
        r.cells.push({ t: Number(s.t.toFixed(1)), tick: s.tick, cell: s.cell, lifecycle: s.lifecycle });
        lastCell = s.cell;
      }
    }
    let settleUntil = -Infinity;
    let settleFrom = null;
    for (let k = 1; k < trace.length; k += 1) {
      const here = trace[k];
      const prev = trace[k - 1];
      const tilePx = here.w / DRAW_SCALE_TILES;
      const dt = Math.max(here.t - prev.t, 1);
      const step = Math.max(Math.abs(here.fx - prev.fx), Math.abs(here.fy - prev.fy)) / tilePx;
      if (step > r.maxFrameStepTiles) {
        r.maxFrameStepTiles = step;
        r.maxFrameStepAt = { t: Number(here.t.toFixed(1)), dtMs: Number(dt.toFixed(1)), tick: here.tick, fromCell: prev.cell, toCell: here.cell, lifecycle: here.lifecycle };
      }
      r.maxFrameRateTilesPer100ms = Math.max(r.maxFrameRateTilesPer100ms, step / (dt / 100));
      // A step of at least a hundredth of a tile is movement; below that is
      // sub-pixel jitter at the sizes drawn here.
      if (step >= 0.01) {
        if (r.firstMoveT === null) r.firstMoveT = Number(here.t.toFixed(1));
        r.lastMoveT = Number(here.t.toFixed(1));
      }
      const settleEdge = prev.lifecycle !== here.lifecycle && (here.lifecycle === 'using' || prev.lifecycle === 'using');
      if (settleEdge) {
        settleUntil = here.t + SETTLE_MS;
        settleFrom = prev;
        r.settleEdges.push({ t: Number(here.t.toFixed(1)), tick: here.tick, from: prev.lifecycle, to: here.lifecycle });
      }
      // The window: the nearest earlier frame at least WINDOW_MS back.
      let j = k - 1;
      while (j > 0 && here.t - trace[j].t < WINDOW_MS) j -= 1;
      const from = trace[j];
      if (here.t - from.t < WINDOW_MS * 0.5) continue; // too early in the record to hold a window
      const wdt = here.t - from.t;
      const wstep = Math.max(Math.abs(here.fx - from.fx), Math.abs(here.fy - from.fy)) / tilePx;
      const inSettle = (here.t <= settleUntil || from.t <= settleUntil) && settleFrom !== null;
      if (inSettle) {
        const settled = Math.hypot(here.fx - settleFrom.fx, here.fy - settleFrom.fy) / tilePx;
        const walkAllowance = (ORDINARY_TILES_PER_100MS * wdt) / 100;
        r.maxSettleRawTiles = Math.max(r.maxSettleRawTiles, settled);
        r.maxSettleExcessTiles = Math.max(r.maxSettleExcessTiles, Math.max(0, settled - walkAllowance));
      } else {
        const rate = wstep / (wdt / 100);
        if (rate > r.maxWindowRateTilesPer100ms) {
          r.maxWindowRateTilesPer100ms = rate;
          r.maxWindowRateAt = { t: Number(here.t.toFixed(1)), windowMs: Number(wdt.toFixed(1)), tick: here.tick, fromCell: from.cell, toCell: here.cell, lifecycle: here.lifecycle };
        }
      }
    }
    const first = trace[0];
    const last = trace[trace.length - 1];
    r.netDisplacementTiles = Math.hypot(last.fx - first.fx, last.fy - first.fy) / (last.w / DRAW_SCALE_TILES);
    for (const s of trace) {
      const excursion = Math.hypot(s.fx - first.fx, s.fy - first.fy) / (s.w / DRAW_SCALE_TILES);
      if (excursion > r.maxExcursionTiles) {
        r.maxExcursionTiles = excursion;
        r.maxExcursionAt = { t: Number(s.t.toFixed(1)), tick: s.tick, cell: s.cell, lifecycle: s.lifecycle };
      }
    }
    r.withinOrdinaryCeiling = r.maxWindowRateTilesPer100ms <= ORDINARY_TILES_PER_100MS;
    r.withinSettleBound = r.maxSettleExcessTiles <= SETTLE_TILES;
    perMember[id] = r;
  }
  return perMember;
}

/** Frames where two members share a `data-cell` and one of them is `using` — reported, not judged. */
function sharedCellFrames(frames) {
  const exact = [];
  const rounded = [];
  const roundCell = (cell) => (cell === null ? null : cell.split(',').map((v) => String(Math.round(Number(v)))).join(','));
  for (let i = 0; i < frames.length; i += 1) {
    const f = frames[i];
    const byExact = new Map();
    const byRounded = new Map();
    for (const m of f.members) {
      if (!byExact.has(m.cell)) byExact.set(m.cell, []);
      byExact.get(m.cell).push(m);
      const rc = roundCell(m.cell);
      if (!byRounded.has(rc)) byRounded.set(rc, []);
      byRounded.get(rc).push(m);
    }
    for (const [cell, ms] of byExact) {
      if (ms.length > 1 && ms.some((m) => m.lifecycle === 'using')) {
        exact.push({ frame: i, t: Number(f.t.toFixed(1)), cell, members: ms.map((m) => `${m.id}:${m.lifecycle}@tick${m.tick}`) });
      }
    }
    for (const [cell, ms] of byRounded) {
      if (ms.length > 1 && ms.some((m) => m.lifecycle === 'using')) {
        rounded.push({ frame: i, t: Number(f.t.toFixed(1)), cell, members: ms.map((m) => `${m.id}:${m.lifecycle}@tick${m.tick}`) });
      }
    }
  }
  return { exact, rounded };
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

const idCensus = (members) => {
  const counts = new Map();
  for (const m of members) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
  return counts;
};
const sameIdSet = (counts, ids) => counts.size === ids.length && ids.every((id) => counts.get(id) === 1);

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
    verdicts: {},
    observations: {},
    price: CAPACITY_PRICE,
    ceilingTilesPer100ms: ORDINARY_TILES_PER_100MS,
    walkTilesPer100ms: WALK_TILES_PER_100MS,
    settleTilesPer100ms: SETTLE_TILES_PER_100MS,
    settleTiles: SETTLE_TILES,
    frames: [],
    pageErrors,
  };
  const frameFiles = [];
  const shot = async (label) => {
    const path = join(OUT, `${vp}-${label}.png`);
    await page.screenshot({ path, fullPage: false });
    result.frames.push(`${vp}-${label}.png`);
    return path;
  };

  // ---- reach the gym the way a player does --------------------------------
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const gymPill = page.getByTestId('shell-open-gym');
  await gymPill.waitFor({ state: 'visible', timeout: 240000 });
  await gymPill.click({ timeout: 15000 });
  await page.getByTestId('gymscreen-root').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-memberid]').length > 0, undefined, { timeout: 30000 });
  const address = page.url();
  result.address = address;
  result.verdicts.playedPath = !address.includes('?');
  note(`${vp} reached the gym at ${address} (${result.verdicts.playedPath ? 'no query string' : 'QUERY STRING PRESENT'})`);

  // ---- 1. earn the price via the dock and the dev clock -------------------
  await page.getByTestId('gymscreen-surface-more').click({ timeout: 10000 });
  await page.getByTestId('gymscreen-more-drawer').waitFor({ state: 'visible', timeout: 10000 });
  const advance = page.getByTestId(ADVANCE_TEST_ID);
  const advanceCount = await advance.count();
  let presses = 0;
  let bucks = await readBucks(page);
  const bucksAtStart = bucks.value;
  if (advanceCount === 0) {
    note(`${vp} the dev-clock control ${ADVANCE_TEST_ID} is not on the MORE surface — cannot earn`);
  } else {
    while (bucks.value !== null && bucks.value < CAPACITY_PRICE && presses < MAX_ADVANCE_PRESSES) {
      await advance.click({ timeout: 10000 });
      presses += 1;
      // The HUD re-renders on the reducer's next commit; poll it rather than sleep.
      const before = bucks.value;
      await page.waitForFunction(
        ({ before }) => {
          const n = document.querySelector('[data-testid="gymscreen-gym-bucks"]');
          const m = n === null ? null : /gym bucks: ([\d.]+)/.exec(n.textContent);
          return m !== null && Number(m[1]) !== before;
        },
        { before },
        { timeout: 5000 },
      ).catch(() => {});
      bucks = await readBucks(page);
    }
  }
  result.verdicts.funded = bucks.value !== null && bucks.value >= CAPACITY_PRICE;
  result.earned = { start: bucksAtStart, after: bucks.value, presses, ratePerHour: bucks.ratePerHour };
  note(`${vp} gym bucks ${bucksAtStart} -> ${bucks.value} after ${presses} press(es) of ${ADVANCE_TEST_ID}; price ${CAPACITY_PRICE}; HUD rate ${bucks.ratePerHour}/h`);
  await page.getByTestId('gymscreen-surface-play').click({ timeout: 10000 });
  // The BUILD FAB is drawn only on Play — the surface's own tell.
  await page.getByTestId('gymscreen-build-fab').waitFor({ state: 'attached', timeout: 10000 });

  // ---- 2. BEFORE: one using, one queuing, capacity 1 ----------------------
  const before = await pollMembers(
    page,
    (s) => s.members.some((m) => m.lifecycle === 'using') && s.members.some((m) => m.lifecycle === 'queuing'),
    BEFORE_BUDGET_MS,
  );
  if (before === null) {
    note(`${vp} BEFORE never held within ${BEFORE_BUDGET_MS} ms: no moment with one member using and one queuing`);
    result.verdicts.beforeState = false;
    result.verdicts.capacityOne = false;
  } else {
    result.verdicts.beforeState = true;
    result.verdicts.capacityOne = before.expansionCount === 0;
    result.before = {
      readAt: before.readAt,
      members: before.members.map((m) => ({ id: m.id, lifecycle: m.lifecycle, queueRank: m.queueRank, cell: m.cell, tick: m.tick, box: m.box })),
      ids: before.members.map((m) => m.id).sort(),
      usingIds: before.members.filter((m) => m.lifecycle === 'using').map((m) => m.id),
      queuingIds: before.members.filter((m) => m.lifecycle === 'queuing').map((m) => m.id),
      queueHead: before.members.find((m) => m.queueRank === '0')?.id ?? null,
      benchBox: before.benchBox,
      gridBox: before.gridBox,
      expansionCount: before.expansionCount,
    };
    note(
      `${vp} BEFORE tick ${before.members[0]?.tick}: ${before.members.map((m) => `${m.id}=${m.lifecycle}${m.queueRank !== null ? `(q${m.queueRank})` : ''}@${m.cell}`).join(' ')} — expansion nodes ${before.expansionCount}, bench box ${JSON.stringify(before.benchBox)}`,
    );
    frameFiles.push({ path: await shot('before'), label: 'before: capacity 1, one using, one queuing' });
  }

  // ---- 3+4. open the panel off the bench; press Capacity; sample frames --
  let transition = null;
  let panelState = null;
  const benchPressed = await syntheticClick(page, 'floorgrid-fixed-flat-bench');
  const panelOpen = benchPressed && (await page.getByTestId('floorgrid-station-panel').waitFor({ state: 'attached', timeout: 10000 }).then(() => true).catch(() => false));
  if (!panelOpen) {
    note(`${vp} the station panel did not open off floorgrid-fixed-flat-bench (bench found: ${benchPressed})`);
    result.verdicts.capacityOffered = false;
  } else {
    const rows = {
      capacity: await countOf(page, CAPACITY_ROW),
      capacityUnavailable: await countOf(page, `${CAPACITY_ROW}-unavailable`),
      capacityDone: await countOf(page, `${CAPACITY_ROW}-done`),
      throughput: await countOf(page, THROUGHPUT_ROW),
      throughputDone: await countOf(page, `${THROUGHPUT_ROW}-done`),
    };
    panelState = { beforePress: rows, capacityRowText: await textOf(page, CAPACITY_ROW) };
    result.verdicts.capacityOffered = rows.capacity === 1 && rows.capacityUnavailable === 0 && rows.capacityDone === 0;
    if (!result.verdicts.capacityOffered) {
      const why = (await textOf(page, `${CAPACITY_ROW}-unavailable`)) ?? (await textOf(page, `${CAPACITY_ROW}-done`)) ?? '(row absent)';
      note(`${vp} Capacity is NOT purchasable: "${why}" — rows ${JSON.stringify(rows)}`);
    } else {
      note(`${vp} panel open: Capacity row "${panelState.capacityRowText}"; throughput purchasable ${rows.throughput === 1}`);
      const bucksBefore = await readBucks(page);
      transition = await pressAndSample(page, CAPACITY_ROW, TRANSITION_SAMPLE_MS);
      const bucksAfter = await readBucks(page);
      const rowsAfter = {
        capacity: await countOf(page, CAPACITY_ROW),
        capacityDone: await countOf(page, `${CAPACITY_ROW}-done`),
        throughput: await countOf(page, THROUGHPUT_ROW),
        throughputDone: await countOf(page, `${THROUGHPUT_ROW}-done`),
      };
      panelState.afterPress = rowsAfter;
      panelState.capacityDoneText = await textOf(page, `${CAPACITY_ROW}-done`);
      panelState.throughputRowText = await textOf(page, THROUGHPUT_ROW);
      // The clock accrues while the run reads: allow what the HUD's own
      // rate could have credited over the page-clock interval between the
      // two reads, doubled for the read landing either side of a commit,
      // plus the HUD's display rounding.
      const elapsedS = (bucksAfter.at - bucksBefore.at) / 1000;
      const accrual = ((bucksBefore.ratePerHour ?? 0) / 3600) * elapsedS;
      const tolerance = accrual * 2 + 0.01;
      const drop = bucksBefore.value !== null && bucksAfter.value !== null ? bucksBefore.value - bucksAfter.value : null;
      result.purchase = {
        bucksBefore: bucksBefore.value,
        bucksAfter: bucksAfter.value,
        drop,
        price: CAPACITY_PRICE,
        elapsedS: Number(elapsedS.toFixed(3)),
        tolerance: Number(tolerance.toFixed(4)),
        pressed: transition.pressed,
        preBucksText: transition.preBucksText,
      };
      result.verdicts.priceCharged = drop !== null && Math.abs(drop - CAPACITY_PRICE) <= tolerance;
      result.verdicts.capacityDone = rowsAfter.capacityDone === 1 && rowsAfter.capacity === 0;
      result.verdicts.throughputUnchanged = rowsAfter.throughput === 1 && rowsAfter.throughputDone === 0;
      note(
        `${vp} pressed Capacity: gym bucks ${bucksBefore.value} -> ${bucksAfter.value} (drop ${drop === null ? '-' : drop.toFixed(3)}, price ${CAPACITY_PRICE}, tolerance ${tolerance.toFixed(4)} over ${elapsedS.toFixed(2)} s at ${bucksBefore.ratePerHour}/h); rows after ${JSON.stringify(rowsAfter)}; done row "${panelState.capacityDoneText}"; throughput row "${panelState.throughputRowText}"`,
      );
      frameFiles.push({ path: await shot('purchase'), label: `purchase: -${CAPACITY_PRICE}, panel open, capacity done` });
    }
    await syntheticClick(page, 'floorgrid-station-panel-dismiss');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="floorgrid-station-panel"]').length === 0, undefined, { timeout: 5000 }).catch(() => {});
  }
  result.panel = panelState;

  // ---- 4. the transition record ------------------------------------------
  let firstTwoUsing = null;
  if (transition !== null && transition.pressed && result.before !== undefined) {
    const frames = transition.frames;
    const beforeIds = result.before.ids;
    const identityBreaks = [];
    for (let i = 0; i < frames.length; i += 1) {
      const census = idCensus(frames[i].members);
      if (!sameIdSet(census, beforeIds)) {
        identityBreaks.push({ frame: i, t: Number(frames[i].t.toFixed(1)), ids: [...census.entries()].map(([id, n]) => `${id}x${n}`) });
      }
    }
    const motion = analyseMotion(frames);
    const shared = sharedCellFrames(frames);
    const dts = frames.slice(1).map((f, i) => f.t - frames[i].t);
    const ghostId = result.before.usingIds[0] ?? null;
    const ghost = ghostId === null ? null : motion[ghostId] ?? null;
    const purchaseFrame = frames.findIndex((f) => f.bucks !== transition.preBucksText);
    const expansionFrame = frames.findIndex((f) => f.expansion > 0);
    const twoUsingFrame = frames.findIndex((f) => f.members.filter((m) => m.lifecycle === 'using').length >= 2);
    if (twoUsingFrame >= 0) {
      const f = frames[twoUsingFrame];
      firstTwoUsing = {
        source: 'transition',
        frame: twoUsingFrame,
        t: Number(f.t.toFixed(1)),
        tick: f.members[0]?.tick ?? null,
        usingIds: f.members.filter((m) => m.lifecycle === 'using').map((m) => m.id),
        queuingIds: f.members.filter((m) => m.lifecycle === 'queuing').map((m) => m.id),
        members: f.members.map((m) => `${m.id}=${m.lifecycle}${m.queueRank !== null ? `(q${m.queueRank})` : ''}@${m.cell}`),
      };
    }
    result.transition = {
      pressAt: transition.pressAt,
      sampleMs: TRANSITION_SAMPLE_MS,
      frameCount: frames.length,
      frameIntervalMs: {
        mean: Number((dts.reduce((a, b) => a + b, 0) / Math.max(dts.length, 1)).toFixed(2)),
        max: Number(Math.max(...dts).toFixed(2)),
      },
      atPress: transition.pre.map((m) => ({ id: m.id, lifecycle: m.lifecycle, queueRank: m.queueRank, cell: m.cell, tick: m.tick })),
      tickAtPress: transition.pre[0]?.tick ?? null,
      tickAtEnd: frames[frames.length - 1]?.members[0]?.tick ?? null,
      purchaseLandedFrame: purchaseFrame < 0 ? null : { frame: purchaseFrame, t: Number(frames[purchaseFrame].t.toFixed(1)), tick: frames[purchaseFrame].members[0]?.tick ?? null },
      expansionFirstFrame: expansionFrame < 0 ? null : { frame: expansionFrame, t: Number(frames[expansionFrame].t.toFixed(1)), tick: frames[expansionFrame].members[0]?.tick ?? null },
      identityBreaks,
      motion,
      ghostId,
      ghost:
        ghost === null
          ? null
          : {
              id: ghostId,
              cells: ghost.cells,
              fromCell: ghost.cells[0]?.cell ?? null,
              toCell: ghost.cells[ghost.cells.length - 1]?.cell ?? null,
              relocationTick: ghost.cells.length > 1 ? ghost.cells[1].tick : null,
              relocationT: ghost.cells.length > 1 ? ghost.cells[1].t : null,
              cellDistanceTiles:
                ghost.cells.length > 1
                  ? Math.max(
                      ...ghost.cells[0].cell.split(',').map((v, i) => Math.abs(Number(v) - Number(ghost.cells[ghost.cells.length - 1].cell.split(',')[i]))),
                    )
                  : 0,
              netDisplacementTiles: Number(ghost.netDisplacementTiles.toFixed(3)),
              maxExcursionTiles: Number(ghost.maxExcursionTiles.toFixed(3)),
              maxExcursionAt: ghost.maxExcursionAt,
              movedFromT: ghost.firstMoveT,
              movedToT: ghost.lastMoveT,
              maxFrameStepTiles: Number(ghost.maxFrameStepTiles.toFixed(3)),
              maxFrameStepAt: ghost.maxFrameStepAt,
              maxFrameRateTilesPer100ms: Number(ghost.maxFrameRateTilesPer100ms.toFixed(3)),
              maxWindowRateTilesPer100ms: Number(ghost.maxWindowRateTilesPer100ms.toFixed(3)),
              maxWindowRateAt: ghost.maxWindowRateAt,
              withinOrdinaryCeiling: ghost.withinOrdinaryCeiling,
              // The ghost's feet, every frame, so a reader can see the shape
              // of the move (snap, one-tick slide, or glide) rather than
              // trust the maxima.
              trace: frames.map((f) => {
                const m = f.members.find((x) => x.id === ghostId);
                return m === undefined ? null : { t: Number(f.t.toFixed(1)), tick: m.tick, cell: m.cell, fx: Number(m.fx.toFixed(1)), fy: Number(m.fy.toFixed(1)), w: Number(m.w.toFixed(1)), clip: m.clip };
              }),
            },
      sharedCell: { exact: shared.exact, roundedOnly: shared.rounded.filter((r) => !shared.exact.some((e) => e.frame === r.frame && e.cell === r.cell)) },
      // The whole record, for the reader; the strip and the numbers above are derived from it.
      frames: frames.map((f) => ({
        t: Number(f.t.toFixed(1)),
        expansion: f.expansion,
        bucks: f.bucks,
        members: f.members.map((m) => ({ id: m.id, lifecycle: m.lifecycle, queueRank: m.queueRank, cell: m.cell, anchor: m.anchor, tick: m.tick, clip: m.clip, fx: Number(m.fx.toFixed(2)), fy: Number(m.fy.toFixed(2)), w: Number(m.w.toFixed(2)) })),
      })),
    };
    result.verdicts.identity = identityBreaks.length === 0;
    const members = Object.values(motion);
    result.verdicts.noTeleport = members.every((m) => m.withinOrdinaryCeiling && m.withinSettleBound);
    result.maxWindowRateTilesPer100ms = Math.max(...members.map((m) => m.maxWindowRateTilesPer100ms));
    result.maxFrameStepTiles = Math.max(...members.map((m) => m.maxFrameStepTiles));
    result.maxSettleExcessTiles = Math.max(...members.map((m) => m.maxSettleExcessTiles));
    note(
      `${vp} TRANSITION ${frames.length} frames over ${TRANSITION_SAMPLE_MS} ms (mean ${result.transition.frameIntervalMs.mean} ms, max gap ${result.transition.frameIntervalMs.max} ms); tick ${result.transition.tickAtPress} -> ${result.transition.tickAtEnd}; purchase landed ${JSON.stringify(result.transition.purchaseLandedFrame)}; expansion first ${JSON.stringify(result.transition.expansionFirstFrame)}; two using first ${firstTwoUsing === null ? 'never in window' : `frame ${firstTwoUsing.frame} t=${firstTwoUsing.t} tick ${firstTwoUsing.tick}`}`,
    );
    for (const m of members) {
      note(
        `${vp}   ${m.id} ${m.lifecycles.join('>')} cells ${m.cells.map((c) => `${c.cell}@t${c.t}/tick${c.tick}`).join(' -> ')} | window rate max ${m.maxWindowRateTilesPer100ms.toFixed(3)} tiles/100ms (ceiling ${ORDINARY_TILES_PER_100MS.toFixed(3)}) at ${JSON.stringify(m.maxWindowRateAt)} | frame step max ${m.maxFrameStepTiles.toFixed(3)} tiles at ${JSON.stringify(m.maxFrameStepAt)} | frame rate max ${m.maxFrameRateTilesPer100ms.toFixed(3)} | settle excess ${m.maxSettleExcessTiles.toFixed(3)} (raw ${m.maxSettleRawTiles.toFixed(3)}, bound ${SETTLE_TILES}) edges ${JSON.stringify(m.settleEdges)} | net ${m.netDisplacementTiles.toFixed(3)} tiles, peak excursion ${m.maxExcursionTiles.toFixed(3)} at t=${m.maxExcursionAt?.t ?? '-'}`,
      );
    }
    if (ghost !== null) {
      const g = result.transition.ghost;
      note(
        `${vp} GHOST ${ghostId}: contract cell ${g.fromCell} -> ${g.toCell} (${g.cellDistanceTiles} tiles on the longer axis) landed tick ${g.relocationTick} at t=${g.relocationT} ms; drawn feet: net displacement ${g.netDisplacementTiles} tiles start-to-end, peak excursion ${g.maxExcursionTiles} tiles from the start at ${JSON.stringify(g.maxExcursionAt)}, moving from t=${g.movedFromT} to t=${g.movedToT} ms; max window rate ${g.maxWindowRateTilesPer100ms} tiles/100ms vs ceiling ${ORDINARY_TILES_PER_100MS.toFixed(3)} (walk ${WALK_TILES_PER_100MS.toFixed(3)}, settle-per-tile ${SETTLE_TILES_PER_100MS.toFixed(3)}); max frame step ${g.maxFrameStepTiles} tiles; ${g.withinOrdinaryCeiling ? 'within the ordinary ceiling' : 'ABOVE the ordinary ceiling'}`,
      );
    }
    note(
      `${vp} OBSERVATION shared cell while one is using: ${shared.exact.length} frame(s) exact${shared.exact.length > 0 ? ` — first ${JSON.stringify(shared.exact[0])}, last ${JSON.stringify(shared.exact[shared.exact.length - 1])}, ticks ${[...new Set(shared.exact.flatMap((s) => s.members.map((m) => m.split('@tick')[1])))].join(',')}` : ''}; ${result.transition.sharedCell.roundedOnly.length} more frame(s) on the rounded cell only`,
    );
    if (identityBreaks.length > 0) note(`${vp} identity broke at ${identityBreaks.length} frame(s): first ${JSON.stringify(identityBreaks[0])}`);
  } else {
    result.verdicts.identity = false;
    result.verdicts.noTeleport = false;
    if (result.verdicts.priceCharged === undefined) {
      result.verdicts.priceCharged = false;
      result.verdicts.capacityDone = false;
      result.verdicts.throughputUnchanged = false;
    }
  }

  // ---- 5. AFTER: second bench drawn, two using, same ids ------------------
  const afterStart = Date.now();
  let expansion = null;
  let after = null;
  while (Date.now() - afterStart < AFTER_BUDGET_MS) {
    expansion = await expansionRead(page);
    after = await membersSnapshot(page);
    const twoUsingNow = after.members.filter((m) => m.lifecycle === 'using').length >= 2;
    if (twoUsingNow && firstTwoUsing === null) {
      firstTwoUsing = {
        source: 'after-poll',
        t: null,
        tick: after.members[0]?.tick ?? null,
        usingIds: after.members.filter((m) => m.lifecycle === 'using').map((m) => m.id),
        queuingIds: after.members.filter((m) => m.lifecycle === 'queuing').map((m) => m.id),
        members: after.members.map((m) => `${m.id}=${m.lifecycle}${m.queueRank !== null ? `(q${m.queueRank})` : ''}@${m.cell}`),
      };
    }
    if (expansionDrawn(expansion) && twoUsingNow) break;
    await page.waitForTimeout(50);
  }
  result.verdicts.secondBenchVisible = expansion !== null && expansionDrawn(expansion);
  const afterUsing = after === null ? [] : after.members.filter((m) => m.lifecycle === 'using').map((m) => m.id);
  result.verdicts.twoUsing = afterUsing.length >= 2 || firstTwoUsing !== null;
  result.after =
    after === null
      ? null
      : {
          readAt: after.readAt,
          waitedMs: Date.now() - afterStart,
          members: after.members.map((m) => ({ id: m.id, lifecycle: m.lifecycle, queueRank: m.queueRank, cell: m.cell, tick: m.tick, box: m.box })),
          ids: after.members.map((m) => m.id).sort(),
          usingIds: afterUsing,
          queuingIds: after.members.filter((m) => m.lifecycle === 'queuing').map((m) => m.id),
          expansion,
          benchBox: after.benchBox,
        };
  result.firstTwoUsing = firstTwoUsing;
  if (result.before !== undefined && after !== null) {
    result.verdicts.sameIds = sameIdSet(idCensus(after.members), result.before.ids);
    const pressMembers = transition !== null && transition.pressed ? transition.pre : before.members;
    const queueHead = pressMembers.find((m) => m.queueRank === '0')?.id ?? result.before.queueHead;
    const queuingAtPress = pressMembers.filter((m) => m.lifecycle === 'queuing').length;
    const rankedAtPress = pressMembers.filter((m) => m.queueRank !== null).length;
    const rankedAfter = after.members.filter((m) => m.queueRank !== null).length;
    result.queue = {
      head: queueHead,
      queuingAtPress,
      queuingAtBefore: result.before.queuingIds.length,
      queuingWhenTwoUsing: firstTwoUsing === null ? null : firstTwoUsing.queuingIds.length,
      rankedAtPress,
      rankedAfter,
    };
    result.verdicts.queueHeadTookSeat = firstTwoUsing !== null && queueHead !== null && firstTwoUsing.usingIds.includes(queueHead);
    result.verdicts.queueShortened = rankedAfter < rankedAtPress;
  } else {
    result.verdicts.sameIds = false;
    result.verdicts.queueHeadTookSeat = false;
    result.verdicts.queueShortened = false;
  }
  result.verdicts.layout = !(after?.overflowX ?? false) && !(before?.overflowX ?? false) && pageErrors.length === 0;
  note(
    `${vp} AFTER (${result.after?.waitedMs ?? '-'} ms): ${after === null ? 'no read' : after.members.map((m) => `${m.id}=${m.lifecycle}${m.queueRank !== null ? `(q${m.queueRank})` : ''}@${m.cell}`).join(' ')} tick ${after?.members[0]?.tick ?? '-'}; expansion ${JSON.stringify(expansion?.bay ?? null)} sprite ${expansion?.sprite === null || expansion === null ? 'null' : `${JSON.stringify(expansion.sprite.box)} opacity ${expansion.sprite.opacity} src ${expansion.sprite.src?.split('/').pop() ?? null} bg ${expansion.sprite.background !== null}`}; first two-using ${JSON.stringify(firstTwoUsing)}; queue ${JSON.stringify(result.queue ?? null)}`,
  );
  if (after !== null) frameFiles.push({ path: await shot('after'), label: 'after: capacity 2, two using' });

  const video = RECORD_VIDEO ? page.video() : null;
  await page.close();
  if (video !== null) {
    const dest = join(OUT, `${vp}-capacity.webm`);
    await video.saveAs(dest);
    await video.delete();
    result.video = `${vp}-capacity.webm`;
  }
  await context.close();
  await composeStrip(browser, frameFiles, join(OUT, `${vp}-capacity-strip.png`), Math.round(viewport.width / 2));
  result.strip = `${vp}-capacity-strip.png`;
  return result;
}

const VERDICT_ORDER = [
  'playedPath',
  'funded',
  'capacityOne',
  'beforeState',
  'capacityOffered',
  'priceCharged',
  'capacityDone',
  'throughputUnchanged',
  'identity',
  'noTeleport',
  'secondBenchVisible',
  'twoUsing',
  'sameIds',
  'queueHeadTookSeat',
  'queueShortened',
  'layout',
];

const browser = await chromium.launch({
  headless: true,
  ...(PW_CHROMIUM === undefined ? {} : { executablePath: PW_CHROMIUM }),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
let exitCode = 0;
try {
  note(`VL-2B capacity proof at ${SHA}${DIRTY ? ' (DIRTY TREE)' : ''} url=${URL}`);
  note(
    `price ${CAPACITY_PRICE} gym bucks; ceiling ${ORDINARY_TILES_PER_100MS.toFixed(3)} tiles/100ms = (${STEP_PER_TICK}/${TICK_MS})*100*(1+${CATCH_UP_RATE})*${RATE_TOLERANCE}; walk ${WALK_TILES_PER_100MS.toFixed(3)}; settle ${SETTLE_MS} ms/tile = ${SETTLE_TILES_PER_100MS.toFixed(3)} tiles/100ms; settle bound ${SETTLE_TILES} tiles; draw scale ${DRAW_SCALE_TILES}; render delay ${RENDER_DELAY_TICKS} tick(s); window ${WINDOW_MS} ms; transition ${TRANSITION_SAMPLE_MS} ms`,
  );
  const results = [];
  for (const viewport of VIEWPORTS) {
    const result = await runViewport(browser, viewport);
    results.push(result);
    for (const k of VERDICT_ORDER) {
      const v = result.verdicts[k];
      note(`${viewport.name} ${v === true ? 'ok  ' : 'FAIL'} ${k}`);
      if (v !== true) exitCode = 1;
    }
    if (result.pageErrors.length > 0) note(`${viewport.name} page errors: ${JSON.stringify(result.pageErrors)}`);
  }
  const summary = {
    sha: SHA,
    dirty: DIRTY,
    url: URL,
    generatedAt: new Date().toISOString(),
    tuning: {
      capacityPrice: CAPACITY_PRICE,
      drawScaleTiles: DRAW_SCALE_TILES,
      settleMs: SETTLE_MS,
      tickMs: TICK_MS,
      stepPerTick: STEP_PER_TICK,
      catchUpRate: CATCH_UP_RATE,
      renderDelayTicks: RENDER_DELAY_TICKS,
      rateTolerance: RATE_TOLERANCE,
      settleTiles: SETTLE_TILES,
      ordinaryCeilingTilesPer100ms: ORDINARY_TILES_PER_100MS,
      walkTilesPer100ms: WALK_TILES_PER_100MS,
      settleTilesPer100ms: SETTLE_TILES_PER_100MS,
      windowMs: WINDOW_MS,
      transitionSampleMs: TRANSITION_SAMPLE_MS,
    },
    results,
    notes,
  };
  writeFileSync(join(OUT, 'notes.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'notes.txt'), notes.join('\n') + '\n');
  note(`wrote ${OUT}`);
} finally {
  await browser.close();
  rmSync(VIDEO_TMP, { recursive: true, force: true });
}
process.exit(exitCode);
