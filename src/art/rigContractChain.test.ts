/**
 * The contract → rig → manifest → handoff → corpus chain is ONE list.
 *
 * `LiftPresentationState` (mechanics lane, frozen) is read by
 * `athleteRigInputsFrom` (the binding) into `AthleteRigInputs`; `rigInputValues`
 * unrolls that record into the write list; `rigInputSpec()` types it;
 * `rigManifest()` writes it down for the editor; `docs/design/athlete-rig-
 * manifest.json` and the schema table in `RIVE-AUTHORING-HANDOFF.md` are that
 * manifest on disk; `tools/rivContract.mjs` diffs an authored file against the
 * same spec; both production stages loop the same write list; and every tick
 * of the trace corpus carries it. Several of those links are already pinned
 * one at a time (`athleteRig.test.ts`, `rivContract.test.ts`,
 * `athleteTraces.test.ts`). What this file adds is the two ends nothing held:
 *
 *   - a CONTRACT field the binding does not read is either named here as
 *     deliberately unbound, with the reason, or it is a red — so a field the
 *     mechanics lane adds tomorrow cannot be silently ignored by the rig;
 *   - the HANDOFF DOCUMENT's schema table — the thing the artist reads — is
 *     parsed and compared to the spec path by path, type by type, value by
 *     value, so the document cannot describe an input the binding does not
 *     write or omit one it does.
 *
 * Mutation runs recorded in the commit that landed this file: a field added
 * to the contract, an enum member added to `LiftEffortBand`, `barHeight`
 * renamed in the record, and `PLATE_SLOTS_PER_SIDE` 8 → 9 — each reddened
 * a named test below or in the files above; none passed.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createLift, stepLift } from '../game/lift';
import { liftPresentation } from '../game/liftPresentation';
import { codeOnly } from '../tuning/audit';
import { athleteRigInputsFrom, rigInputPaths, rigInputSpec, rigInputValues, type RigInputSpec } from './athleteRig';
import { athleteTrace, ATHLETE_TRACE_SCENARIOS } from './athleteTraces';
import { rigManifest } from './rivContract';
import { ATHLETE_RIG } from './spriteTuning';

const RIG_CODE = codeOnly(readFileSync(new URL('./athleteRig.ts', import.meta.url), 'utf8'));
const HANDOFF = readFileSync(new URL('../../docs/design/RIVE-AUTHORING-HANDOFF.md', import.meta.url), 'utf8');
const MANIFEST_JSON = readFileSync(new URL('../../docs/design/athlete-rig-manifest.json', import.meta.url), 'utf8');

/**
 * Contract fields the binding deliberately does NOT carry to the rig, each
 * with the reason. Both directions are pinned: a listed field must exist on
 * the contract and must NOT be read by the binding; an unlisted field must be
 * read. Nested `load.*` and `command.*` members are listed by dotted path.
 */
const UNBOUND_CONTRACT_FIELDS: Readonly<Record<string, string>> = Object.freeze({
  tick: 'the sim clock; the rig is driven by barHeight, not by time',
  phaseTick: 'ticks inside the phase; a state machine keeps its own time',
  peakHeight: 'a resolution fact; `lockedOut` carries what the rig shows',
  netForce: 'raw capacity units; `strain` and `grindIntensity` are the read models the contract offers',
  stallTicks: 'raw count; `grindIntensity` is the normalised read model',
  ascentTicks: 'raw count; duration is not a pose driver',
  extraDepth: 'demand bookkeeping; `depth`/`barHeight` already carry the position',
  lastTiming: 'the HUD’s grade line; `commandGlow` is the rig’s cue read model',
  events: 'the haptic/flash channel; a ViewModel scalar cannot hold a list',
  resolution: 'the HUD’s headline/detail copy; `outcome`/`missReason` carry the rig’s share',
  chestApproach: 'bench only; the v1 athlete is squat',
  benchGrind: 'bench only; the v1 athlete is squat',
  'load.barKg': 'a constant the sleeve does not draw',
  'load.loadRatio': 'the prescription; `totalKg` and the discs are what is drawn',
  'load.remainderKg': 'kg the ladder could not stack; `platesOverflow` is the rig’s finding',
});

/** A real contract tick, driven — not the binding's EMPTY_VIEW. */
function contractTick() {
  const state = createLift({ kind: 'squat', loadRatio: 0.8, seed: 1 });
  return liftPresentation(stepLift(state, { kind: 'press' }), 160, state);
}

/** Contract keys, top level plus the two nested records, as dotted paths. */
function contractPaths(): readonly string[] {
  const view = contractTick();
  const out: string[] = [];
  for (const key of Object.keys(view)) {
    if (key === 'load' || key === 'command') {
      for (const nested of Object.keys(view[key])) out.push(`${key}.${nested}`);
    } else {
      out.push(key);
    }
  }
  return out;
}

/** Does the binding's CODE read `view.<path>`? */
function bindingReads(dotted: string): boolean {
  const pattern = new RegExp(`\\bview\\.${dotted.replace(/\./g, '\\.')}\\b`);
  return pattern.test(RIG_CODE);
}

