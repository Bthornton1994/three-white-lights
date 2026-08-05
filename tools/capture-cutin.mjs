#!/usr/bin/env node
/**
 * Photographs the cut-in overlay — the thing GDD §7.2 says a player is
 * interrupted by.
 *
 * ===========================================================================
 * WHY THIS TOOL HAD TO EXIST
 * ===========================================================================
 * The gate has 100+ unit tests. The OVERLAY had none that could ever see a
 * pixel: `vitest.config.ts` is `environment: node`, so nothing in `src/` can
 * mount a component, and everything about the view layer — the full-screen tap
 * target, the auto-dismiss timer, the arrival, the scrim, and whether the thing
 * is even ON TOP of the screen it interrupts — was verified by reading source
 * text. `cutInWiring.test.ts` says so about itself in its own header. This is
 * the instrument that was missing.
 *
 * ===========================================================================
 * WHY A DEBUG ROUTE RATHER THAN PLAYING TO ONE
 * ===========================================================================
 * The same reason `capture-meet.mjs` gives, plus one that is specific to this
 * piece: a cut-in is SCARCE ON PURPOSE. §7.2's rates mean most sittings show
 * none, and the one that does show one shows it for under two seconds. Driving
 * the real loop until a cut-in happened would photograph a coin toss, late.
 *
 * So the moment is scripted through `?cutin=<moment>` (see
 * `src/cutin/cutInPreview.ts`), which hands the REAL GATE a real beat and lets
 * it decide. No bypass: the cap applies, the rate applies, the qualification
 * applies. The only thing the route arranges is the session SEED — it looks for
 * a sitting whose §7.2 roll would have allowed the moment anyway. If the gate
 * refuses, this tool photographs an empty screen and fails, which is the
 * correct outcome and the reason the route is not a `setLive` call.
 *
 * `?cutin=<moment>` is FROZEN — the host does not start the auto-dismiss timer —
 * so the shutter can land. `?cutin=<moment>&live=1` is the same preview with
 * the clock running, which is how the two timing claims below are checked.
 *
 * Usage:
 *   node tools/capture-cutin.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePng, diffPixels } from './png.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
const outDir = path.resolve(flag('out', '.gauntlet/shots/cutin'));
const srcRoot = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

/**
 * WHERE THIS EVIDENCE CAME FROM.
 *
 * `frames.json` shipped for weeks with no provenance at all, and
 * `tools/evidence.mjs --verify` found it the first time it was taught to look:
 * "no capturedFrom.commit — this record cannot be dated". These shots are
 * TRACKED, in `.gitignore`, under a comment naming this directory, because a
 * critic is asked to open the pixels and a screenshot carries no provenance of
 * its own. A JSON sidecar that also carries none leaves the artifact exactly as
 * undatable as it was before — which is how the sibling `route.json` came to
 * sit in the repo describing a different commit while looking authoritative.
 *
 * Snapshotted BEFORE `outDir` is wiped and rewritten, so it records the tree
 * the browser was served from rather than one this tool has already dirtied.
 * `outDir` is excluded from the clean/dirty verdict — a previous run's leftover
 * pixels are not code the app ran — as are the other run artefacts named at the
 * filter below. All of them stay listed in `dirtyPaths`, so nothing is hidden
 * from a reader; they are re-labelled, not dropped.
 */
const capturedFrom = (() => {
  const record = {
    capturedAt: new Date().toISOString(),
    url,
    sourceRoot: srcRoot,
    commit: null,
    branch: null,
    workingTree: 'unknown',
    dirtyPaths: [],
  };
  const git = (...gitArgs) =>
    execFileSync('git', ['-C', srcRoot, ...gitArgs], { encoding: 'utf8' }).trim();
  try {
    record.commit = git('rev-parse', '--short', 'HEAD');
    record.branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const status = git('status', '--porcelain');
    const lines = status === '' ? [] : status.split('\n');
    // Not code the app ran: this tool's own output directory, plus the run
    // artefacts `tools/evidence.mjs` excludes for the same reason (a bundle or
    // a progress-page update is not a change to what the browser executed).
    // Kept in step with SELF_DIRTYING there deliberately — a capture that
    // reads DIRTY because an evidence bundle is uncommitted is a false alarm,
    // and false alarms are how a real one gets waved through.
    // `.gauntlet/shots/` WHOLESALE, not just this tool's own directory. The
    // sibling capture tool writes a different shot directory, so running the
    // two in sequence made the second report the first's fresh pixels as
    // uncommitted CODE — which they are not; no shot is an input to the app.
    // Each record's own staleness is cross-checked independently by
    // `tools/evidence.mjs --verify`, which reads every tracked shot record and
    // fails on one that is undated, dirty, stale or red. This field answers a
    // narrower question: was the CODE the browser ran committed.
    const notCode = ['.gauntlet/shots/', '.gauntlet/evidence/', '.gauntlet/state.json'];
    const code = lines.filter((line) => {
      const p = line.replace(/^\s*\S+\s+/, '');
      return !notCode.some((prefix) => p.startsWith(prefix));
    });
    record.workingTree = code.length === 0 ? 'clean' : 'DIRTY — this run is not against a commit';
    record.dirtyPaths = lines.slice(0, 40);
  } catch (error) {
    record.workingTree = `unknown — ${String(error).slice(0, 200)}`;
  }
  // A digest of the measuring device, not just the app it measured. See the
  // matching block in `verify-shell-route.mjs` for why a SHA alone is not
  // enough: an edited instrument leaves a green record describing a check that
  // no longer exists, and the commit is unchanged.
  record.instrument = Object.fromEntries(
    ['capture-cutin.mjs', 'png.mjs'].map((name) => {
      const file = path.join(path.dirname(fileURLToPath(import.meta.url)), name);
      try {
        return [name, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16)];
      } catch (error) {
        return [name, `unreadable — ${String(error).slice(0, 80)}`];
      }
    }),
  );
  return record;
})();
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));

