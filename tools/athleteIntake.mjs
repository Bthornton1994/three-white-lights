#!/usr/bin/env node
// tools/athleteIntake.mjs — the intake command for the production athlete
// asset, `assets/athlete/athlete-01.riv`.
//
// Runs the MECHANICAL steps of the intake flow written in
// `docs/design/ATHLETE-ASSET-PIPELINE.md` §12a, in order, and stops at the
// first one that fails:
//
//   0. the EMPTY side-on room plate the rig composites onto — if it is
//      there, it is 1152 x 1728 and it is NOT one of the existing painted
//      squat scenes (ruled 2026-09-08: never cropped or re-used behind the
//      athlete); if it is not there yet, that is reported, not a rejection —
//      the rig can be validated without it, the composite cannot be graded;
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

/**
 * The empty side-on room plate (`docs/design/ATHLETE-SOURCE-PACKAGE.md` §8),
 * the same size as the artboard so the rig composites 1:1. The existing
 * `squat-*.jpg` plates are painted scenes with a lifter in them and are
 * refused here by name — a crop of one would pass a size check and is
 * exactly what the ruling forbids.
 */
export const DEFAULT_ROOM = 'assets/iron-amber/squat-room-side.jpg';
export const ROOM_SIZE = Object.freeze({ width: 1152, height: 1728 });
export const PAINTED_SCENES = Object.freeze(['squat-brace.jpg', 'squat-hole.jpg', 'squat-drive.jpg']);

export const REMAINING_STEPS = Object.freeze([
  {
    step: 4,
    title: 'the squat state machine actually DRIVES',
    command:
      'repoint src/session/athleteAsset.ts at the delivered file and flip ATHLETE_RIV_IS_PLACEHOLDER (athleteAsset.test.ts pins both), ' +
      'tools/dev-web.sh, then node tools/athleteAccept.mjs --web: the dev-only harness replays the canonical trace corpus ' +
      '(docs/design/athlete-traces/) through the REAL AthleteStage and reads the canvas back per scenario',
    gate: 'the canvas changes within every scenario; 0 changed pixels is BOUND, not DRIVEN (ADR-001 §7) — reject',
  },
  {
    step: 5,
    title: 'the REAL LiftPresentationState is what moves it',
    command:
      'the same run: the harness hands the stage LiftState + history from the real mechanic and its probe reports ' +
      'barHeight / depth / phase / outcome per tick (the stages call liftPresentation(state, totalKg, prior), pinned by src/art/athleteRig.test.ts)',
    gate: 'brace → descent → depth → reversal → ascent → stick → grind → lockout, and at least one authentic miss, from the simulation alone',
  },
  {
    step: 6,
    title: 'web performance',
    command: 'node tools/athleteAccept.mjs --web records rAF pacing per scenario at 390x844 (the readback the spike probe used)',
    gate: '60 Hz sustained over a full rep with the 43-input write, no frame over 33 ms while the scene draws',
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

/** Width and height from a baseline or progressive JPEG's SOF marker; null if not a JPEG. */
export function jpegDimensions(file) {
  const b = readFileSync(file);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

/**
 * Step 0. Returns `{ reject, lines }`: `reject` is a code string when the
 * plate is present and wrong (size, or a painted scene by name), null when
 * it is absent (reported) or right.
 */
export function roomCheck(room) {
  const lines = [];
  const rel = path.relative(REPO, room);
  if (!existsSync(room)) {
    lines.push(`step 0 note: room plate ${rel} is not there yet — the rig can be validated, the composite cannot be graded (source package §8)`);
    return { reject: null, lines };
  }
  if (PAINTED_SCENES.includes(path.basename(room))) {
    lines.push(`INTAKE_REJECTED: ROOM_PLATE_IS_A_SCENE — step 0: ${rel} is a painted scene with a lifter in it; never cropped or re-used behind the athlete (ruled 2026-09-08)`);
    return { reject: 'ROOM_PLATE_IS_A_SCENE', lines };
  }
  const dims = jpegDimensions(room);
  if (dims === null) {
    lines.push(`INTAKE_REJECTED: ROOM_PLATE_NOT_A_JPEG — step 0: ${rel}`);
    return { reject: 'ROOM_PLATE_NOT_A_JPEG', lines };
  }
  if (dims.width !== ROOM_SIZE.width || dims.height !== ROOM_SIZE.height) {
    lines.push(
      `INTAKE_REJECTED: ROOM_PLATE_WRONG_SIZE — step 0: ${rel} is ${dims.width} x ${dims.height}, the artboard is ${ROOM_SIZE.width} x ${ROOM_SIZE.height}`,
    );
    return { reject: 'ROOM_PLATE_WRONG_SIZE', lines };
  }
  lines.push(`step 0 ok: room plate ${rel} present, ${dims.width} x ${dims.height}, not a painted scene`);
  return { reject: null, lines };
}

/**
 * Pure enough to test: given the directory (and the room plate's path),
 * returns the verdict and the lines the report prints. Does not exit;
 * `main` does.
 */
export function intake(dir, room = path.resolve(REPO, DEFAULT_ROOM)) {
  const riv = path.join(dir, `${ATHLETE_ID}.riv`);
  const lines = [];

  // Step 0 — the room the rig composites onto. Wrong is a rejection; absent is a note.
  const roomVerdict = roomCheck(room);
  lines.push(...roomVerdict.lines);
  if (roomVerdict.reject !== null) return { code: 1, lines };

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
  let room = DEFAULT_ROOM;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') {
      dir = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--room') {
      room = argv[i + 1];
      i += 1;
    } else {
      process.stderr.write(
        `usage: node tools/athleteIntake.mjs [--dir <directory holding ${ATHLETE_ID}.riv>] [--room <empty side-on room plate .jpg>]\n`,
      );
      return 2;
    }
  }
  const { code, lines } = intake(path.resolve(REPO, dir), path.resolve(REPO, room));
  process.stdout.write(`${lines.join('\n')}\n`);
  return code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
