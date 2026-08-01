#!/usr/bin/env node
/**
 * Semantic verification of a captured lift sequence.
 *
 * WHY A HASH CHECK IS NOT ENOUGH, stated because this tool exists entirely
 * because of it: a previous "maximal sequence" was three screenshots of the
 * same resolved NO LIFT frame. They differed only by a dev-menu glyph, so every
 * byte hash was distinct and the sequence passed. It contained zero ascent
 * frames, zero sticking-point frames and zero grind — it was evidence of
 * nothing at all.
 *
 * So this tool asks what each shot ACTUALLY SHOWS, from the probe the app
 * emitted alongside it, and checks:
 *
 *   - every shot is in the phase its filename claims
 *   - no two shots in a sequence are the same tick of the same rep
 *   - two shots whose sprite specs differ are different PIXELS INSIDE THE
 *     STAGE, which excludes browser and dev chrome entirely
 *   - the maximal sequence really reaches the ascent, the sticking point, and a
 *     moment where the bar is losing
 *   - the maximal sequence is drawn more strained than the light one at the
 *     same beats — GDD §12.2's bar, in the one form a script can check
 *
 * EVERYTHING BELOW IS RESTATED, NOT IMPORTED. The expected phases, the
 * sticking-point height and the top strain rung are written out here rather
 * than read from `src/`. That is deliberate: this is a second, independent
 * statement of what the evidence must contain, and a verifier that imported its
 * expectations from the code under test would agree with it however wrong it
 * was.
 *
 * Usage: node tools/verify-lift-shots.mjs [--root .gauntlet/shots]
 *                                         [--heavy L1-maximal] [--light L1-light]
 */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};

const root = path.resolve(flag('root', '.gauntlet/shots'));
const heavyDir = flag('heavy', 'L1-maximal');
const lightDir = flag('light', 'L1-light');

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
/** Beats at which a maximal attempt must outdraw a light one in strain. */
const MIN_STRICTLY_HEAVIER_BEATS = 3;
/** Ascent shots a sequence must contain to be evidence of an ascent at all. */
const MIN_ASCENT_SHOTS = 3;

const failures = [];
const notes = [];
const fail = (message) => failures.push(message);

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
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
    shot.stageHash = stageStat === null ? null : await sha256(stage);
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

  // --- semantic distinctness --------------------------------------------
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

  // --- the renderer is actually responding to the state ------------------
  // Two shots whose sprite spec differs must be different pixels INSIDE THE
  // STAGE. Chrome differences cannot satisfy this, which is the whole point.
  for (let i = 0; i < probed.length; i += 1) {
    for (let j = i + 1; j < probed.length; j += 1) {
      const a = probed[i];
      const b = probed[j];
      if (a.probe.frameKey === b.probe.frameKey) continue;
      if (a.stageHash !== null && a.stageHash === b.stageHash) {
        fail(
          `${tag}: ${a.moment} and ${b.moment} have different sprite specs but identical stage pixels ` +
            `— the renderer is showing a stale frame`,
        );
      }
    }
  }
  const distinctStages = new Set(probed.map((s) => s.stageHash)).size;
  notes.push(`${tag}: ${distinctStages}/${probed.length} distinct stage renders`);

  // --- the sequence contains an ascent at all ----------------------------
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

  return {
    tag,
    probed,
    ascent,
    maxStrain: Math.max(...probed.map((s) => s.probe.strainLevel)),
    minAscentNet: Math.min(...ascent.map((s) => s.probe.netForce)),
    maxForward: Math.max(...probed.map((s) => s.probe.barForwardPx)),
  };
}

const heavy = checkSequence(await loadSequence(heavyDir));
const light = checkSequence(await loadSequence(lightDir));

// --- the maximal attempt really is a maximal attempt ---------------------
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

// --- GDD §12.2: does the maximal attempt animate HEAVIER? ----------------
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
notes.push(`${strictlyHeavier}/${EXPECTED.length} beats draw the maximal attempt strictly heavier`);

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

console.log(JSON.stringify({ root, notes, table, failures }, null, 2));
if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} problem(s)`);
  process.exit(1);
}
console.error('\nOK: both sequences are semantically distinct and the maximal one animates heavier.');