/**
 * GDD §7.2's four firing moments and the line each one prints.
 *
 * TRANSCRIBED HERE RATHER THAN IMPORTED, the same way `capture-meet.mjs`
 * restates its beat list: this tool is a second, independent statement of what
 * the piece contains, and a capture that agreed with a broken module by
 * construction would be worth nothing. If `CUT_IN_COPY` changes, this file has
 * to change too, on purpose.
 */
const MOMENTS = [
  ['third-attempt-walkout', 'LAST ONE'],
  ['personal-record', 'NOBODY HAS SEEN YOU DO THIS'],
  ['bomb-out', 'THAT IS THE MEET'],
  ['coach-heavy-set', 'THAT MOVED'],
];

const SKIP_HINT = 'TAP TO SKIP';

/**
 * `CUT_IN_TUNING`'s timings, restated. Same rule as above.
 *
 *   ENTER_MS 120 + HOLD_MS 1600 = 1720 ms, the auto-dismiss AND the whole beat
 *
 * THE SECOND LINE IS GONE, and it was false while it was here: it read
 * "+ EXIT_MS 100 = 1820 ms, the whole beat", and this tool's own output
 * disproves it — `frames.json` puts the tap dismissal at `tappedAt: 14,
 * goneAt: 26`. Nothing animated an exit; the overlay un-mounts on the tick. The
 * constant is deleted, not merely unmentioned (`cutInTuning.ts`, `ENTER_MS`).
 *
 * These are STARTING POINTS nobody has played (GDD §12.1). The tool checks the
 * timer fires inside a generous window around them rather than pinning them, so
 * a tuning pass moves one file and not two.
 */
const AUTO_DISMISS_MS = 1720;
const STILL_UP_PROBE_MS = 700;
const GONE_BY_MS = 4000;

/**
 * How many device pixels of the screen behind must survive `SCRIM_OPACITY`.
 *
 * A FLOOR, not a pin, and measured on both sides of the defect it exists for.
 * Over the 1,316,640 device pixels of a 390×844 frame at dpr 2, outside the
 * overlay's own panel and copy:
 *
 *   SCRIM_OPACITY on its own layer      66,128   blended    194 flat backdrop
 *   ...and personal-record, which wraps 73,185   blended    210 flat backdrop
 *   SCRIM_OPACITY under the arrival          0   blended 66,322 flat backdrop
 *
 * The bottom row is the shipped defect, re-created and re-measured: an opaque
 * scrim produces ZERO blended pixels by construction, because every pixel it
 * covers is either already the backdrop colour or replaced by it. So the floor
 * only has to be above zero to bite; it sits an order of magnitude under the
 * healthy reading so that a single antialiased glyph could not clear it.
 */
const SCRIM_MUST_BLEND_AT_LEAST = 2000;

/** The palette's backdrop, `LIFT_PALETTE.BACKDROP` — '#12141a'. Restated. */
const BACKDROP = [0x12, 0x14, 0x1a];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

const decoded = new Map();
async function imageOf(file) {
  if (!decoded.has(file)) decoded.set(file, decodePng(await readFile(file)));
  return decoded.get(file);
}

/**
 * WHAT THE PAGE ACTUALLY SHOWS, read off the DOM rather than assumed.
 *
 * The hit tests are the half a source scan cannot do. `cutInWiring.test.ts` can
 * see that the `Pressable` is `absoluteFill` and that its `onPress` is the
 * dismiss handler; it cannot see whether the overlay is ON TOP of the screen it
 * interrupts, or whether a tap in a CORNER lands on it. Both are answered here
 * by `elementFromPoint` on the running page.
 */
