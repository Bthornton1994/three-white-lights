#!/usr/bin/env node
/**
 * Photographs meet day, beat by beat.
 *
 * WHY A DEBUG ROUTE RATHER THAN POINTER EVENTS. The same reason
 * `capture-session.mjs` and `capture-lift.mjs` exist, only more so: a third
 * attempt is nine attempts and a dozen timing inputs past the weigh-in, a limit
 * attempt is won inside a band of a few ticks, and a headless browser on a
 * loaded machine cannot land a press inside a band that narrow. Driving meet day
 * with clicks to reach its bomb-out beat photographs a meet that bombed the
 * squat by accident.
 *
 * So the MEET is scripted through `?meet=<moment>` (see
 * `src/game/meetPreview.ts`), which drives the same `stepMeetDay` the played
 * loop runs on, plays its reps through the real `runLift`, and hands the result
 * to the same components. No mock, no second renderer.
 *
 * THE PREVIEW IS FROZEN, so a beat holds still to be photographed:
 * `useMeetDay(preview, frozen)` stops the walkout, deliberation and verdict
 * timers. Without it a 1.5 s walkout would have advanced to the rep before the
 * shutter, which is how a run of "different" screenshots becomes three copies of
 * one screen.
 *
 * `--live` additionally drives the real loop with pointer events — confirm the
 * weigh-in, confirm the openers — and photographs the walkout it reaches. That
 * one proves the touch path is wired; the scripted ones prove what each screen
 * looks like.
 *
 * Usage:
 *   node tools/capture-meet.mjs [--url URL] [--out DIR] [--live]
 */
import { chromium } from 'playwright';
import { gateDevServer } from './devServerSentinel.mjs';
import { armFreshLifterPerBoot } from './freshLifterBoundary.mjs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { decodePng, diffPixels } from './png.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const url = flag('url', 'http://localhost:8081');
// Refuses (with the reason and the fix named) unless tools/dev-web.sh started the
// server this URL names and it is still that process on that port — see
// devServerSentinel.mjs's header. UNMANAGED_DEV_SERVER=1 skips it, loudly.
gateDevServer({ url });
const outDir = path.resolve(flag('out', '.gauntlet/shots/meet'));
const width = Number(flag('w', '390'));
const height = Number(flag('h', '844'));
const dpr = Number(flag('dpr', '2'));
// Long enough for the SLOWEST screen to finish assembling. The bomb-out beat
// is the one that decides it: BOMB_OUT_SILENCE_MS (1500) + three rows at
// BOMB_OUT_ROW_STAGGER_MS (700) + BOMB_OUT_ROW_FADE_MS (620) = 4220 ms, and a
// shorter settle photographs it with its last line — the way out — missing.
const settleMs = Number(flag('settle', '5200'));

/**
 * The beats, in loop order. Restated here rather than imported from the
 * TypeScript module on purpose: this tool is a second, independent statement of
 * what the sequence contains, and a capture that silently agreed with a broken
 * module would be worth nothing.
 */
const MOMENTS = [
  'weigh-in',
  'openers',
  'walkout',
  'walkout-third',
  'walkout-unrack',
  'walkout-step',
  'lift',
  'deliberation',
  'verdict-good',
  'verdict-split',
  'verdict-no-lift',
  'verdict-split-red',
  'select-after-make',
  'select-after-miss',
  'bombed',
  'recap',
  'recap-card',
];

/**
 * Which testID each beat MUST be showing. A hash comparison already let a
 * sequence of three identical frames through once elsewhere in this project; a
 * phase comparison would not have.
 */
