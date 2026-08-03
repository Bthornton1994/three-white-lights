#!/usr/bin/env node
/**
 * Verification of a captured lift sequence — half semantic, half photographic.
 *
 * WHY A HASH CHECK IS NOT ENOUGH, stated because this tool exists entirely
 * because of it: a previous "maximal sequence" was three screenshots of the
 * same resolved NO LIFT frame. They differed only by a dev-menu glyph, so every
 * byte hash was distinct and the sequence passed. It contained zero ascent
 * frames, zero sticking-point frames and zero grind — it was evidence of
 * nothing at all.
 *
 * WHY A HASH CHECK PLUS A PROBE WAS STILL NOT ENOUGH, stated because the
 * SECOND version of this tool shipped that and was also blind: it hashed whole
 * stage PNGs and compared probe fields. The whole-canvas hash includes the
 * bar-path trace, which is redrawn from `history` at every beat and therefore
 * differs between any two beats no matter what the LIFTER does — so the
 * "different sprite spec must mean different pixels" clause could never fire.
 * And the heaviness verdict was computed entirely from probe numbers, which are
 * the renderer's INPUTS. Copying the light sequence's PNGs over the maximal
 * one's, leaving both manifests alone, passed. A renderer that ignored strain,
 * tilt and bend — or drew nothing at all — passed.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS MEASURED HERE, AND WHAT IS TAKEN ON TRUST
 * ---------------------------------------------------------------------------
 * This is the half that matters, and the previous header restated the wrong
 * one. Restating a THRESHOLD independently is worth nothing if the MEASUREMENT
 * it is applied to came from the code under test.
 *
 * TAKEN ON TRUST FROM THE APP (`probe`, written by `src/lift/liftReplay.ts`):
 *   phase, tick, height, netForce, strainLevel, pitchLevel, barForwardPx,
 *   frameKey, loadRatio. These are the renderer's INPUTS. Every claim resting
 *   on them is a claim about what the app SAYS it drew, and is labelled as such
 *   in the output. `strainLevel` in particular is never confirmed by a pixel:
 *   nothing here can see a "strain rung".
 *
 * MEASURED HERE, FROM THE PNG BYTES, BY DECODING THEM (`tools/png.mjs`):
 *   - the stage image's own dimensions, from which the device scale is derived
 *     rather than read out of the manifest
 *   - how many pixels of the LIFTER REGION differ between two beats of one
 *     sequence. The lifter region is the sprite box with the cue ring's
 *     footprint punched out and the bar-path panel excluded, so neither the
 *     trace nor the shrinking cue ring can stand in for a sprite that moved.
 *   - how many pixels of the lifter region differ between the maximal and the
 *     light sequence at beats where the bar is at the SAME HEIGHT, so the
 *     difference cannot be explained by position
 *   - how far right of the plumb line the bar-path plot actually draws ink, in
 *     each sequence, at each beat
 *
 * WHAT THE SIGN-OFF THEREFORE CLAIMS is narrower than "the maximal one animates
 * heavier", which was the old claim and was backed by no image operation at
 * all. It claims the two loads are DRAWN DIFFERENTLY at matched bar heights and
 * that the maximal bar is DRAWN FURTHER FORWARD OF PLUMB. Whether that reads as
 * heavier to a human eye is GDD §12.2's blind A/B, and a script does not get to
 * answer it.
 *
 * The expected phases, the sticking-point height, the stage geometry and the
 * top strain rung are still written out below rather than imported from `src/`,
 * for the original reason: a verifier that imported its expectations from the
 * code under test would agree with it however wrong it was. That is necessary
 * and not sufficient, which is what the paragraphs above are for.
 *
 * Usage: node tools/verify-lift-shots.mjs [--root .gauntlet/shots]
 *                                         [--heavy L1-maximal] [--light L1-light]
 */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { decodePng, diffPixels, scaleHole, scaleRegion } from './png.mjs';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const root = path.resolve(flag('root', '.gauntlet/shots'));