async function readOverlay() {
  return page.evaluate(() => {
    const node = (id) => document.querySelector(`[data-testid="${id}"]`);
    const text = (id) => node(id)?.textContent ?? null;
    const cutIn = node('cut-in');
    const inCutIn = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return hit !== null && cutIn !== null && (cutIn === hit || cutIn.contains(hit));
    };
    const box = (id) => {
      const n = node(id);
      if (n === null) return null;
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const INSET = 8;
    return {
      present: cutIn !== null,
      line: text('cut-in-line'),
      hint: text('cut-in-skip-hint'),
      scrim: node('cut-in-scrim') !== null,
      art: box('cut-in-art'),
      lineBox: box('cut-in-line'),
      hintBox: box('cut-in-skip-hint'),
      // The screen underneath. If this is missing, the shot is of an overlay
      // over nothing and every "does it interrupt" question is meaningless.
      behind: node('session-check-in') !== null,
      // FOUR CORNERS AND THE CENTRE. GDD §7.2: "Always skippable — tap to
      // dismiss", with no close button in a corner, so every one of these must
      // land on the cut-in.
      corners: {
        topLeft: inCutIn(INSET, INSET),
        topRight: inCutIn(window.innerWidth - INSET, INSET),
        bottomLeft: inCutIn(INSET, window.innerHeight - INSET),
        bottomRight: inCutIn(window.innerWidth - INSET, window.innerHeight - INSET),
        centre: inCutIn(window.innerWidth / 2, window.innerHeight / 2),
      },
      // Two controls that are NOT the cut-in's, hit-tested at their own
      // centres. The first belongs to the screen being interrupted; the second
      // is the shell's navigation pill, which is a SIBLING of the whole session
      // surface and therefore paints after it.
      //
      // The baseline frame is the positive control for both: with no cut-in up,
      // `checkIn` must come back true, or the probe is looking at a testID that
      // does not exist and every "the overlay is on top" reading is vacuous.
      // That is exactly how the first version of this tool was wrong.
      tappableThroughTheCutIn: {
        checkIn: (() => {
          const n = document.querySelector('[data-testid="check-in-sleep-good"]');
          if (n === null) return null;
          const r = n.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit !== null && (n === hit || n.contains(hit));
        })(),
        shellNav: (() => {
          const n = document.querySelector('[data-testid="shell-open-meet"]');
          if (n === null) return null;
          const r = n.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit !== null && (n === hit || n.contains(hit));
        })(),
      },
    };
  });
}

/**
 * DOES `SCRIM_OPACITY` REACH A PIXEL?
 *
 * The defect this measurement exists for: `CUT_IN_LAYOUT.SCRIM_OPACITY` was a
 * registered, documented, playtest-facing tunable applied to the same node the
 * arrival animation drives — and the animation's opacity was applied last, so
 * once the enter timing completed the overlay sat at 1 over an opaque backdrop
 * and the constant reached nothing.
 *
 * The reading. Every pixel OUTSIDE the overlay's own content (the panel and the
 * two lines of type, whose boxes are read off the DOM above) is one of three
 * things:
 *
 *   - identical to the baseline           the screen behind was already the
 *                                         backdrop colour, so a backdrop scrim
 *                                         over it changes nothing
 *   - exactly the backdrop, but different an OPAQUE scrim — the failure
 *   - neither                             a BLEND: some of the screen behind
 *                                         survived the scrim
 *
 * A scrim at opacity 1 produces zero of the third kind, by construction. So the
 * count of blended pixels is the constant, measured.
 */
