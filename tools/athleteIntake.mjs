#!/usr/bin/env node
// tools/athleteIntake.mjs — the intake command for the production athlete
// asset, `assets/athlete/athlete-01.riv`.
//
// Runs the MECHANICAL steps of the intake flow written in
// `docs/design/ATHLETE-ASSET-PIPELINE.md` §12a, in order, and stops at the
// first one that fails:
//
//   1. the provenance / licence package is present and its SHA-256 names the
//      bytes on disk (an attestation about a different file is not one);
//   2. `node tools/rivContract.mjs <file> --artboard squat` exits 0 — the squat
//      artboard exists, carries a same-named state machine, and its default
//      ViewModel exposes the full rig contract;
//   3. anything non-zero is a rejection, printed verbatim.
//
// Steps 4–8 — the state machine actually DRIVING under a ViewModel write,
// the real `LiftPresentationState` bound, web and native performance, and
// only then the player-path mount — are device and harness steps. This tool
// does not pretend to run them: it prints each with its command and its
// gate, and exits 0 only to say the mechanical gates are clear and the rest
// are owed. It never edits the asset, the validator or the gate to get there
// — the ruling of 2026-09-08 is explicit that the validator is not weakened
// to admit a file.
//
// Exit codes: 0 mechanical checks passed (steps 4–8 remain);
//             1 rejected at a mechanical step (the line names which);
//             2 nothing to intake (the asset is not there yet).
//
// Declares no dev-server URL. Touches no existing tool.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

/** The asset's name; every sibling in the package derives from it. */
export const ATHLETE_ID = 'athlete-01';
export const DEFAULT_DIR = 'assets/athlete';

/**
 * The provenance package the handoff (§1) asks the artist to deliver beside
 * the runtime file. Each line is `Key: value` at the start of a line,
 * case-insensitive on the key. `SHA-256` must equal the `.riv`'s hash.
 */
export const PROVENANCE_FILE = 'ATHLETE-01-PROVENANCE.md';
export const PROVENANCE_LINES = Object.freeze([
  { key: 'SHA-256', why: 'the hash of the delivered .riv, so the attestation names these bytes' },
  { key: 'Licen[cs]e', why: 'owned outright or licensed for redistribution, with the agreement filed' },
  { key: '(Author|Artist)', why: 'who authored it' },
  { key: 'Marks', why: 'attestation that no real federation, brand, sponsor or likeness appears' },
  { key: 'Editor source', why: 'the committed .rev the runtime file was exported from' },
]);
export const SIBLING_FILES = Object.freeze([
  `${ATHLETE_ID}.rev`,
  `${ATHLETE_ID}-reference-sheet.png`,
]);