const heavyDir = flag('heavy', 'L1-maximal');
const lightDir = flag('light', 'L1-light');

// ---------------------------------------------------------------------------
// EVERY THRESHOLD THIS TOOL APPLIES, IN ONE PLACE.
//
// CLAUDE.md, "Game Feel Values Must Be Tunable": these get moved by hand. The
// pixel fractions in particular are margins, not measurements — the values
// below were chosen with 3x to 5x headroom over what the real captured
// sequences produce, and the run prints the observed minimum next to each so
// the headroom is visible rather than asserted.
// ---------------------------------------------------------------------------

/** The beats a sequence must contain, in order, and the phase each must be in. */
const EXPECTED = [
  ['brace', 'BRACE'],
  ['descent', 'DESCENT'],
  ['depth-cue', 'DESCENT'],
  ['hole', 'HOLE'],
  ['drive-cue', 'ASCENT'],
  ['losing', 'ASCENT'],
  ['sticking-point', 'ASCENT'],
  ['lockout', 'LOCKOUT'],
  ['result', 'RESOLVED'],
];

/** Independent restatement of STICK.HEIGHT_FRAC in `src/art/spriteTuning.ts`. */
const STICK_HEIGHT = 0.34;
/** How near the stall height a "sticking-point" shot has to be to earn the name. */
const STICK_TOLERANCE = 0.06;
/** Independent restatement of STRAIN.LEVELS - 1: the top authored strain rung. */
const TOP_STRAIN_LEVEL = 3;
/** Beats at which a maximal attempt must outdraw a light one in strain. PROBE-BASED. */
const MIN_STRICTLY_HEAVIER_BEATS = 3;
/** Ascent shots a sequence must contain to be evidence of an ascent at all. */
const MIN_ASCENT_SHOTS = 3;

/**
 * STAGE GEOMETRY, in logical points, restated from `LIFT_TUNING.LAYOUT` and
 * `SPRITE_BOX`. The stage screenshot is the Skia canvas and nothing else, so
 * these rectangles are the only map this tool has from "a region of the frame"
 * to "a thing the mechanic draws".
 */
const STAGE = Object.freeze({ W: 390, H: 520 });
/** The lifter: LAYOUT.SPRITE_X/Y, and RESOLUTION.CELL_W/H x FEEDBACK.SPRITE_SCALE. */
const SPRITE_BOX = Object.freeze({ x: 6, y: 292, w: 96 * 3, h: 72 * 3 });
/**
 * The cue ring's footprint, punched out of the lifter region.
 *
 * THIS HOLE IS LOAD-BEARING. The ring is centred on the lifter and shrinks
 * every tick; without the hole, a completely frozen sprite would still show
 * "different pixels" between beats and the frozen-sprite check would be as
 * vacuous as the hash check it replaces. Radius is CUE_RING_OUTER_R (46) plus
 * the stroke and a pixel of antialiasing.
 */
const CUE_HOLE = Object.freeze({ cx: 150, cy: 374, r: 50 });
/** The bar-path plot: LAYOUT.TRACE_X / TRACE_W / TRACE_TOP / TRACE_BOTTOM. */
const TRACE_PANEL = Object.freeze({ x: 300, y: 20, w: 78, h: 480 });
/** The plumb line on that plot: traceX(0) = TRACE_X + TRACE_W / 2. */
const PLUMB_X = 339;

/**
 * Per-channel difference below which two pixels count as the same.
 *
 * A screenshot of a GPU canvas is not bit-reproducible between runs; measured
 * drift between two captures of the identical frame is a few units. This must
 * stay far under what an authored pose change moves, and it does — the smallest
 * real pose change below moves 5% of the region by far more than 8/255.
 */
const PIXEL_TOLERANCE = 8;