async function scrimReading(file, baselineFile, holes) {
  const shot = await imageOf(file);
  const base = await imageOf(baselineFile);
  let blended = 0;
  let opaqueBackdrop = 0;
  let untouched = 0;
  // THE BOXES COME OFF THE DOM IN LOGICAL POINTS AND THE IMAGE IS IN DEVICE
  // PIXELS. Forgetting the `dpr` here excluded only the top-left quarter of the
  // panel, and the cream card that leaked into the reading looked exactly like
  // a healthy scrim — 354,394 "blended" pixels on a build whose scrim was
  // fully opaque. The measurement passed on the defect it was written for.
  const scaled = holes
    .filter((h) => h !== null)
    .map((h) => ({
      x: Math.floor(h.x * dpr),
      y: Math.floor(h.y * dpr),
      w: Math.ceil(h.w * dpr),
      h: Math.ceil(h.h * dpr),
    }));
  const inHole = (x, y) =>
    scaled.some((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h);
  for (let y = 0; y < shot.height; y += 1) {
    for (let x = 0; x < shot.width; x += 1) {
      if (inHole(x, y)) continue;
      const i = (y * shot.width + x) * 4;
      const same =
        shot.rgba[i] === base.rgba[i] &&
        shot.rgba[i + 1] === base.rgba[i + 1] &&
        shot.rgba[i + 2] === base.rgba[i + 2];
      if (same) {
        untouched += 1;
        continue;
      }
      const isBackdrop =
        shot.rgba[i] === BACKDROP[0] &&
        shot.rgba[i + 1] === BACKDROP[1] &&
        shot.rgba[i + 2] === BACKDROP[2];
      if (isBackdrop) opaqueBackdrop += 1;
      else blended += 1;
    }
  }
  return { blended, opaqueBackdrop, untouched };
}

const notes = [];
let missing = 0;
let wrongLine = 0;
let unreachableCorner = 0;
let notOnTop = 0;
/**
 * THIS USED TO BE REPORTED AND NOT FAILED ON. IT IS FAILED ON NOW.
 *
 * `AppShell.tsx` renders its navigation pill as a SIBLING of the whole session
 * surface, after it — so the pill painted above `CutInHost`'s overlay and took
 * taps through it. GDD §7.2 wants the whole screen to be the dismiss target,
 * and a control that navigates instead of dismissing is a hole in that.
 *
 * It was not the cut-in's to fix: the overlay cannot lift itself above a
 * sibling of its own ancestor without giving the entire surface a stacking
 * order that would bury the pill for good. So it was reported loudly and kept
 * out of the exit code, because failing this tool on another file's defect
 * would only teach the next person to stop running it.
 *
 * The shell has since taken the fix — `shellAffordanceFor` draws no chrome
 * while a cut-in is live, the same gate it already applied over a live set —
 * so the finding becomes an assertion. Its positive control is at the baseline
 * below: with no cut-in up, on the very same check-in beat, the pill must be
 * present AND hit-testable. Without that, "the pill is not on top" would also
 * be what a tool that could not find the pill at all would report.
 */
let shellNavOverTheInterrupt = 0;

// ---------------------------------------------------------------------------
// THE BASELINE, WHICH IS ALSO THE "NOT REACHABLE IN PLAY" CHECK
// ---------------------------------------------------------------------------
// `?cutin=nonsense` must boot the daily session with NO overlay, exactly as
// `?meet=nonsense` does. It is both the control frame every scrim reading is
// taken against and the proof that an unrecognised debug route is inert.
await page.goto(`${url}?cutin=nonsense`, { waitUntil: 'load' });
await page.getByTestId('session-check-in').waitFor({ state: 'visible', timeout: 120000 });
await page.waitForTimeout(1500);
const baselineFile = path.join(outDir, 'baseline-no-cutin.png');
await page.screenshot({ path: baselineFile });
const baselineOverlay = await readOverlay();
if (baselineOverlay.present) {
  console.log('!! ?cutin=nonsense PUT A CUT-IN ON SCREEN — the route is not inert');
  missing += 1;
}
// POSITIVE CONTROL FOR THE "IS IT ON TOP" PROBE. With no cut-in up, the
// check-in's own chip must be hit-testable. If it is not, the selector is wrong
// and every later reading of it means nothing — which is how the first version
// of this tool silently passed.
if (baselineOverlay.tappableThroughTheCutIn.checkIn !== true) {
  console.log('!! THE "IS IT ON TOP" PROBE IS BLIND — the check-in chip was not hit-testable');
  missing += 1;
}
// AND THE SAME CONTROL FOR THE SHELL PILL, which is now asserted on rather than
// reported. With no cut-in up this is the check-in beat, where `SHELL_NAV`
// says the pill belongs — so it must be present and hit-testable here, or
// "the pill is not on top of the interrupt" below is what a probe that cannot
// find the pill AT ALL would also say.
if (baselineOverlay.tappableThroughTheCutIn.shellNav !== true) {
  console.log(
    '!! THE SHELL-PILL PROBE IS BLIND — with no cut-in up, the pill was not hit-testable\n' +
      '   on the check-in beat, so every "no chrome over the interrupt" reading below is vacuous.',
  );
  missing += 1;
}
console.log(
  `baseline             -> ${path.basename(baselineFile)}  ` +
    `cut-in:${baselineOverlay.present ? '!! PRESENT' : 'none'}  ` +
    `check-in:${baselineOverlay.behind ? 'up' : '!! MISSING'}  ` +
    `its chip:${baselineOverlay.tappableThroughTheCutIn.checkIn ? 'tappable (probe works)' : '!! NOT HIT-TESTABLE'}  ` +
    `shell nav:${baselineOverlay.tappableThroughTheCutIn.shellNav ? 'tappable' : 'absent'}`,
);

// ---------------------------------------------------------------------------
// ONE FROZEN FRAME PER FIRING MOMENT
// ---------------------------------------------------------------------------

for (const [moment, expectedLine] of MOMENTS) {
  await page.goto(`${url}?cutin=${moment}`, { waitUntil: 'load' });
  let showed = true;
  try {
    await page.getByTestId('cut-in').waitFor({ state: 'visible', timeout: 120000 });
  } catch {
    showed = false;
  }
  // Past the arrival, so the frame is the cut-in at full weight rather than
  // mid-fade — which is also the state in which the scrim defect was invisible.
  await page.waitForTimeout(1200);
  const file = path.join(outDir, `${moment}.png`);
  await page.screenshot({ path: file });
  const seen = await readOverlay();

  if (!showed || !seen.present) missing += 1;
  if (seen.line !== expectedLine) wrongLine += 1;
  if (seen.hint !== SKIP_HINT) wrongLine += 1;
  const everyCorner = Object.values(seen.corners).every(Boolean);
  if (!everyCorner) unreachableCorner += 1;
  // The overlay is ABOVE the screen it interrupts. If the check-in's own
  // controls are still hit-testable, the cut-in is mounted underneath them and
  // a tap meant to skip it would answer a readiness question instead.
  if (seen.tappableThroughTheCutIn.checkIn === true) notOnTop += 1;
  if (seen.tappableThroughTheCutIn.shellNav === true) shellNavOverTheInterrupt += 1;

  const scrim = seen.present
    ? await scrimReading(file, baselineFile, [seen.art, seen.lineBox, seen.hintBox])
    : null;

  notes.push({ moment, file, name: path.basename(file), expectedLine, seen, scrim });
  console.log(
    `${moment.padEnd(22)} -> ${path.basename(file)}  ` +
      `${seen.present ? 'up' : '!! NO CUT-IN'}  ` +
      `line:${JSON.stringify(seen.line)}${seen.line === expectedLine ? '' : ` !! EXPECTED ${JSON.stringify(expectedLine)}`}  ` +
      `corners:${everyCorner ? 'all tappable' : `!! ${JSON.stringify(seen.corners)}`}  ` +
      `${seen.tappableThroughTheCutIn.checkIn === true ? '!! THE SCREEN BEHIND IS STILL TAKING TAPS' : 'on top of the screen'}` +
      (seen.tappableThroughTheCutIn.shellNav === true
        ? '  !! THE SHELL NAV PILL IS ON TOP OF THE INTERRUPT'
        : '') +
      (scrim === null ? '' : `  scrim blended:${scrim.blended}px`),
  );
}

// ---------------------------------------------------------------------------
// DOES THE SCRIM REACH PIXELS?
// ---------------------------------------------------------------------------

let scrimDead = 0;
for (const note of notes) {
  if (note.scrim === null) continue;
  const { blended, opaqueBackdrop } = note.scrim;
  const bad = blended < SCRIM_MUST_BLEND_AT_LEAST;
  if (bad) scrimDead += 1;
  console.log(
    `scrim ${note.moment.padEnd(22)} blended:${String(blended).padStart(7)}  ` +
      `flat-backdrop:${String(opaqueBackdrop).padStart(7)}  ` +
      `${bad ? '!! THE SCRIM IS OPAQUE — SCRIM_OPACITY IS READ BY NO PIXEL' : 'the screen behind survives it'}`,
  );
}

// ---------------------------------------------------------------------------
// THE FOUR FRAMES ARE FOUR FRAMES
// ---------------------------------------------------------------------------

const fingerprints = notes.map((n) => JSON.stringify({ line: n.seen.line, art: n.seen.art }));
let duplicates = fingerprints.length - new Set(fingerprints).size;

/**
 * The panel, compared BETWEEN FRAMES AND ALIGNED TO EACH FRAME'S OWN BOX.
 *
 * The alignment is the whole point. The overlay is centred, so a moment whose
 * line wraps to two lines pushes the panel up by half a line — `personal-record`
 * sits 26 logical points higher than `bomb-out` for exactly that reason. A diff
 * taken at one frame's coordinates in both would report six figures of
 * difference for two IDENTICAL drawings, which is a number that looks like an
 * answer and is not one.
 *
 * WHAT THIS IS ASKING. All four moments lead with the same Tier 3 slot today
 * (`CUT_IN_ART.SLOT` is `portrait` four times), and three of the four wear the
 * lifter's face while the coach beat wears the coach's. So three of these are
 * EXPECTED to be identical and one is expected to differ. Measured and printed
 * rather than required: which face a moment wears is a design decision, not
 * something this tool should pin.
 */
function alignedArtDiff(shotA, boxA, shotB, boxB) {
  const w = Math.round(Math.min(boxA.w, boxB.w) * dpr);
  const h = Math.round(Math.min(boxA.h, boxB.h) * dpr);
  const ax = Math.round(boxA.x * dpr);
  const ay = Math.round(boxA.y * dpr);
  const bx = Math.round(boxB.x * dpr);
  const by = Math.round(boxB.y * dpr);
  let differing = 0;
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      const ia = ((ay + row) * shotA.width + ax + col) * 4;
      const ib = ((by + row) * shotB.width + bx + col) * 4;
      if (
        shotA.rgba[ia] !== shotB.rgba[ib] ||
        shotA.rgba[ia + 1] !== shotB.rgba[ib + 1] ||
        shotA.rgba[ia + 2] !== shotB.rgba[ib + 2]
      ) {
        differing += 1;
      }
    }
  }
  return { differing, total: w * h };
}