const MOMENT_SCREEN = {
  'weigh-in': 'meet-weigh-in',
  openers: 'meet-openers',
  walkout: 'meet-walkout',
  'walkout-third': 'meet-walkout',
  'walkout-unrack': 'meet-walkout',
  'walkout-step': 'meet-walkout',
  lift: 'meet-attempt',
  deliberation: 'meet-deliberation',
  'verdict-good': 'meet-verdict',
  'verdict-split': 'meet-verdict',
  'verdict-no-lift': 'meet-verdict',
  'verdict-split-red': 'meet-verdict',
  'select-after-make': 'meet-attempt-select',
  'select-after-miss': 'meet-attempt-select',
  bombed: 'meet-bombed',
  recap: 'meet-recap',
  'recap-card': 'result-card-screen',
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

await rm(outDir, { recursive: true, force: true });
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

/**
 * Which beats must happen in the meet hall, and which deliberately must not.
 *
 * Restated here rather than imported for the same reason `MOMENTS` is: this
 * tool is a second, independent statement, and a capture that agreed with a
 * broken module by construction would be worth nothing. `meetStage.test.ts`
 * holds the same split as `STAGED_BEATS` / `UNSTAGED_BEATS`.
 *
 * The unstaged ones are the pre-meet paperwork (weigh-in, openers), the recap,
 * and the bomb-out — where GDD §6.3 wants a somber, emptied room and the empty
 * field IS the beat.
 */
const STAGED = new Set([
  'walkout',
  'walkout-third',
  'walkout-unrack',
  'walkout-step',
  'lift',
  'deliberation',
  'verdict-good',
  'verdict-split',
  'verdict-no-lift',
  'verdict-split-red',
  'select-after-make',
  'select-after-miss',
]);

/**
 * WHERE THE HALL IS IN A SCREENSHOT, in device pixels.
 *
 * Read off the running DOM — `MeetHallView`'s own marker node — and multiplied
 * by the device pixel ratio, rather than restated as a scanline. That matters
 * for what this tool is being asked: "do these two frames differ BELOW THE COPY
 * BLOCK". A hard-coded y would silently start measuring the wrong band the day
 * the layout moved, and the answer it produced would still look like a number.
 */
async function hallRegion() {
  const box = await page.evaluate(() => {
    const node = document.querySelector('[data-testid="meet-hall"]');
    if (node === null) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });
  if (box === null) return null;
  return {
    x: Math.round(box.x * dpr),
    y: Math.round(box.y * dpr),
    w: Math.round(box.w * dpr),
    h: Math.round(box.h * dpr),
  };
}

const decoded = new Map();
async function imageOf(file) {
  if (!decoded.has(file)) decoded.set(file, decodePng(await readFile(file)));
  return decoded.get(file);
}

/**
 * Differing device pixels between two shots, inside one region.
 *
 * TOLERANCE ZERO. Both frames come from the same SwiftShader canvas in the same
 * browser process, so identical content really is identical bytes here — and a
 * tolerance is exactly what would let a "different" frame that is actually the
 * same drawing slip through, which is the failure this whole check is about.
 */
async function differBy(fileA, fileB, region) {
  const a = await imageOf(fileA);
  const b = await imageOf(fileB);
  return diffPixels(a, b, region, { tolerance: 0 });
}

const notes = [];
let wrong = 0;
let roomless = 0;
let blocked = 0;
let motionless = 0;

for (const moment of MOMENTS) {
  await page.goto(`${url}?meet=${moment}`, { waitUntil: 'load' });
  const expected = MOMENT_SCREEN[moment];
  let showed = true;
  try {
    await page.getByTestId(expected).waitFor({ state: 'visible', timeout: 120000 });
  } catch {
    showed = false;
  }
  await page.waitForTimeout(settleMs);
  const file = path.join(outDir, `${moment}.png`);
  await page.screenshot({ path: file });

  // What the frame ACTUALLY shows, read off the DOM rather than assumed, so a
  // sequence of shots can be checked as semantically distinct instead of just
  // byte-distinct.
  const seen = await page.evaluate(() => {
    const text = (id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      return node === null ? null : node.textContent;
    };
    const present = (id) => document.querySelector(`[data-testid="${id}"]`) !== null;
    // WHICH BEATS HAVE A BUILDING IN THEM. Counted off the DOM rather than
    // asserted from the source, because the whole failure this run sent the
    // piece back for was a suite that named the room on one screen and a
    // sequence of frames that showed it on one screen. `meet-hall` is the
    // `MeetHallView` canvas; `attempt-touch` wraps the rep's own `LiftStage`,
    // which draws the same room a different way.
    const halls =
      document.querySelectorAll('[data-testid="meet-hall"]').length +
      document.querySelectorAll('[data-testid="attempt-touch"] canvas').length;
    // AND THE ROOM DOES NOT EAT THE DECISION. The attempt-choice screen draws
    // its hall as an absolutely-positioned layer that OVERLAPS both cards, so
    // "is the card still the thing under the player's thumb" is a real question
    // with a real way to be wrong. Answered by hit-testing the card's own centre
    // rather than by trusting `pointerEvents`.
    const hitTest = ['repeat', 'small', 'big']
      .map((id) => document.querySelector(`[data-testid="attempt-option-${id}"]`))
      .filter((card) => card !== null)
      .map((card) => {
        const box = card.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return card.contains(hit) || card === hit;
      });
    return {
      halls,
      cardsHittable: hitTest.length === 0 ? null : hitTest.every(Boolean),
      screens: [
        'meet-weigh-in',
        'meet-openers',
        'meet-attempt-select',
        'meet-walkout',
        'meet-attempt',
        'meet-deliberation',
        'meet-verdict',
        'meet-bombed',
        'meet-recap',
        'result-card-screen',
      ].filter(present),
      walkoutAttempt: text('walkout-attempt'),
      walkoutWeight: text('walkout-weight'),
      walkoutLine: text('walkout-line'),
      selectTitle: text('attempt-select-title'),
      selectBanked: text('attempt-select-banked'),
      floorWeight: text('attempt-select-floor-weight'),
      floorText: text('attempt-select-floor-text'),
      optionSmall: text('attempt-option-weight-small'),
      optionBig: text('attempt-option-weight-big'),
      optionRepeat: text('attempt-option-weight-repeat'),
      bombWarning: text('attempt-select-bomb-warning'),
      verdictCall: text('verdict-call'),
      verdictDeliberating: text('verdict-deliberating'),
      verdictLightsText: text('verdict-lights-text'),
      verdictFeedback: text('verdict-feedback'),
      bombCall: text('bomb-out-call'),
      bombKept: text('bomb-out-kept'),
      recapTotal: text('recap-total'),
      recapPr: text('recap-pr'),
      recapDots: text('recap-dots'),
      recapPlace: text('recap-place'),
      bodyText: (document.body.textContent ?? '').slice(0, 3000),
    };
  });

  const rightScreen = showed && seen.screens.includes(expected);
  if (!rightScreen) wrong += 1;
  const wantsHall = STAGED.has(moment);
  const staged = seen.halls > 0;
  if (wantsHall !== staged) roomless += 1;
  if (seen.cardsHittable === false) blocked += 1;
  const hall = staged ? await hallRegion() : null;
  notes.push({ moment, file, name: path.basename(file), expected, rightScreen, staged, hall, seen });
  console.log(
    `${moment.padEnd(20)} -> ${path.basename(file)}  ${rightScreen ? 'ok' : `!! EXPECTED ${expected}, SAW ${seen.screens.join(',') || 'nothing'}`}` +
      `  hall:${staged ? 'yes' : 'no '}${wantsHall === staged ? '' : ' !! EXPECTED ' + (wantsHall ? 'A HALL' : 'NO HALL')}` +
      `${seen.cardsHittable === null ? '' : seen.cardsHittable ? '  cards:hittable' : '  !! THE ROOM IS EATING THE CARDS'}`,
  );
}

// ---------------------------------------------------------------------------
// DOES THE WALK-OUT CONTAIN A WALK-OUT, AND DOES THE HALL KNOW WHICH ATTEMPT
// THIS IS?
//
// The measurement this section exists for, taken on the frames this run shipped
// before the choreography was built:
//
//     walkout.png (opener) vs walkout-third.png (third, nothing banked)
//     differing pixels:                22,467 of 1,316,640
//     row span of every difference:    y 204 to 439 — the copy block
//     differing pixels below y=640:    0
//
// Zero. Below the text they were the same frame, and every escalation a third
// attempt had lived in sound and haptics, which nothing here can hear or feel.
//
// So: measure the four walk-out frames against each other INSIDE THE HALL'S OWN
// BOX, and fail the capture on any pair that is the same picture. Compared in
// device pixels on the decoded PNGs, at zero tolerance.
// ---------------------------------------------------------------------------

/**
 * How many device pixels of the hall two frames must differ by.
 *
 * A FLOOR, not a pin. Measured on this build, over the hall's 811,200 device
 * pixels:
 *
 *     walkout        vs walkout-third   34,524   4.26%   urgency in the room
 *     walkout-unrack vs walkout-step    61,164   7.54%   two stages apart
 *     walkout-unrack vs walkout-third   71,280   8.79%
 *     walkout-step   vs walkout-third   70,380   8.68%
 *     live @650ms    vs live @1400ms    50,760   6.26%   the clock, running
 *
 * The floor sits an order of magnitude under the smallest of them, because the
 * question being asked is "is this the same picture" and the answer used to be
 * yes. Zero alone would be too weak: a single antialiased glyph moving would
 * clear it, and the whole point is that the HALL changed.
 */
const THE_HALL_MUST_DIFFER_BY = 10000;

/** Pairs whose halls MUST differ, and what each one is supposed to prove. */
const WALKOUT_PAIRS = [
  ['walkout', 'walkout-third', 'urgency reaches the hall'],
  ['walkout-unrack', 'walkout-step', 'the choreography moves between stages'],
  ['walkout-unrack', 'walkout-third', 'the unrack is not the settled pose'],
  ['walkout-step', 'walkout-third', 'the step back is not the settled pose'],
  ['deliberation', 'verdict-good', 'the hall reacts to three white lights'],
];

/**
 * Pairs whose halls MUST BE IDENTICAL — the other half of the claim, and the
 * one that keeps this channel scarce (GDD §7.2).
 *
 * A crowd that got up for everything would be wallpaper. A real hall goes quiet
 * on three reds, and giving the player a reacting room either way would be
 * giving them a reaction to nothing. Byte-identical is the right bar here: the
 * deliberation and a no-lift are the same lifter under the same bar in the same
 * room, so anything at all separating them is the room leaking a verdict.
 */
const SAME_HALL_PAIRS = [
  ['deliberation', 'verdict-no-lift', 'and stays seated for three reds'],
];

const hallDiffs = [];
for (const [a, b, why] of WALKOUT_PAIRS) {
  const noteA = notes.find((n) => n.moment === a);
  const noteB = notes.find((n) => n.moment === b);
  if (noteA === undefined || noteB === undefined || noteA.hall === null) {
    console.log(`!! CANNOT MEASURE ${a} vs ${b}: no hall was found in one of them`);
    motionless += 1;
    continue;
  }
  const { differing, total } = await differBy(noteA.file, noteB.file, noteA.hall);
  const share = ((differing / total) * 100).toFixed(2);
  hallDiffs.push({ a, b, why, differing, total, sharePct: Number(share) });
  const bad = differing < THE_HALL_MUST_DIFFER_BY;
  if (bad) motionless += 1;
  console.log(
    `hall ${a.padEnd(15)} vs ${b.padEnd(15)} ${String(differing).padStart(7)} / ${total} px (${share}%)  ` +
      `${bad ? `!! ${differing === 0 ? 'THE SAME PICTURE' : 'BARELY DIFFERENT'} — ` + why : why}`,
  );
}

for (const [a, b, why] of SAME_HALL_PAIRS) {
  const noteA = notes.find((n) => n.moment === a);
  const noteB = notes.find((n) => n.moment === b);
  if (noteA === undefined || noteB === undefined || noteA.hall === null) {
    console.log(`!! CANNOT MEASURE ${a} vs ${b}: no hall was found in one of them`);
    motionless += 1;
    continue;
  }
  const { differing, total } = await differBy(noteA.file, noteB.file, noteA.hall);
  hallDiffs.push({ a, b, why, differing, total, mustMatch: true });
  if (differing !== 0) motionless += 1;
  console.log(
    `hall ${a.padEnd(15)} vs ${b.padEnd(15)} ${String(differing).padStart(7)} / ${total} px         ` +
      `${differing === 0 ? why : '!! THE ROOM MOVED WHEN IT SHOULD NOT HAVE — ' + why}`,
  );
}

/**
 * A hash of one frame's hall, or `null` when the frame has no hall in it.
 *
 * FNV-1a over the hall's own box, decoded from the PNG that was actually
 * written. A hash rather than a diff because this is a set-membership question;
 * the distances that mean something are measured above, on named pairs.
 *
 * NO SHORTCUT FOR THE WALK-OUT FRAMES. It would be very easy to fall back to
 * the moment's name here for the frames that are hard to tell apart, and that
 * fallback would make the duplicate check unfailable for exactly the frames it
 * is being asked about. A frame with a hall is hashed from its pixels or the
 * capture cannot answer.
 */
async function hallFingerprintOf(note) {
  if (note.hall === null) return null;
  const image = await imageOf(note.file);
  let hash = 0x811c9dc5;
  const { x, y, w, h } = note.hall;
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const i = (row * image.width + col) * 4;
      for (let c = 0; c < 4; c += 1) {
        hash ^= image.rgba[i + c];
        hash = Math.imul(hash, 0x01000193);
      }
    }
  }
  return hash;
}