export const REMAINING_STEPS = Object.freeze([
  {
    step: 4,
    title: 'the squat state machine actually DRIVES',
    command:
      "flip ATHLETE_RIG.TRAINING_STAGE to 'athlete' in a LOCAL scratch tree (do not commit), " +
      'tools/dev-web.sh, then node tools/capture-session.mjs and read the pixels back across two set beats',
    gate: 'the athlete changes between beats; 0 changed pixels is BOUND, not DRIVEN (ADR-001 §7) — reject',
  },
  {
    step: 5,
    title: 'the REAL LiftPresentationState is what moves it',
    command:
      'the same played session: the stages already call liftPresentation(state, totalKg, prior) ' +
      '(pinned by src/art/athleteRig.test.ts) — read barHeight / phase / outcome on the ViewModel against the HUD',
    gate: 'brace → descent → depth → reversal → ascent → stick → grind → lockout, and at least one authentic miss, from the simulation alone',
  },
  {
    step: 6,
    title: 'web performance',
    command: 'the rAF cadence readback the spike probe used (docs/design/evidence/rive-spike/), on the athlete arm, 390x844',
    gate: '60 Hz sustained over a full rep with the 42-input write, no frame over 33 ms while the scene draws',
  },
  {
    step: 7,
    title: 'native performance',
    command: 'the EAS development build (eas.json `development`) on a physical Android device, same rep',
    gate: 'installs, mounts, drives, survives unmount/remount and rotation, keeps pacing; NATIVE_RUNTIME is a device fact, never inferred from the build',
  },
  {
    step: 8,
    title: 'mount as the squat player-path CANDIDATE',
    command:
      "set ATHLETE_RIG.TRAINING_STAGE = 'athlete' in src/art/spriteTuning.ts and move the pin in " +
      'src/session/trainingStageGate.test.ts, in the commit that records the human VISUAL / ANIMATION / SOFT-FEEL grade',
    gate: 'a human graded it; OWNER PLAYTEST is Bryant’s alone — this tool cannot pass this step',
  },
]);

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function provenanceLine(text, key) {
  const re = new RegExp(`^\\s*(?:[-*]\\s*)?\\*{0,2}${key}\\*{0,2}\\s*:\\s*(.+?)\\s*$`, 'im');
  const m = text.match(re);
  return m ? m[1].replace(/`/g, '').trim() : null;
}

/**
 * Pure enough to test: given the directory, returns the verdict and the
 * lines the report prints. Does not exit; `main` does.
 */
export function intake(dir) {
  const riv = path.join(dir, `${ATHLETE_ID}.riv`);
  const lines = [];
  if (!existsSync(riv)) {
    lines.push(`INTAKE_WAITING: ASSET_MISSING — ${path.relative(REPO, riv)} is not there yet`);
    return { code: 2, lines };
  }

  // Step 1 — provenance / licence package.
  const prov = path.join(dir, PROVENANCE_FILE);
  const missing = [];
  if (!existsSync(prov)) {
    missing.push(`${PROVENANCE_FILE} (the package itself)`);
  } else {
    const text = readFileSync(prov, 'utf8');
    for (const { key, why } of PROVENANCE_LINES) {
      if (provenanceLine(text, key) === null) missing.push(`line \`${key}:\` — ${why}`);
    }
  }
  for (const sibling of SIBLING_FILES) {
    if (!existsSync(path.join(dir, sibling))) missing.push(`${sibling} beside the .riv`);
  }
  if (missing.length > 0) {
    lines.push('INTAKE_REJECTED: PROVENANCE_INCOMPLETE — step 1');
    for (const m of missing) lines.push(`  missing: ${m}`);
    return { code: 1, lines };
  }
  const declared = provenanceLine(readFileSync(prov, 'utf8'), 'SHA-256').toLowerCase();
  const actual = sha256(riv);
  if (declared !== actual) {
    lines.push('INTAKE_REJECTED: PROVENANCE_HASH_MISMATCH — step 1');
    lines.push(`  ${PROVENANCE_FILE} names ${declared}`);
    lines.push(`  ${path.basename(riv)} is      ${actual}`);
    return { code: 1, lines };
  }
  lines.push(`step 1 ok: provenance package present, SHA-256 ${actual} matches`);

  // Step 2 — the contract command, verbatim, as a subprocess.
  const contract = spawnSync(
    process.execPath,
    [path.join(HERE, 'rivContract.mjs'), riv, '--artboard', 'squat'],
    { cwd: REPO, encoding: 'utf8' },
  );
  const verdict = (contract.stderr ?? '').trim().split('\n').filter(Boolean);
  if (contract.status !== 0) {
    // Step 3 — non-zero is a rejection.
    lines.push(`INTAKE_REJECTED: CONTRACT_NOT_SATISFIED — step 2 (rivContract exit ${contract.status ?? 'signal'})`);
    for (const v of verdict) lines.push(`  ${v}`);
    return { code: 1, lines };
  }
  lines.push('step 2 ok: node tools/rivContract.mjs … --artboard squat → SATISFIED, exit 0');
  lines.push('step 3 ok: nothing to reject');

  // Steps 4–8 — owed, not run.
  lines.push('INTAKE_MECHANICAL_CHECKS_PASSED — steps 4–8 remain, in this order:');
  for (const s of REMAINING_STEPS) {
    lines.push(`  ${s.step}. ${s.title}`);
    lines.push(`     run:  ${s.command}`);
    lines.push(`     gate: ${s.gate}`);
  }
  return { code: 0, lines };
}

function main(argv) {
  let dir = DEFAULT_DIR;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') {
      dir = argv[i + 1];
      i += 1;
    } else {
      process.stderr.write(`usage: node tools/athleteIntake.mjs [--dir <directory holding ${ATHLETE_ID}.riv>]\n`);
      return 2;
    }
  }
  const { code, lines } = intake(path.resolve(REPO, dir));
  process.stdout.write(`${lines.join('\n')}\n`);
  return code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