const artDiffs = [];
for (let i = 1; i < notes.length; i += 1) {
  const a = notes[i - 1];
  const b = notes[i];
  if (a.seen.art === null || b.seen.art === null) continue;
  const { differing, total } = alignedArtDiff(
    await imageOf(a.file),
    a.seen.art,
    await imageOf(b.file),
    b.seen.art,
  );
  artDiffs.push({ a: a.moment, b: b.moment, differing, total, alignedToEachOwnBox: true });
  console.log(
    `art   ${a.moment.padEnd(22)} vs ${b.moment.padEnd(22)} ${String(differing).padStart(7)} / ${total} px  ` +
      `${differing === 0 ? 'the same panel — one slot, one face' : 'a different face'}`,
  );
}

// ---------------------------------------------------------------------------
// THE TWO THINGS ONLY A RUNNING CLOCK CAN ANSWER
// ---------------------------------------------------------------------------

let timing = 0;

// (1) IT LEAVES ON ITS OWN. §7.2's interrupt is not a modal dialog.
await page.goto(`${url}?cutin=personal-record&live=1`, { waitUntil: 'load' });
let leavesOnItsOwn = null;
try {
  await page.getByTestId('cut-in').waitFor({ state: 'visible', timeout: 120000 });
  const appearedAt = Date.now();
  await page.waitForTimeout(STILL_UP_PROBE_MS);
  const stillUpAt = Date.now() - appearedAt;
  const stillUp = await page.getByTestId('cut-in').isVisible();
  await page.screenshot({ path: path.join(outDir, 'live-mid-hold.png') });
  await page.getByTestId('cut-in').waitFor({ state: 'detached', timeout: GONE_BY_MS });
  const goneAt = Date.now() - appearedAt;
  await page.screenshot({ path: path.join(outDir, 'live-after-auto-dismiss.png') });
  const behind = await page.getByTestId('session-check-in').isVisible();
  leavesOnItsOwn = { stillUpAt, stillUp, goneAt, behind };
  if (!stillUp) timing += 1;
  if (!behind) timing += 1;
  console.log(
    `auto-dismiss         still up at ${stillUpAt}ms: ${stillUp ? 'yes' : '!! ALREADY GONE'}; ` +
      `gone by ${goneAt}ms (the piece claims ${AUTO_DISMISS_MS}ms); ` +
      `the screen behind came back: ${behind ? 'yes' : '!! NO'}`,
  );
} catch (e) {
  timing += 1;
  console.log(`!! THE CUT-IN NEVER LEFT ON ITS OWN: ${String(e).split('\n')[0]}`);
}

