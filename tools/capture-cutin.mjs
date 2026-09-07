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
 * ===========================================================================
 * EVERY SCREEN THIS TOOL OPENS IS OPENED BY URL, INCLUDING THE MEET ONES
 * ===========================================================================
 * TWO QUERY STRINGS, AND THE SECOND ONE USED TO BE DISCLOSED EIGHT HUNDRED
 * LINES DOWN. This header described `?cutin=` and stopped, so a reader who got
 * as far as the usage line had been told about half the tool. The other half
 * drives `?meet=walkout-third` and `?meet=bombed`, and those are named here
 * now, with what they are and what they are not.
 *
 * `?meet=<moment>` RESOLVES TO `{ surface: 'meet', source: 'debug' }` — pinned
 * by `src/shell/shellRoute.test.ts` — and carries a SCRIPTED meet state plus a
 * stand-in lifter, because `frozenMeetFor` branches on exactly that `source`.
 * So the debug arm and the arm a player walks down are literally different
 * code, and this tool only ever runs the first.
 *
 * WHAT IS REAL ABOUT THOSE TWO SHOTS, because it is not nothing: `WalkoutView`
 * and `BombOutView` are the shipped components, they mount inside
 * `MeetScreen`'s own `CutInHost`, they offer their own beats, and the gate
 * decides with no arrangement. What is fabricated is the MEET the beats are
 * about — which attempt it is, what is banked, whose lifter it is.
 *
 * SO THE VARIABLE IS NOT CALLED `playedPath` ANY MORE. It was, and the name was
 * the whole defect: a record field, a console line and a `frames.json` key all
 * said "played" about the debug arm. `debugMeetPath` is what it is, the record
 * carries a `scope` field saying so in a sentence, and the two page loads assert
 * that the address bar really does carry the query string this header claims —
 * so the disclosure is pinned to a fact rather than to a comment somebody has to
 * keep true.
 *
 * WHERE THE PLAYED ARM IS CHECKED: `tools/verify-shell-route.mjs`, which reaches
 * meet day with a mouse and asserts an empty address bar at the moment it reads
 * the screen. Not here, and this tool does not pretend otherwise.
 *
 * Usage:
 *   node tools/capture-cutin.mjs [--url URL] [--out DIR]
 */
import { chromium } from 'playwright';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { completeCreateIfNeeded } from './enterMeetFromCalendar.mjs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decodePng, diffPixels } from './png.mjs';
import { numberInSource, parserSelfTest } from './readTuning.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const url = flag('url', 'http://localhost:8081');
// Refuses (with the reason and the fix named) unless tools/dev-web.sh started the
// server this URL names and it is still that process on that port — see
// devServerSentinel.mjs's header. UNMANAGED_DEV_SERVER=1 skips it, loudly.
gateDevServer({ url });
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
 * THE AUTO-DISMISS, READ OUT OF `cutInTuning.ts` — NOT TRANSCRIBED, AND THAT IS
 * A DELIBERATE EXCEPTION TO THE RULE ABOVE.
 *
 * `MOMENTS` above is restated on purpose: it is a second, independent statement
 * of what the piece is supposed to CONTAIN. This is not that. It is a number the
 * tool COMPARES AGAINST, and it was typed here by hand as `1720` — so the
 * question "did the tap beat the hold?" was being answered against a value the
 * app might have stopped using. On a build whose real hold was 10 ms,
 * `wellInsideTheHold` would still have come back true. `tools/readTuning.mjs`
 * has the whole argument for the split.
 *
 * The clause survived only because a DIFFERENT check in the same run bounded
 * the real hold: `leavesOnItsOwn.stillUp` at `STILL_UP_PROBE_MS` says the
 * overlay was demonstrably still up 700 ms in. That is a real bound and it stays
 * — but it is not the one the tap comparison was reading, and the comment on the
 * tap check claimed otherwise.
 *
 * A NULL READ IS A FAILURE, NOT A DEFAULT. A regex that has stopped matching
 * reports "not found", and a "not found" quietly replaced by a literal is
 * exactly the transcription this change removes.
 *
 * These are STARTING POINTS nobody has played (GDD §12.1). The tool checks the
 * timer fires inside a generous window around them rather than pinning them, so
 * a tuning pass moves one file and not two.
 */