/**
 * Luma above which a pixel in the bar-path panel counts as drawn ink.
 *
 * The panel background (#1f2430), the sticking-point band (#2b2436), the plumb
 * line (#333a4a) and the legal-depth line (#7a6a3f) are all below 110; the
 * trace (#7fb2ff) and the bar glyph (#c9d2e2) are both above 160. Anything from
 * 110 to 150 gives the identical answer on real captures, so this sits in the
 * middle of that plateau.
 */
const TRACE_INK_LUMA = 120;

/** Bar-height change above which two beats of one sequence must look different. */
const HEIGHT_MOVED = 0.02;
/** Bar-height gap below which two beats of DIFFERENT sequences count as matched. */
const HEIGHT_MATCHED = 0.02;
/** Fraction of the lifter region that must change when the bar has moved. */
const MIN_SPRITE_MOVE_FRAC = 0.01;
/** Fraction of the lifter region that must differ between loads at a matched height. */
const MIN_LOAD_DIFF_FRAC = 0.02;
/** Height-matched beats the two sequences must share for that check to mean anything. */
const MIN_HEIGHT_MATCHED_BEATS = 4;
/** Logical points of forward reach the maximal bar may lose to the light one anywhere. */
const FORWARD_REGRESSION_SLACK_PT = 1;
/** Logical points beyond which "further forward" is a drawing and not antialiasing. */
const FORWARD_SIGNIFICANT_PT = 1.5;
/** Beats at which the maximal bar must be drawn significantly further forward. */
const MIN_FURTHER_FORWARD_BEATS = 4;

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

/**
 * The device scale of a stage capture, derived from the image itself.
 *
 * Read from the pixels rather than from `manifest.viewport.deviceScaleFactor`
 * on purpose: the manifest is written by the capture tool, and every region
 * below is meaningless if the picture is not the stage at a whole multiple.
 */
function stageScale(image, tag) {
  const sx = image.width / STAGE.W;
  const sy = image.height / STAGE.H;
  if (sx !== sy || !Number.isInteger(sx) || sx < 1) {
    fail(
      `${tag}: stage PNG is ${image.width}x${image.height}, which is not ${STAGE.W}x${STAGE.H} at a ` +
        `whole scale — the capture is not a picture of the stage`,
    );
    return null;
  }
  return sx;
}

/**
 * Rightmost drawn bar-path pixel, as logical points right of the plumb line.
 *
 * This is the one DIRECTIONAL pixel measurement in the tool. It reads the plot,
 * not the sprite: forward drift reaches the head-on sprite only as the body
 * folding, but on the side-on plot it is literally how far right the ink goes.
 */
function forwardInkReachPt(image, scale) {
  const region = scaleRegion(TRACE_PANEL, scale);
  const plumb = PLUMB_X * scale;
  let maxX = -Infinity;
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x + region.w - 1; x >= region.x; x -= 1) {
      if (x <= maxX) break;
      const i = (y * image.width + x) * 4;
      const luma = 0.2126 * image.rgba[i] + 0.7152 * image.rgba[i + 1] + 0.0722 * image.rgba[i + 2];
      if (luma >= TRACE_INK_LUMA) {
        maxX = x;
        break;
      }
    }
  }
  return maxX === -Infinity ? null : (maxX - plumb) / scale;
}

async function loadSequence(dirName) {
  const dir = path.join(root, dirName);
  const manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
  for (const shot of manifest.shots) {
    const full = path.join(root, shot.full);
    const stage = path.join(root, shot.stage);
    const fullStat = await stat(full).catch(() => null);
    const stageStat = await stat(stage).catch(() => null);
    if (fullStat === null || fullStat.size === 0) fail(`${dirName}/${shot.moment}: missing full PNG`);
    if (stageStat === null || stageStat.size === 0) fail(`${dirName}/${shot.moment}: missing stage PNG`);
    shot.fullHash = fullStat === null ? null : await sha256(full);
    shot.stageImage = null;
    shot.scale = null;
    if (stageStat !== null && stageStat.size > 0) {
      try {
        shot.stageImage = decodePng(await readFile(stage));
        shot.scale = stageScale(shot.stageImage, `${dirName}/${shot.moment}`);
      } catch (e) {
        fail(`${dirName}/${shot.moment}: stage PNG did not decode: ${e.message}`);
      }
    }
  }
  return { dirName, dir, ...manifest };
}