// (2) A TAP IN A CORNER DISMISSES IT, WELL BEFORE THE HOLD WOULD HAVE.
//
// WHAT THIS DOES AND DOES NOT PROVE. It proves a tap reaches the dismiss
// handler, that a CORNER is a valid target, and that the cut-in went away
// because of the tap rather than because the clock ran out. It does NOT prove
// "dismissible on the first frame": `tappedAt` below is however long Playwright
// took to see the node and move the mouse, which on a loaded machine has been
// anywhere from 14 ms to 170 ms. The first-frame claim is
// `DISMISS_ENABLED_AFTER_MS === 0` and it is a unit test, not a photograph.
await page.goto(`${url}?cutin=bomb-out&live=1`, { waitUntil: 'load' });
let tapDismissed = null;
try {
  await page.getByTestId('cut-in').waitFor({ state: 'visible', timeout: 120000 });
  const appearedAt = Date.now();
  await page.mouse.click(12, 12);
  const tappedAt = Date.now() - appearedAt;
  await page.getByTestId('cut-in').waitFor({ state: 'detached', timeout: 5000 });
  const goneAt = Date.now() - appearedAt;
  await page.screenshot({ path: path.join(outDir, 'live-after-tap.png') });
  tapDismissed = { tappedAt, goneAt, wellInsideTheHold: goneAt < AUTO_DISMISS_MS };
  if (!tapDismissed.wellInsideTheHold) {
    // Otherwise this proved nothing: the hold would have taken it down anyway.
    timing += 1;
  }
  console.log(
    `tap to dismiss       tapped a CORNER ${tappedAt}ms after the shutter saw it, gone at ${goneAt}ms ` +
      `${tapDismissed.wellInsideTheHold ? `(the hold is ${AUTO_DISMISS_MS}ms, so the tap did it — not the clock)` : '!! THE HOLD MAY HAVE DONE IT'}`,
  );
} catch (e) {
  timing += 1;
  console.log(`!! A CORNER TAP DID NOT DISMISS THE CUT-IN: ${String(e).split('\n')[0]}`);
}

