import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isRivMagic, readRivSchema, type RivSchema } from '../../tools/rivSchema.mjs';
import { rigInputSpec, rigLiftArtboards } from './athleteRig';
import { diffRivContract, flattenViewModel, rigManifest } from './rivContract';
import { ATHLETE_RIG } from './spriteTuning';

const asset = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(new URL(`../../assets/dev/${name}`, import.meta.url)));

/**
 * THE ORACLE IS UPSTREAM'S OWN GENERATOR, NOT THIS TOOL. The vendor's runtime
 * repository ships a `.riv.d.ts` beside each example asset, produced by its
 * `rive-gen-types` from the same engine. These literals are transcribed from
 * `example/assets/rive/quick_start.riv.d.ts` and `rewards.riv.d.ts` at the
 * commit `assets/dev/THIRD-PARTY-RIVE-ASSETS.md` names — so a reader that
 * mis-typed a property, dropped a nested reference or lost an enum value
 * disagrees with a second implementation, not with itself.
 */
const QUICK_START_UPSTREAM = {
  artboards: ['health_bar_v01'],
  stateMachines: { health_bar_v01: ['State Machine 1'] },
  viewModels: {
    health_bar_01: {
      gameOver: 'trigger',
      hoverYes: 'boolean',
      hoverNo: 'boolean',
      healthColor: 'color',
      health: 'number',
    },
  },
} as const;

const REWARDS_UPSTREAM_VIEW_MODELS = {
  Item_Icon_Value: { Icon_React: 'trigger', Property_Of_Item: 'viewModel:Item', Item_Value: 'number' },
  Energy_Bar: { Bar_Color: 'color', Lives: 'number', Energy_Bar: 'number' },
  Rewards: {
    Price_Value: 'number',
    Color: 'color',
    Height: 'number',
    With: 'number',
    Item_Selection: 'viewModel:Item',
    Item_Value_Icon: 'viewModel:Item_Icon_Value',
    Button: 'viewModel:Button',
    Coin: 'viewModel:Item_Icon_Value',
    Gem: 'viewModel:Item_Icon_Value',
    Energy_Bar: 'viewModel:Energy_Bar',
  },
  Button: { State_1: 'string', Item_Text: 'string', Item: 'viewModel:Item', Pressed: 'trigger' },
  Item: { Item_Selection: 'enum:Coin|Gem' },
} as const;

/** Render a schema's ViewModels in upstream's `type`, `viewModel:Ref`, `enum:a|b` spelling. */
function upstreamSpelling(schema: RivSchema): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [name, properties] of Object.entries(schema.viewModels)) {
    out[name] = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        property.type === 'viewModel'
          ? `viewModel:${property.ref ?? ''}`
          : property.type === 'enum'
            ? `enum:${(property.values ?? []).join('|')}`
            : property.type,
      ]),
    );
  }
  return out;
}

describe('tools/rivSchema.mjs reads a real .riv headlessly', () => {
  it('quick_start.riv reads exactly as upstream’s generated manifest says', async () => {
    const schema = await readRivSchema(asset('quick_start.riv'));
    expect(schema.valid).toBe(true);
    if (!schema.valid) return;
    expect(schema.artboards).toEqual(QUICK_START_UPSTREAM.artboards);
    expect(schema.stateMachines).toEqual(QUICK_START_UPSTREAM.stateMachines);
    expect(upstreamSpelling(schema)).toEqual(QUICK_START_UPSTREAM.viewModels);
    expect(schema.defaultViewModel, 'what useDefault: true binds').toBe('health_bar_01');
  });

  it('rewards.riv resolves nested ViewModel references and enum values', async () => {
    const schema = await readRivSchema(asset('rewards.riv'));
    expect(schema.valid).toBe(true);
    if (!schema.valid) return;
    expect(upstreamSpelling(schema)).toEqual(REWARDS_UPSTREAM_VIEW_MODELS);
    expect(schema.defaultViewModel).toBe('Rewards');
    // The nested-path grammar the rig's `plates/<i>/on` uses, on a real file.
    const flat = new Map(flattenViewModel(schema, 'Rewards').map((f) => [f.path, f.property]));
    expect(flat.get('Coin/Item_Value')?.type).toBe('number');
    expect(flat.get('Energy_Bar/Bar_Color')?.type).toBe('color');
    expect(flat.get('Button/Pressed')?.type).toBe('trigger');
    expect(flat.get('Coin/Property_Of_Item/Item_Selection')?.values, 'two levels down').toEqual(['Coin', 'Gem']);
    // NON-VACUITY: the walk reached past the root.
    expect([...flat.keys()].filter((p) => p.includes('/')).length).toBeGreaterThan(10);
  });

  it('the deliberate placeholder is refused, by magic, before the engine is asked', async () => {
    const placeholder = asset('rive-spike.riv');
    expect(isRivMagic(placeholder)).toBe(false);
    expect(isRivMagic(asset('quick_start.riv'))).toBe(true);
    expect(isRivMagic(asset('rewards.riv'))).toBe(true);
    const schema = await readRivSchema(placeholder);
    expect(schema.valid).toBe(false);
    if (schema.valid) return;
    expect(schema.reason).toContain('RIVE');
  });
});