function checkSequence(seq) {
  const tag = seq.dirName;

  // --- structure ---------------------------------------------------------
  if (seq.shots.length !== EXPECTED.length) {
    fail(`${tag}: ${seq.shots.length} shots, expected ${EXPECTED.length}`);
  }
  for (let i = 0; i < EXPECTED.length; i += 1) {
    const [moment, phase] = EXPECTED[i];
    const shot = seq.shots[i];
    if (!shot) {
      fail(`${tag}: missing shot ${i} (${moment})`);
      continue;
    }
    if (shot.moment !== moment) fail(`${tag}: shot ${i} is ${shot.moment}, expected ${moment}`);
    if (!shot.probe) {
      fail(`${tag}/${moment}: no probe — the shot may be of a live rep, not the named beat`);
      continue;
    }
    // THE CHECK THAT WOULD HAVE CAUGHT THE OLD SEQUENCE.
    if (shot.probe.phase !== phase) {
      fail(`${tag}/${moment}: rendered phase ${shot.probe.phase}, expected ${phase}`);
    }
    if (shot.probe.loadRatio !== seq.loadRatio) {
      fail(`${tag}/${moment}: probe load ${shot.probe.loadRatio}, manifest ${seq.loadRatio}`);
    }
  }

  const probed = seq.shots.filter((s) => s.probe);

  // --- semantic distinctness (PROBE-BASED, stated as such) ----------------
  const ticks = probed.map((s) => s.probe.tick);
  if (new Set(ticks).size !== ticks.length) {
    fail(`${tag}: two shots are the same tick of the same rep (${ticks.join(',')})`);
  }
  const identities = probed.map((s) =>
    [s.probe.phase, s.probe.prompt, s.probe.frameKey, s.probe.historyTicks].join('|'),
  );
  if (new Set(identities).size !== identities.length) {
    fail(`${tag}: two shots show an identical state`);
  }
  const fullHashes = probed.map((s) => s.fullHash);
  if (new Set(fullHashes).size !== fullHashes.length) {
    fail(`${tag}: two shots are byte-identical`);
  }

  // --- PIXELS: the LIFTER moves when the bar moves ------------------------
  //
  // Gated on the bar's height rather than on `frameKey`, and comparing the
  // lifter region rather than the canvas, because both of those were how the
  // previous version of this check managed to be unfalsifiable. Two beats at
  // different bar heights CANNOT be the same drawing of a lifter; if they are,
  // the sprite is frozen and the movement on screen is the trace and the cue
  // ring, which are drawn from history and from the clock.
  const withPixels = probed.filter((s) => s.stageImage !== null && s.scale !== null);
  const spriteMoves = [];
  let comparedRegionPx = 0;
  for (let i = 0; i < withPixels.length; i += 1) {
    for (let j = i + 1; j < withPixels.length; j += 1) {
      const a = withPixels[i];
      const b = withPixels[j];
      if (Math.abs(a.probe.height - b.probe.height) <= HEIGHT_MOVED) continue;
      if (a.scale !== b.scale) {
        fail(`${tag}: ${a.moment} and ${b.moment} were captured at different scales`);
        continue;
      }
      let result;
      try {
        result = diffPixels(a.stageImage, b.stageImage, scaleRegion(SPRITE_BOX, a.scale), {
          tolerance: PIXEL_TOLERANCE,
          holes: [scaleHole(CUE_HOLE, a.scale)],
        });
      } catch (e) {
        fail(`${tag}: ${a.moment} vs ${b.moment}: ${e.message}`);
        continue;
      }
      comparedRegionPx = result.total;
      const frac = result.differing / result.total;
      spriteMoves.push({ a: a.moment, b: b.moment, frac });
      if (frac < MIN_SPRITE_MOVE_FRAC) {
        fail(
          `${tag}: the bar moves from h=${a.probe.height.toFixed(3)} (${a.moment}) to ` +
            `h=${b.probe.height.toFixed(3)} (${b.moment}) but only ${(frac * 100).toFixed(3)}% of the ` +
            `LIFTER's pixels change (need ${(MIN_SPRITE_MOVE_FRAC * 100).toFixed(1)}%) — the sprite is ` +
            `frozen and only the trace and cue ring are animating`,
        );
      }
    }
  }
  if (spriteMoves.length === 0 && withPixels.length > 0) {
    fail(`${tag}: no two beats are more than ${HEIGHT_MOVED} apart in height — nothing to compare`);
  }
  const weakest = spriteMoves.reduce(
    (min, m) => (m.frac < min.frac ? m : min),
    { a: '-', b: '-', frac: Infinity },
  );
  if (spriteMoves.length > 0) {
    notes.push(
      `${tag}: ${spriteMoves.length} beat pairs at different bar heights; the least the lifter ` +
        `changes across any of them is ${(weakest.frac * 100).toFixed(1)}% of ${comparedRegionPx} ` +
        `compared pixels (${weakest.a} vs ${weakest.b}), against a floor of ` +
        `${(MIN_SPRITE_MOVE_FRAC * 100).toFixed(1)}%`,
    );
  }

  // --- the sequence contains an ascent at all (PROBE-BASED) ---------------
  const ascent = probed.filter((s) => s.probe.phase === 'ASCENT');
  if (ascent.length < MIN_ASCENT_SHOTS) {
    fail(`${tag}: only ${ascent.length} ascent shots, expected at least ${MIN_ASCENT_SHOTS}`);
  }
  const atStick = ascent.filter(
    (s) => Math.abs(s.probe.height - STICK_HEIGHT) <= STICK_TOLERANCE,
  );
  if (atStick.length === 0) {
    fail(`${tag}: no shot within ${STICK_TOLERANCE} of the sticking point (h ${STICK_HEIGHT})`);
  }
  const resolved = probed.find((s) => s.probe.phase === 'RESOLVED');
  if (resolved && resolved.probe.outcome === 'miss') {
    fail(`${tag}: the captured rep was a miss, so it cannot show a lockout`);
  }

  // --- PIXELS: how far forward the plot actually draws the bar ------------
  const forward = new Map();
  for (const shot of withPixels) {
    const reach = forwardInkReachPt(shot.stageImage, shot.scale);
    if (reach === null) {
      fail(`${tag}/${shot.moment}: the bar-path panel has no drawn ink at all`);
      continue;
    }
    forward.set(shot.moment, reach);
  }

  return {
    tag,
    probed,
    withPixels,
    ascent,
    forward,
    maxStrain: Math.max(...probed.map((s) => s.probe.strainLevel)),
    minAscentNet: Math.min(...ascent.map((s) => s.probe.netForce)),
    maxForward: Math.max(...probed.map((s) => s.probe.barForwardPx)),
  };
}