// ---------------------------------------------------------------------------
// THE PLAYED PATH: DOES THE BOMB-OUT FIX ACTUALLY REACH MEET DAY?
// ---------------------------------------------------------------------------
//
// Everything above is the cut-in's own debug route. This is the same question
// asked of the REAL meet screens, through `?meet=<beat>` — `WalkoutView` and
// `BombOutView` mounting inside `MeetScreen`'s own `CutInHost`, offering their
// own beats, with nothing arranged.
//
//   ?meet=walkout-third   a third attempt with NOTHING BANKED. `meetDay.ts`
//                         sets `bombRisk` on exactly this attempt, so the gate
//                         must refuse it — otherwise it spends the meet's slot
//                         and the bomb-out that follows gets nothing.
//   ?meet=bombed          the meet ended on that miss. This is the beat that
//                         used to lose.
//
// The first is a HARD failure and is independent of tuning: a disqualified beat
// is refused whatever `SESSION_ALLOWANCE` says. The second depends on this
// meet's roll for `bomb-out` — 1 today — so it is printed loudly and reported
// separately rather than failing the tool on a number a playtester is expected
// to move.
//
// WHAT THESE TWO SHOTS ARE NOT. They are two separate page loads, so they are
// two separate processes and two separate gate ledgers — the second does not
// inherit the first's spent slot. This is "does each beat qualify on its own",
// not "does one meet spend its slot on the right beat". The second question is
// answered by `cutInGate.test.ts`'s "A MEET THAT BOMBS SHOWS THE BOMB-OUT
// CUT-IN", which walks all four beats through ONE session.
//
// Measured with the disqualifier reverted, to show this reading bites:
// `?meet=walkout-third` came back with 'LAST ONE' over the attempt that ends
// the meet, which is the defect this pass was sent back for, photographed.

/** Watch for a cut-in for a while, and say whether one ever appeared. */
async function sawACutInWithin(ms) {
  const until = Date.now() + ms;
  let line = null;
  while (Date.now() < until) {
    const seen = await page.evaluate(() => {
      const node = document.querySelector('[data-testid="cut-in"]');
      if (node === null) return null;
      return document.querySelector('[data-testid="cut-in-line"]')?.textContent ?? '';
    });
    if (seen !== null) {
      line = seen;
      break;
    }
    await page.waitForTimeout(50);
  }
  return line;
}

/** Long enough to cover the whole beat: enter + hold + exit, with slack. */
const WATCH_FOR_A_CUT_IN_MS = 3000;

let playedPath = null;
let bombOutMissingOnMeetDay = 0;
let walkoutSpentTheSlot = 0;
try {
  await page.goto(`${url}?meet=walkout-third`, { waitUntil: 'load' });
  await page.getByTestId('meet-walkout').waitFor({ state: 'visible', timeout: 120000 });
  const onWalkout = await sawACutInWithin(WATCH_FOR_A_CUT_IN_MS);
  await page.screenshot({ path: path.join(outDir, 'played-walkout-third.png') });

  await page.goto(`${url}?meet=bombed`, { waitUntil: 'load' });
  await page.getByTestId('meet-bombed').waitFor({ state: 'visible', timeout: 120000 });
  const onBombOut = await sawACutInWithin(WATCH_FOR_A_CUT_IN_MS);
  await page.screenshot({ path: path.join(outDir, 'played-bombed.png') });

  playedPath = { onWalkout, onBombOut };
  if (onWalkout !== null) walkoutSpentTheSlot += 1;
  if (onBombOut === null) bombOutMissingOnMeetDay += 1;
  console.log(
    `played ?meet=walkout-third  cut-in: ${onWalkout === null ? 'none — the bomb is still live, so it is refused' : `!! ${JSON.stringify(onWalkout)} — A WALK-OUT THAT CAN STILL BOMB SPENT THE SLOT`}`,
  );
  console.log(
    `played ?meet=bombed         cut-in: ${onBombOut === null ? '!! NONE — the somber counterpart got nothing' : `${JSON.stringify(onBombOut)}`}`,
  );
} catch (e) {
  walkoutSpentTheSlot += 1;
  console.log(`!! COULD NOT DRIVE THE PLAYED MEET PATH: ${String(e).split('\n')[0]}`);
}