const cutInTuningText = readFileSync(path.join(srcRoot, 'src', 'cutin', 'cutInTuning.ts'), 'utf8');
const parserComplaints = parserSelfTest();
const ENTER_MS = numberInSource(cutInTuningText, 'ENTER_MS');
const HOLD_MS = numberInSource(cutInTuningText, 'HOLD_MS');
const AUTO_DISMISS_MS = ENTER_MS === null || HOLD_MS === null ? null : ENTER_MS + HOLD_MS;
/** Non-zero when this tool could not read the number it compares against. */
const unreadTuning =
  parserComplaints.length > 0 || AUTO_DISMISS_MS === null
    ? [
        parserComplaints.length > 0 ? `readTuning.mjs self-test: ${parserComplaints.join('; ')}` : null,
        AUTO_DISMISS_MS === null
          ? `ENTER_MS=${ENTER_MS} HOLD_MS=${HOLD_MS} in src/cutin/cutInTuning.ts`
          : null,
      ].filter((line) => line !== null)
    : [];
if (unreadTuning.length > 0) {
  console.log('!! COULD NOT READ THE AUTO-DISMISS OUT OF cutInTuning.ts:');
  for (const line of unreadTuning) console.log('  ', line);
}

/**
 * How long an exit ANIMATION would have taken, if there were one.
 *
 * `CUT_IN_TUNING` had an `EXIT_MS` at 100 ms described as "how long it takes to
 * leave", and nothing performed it: `CutInView` has an arrival and no
 * departure, and `CutInHost` un-mounts the overlay synchronously on
 * `setLive(null)`. It was deleted rather than wired (`cutInTuning.ts`,
 * `ENTER_MS`), and this number is kept only as the yardstick that says so —
 * `tapDismissed.dismissTookMs` below is the measurement, recorded in
 * `frames.json` so a reader checks a field instead of trusting a sentence.
 *
 * REPORTED, NOT FAILED ON. A slow machine can take longer than a hundred
 * milliseconds to notice a node has detached, and a flaky red here would teach
 * the next person to stop running the tool.
 */
const AN_EXIT_ANIMATION_WOULD_HAVE_TAKEN_MS = 100;
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

/**
 * THE WIPE HAPPENS AFTER THE FIRST PAGE LOADS, NOT BEFORE THE BROWSER OPENS.
 *
 * It used to be here, and it cost committed evidence. The dev server had died
 * between one capture and the next; `page.goto` threw ERR_CONNECTION_REFUSED —
 * and by then the ten PNGs and `frames.json` were already deleted, so the
 * tracked directory was empty and the next `git add` swept the deletion into a
 * commit. `evidence.mjs --verify`'s non-vacuity guard caught it, which is the
 * guard working, but nothing should have needed catching: A TOOL THAT CANNOT
 * RUN MUST NOT BE ABLE TO DESTROY THE ARTIFACT IT WAS GOING TO REPLACE.
 *
 * The wipe still has to happen — a renamed or deleted frame would otherwise
 * linger and be read as current, which is this directory's whole failure mode.
 * It just belongs after the first successful `goto`, by which point the run is
 * committed to producing replacements.
 */
await mkdir(outDir, { recursive: true });