// Every scripted beat must be a DIFFERENT screen's worth of text — or, for the
// three shots of one attempt at three instants, a different hall.
//
// THE HALL IS IN THE FINGERPRINT, and it has to be: `walkout-third`,
// `walkout-unrack` and `walkout-step` are the SAME attempt with the same copy
// over it, so a text-only fingerprint would call two of them duplicates and a
// text-only fingerprint is also the weaker check — text is what a screen says,
// and the hall is what it shows.
const fingerprints = [];
for (const note of notes) {
  note.hallHash = await hallFingerprintOf(note);
  fingerprints.push(JSON.stringify({ ...note.seen, hall: note.hallHash }));
}
const duplicates = fingerprints.length - new Set(fingerprints).size;

let liveNote = null;
if (has('live')) {
  // THE PLAYED PATH, with the beat timers running. `?meet=live` mounts the same
  // screens with no preview state, so this shows that the walkout, deliberation
  // and verdict beats actually ELAPSE rather than merely having durations — the
  // one thing a frozen capture cannot show.
  await page.goto(`${url}?meet=live`, { waitUntil: 'load' });
  await page.getByTestId('meet-weigh-in').waitFor({ state: 'visible', timeout: 120000 });
  const started = Date.now();
  await page.getByTestId('weigh-in-action').click();
  await page.getByTestId('meet-openers').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, 'live-openers.png') });

  // Move an opener, so the override path is exercised rather than asserted.
  const before = await page.getByTestId('opener-weight-squat').textContent();
  await page.getByTestId('opener-up-squat').click();
  const after = await page.getByTestId('opener-weight-squat').textContent();

  await page.getByTestId('openers-action').click();
  await page.getByTestId('meet-walkout').waitFor({ state: 'visible', timeout: 20000 });
  const walkoutAppearedAt = Date.now();

  // TWO SHOTS OF ONE LIVE WALK-OUT, AND THIS IS THE ONLY INSTRUMENT ANYWHERE
  // THAT CAN WATCH THE HALL'S CLOCK RUN.
  //
  // Everything else about the choreography is checked on pure rasters by
  // `src/meet/walkout.test.ts`, and every one of those assertions stays green if
  // `useHallStep` is frozen to `sampleAt(0)` — the vitest suite runs in a node
  // environment with no renderer, so it cannot mount the component. Here the
  // component is really mounted, really animating, and photographed twice.
  //
  // WHY THESE TWO INSTANTS. Both are AFTER the last disc has landed, so the
  // bar-load clip window — which is driven by `setTimeout`, a different
  // mechanism — is fully open in both and cannot supply the difference. The
  // early one lands while he is still sitting under the bar in the rack, the
  // late one while he is stepping back. If the hall's clock is stopped, the two
  // are the same picture and the capture fails.
  const LIVE_EARLY_MS = 650;
  const LIVE_LATE_MS = 1400;
  await page.waitForTimeout(LIVE_EARLY_MS);
  await page.screenshot({ path: path.join(outDir, 'live-walkout.png') });
  const walkoutSeenAt = Date.now();
  const liveHall = await hallRegion();

  const untilLate = LIVE_LATE_MS - (Date.now() - walkoutAppearedAt);
  if (untilLate > 0) await page.waitForTimeout(untilLate);
  const lateAt = Date.now() - walkoutAppearedAt;
  const stillWalkingOut = await page.getByTestId('meet-walkout').isVisible();
  await page.screenshot({ path: path.join(outDir, 'live-walkout-late.png') });

  let liveMotion = null;
  if (!stillWalkingOut) {
    // The second shutter missed the beat. Reported as a failure rather than
    // waved through: a comparison against the wrong screen would produce a
    // large, meaningless number and look like a pass.
    console.log(`!! THE LIVE WALK-OUT ENDED BEFORE ITS SECOND SHOT (${lateAt}ms in)`);
    motionless += 1;
  } else if (liveHall === null) {
    console.log('!! NO HALL IN THE LIVE WALK-OUT TO MEASURE');
    motionless += 1;
  } else {
    const { differing, total } = await differBy(
      path.join(outDir, 'live-walkout.png'),
      path.join(outDir, 'live-walkout-late.png'),
      liveHall,
    );
    liveMotion = { earlyMs: LIVE_EARLY_MS, lateMs: lateAt, differing, total };
    // A weaker bound than the frozen pairs get, and deliberately: WHICH two
    // drawings this lands on depends on how the machine was loaded, so the
    // honest question here is "did anything move", not "did this much move".
    if (differing === 0) motionless += 1;
    console.log(
      `hall live @${LIVE_EARLY_MS}ms vs @${lateAt}ms  ${String(differing).padStart(7)} / ${total} px ` +
        `(${((differing / total) * 100).toFixed(2)}%)  ` +
        `${differing === 0 ? '!! THE HALL CLOCK IS STOPPED' : 'the beat animates on its own'}`,
    );
  }

  // ...and wait for the walkout beat to hand over to the rep ON ITS OWN.
  await page.getByTestId('meet-attempt').waitFor({ state: 'visible', timeout: 20000 });
  const walkoutHeldMs = Date.now() - walkoutSeenAt;
  await page.screenshot({ path: path.join(outDir, 'live-attempt.png') });

  liveNote = {
    moment: 'live',
    msFromWeighInToWalkout: walkoutSeenAt - started,
    walkoutHeldMs,
    openerBefore: before,
    openerAfter: after,
    openerOverrideTook: before !== after,
    liveMotion,
  };
  notes.push({ moment: 'live', file: 'live-walkout.png', expected: 'meet-walkout', rightScreen: true, seen: liveNote });
  console.log(`live                 -> live-openers.png / live-walkout.png / live-walkout-late.png / live-attempt.png ${JSON.stringify(liveNote)}`);
}

await writeFile(
  path.join(outDir, 'frames.json'),
  `${JSON.stringify({ frames: notes, hallDiffs }, null, 2)}\n`,
);
if (errors.length > 0) {
  console.log('PAGE ERRORS:');
  for (const e of errors.slice(0, 10)) console.log('  ', e);
}
await browser.close();
console.log(`\nwrote ${notes.length} frames to ${outDir}`);
console.log(
  `${wrong} frame(s) showed the wrong screen; ${duplicates} duplicate frame(s); ` +
    `${roomless} frame(s) had the wrong answer to "is there a building in this shot"; ` +
    `${blocked} frame(s) had the room sitting on top of the attempt cards; ` +
    `${motionless} hall comparison(s) came back as the same picture`,
);
process.exit(
  wrong === 0 && duplicates === 0 && roomless === 0 && blocked === 0 && motionless === 0 ? 0 : 1,
);