const heavy = checkSequence(await loadSequence(heavyDir));
const light = checkSequence(await loadSequence(lightDir));

// --- the maximal attempt really is a maximal attempt (PROBE-BASED) -------
if (!(heavy.minAscentNet < 0)) {
  fail(
    `${heavy.tag}: no ascent shot has the bar losing (min net force ${heavy.minAscentNet}) — ` +
      `there is no grind in this sequence`,
  );
}
if (heavy.maxStrain !== TOP_STRAIN_LEVEL) {
  fail(
    `${heavy.tag}: peak strain level ${heavy.maxStrain}, expected the top authored rung ` +
      `${TOP_STRAIN_LEVEL}`,
  );
}

// --- GDD §12.2, the part a probe can speak to ----------------------------
// These compare the renderer's INPUTS. They say what the app intended to draw.
// They are kept because an intent that is already wrong needs no picture, but
// they are NOT the heaviness evidence and the sign-off does not treat them as
// such.
if (!(light.minAscentNet >= 0)) {
  fail(`${light.tag}: the light rep is losing somewhere, so it is not a fair comparison`);
}
if (!(heavy.maxStrain > light.maxStrain)) {
  fail(
    `peak strain: maximal ${heavy.maxStrain} vs light ${light.maxStrain} — the heavy rep does ` +
      `not draw more strained`,
  );
}
if (!(heavy.maxForward > light.maxForward)) {
  fail(`peak forward drift: maximal ${heavy.maxForward} vs light ${light.maxForward}`);
}