/** A schema that satisfies the spec exactly — plates as nested `plates -> <i> -> {on,size}` models. */
function schemaSatisfying(spec = rigInputSpec()): RivSchema {
  const root: Record<string, { type: 'number' | 'boolean' | 'enum' | 'viewModel'; values?: string[]; ref?: string }> = {};
  const slot: Record<string, { type: 'number' | 'boolean' }> = {};
  const slots: Record<string, { type: 'viewModel'; ref: string }> = {};
  for (const input of spec) {
    const parts = input.path.split('/');
    if (parts[0] === 'plates') {
      slots[parts[1]!] = { type: 'viewModel', ref: 'PlateSlot' };
      slot[parts[2]!] = { type: input.type as 'number' | 'boolean' };
      continue;
    }
    root[input.path] = input.type === 'enum' ? { type: 'enum', values: [...input.values] } : { type: input.type };
  }
  root['plates'] = { type: 'viewModel', ref: 'PlateSlots' };
  const lifts = rigLiftArtboards();
  return {
    valid: true,
    artboards: [...lifts],
    defaultArtboard: lifts[0] ?? null,
    stateMachines: Object.fromEntries(lifts.map((lift) => [lift, [lift]])),
    viewModels: { Athlete: root, PlateSlots: slots, PlateSlot: slot },
    defaultViewModel: 'Athlete',
    defaultViewModelByArtboard: Object.fromEntries(lifts.map((lift) => [lift, 'Athlete'])),
  };
}

describe('diffRivContract', () => {
  it('reports every rig path missing from the health-bar test asset, and names what it has instead', async () => {
    const schema = await readRivSchema(asset('quick_start.riv'));
    const spec = rigInputSpec();
    const diff = diffRivContract(schema, spec, { artboards: rigLiftArtboards() });
    expect(diff.viewModel).toBe('health_bar_01');
    expect(diff.satisfied).toBe(false);
    expect(diff.missingArtboards).toEqual(['squat', 'bench', 'deadlift']);
    expect(diff.artboards.map((a) => [a.artboard, a.present, a.stateMachine, a.viewModel, a.satisfied])).toEqual(
      rigLiftArtboards().map((name) => [name, false, false, null, false]),
    );
    expect(diff.missing).toEqual(spec.map((input) => input.path));
    expect(diff.wrongType).toEqual([]);
    expect(diff.extra).toEqual(['gameOver', 'hoverYes', 'hoverNo', 'healthColor', 'health']);
    // NON-VACUITY: the spec is the whole contract, not a stub.
    expect(spec.length).toBeGreaterThan(40);
  });

  it('an invalid file is every path missing, bound to nothing', async () => {
    const diff = diffRivContract(await readRivSchema(asset('rive-spike.riv')), rigInputSpec());
    expect(diff.viewModel).toBeNull();
    expect(diff.missing.length).toBe(rigInputSpec().length);
    expect(diff.satisfied).toBe(false);
  });

  it('a schema built from the spec satisfies it, through the nested plate slots', () => {
    const spec = rigInputSpec();
    const diff = diffRivContract(schemaSatisfying(spec), spec, { artboards: rigLiftArtboards() });
    const { artboards, ...top } = diff;
    expect(top).toEqual({
      viewModel: 'Athlete',
      missingArtboards: [],
      missing: [],
      wrongType: [],
      missingEnumValues: [],
      extra: [],
      satisfied: true,
    });
    // Each lift artboard is checked on ITS OWN default ViewModel, the way the
    // stages bind it — not on the file's default.
    expect(artboards.map((a) => [a.artboard, a.present, a.stateMachine, a.viewModel, a.satisfied])).toEqual(
      rigLiftArtboards().map((name) => [name, true, true, 'Athlete', true]),
    );
    // NON-VACUITY: the flattened schema has exactly one leaf per spec entry.
    const leaves = flattenViewModel(schemaSatisfying(spec), 'Athlete').filter((f) => f.property.type !== 'viewModel');
    expect(leaves.length).toBe(spec.length);
  });

  it('a renamed path, a retyped path and a missing enum value are each named, not merged', () => {
    const spec = rigInputSpec();
    const good = schemaSatisfying(spec);
    const athlete = { ...good.viewModels['Athlete']! };
    delete athlete['barHeight'];
    athlete['bar_height'] = { type: 'number' };
    athlete['held'] = { type: 'number' };
    athlete['effortBand'] = { type: 'enum', values: ['easy', 'normal', 'hard', 'failing'] };
    const mutant: RivSchema = { ...good, viewModels: { ...good.viewModels, Athlete: athlete } };
    const diff = diffRivContract(mutant, spec);
    expect(diff.missing).toEqual(['barHeight']);
    expect(diff.wrongType).toEqual([{ path: 'held', expected: 'boolean', actual: 'number' }]);
    expect(diff.missingEnumValues).toEqual([{ path: 'effortBand', values: ['grind'] }]);
    expect(diff.extra).toEqual(['bar_height']);
    expect(diff.satisfied).toBe(false);
  });

  it('binds to a named ViewModel when asked, else the engine’s default', () => {
    const spec = rigInputSpec();
    const schema = schemaSatisfying(spec);
    expect(diffRivContract(schema, spec, { viewModel: 'PlateSlot' }).satisfied).toBe(false);
    expect(diffRivContract(schema, spec, { viewModel: 'Athlete' }).satisfied).toBe(true);
    expect(diffRivContract({ ...schema, defaultViewModel: null }, spec).viewModel).toBeNull();
  });

  it('an artboard that exists but carries no same-named state machine is missing — bound is not driven', () => {
    const spec = rigInputSpec();
    const good = schemaSatisfying(spec);
    // The spike's first real-asset probe, as a schema: the artboard is there,
    // its only state machine is called something else, the writes reach nothing.
    const mutant: RivSchema = { ...good, stateMachines: { ...good.stateMachines, squat: ['State Machine 1'] } };
    const diff = diffRivContract(mutant, spec, { artboards: rigLiftArtboards() });
    expect(diff.missingArtboards).toEqual(['squat']);
    expect(diff.missing, 'the ViewModel still binds').toEqual([]);
    expect(diff.artboards.find((a) => a.artboard === 'squat')?.satisfied).toBe(false);
    expect(diff.artboards.find((a) => a.artboard === 'bench')?.satisfied).toBe(true);
    expect(diff.satisfied).toBe(false);
    // And an artboard whose own default ViewModel lacks the contract, while
    // the FILE's default is fine — the case a file-level check would pass.
    const wrongDefault: RivSchema = { ...good, defaultViewModelByArtboard: { ...good.defaultViewModelByArtboard, bench: 'PlateSlot' } };
    const benchDiff = diffRivContract(wrongDefault, spec, { artboards: rigLiftArtboards() });
    expect(benchDiff.missing, 'the file default still satisfies').toEqual([]);
    const bench = benchDiff.artboards.find((a) => a.artboard === 'bench');
    expect(bench?.viewModel).toBe('PlateSlot');
    // A slot model exposes `on` and `size` at its root — none of the 42 rig
    // paths — so every path is missing and the two are reported as extras.
    expect(bench?.missing.length).toBe(spec.length);
    expect(bench?.extra).toEqual(['on', 'size']);
    expect(benchDiff.satisfied).toBe(false);
    // And an artboard absent outright.
    const absent: RivSchema = { ...good, artboards: good.artboards.filter((a) => a !== 'deadlift') };
    expect(diffRivContract(absent, spec, { artboards: rigLiftArtboards() }).missingArtboards).toEqual(['deadlift']);
    // NON-VACUITY: three lifts asked for, three artboards on the good schema.
    expect(rigLiftArtboards().length).toBe(3);
    expect(good.artboards.length).toBe(3);
  });
});

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** JPEG SOF0/SOF2 frame header: the room plate's real pixel dimensions. */
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error('no JPEG frame header');
}