const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
// Sprint 2: the server persists a lifter across boots. Every goto in this tool
// means a FRESH one, so the boundary is armed rather than assumed.
await armFreshLifterPerBoot(context);
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
      behind: node('session-briefing') !== null,
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
          const n = document.querySelector('[data-testid="check-in-lift-squat"]');
          if (n === null) return null;
          const r = n.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return hit !== null && (n === hit || n.contains(hit));
        })(),
        shellNav: (() => {
          // The CAREER pill: the session's route toward a meet since Sprint 1c
          // deleted `shell-open-meet`. Any session pill serves this probe — the
          // measurement is about chrome painting above the overlay, not about
          // where the pill goes.
          const n = document.querySelector('[data-testid="shell-open-career"]');
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
await completeCreateIfNeeded(page);
await page.getByTestId('session-briefing').waitFor({ state: 'visible', timeout: 120000 });

// SAFE TO CLEAR NOW — see the block above `mkdir`. The page loaded and the app
// mounted, so this run will write replacements for everything it removes.
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

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
  await completeCreateIfNeeded(page);
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

/**
 * FNV-1a over a decoded frame's RGB. Alpha is skipped: a screenshot is opaque
 * and including it only slows the walk down.
 *
 * TAKES AN IMAGE, NOT A PATH, so the controls below can hash the same pixels
 * under two different names and a nudged copy of them under one — which is what
 * makes "this hash is of the picture" a measured statement rather than an
 * assumption about the implementation.
 */
function hashPixels(image) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < image.rgba.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      hash ^= image.rgba[i + c];
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

/**
 * THE FOUR FRAMES ARE FOUR FRAMES, MEASURED ON PIXELS.
 *
 * ===========================================================================
 * THIS COUNTER USED TO BE UNREACHABLE, AND THAT IS WHY IT CHANGED
 * ===========================================================================
 * The fingerprint was `{ line, art }` read off the DOM. `line` is unique per
 * moment BY THE SAME TABLE `wrongLine` checks, and `wrongLine` already fails on
 * any moment whose line is not its own — so `duplicates` could only exceed zero
 * in a run that had already failed for a different reason. It was a counter
 * that could never be the cause of a failure: it appeared in the exit
 * condition, in the summary line and in `frames.json`, and no state of the
 * subject would have moved it.
 *
 * WHAT IT ASKS NOW IS A QUESTION A DOM READ CANNOT ANSWER: are these four
 * PICTURES four pictures. `wrongLine` proves the right string is in the tree;
 * this proves the frame the player would see is not the same frame twice. The
 * two failure modes that separates — a line present in the DOM and not painted,
 * and a moment whose whole overlay failed to compose — are exactly the class
 * this repository keeps finding (a tunable "read by no pixel").
 *
 * THE ART IS EXPECTED TO BE IDENTICAL ACROSS THREE OF THE FOUR and that is not
 * what this measures: `alignedArtDiff` reports the panel, aligned to each
 * frame's own box, and prints its numbers without requiring them. What this
 * requires is that the FRAMES differ, which today they do because the line is
 * different type in a different place.
 */
const baselineImage = await imageOf(baselineFile);
const baselineHash = hashPixels(baselineImage);
const sameBytesElsewhere = hashPixels({
  width: baselineImage.width,
  height: baselineImage.height,
  rgba: Uint8Array.from(baselineImage.rgba),
});
const nudgedBytes = Uint8Array.from(baselineImage.rgba);
nudgedBytes[0] = nudgedBytes[0] ^ 0xff;
const nudgedHash = hashPixels({
  width: baselineImage.width,
  height: baselineImage.height,
  rgba: nudgedBytes,
});
/**
 * The hasher's two-sided control, in memory so it writes no frame nobody asked
 * for. Same pixels in a different buffer must hash the same; ONE channel of ONE
 * pixel flipped must not. Without the first, a hasher keyed on anything but the
 * picture would report zero duplicates for ever; without the second, a hasher
 * that returned a constant would report `notes.length - 1` and look like a
 * finding rather than a broken instrument.
 */
let hasherBlind = 0;
if (sameBytesElsewhere !== baselineHash || nudgedHash === baselineHash) {
  hasherBlind += 1;
  console.log(
    '!! THE FRAME HASHER IS NOT READING PIXELS — ' +
      `same bytes: ${sameBytesElsewhere === baselineHash ? 'same hash' : 'DIFFERENT HASH'}, ` +
      `one channel flipped: ${nudgedHash === baselineHash ? 'SAME HASH' : 'different hash'}`,
  );
}
for (const note of notes) {
  note.pixelHash = note.seen.present ? hashPixels(await imageOf(note.file)) : null;
}
const fingerprints = notes.map((n) => `${n.pixelHash}`);
let duplicates = fingerprints.length - new Set(fingerprints).size;
console.log(
  `frames               ${new Set(fingerprints).size} distinct picture(s) out of ${fingerprints.length}` +
    `${duplicates === 0 ? '' : ' !! TWO MOMENTS PHOTOGRAPHED THE SAME FRAME'}` +
    `  (baseline hashes ${baselineHash}, and no moment may match it)`,
);
for (const note of notes) {
  if (note.pixelHash !== baselineHash) continue;
  // A moment whose frame is byte-identical to the no-cut-in baseline is an
  // overlay that did not paint, whatever the DOM says about it.
  duplicates += 1;
  console.log(`!! ${note.moment} IS THE BASELINE FRAME — nothing was painted over the session`);
}

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
await completeCreateIfNeeded(page);
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
  const behind = await page.getByTestId('session-briefing').isVisible();
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
//
// AND THE COMPARISON IS AGAINST THE APP'S OWN NUMBER NOW. `AUTO_DISMISS_MS` was
// typed into this file as 1720 and is read out of `cutInTuning.ts` — see the
// block that reads it. "The tap did it, not the clock" was previously measured
// against a constant the app could have stopped using.
await page.goto(`${url}?cutin=bomb-out&live=1`, { waitUntil: 'load' });
await completeCreateIfNeeded(page);
let tapDismissed = null;
try {
  await page.getByTestId('cut-in').waitFor({ state: 'visible', timeout: 120000 });
  const appearedAt = Date.now();
  await page.mouse.click(12, 12);
  const tappedAt = Date.now() - appearedAt;
  await page.getByTestId('cut-in').waitFor({ state: 'detached', timeout: 5000 });
  const goneAt = Date.now() - appearedAt;
  await page.screenshot({ path: path.join(outDir, 'live-after-tap.png') });
  tapDismissed = {
    tappedAt,
    goneAt,
    // THE MEASUREMENT THREE COMMENTS USED TO QUOTE BY HAND. `cutInTuning.ts`
    // and this file both cited "tappedAt: 14, goneAt: 26" as the evidence that
    // nothing animates an exit, and the committed run said 16 / 27. The number
    // is now a FIELD a reader can open rather than a transcription that ages.
    dismissTookMs: goneAt - tappedAt,
    exitAnimationYardstickMs: AN_EXIT_ANIMATION_WOULD_HAVE_TAKEN_MS,
    wellInsideTheHold: AUTO_DISMISS_MS !== null && goneAt < AUTO_DISMISS_MS,
    holdReadFromSourceMs: AUTO_DISMISS_MS,
  };
  if (!tapDismissed.wellInsideTheHold) {
    // Otherwise this proved nothing: the hold would have taken it down anyway.
    timing += 1;
  }
  console.log(
    `tap to dismiss       tapped a CORNER ${tappedAt}ms after the shutter saw it, gone at ${goneAt}ms ` +
      `${tapDismissed.wellInsideTheHold ? `(the hold is ${AUTO_DISMISS_MS}ms, read from cutInTuning.ts, so the tap did it — not the clock)` : '!! THE HOLD MAY HAVE DONE IT'}`,
  );
  console.log(
    `                     the overlay left ${tapDismissed.dismissTookMs}ms after the tap ` +
      `(an exit animation would have been ~${AN_EXIT_ANIMATION_WOULD_HAVE_TAKEN_MS}ms; reported, not failed on)`,
  );
} catch (e) {
  timing += 1;
  console.log(`!! A CORNER TAP DID NOT DISMISS THE CUT-IN: ${String(e).split('\n')[0]}`);
}

// ---------------------------------------------------------------------------
// THE MEET SCREENS, ON THE DEBUG ARM: DOES THE BOMB-OUT FIX REACH THEM?
// ---------------------------------------------------------------------------
//
// THIS SECTION USED TO BE HEADED "THE PLAYED PATH" AND ITS VARIABLE WAS CALLED
// `playedPath`. It is not the played path. `?meet=<moment>` resolves to
// `{ surface: 'meet', source: 'debug' }` and `frozenMeetFor` branches on that
// `source`, so this is the debug arm wearing the played arm's name — in a
// console line, in a `frames.json` key and in the one sentence a reader of this
// file would have taken it from. The header now discloses it and the two loads
// below assert the address bar to prove the disclosure.
//
// Everything above is the cut-in's own debug route. This is the same question
// asked of the SHIPPED meet screens, through `?meet=<beat>` — `WalkoutView` and
// `BombOutView` mounting inside `MeetScreen`'s own `CutInHost`, offering their
// own beats, with the GATE arranged in no way at all. The MEET is arranged: the
// attempt, what is banked and whose lifter it is are all scripted, and that is
// the difference between this and a meet somebody lifted.
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

/**
 * The one sentence that says what these two shots are, carried in the record
 * rather than only in this file's header.
 *
 * A reader who opens `frames.json` is holding the artifact and not the source,
 * and the field this replaces was called `playedPath` — so the artifact itself
 * asserted the thing that was false. Written down once, here, so the console
 * line, the record and the header cannot drift apart.
 */
const DEBUG_MEET_SCOPE =
  'DEBUG ARM. ?meet=<moment> resolves to { surface: "meet", source: "debug" } and frozenMeetFor ' +
  'branches on that source, so the meet, the attempt and the lifter are all scripted. The ' +
  'SCREENS and the GATE are the shipped ones with nothing arranged. A meet a player lifted for ' +
  'is checked by tools/verify-shell-route.mjs, not here.';

/**
 * Read the address bar at the moment a shot is taken, and say what it carried.
 *
 * THE MIRROR OF THE RULE `verify-shell-route.mjs` FOLLOWS. That tool asserts the
 * query string is EMPTY when it reads a screen, so a quiet fallback to a debug
 * URL cannot make its section look complete. This tool is on the other side of
 * the same line: it asserts the query string is PRESENT and is the one it asked
 * for, so the disclosure above is pinned to something that executes rather than
 * to a comment somebody has to keep true. If these two loads ever become a real
 * drive, this goes red and the header has to be rewritten with it.
 */
function queryStringFault(pageUrl, expected) {
  if (!pageUrl.includes(`?${expected}`)) {
    return `expected the address bar to carry ?${expected} while the shot was taken, got ${JSON.stringify(pageUrl)}`;
  }
  return null;
}

let debugMeetPath = null;
let bombOutMissingOnMeetDay = 0;
let walkoutSpentTheSlot = 0;
let debugScopeUndisclosed = 0;
try {
  await page.goto(`${url}?meet=walkout-third`, { waitUntil: 'load' });
  await page.getByTestId('meet-walkout').waitFor({ state: 'visible', timeout: 120000 });
  // Read at the moment the screen is read, not after the navigation call, so
  // the record says where the shutter actually was.
  const walkoutAddressBar = page.url();
  const onWalkout = await sawACutInWithin(WATCH_FOR_A_CUT_IN_MS);
  await page.screenshot({ path: path.join(outDir, 'debug-meet-walkout-third.png') });

  await page.goto(`${url}?meet=bombed`, { waitUntil: 'load' });
  await page.getByTestId('meet-bombed').waitFor({ state: 'visible', timeout: 120000 });
  const bombedAddressBar = page.url();
  const onBombOut = await sawACutInWithin(WATCH_FOR_A_CUT_IN_MS);
  await page.screenshot({ path: path.join(outDir, 'debug-meet-bombed.png') });

  const urlFaults = [
    queryStringFault(walkoutAddressBar, 'meet=walkout-third'),
    queryStringFault(bombedAddressBar, 'meet=bombed'),
  ].filter((fault) => fault !== null);
  debugScopeUndisclosed += urlFaults.length;
  debugMeetPath = {
    scope: DEBUG_MEET_SCOPE,
    onWalkout,
    onBombOut,
    addressBar: { walkout: walkoutAddressBar, bombed: bombedAddressBar },
    urlFaults,
  };
  if (onWalkout !== null) walkoutSpentTheSlot += 1;
  if (onBombOut === null) bombOutMissingOnMeetDay += 1;
  for (const fault of urlFaults) console.log(`!! ${fault}`);
  console.log(
    `debug ?meet=walkout-third   cut-in: ${onWalkout === null ? 'none — the bomb is still live, so it is refused' : `!! ${JSON.stringify(onWalkout)} — A WALK-OUT THAT CAN STILL BOMB SPENT THE SLOT`}`,
  );
  console.log(
    `debug ?meet=bombed          cut-in: ${onBombOut === null ? '!! NONE — the somber counterpart got nothing' : `${JSON.stringify(onBombOut)}`}`,
  );
  console.log(`                     scope: ${DEBUG_MEET_SCOPE}`);
} catch (e) {
  walkoutSpentTheSlot += 1;
  console.log(`!! COULD NOT DRIVE THE DEBUG MEET PATH: ${String(e).split('\n')[0]}`);
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
  [unreadTuning.length, "timing value(s) this tool compares against could not be read out of cutInTuning.ts"],
  [hasherBlind, 'frame hasher(s) that are not reading pixels, so the duplicate count means nothing'],
  [missing, 'moment(s) showed no cut-in'],
  [wrongLine, 'wrong line(s) or hint(s)'],
  [duplicates, 'duplicate frame(s)'],
  [unreachableCorner, 'frame(s) had a corner the tap could not reach'],
  [notOnTop, 'frame(s) had the screen behind still taking taps'],
  [scrimDead, 'frame(s) had an opaque scrim'],
  [timing, 'timing check(s) failed'],
  [walkoutSpentTheSlot, "debug-arm walk-out(s) spent the bomb-out's slot"],
  [shellNavOverTheInterrupt, 'frame(s) had the shell pill on top of the cut-in (GDD §7.2)'],
  [
    debugScopeUndisclosed,
    'meet shot(s) whose address bar did not carry the debug query string this file’s header discloses',
  ],
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
      // RENAMED FROM `playedPath`, which is the finding this round closed: the
      // key said "played" about the debug arm, in the artifact a reader opens
      // instead of the source. It carries its own `scope` sentence now.
      debugMeetPath,
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
// THE SUMMARY READS `failures` TOO, and it did not: it restated seven of the
// counters by hand, so the two new ones added with this round would have been
// in the exit code, in `frames.json` and absent from the line a person reads.
// The block that builds the array says why there must not be a second copy of
// the condition; this was one.
console.log(failures.length === 0 ? 'nothing failed' : failures.join('; '));
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