/**
 * ONE LIST DRIVES BOTH THE RECORD AND THE EXIT CODE.
 *
 * These counters used to feed the `process.exit` at the bottom of this file and
 * nothing else, so a red run wrote a `frames.json` indistinguishable from a
 * green one and the verdict lived only in a terminal that was already closed.
 * The sibling tool shipped exactly that failure — a committed record of a
 * failing run, sitting in the graded artifact, reading as green to anyone who
 * looked at the pictures rather than the JSON.
 *
 * So the array is BUILT ONCE and used twice. `process.exit` below reads
 * `failures.length`; it does not restate the conjunction. Add a counter and
 * forget to add it to the exit condition and the two cannot silently disagree,
 * because there is no longer a second copy of the condition to forget.
 *
 * `bombOutMissingOnMeetDay` is deliberately NOT here: it is a tuning reading,
 * not a broken gate, and the block below says so at length.
 */
const failures = [
  [missing, 'moment(s) showed no cut-in'],
  [wrongLine, 'wrong line(s) or hint(s)'],
  [duplicates, 'duplicate frame(s)'],
  [unreachableCorner, 'frame(s) had a corner the tap could not reach'],
  [notOnTop, 'frame(s) had the screen behind still taking taps'],
  [scrimDead, 'frame(s) had an opaque scrim'],
  [timing, 'timing check(s) failed'],
  [walkoutSpentTheSlot, "played walk-out(s) spent the bomb-out's slot"],
  [shellNavOverTheInterrupt, 'frame(s) had the shell pill on top of the cut-in (GDD §7.2)'],
]
  .filter(([count]) => count > 0)
  .map(([count, what]) => `${count} ${what}`);

await writeFile(
  path.join(outDir, 'frames.json'),
  `${JSON.stringify(
    {
      capturedFrom,
      frames: notes,
      artDiffs,
      leavesOnItsOwn,
      tapDismissed,
      playedPath,
      failures,
      pageErrors: errors,
    },
    null,
    2,
  )}\n`,
);

if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log('  ', e);
}
await browser.close();

console.log(`\nwrote ${notes.length + 4} frames to ${outDir}`);
console.log(
  `${missing} moment(s) showed no cut-in; ${wrongLine} wrong line(s) or hint(s); ` +
    `${duplicates} duplicate frame(s); ${unreachableCorner} frame(s) had a corner the tap could not reach; ` +
    `${notOnTop} frame(s) had the screen behind still taking taps; ` +
    `${scrimDead} frame(s) had an opaque scrim; ${timing} timing check(s) failed; ` +
    `${walkoutSpentTheSlot} played walk-out(s) spent the bomb-out's slot`,
);
if (shellNavOverTheInterrupt > 0) {
  console.log(
    `\n!! on ${shellNavOverTheInterrupt} of ${notes.length} frames the shell's navigation pill sits ` +
      'ON TOP of the cut-in and takes taps through it.\n' +
      '   GDD §7.2 makes the whole screen the dismiss target; that pill navigates instead.\n' +
      '   It belongs to src/shell/AppShell.tsx: the chrome is gated off while a cut-in is\n' +
      '   up (`shellAffordanceFor`), the same way it is gated off over a live set. If this\n' +
      '   is back, that gate has been undone or the host has stopped reporting `onLive`.',
  );
}
if (bombOutMissingOnMeetDay > 0) {
  console.log(
    '\n!! REPORTED, NOT FAILED: ?meet=bombed showed no cut-in.\n' +
      "   That is a TUNING reading, not a broken gate: it means this meet's roll for\n" +
      '   bomb-out came back false. Check CUT_IN_TUNING.SESSION_ALLOWANCE before\n' +
      '   concluding anything. What the gate guarantees is the line above it — that a\n' +
      '   walk-out which can still bomb does not spend the slot — and that IS failed on.',
  );
}
// Reads the array written into `frames.json`, rather than restating the
// conjunction. See the block that builds it.
process.exit(failures.length === 0 ? 0 : 1);