describe('the rig manifest is the binding written down', () => {
  it('docs/design/athlete-rig-manifest.json is byte-for-byte rigManifest()', () => {
    const committed = JSON.parse(readFileSync(new URL('../../docs/design/athlete-rig-manifest.json', import.meta.url), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(rigManifest())));
    // NON-VACUITY: the manifest is the whole contract, not a stub.
    expect(committed.inputs.length).toBe(rigInputSpec().length);
    expect(committed.artboards.map((a: { name: string }) => a.name)).toEqual(rigLiftArtboards());
  });

  it('the rig canvas is the room plate’s camera, read from the plate’s own header', () => {
    const plate = jpegDimensions(readFileSync(new URL('../../assets/iron-amber/squat-brace.jpg', import.meta.url)));
    expect(plate).toEqual({ width: ATHLETE_RIG.CANVAS_PX.WIDTH, height: ATHLETE_RIG.CANVAS_PX.HEIGHT });
    expect(rigManifest().canvas).toEqual({ width: plate.width, height: plate.height });
  });
});

describe('tools/rivContract.mjs — the validation command the handoff names', () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['tools/rivContract.mjs', ...args], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000 });

  it('--manifest prints exactly rigManifest(), loaded from the TypeScript truth at run time', () => {
    const result = run('--manifest');
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(JSON.stringify(rigManifest())));
  });

  it('fails closed on the health-bar fixture: every lift artboard missing, exit 1, the diff on stdout', () => {
    const result = run('assets/dev/quick_start.riv');
    expect(result.status, result.stderr).toBe(1);
    const report = JSON.parse(result.stdout);
    expect(report.satisfied).toBe(false);
    expect(report.missingArtboards).toEqual(rigLiftArtboards());
    expect(report.missing.length).toBe(rigInputSpec().length);
    expect(result.stderr).toContain('NOT SATISFIED');
  });

  it('fails closed on the invalid placeholder', () => {
    const result = run('assets/dev/rive-spike.riv');
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).valid).toBe(false);
  });
});