let strictlyHeavier = 0;
for (const [moment] of EXPECTED) {
  const h = heavy.probed.find((s) => s.moment === moment);
  const l = light.probed.find((s) => s.moment === moment);
  if (!h || !l) continue;
  if (h.probe.strainLevel < l.probe.strainLevel) {
    fail(`${moment}: maximal draws LESS strained (${h.probe.strainLevel}) than light (${l.probe.strainLevel})`);
  }
  if (h.probe.strainLevel > l.probe.strainLevel) strictlyHeavier += 1;
}
if (strictlyHeavier < MIN_STRICTLY_HEAVIER_BEATS) {
  fail(
    `only ${strictlyHeavier} beats draw the maximal attempt strictly heavier, expected at least ` +
      `${MIN_STRICTLY_HEAVIER_BEATS}`,
  );
}
notes.push(
  `PROBE (not pixels): ${strictlyHeavier}/${EXPECTED.length} beats report the maximal attempt at a ` +
    `higher strain rung`,
);

// --- GDD §12.2, the part PIXELS can speak to -----------------------------
//
// (1) At beats where the two reps have the bar at the SAME height, the lifter
//     must still be drawn differently. Matching on height is what makes this a
//     statement about LOAD: if the two frames differ at the same bar position,
//     the difference is what the weight did to the lifter, and it is measured
//     by decoding both PNGs rather than by reading a strain number back out of
//     the app that produced it.
const pixelBeats = [];
let matchedBeats = 0;
let weakestLoadDiff = { moment: '-', frac: Infinity };
for (const [moment] of EXPECTED) {
  const h = heavy.withPixels.find((s) => s.moment === moment);
  const l = light.withPixels.find((s) => s.moment === moment);
  const row = { moment, heightGap: null, lifterDiffPct: null, forwardHeavyPt: null, forwardLightPt: null };
  if (h && l && h.scale === l.scale) {
    const gap = Math.abs(h.probe.height - l.probe.height);
    row.heightGap = Number(gap.toFixed(4));
    if (gap <= HEIGHT_MATCHED) {
      matchedBeats += 1;
      try {
        const result = diffPixels(h.stageImage, l.stageImage, scaleRegion(SPRITE_BOX, h.scale), {
          tolerance: PIXEL_TOLERANCE,
          holes: [scaleHole(CUE_HOLE, h.scale)],
        });
        const frac = result.differing / result.total;
        row.lifterDiffPct = Number((frac * 100).toFixed(2));
        if (frac < weakestLoadDiff.frac) weakestLoadDiff = { moment, frac };
        if (frac < MIN_LOAD_DIFF_FRAC) {
          fail(
            `${moment}: the two loads put the bar at the same height (gap ${gap.toFixed(3)}) but only ` +
              `${(frac * 100).toFixed(3)}% of the LIFTER's pixels differ between them (need ` +
              `${(MIN_LOAD_DIFF_FRAC * 100).toFixed(1)}%) — the drawing is not responding to load`,
          );
        }
      } catch (e) {
        fail(`${moment}: cross-load pixel compare failed: ${e.message}`);
      }
    }
  }
  row.forwardHeavyPt = heavy.forward.has(moment) ? Number(heavy.forward.get(moment).toFixed(2)) : null;
  row.forwardLightPt = light.forward.has(moment) ? Number(light.forward.get(moment).toFixed(2)) : null;
  pixelBeats.push(row);
}
if (matchedBeats < MIN_HEIGHT_MATCHED_BEATS) {
  fail(
    `only ${matchedBeats} beats put the two reps at the same bar height (need ` +
      `${MIN_HEIGHT_MATCHED_BEATS}) — there is no position-controlled pixel comparison to make`,
  );
} else {
  notes.push(
    `PIXELS: at ${matchedBeats} beats the two reps are within ${HEIGHT_MATCHED} of the same bar ` +
      `height, and the least the lifter differs between loads at any of them is ` +
      `${(weakestLoadDiff.frac * 100).toFixed(1)}% (${weakestLoadDiff.moment}), against a floor of ` +
      `${(MIN_LOAD_DIFF_FRAC * 100).toFixed(1)}%`,
  );
}