describe('every contract field is bound to the rig or named here as deliberately unbound', () => {
  it('an unlisted contract field is read by the binding; a listed one is not', () => {
    const paths = contractPaths();
    expect(paths.length, 'contract paths').toBeGreaterThan(30);
    const unlisted = paths.filter((p) => !(p in UNBOUND_CONTRACT_FIELDS));
    const listed = paths.filter((p) => p in UNBOUND_CONTRACT_FIELDS);
    for (const p of unlisted) {
      expect(bindingReads(p), `contract field \`${p}\` is neither bound by athleteRig.ts nor listed as deliberately unbound`).toBe(true);
    }
    for (const p of listed) {
      expect(bindingReads(p), `\`${p}\` is listed as unbound but the binding reads it`).toBe(false);
    }
    // NON-VACUITY: both halves have members, and the two halves are the whole.
    expect(unlisted.length).toBeGreaterThan(20);
    expect(listed.length).toBe(Object.keys(UNBOUND_CONTRACT_FIELDS).length);
  });

  it('every listed field exists on the contract — a stale row is a red, not a comment', () => {
    const paths = new Set(contractPaths());
    for (const p of Object.keys(UNBOUND_CONTRACT_FIELDS)) {
      expect(paths.has(p), `UNBOUND_CONTRACT_FIELDS names \`${p}\`, which the contract no longer has`).toBe(true);
    }
  });

  it('every bound field reaches the write list, by its own name or a documented rename', () => {
    // The renames the binding makes, contract → rig. Anything else keeps its name.
    const renamed: Readonly<Record<string, string>> = {
      kind: 'lift',
      chalkPuff: 'chalk',
      'load.totalKg': 'totalKg',
      'load.discs': 'plates/0/on',
      'command.held': 'held',
      'command.pressCommandLive': 'pressCommandLive',
      'command.lockoutHoldLive': 'lockoutHoldLive',
      // Read through `commandGlowFrom`: a visual reading of the timing window.
      'command.cueProgress': 'commandGlow',
    };
    const paths = new Set(rigInputPaths());
    for (const p of contractPaths().filter((x) => !(x in UNBOUND_CONTRACT_FIELDS))) {
      const target = renamed[p] ?? p;
      expect(paths.has(target), `bound contract field \`${p}\` has no write \`${target}\``).toBe(true);
    }
    // And the rig adds exactly its own derived inputs beyond the contract.
    const derived = ['commandGlow', 'platesOverflow', ...Array.from({ length: ATHLETE_RIG.PLATE_SLOTS_PER_SIDE }, (_, i) => `plates/${i}/size`)];
    for (const d of derived) expect(paths.has(d), `rig-derived input \`${d}\``).toBe(true);
  });
});

/** The handoff document's schema table, parsed: `| \`path\` | type… | range | meaning |`. */
function handoffTable(): readonly RigInputSpec[] {
  const rows: RigInputSpec[] = [];
  const lines = HANDOFF.split('\n');
  const header = lines.findIndex((line) => /^\| Path \| Type \|/.test(line));
  expect(header, 'the schema table header').toBeGreaterThan(0);
  // Rows run contiguously from the header (past its `|---|` rule) to the first non-row line.
  for (const line of lines.slice(header + 2)) {
    const m = line.match(/^\| `([a-zA-Z0-9/]+)` \| ([^|]+) \|/);
    if (!m) break;
    const path = m[1]!;
    const type = m[2]!.trim();
    if (type === 'number' || type === 'boolean') {
      rows.push({ path, type });
      continue;
    }
    const values = [...type.matchAll(/`([^`]+)`/g)].map((v) => v[1]!);
    expect(type, `${path} type cell`).toMatch(/^enum — values /);
    rows.push({ path, type: 'enum', values });
  }
  return rows;
}

describe('the handoff document and the manifest are the spec written down', () => {
  it('RIVE-AUTHORING-HANDOFF.md’s schema table is rigInputSpec(), path by path, type by type, value by value', () => {
    const table = handoffTable();
    const spec = rigInputSpec();
    // NON-VACUITY: the parser found the table, not a stray backticked word.
    expect(table.length, 'rows parsed').toBeGreaterThan(40);
    expect(table.map((r) => r.path)).toEqual(spec.map((s) => s.path));
    expect(table).toEqual(spec);
  });

  it('the committed manifest, rigManifest() and the spec agree, and the slot count is one constant everywhere', () => {
    const committed = JSON.parse(MANIFEST_JSON) as { plateSlotsPerSide: number; inputs: RigInputSpec[] };
    expect(committed.inputs).toEqual(rigInputSpec());
    expect(rigManifest().inputs).toEqual(rigInputSpec());
    expect(committed.plateSlotsPerSide).toBe(ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    expect(rigInputPaths().filter((p) => p.startsWith('plates/')).length).toBe(2 * ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    const sample = athleteTrace(ATHLETE_TRACE_SCENARIOS[0]!).ticks[0]!;
    expect(sample.rig.plates.length).toBe(ATHLETE_RIG.PLATE_SLOTS_PER_SIDE);
    expect(rigInputValues(sample.rig).map((w) => w.path)).toEqual(rigInputPaths());
  });

  it('the write list is the record’s own keys in order — no second list anywhere', () => {
    const record = athleteRigInputsFrom(contractTick());
    const keys = Object.keys(record).filter((k) => k !== 'plates');
    const writes = rigInputPaths().filter((p) => !p.startsWith('plates/'));
    expect(writes).toEqual(keys);
  });
});