// (2) The one DIRECTIONAL pixel claim: the bar-path plot draws the maximal
//     bar further forward of plumb than the light one. Not "heavier" — further
//     forward, which is a fact about ink position and is checkable.
let furtherForward = 0;
for (const [moment] of EXPECTED) {
  const h = heavy.forward.get(moment);
  const l = light.forward.get(moment);
  if (h === undefined || l === undefined) continue;
  if (h < l - FORWARD_REGRESSION_SLACK_PT) {
    fail(
      `${moment}: the bar-path plot draws the MAXIMAL bar ${(l - h).toFixed(1)}pt LESS far forward of ` +
        `plumb than the light one (${h.toFixed(1)}pt vs ${l.toFixed(1)}pt)`,
    );
  }
  if (h > l + FORWARD_SIGNIFICANT_PT) furtherForward += 1;
}
if (furtherForward < MIN_FURTHER_FORWARD_BEATS) {
  fail(
    `PIXELS: only ${furtherForward} beats draw the maximal bar more than ${FORWARD_SIGNIFICANT_PT}pt ` +
      `further forward of plumb than the light one (need ${MIN_FURTHER_FORWARD_BEATS}) — on screen ` +
      `the two bar paths are the same shape`,
  );
} else {
  notes.push(
    `PIXELS: ${furtherForward}/${EXPECTED.length} beats draw the maximal bar more than ` +
      `${FORWARD_SIGNIFICANT_PT}pt further forward of plumb than the light one`,
  );
}

// --- report --------------------------------------------------------------
const table = EXPECTED.map(([moment]) => {
  const h = heavy.probed.find((s) => s.moment === moment)?.probe ?? null;
  const l = light.probed.find((s) => s.moment === moment)?.probe ?? null;
  return {
    moment,
    maximal: h && {
      tick: h.tick,
      phase: h.phase,
      prompt: h.prompt,
      height: h.height,
      netForce: h.netForce,
      strain: h.strainLevel,
      pitch: h.pitchLevel,
      forwardPx: h.barForwardPx,
    },
    light: l && {
      tick: l.tick,
      phase: l.phase,
      prompt: l.prompt,
      height: l.height,
      netForce: l.netForce,
      strain: l.strainLevel,
      pitch: l.pitchLevel,
      forwardPx: l.barForwardPx,
    },
  };
});

console.log(
  JSON.stringify(
    {
      root,
      notes,
      probeTable: table,
      pixelTable: pixelBeats,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} problem(s)`);
  process.exit(1);
}
console.error(
  '\nOK, and only this: both sequences are semantically distinct by their probes; the LIFTER is\n' +
    `drawn differently between the two loads at ${matchedBeats} beats where the bar is at the same\n` +
    `height; the lifter's pixels change at every pair of beats where the bar moved; and the plot\n` +
    `draws the maximal bar further forward of plumb at ${furtherForward} beats. Whether that reads as\n` +
    'HEAVIER is GDD §12.2\'s blind A/B and this script did not judge it. The strain-rung comparison\n' +
    'above is read from the app\'s own probe, not from any pixel.',
);
