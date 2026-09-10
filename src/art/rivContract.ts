/**
 * rivContract — does an authored `.riv` expose what the rig binding writes?
 *
 * A ViewModel path the runtime cannot find is a silent no-op on both
 * platforms, so an asset that is one rename away from the contract renders a
 * motionless athlete with no error anywhere. This module makes that a
 * finding before the asset is mounted: the schema `tools/rivSchema.mjs`
 * reads out of the file, diffed against `rigInputSpec()` — the typed list
 * the binding derives from its own record. The diff is the handoff check in
 * `docs/design/ATHLETE-ASSET-PIPELINE.md` §11.
 *
 * Pure. Reads no file itself — the caller hands it a schema — so it is
 * exercised against real assets in its test and against constructed schemas
 * for the cases no shipped asset reaches yet.
 */
import type { RivInvalid, RivProperty, RivPropertyType, RivSchema } from '../../tools/rivSchema.mjs';
import { ATHLETE_PLATE_SLOT, ATHLETE_PLATES_LIST } from './athletePlatesList';
import { rigInputSpec, rigLiftArtboards, type RigInputSpec, type RigInputType } from './athleteRig';
import { ATHLETE_RIG } from './spriteTuning';

/** One property reachable from a ViewModel by Rive's nested-path grammar (`a/b/c`). */
export interface FlatRivProperty {
  readonly path: string;
  readonly property: RivProperty;
}

/**
 * Every property reachable from `viewModel`, nested references expanded to
 * slash paths, containers included. Depth-capped so a self-referencing
 * model terminates.
 *
 * Native Lists are not nested ViewModels. When `Athlete.plates` is a List
 * whose items are `PlateSlot`, the walk synthesises the logical contract
 * paths `plates/<i>/on|size` from the item ViewModel — the same paths
 * `rigInputSpec()` names — without claiming those strings exist as runtime
 * path lookups (stages write through indexed List access).
 */
export function flattenViewModel(schema: RivSchema, viewModel: string): readonly FlatRivProperty[] {
  const out: FlatRivProperty[] = [];
  const walk = (name: string, prefix: string, depth: number): void => {
    const properties = schema.viewModels[name];
    if (properties === undefined || depth > ATHLETE_RIG.VIEW_MODEL_DEPTH_LIMIT) return;
    for (const [key, property] of Object.entries(properties)) {
      const path = prefix === '' ? key : `${prefix}/${key}`;
      out.push({ path, property });
      if (property.type === 'viewModel' && property.ref) walk(property.ref, path, depth + 1);
      if (
        property.type === 'list' &&
        key === ATHLETE_PLATES_LIST &&
        property.itemRef === ATHLETE_PLATE_SLOT &&
        schema.viewModels[ATHLETE_PLATE_SLOT] !== undefined
      ) {
        for (let i = 0; i < ATHLETE_RIG.PLATE_SLOTS_PER_SIDE; i += 1) {
          walk(ATHLETE_PLATE_SLOT, `${path}/${i}`, depth + 1);
        }
      }
    }
  };
  walk(viewModel, '', 0);
  return out;
}

export interface RivTypeMismatch {
  readonly path: string;
  readonly expected: RigInputType;
  readonly actual: RivPropertyType;
}

export interface RivEnumGap {
  readonly path: string;
  /** Values the binding can write that the authored enum does not carry. */
  readonly values: readonly string[];
}

/** The diff of one ViewModel against the spec. */
export interface RivViewModelDiff {
  /** The ViewModel the diff was taken against; null when the file is invalid or the artboard has no default. */
  readonly viewModel: string | null;
  /** Spec paths the ViewModel does not expose at all. */
  readonly missing: readonly string[];
  /** Spec paths exposed with a different type. */
  readonly wrongType: readonly RivTypeMismatch[];
  /** Enum paths whose authored values do not cover what the binding writes. */
  readonly missingEnumValues: readonly RivEnumGap[];
  /** Non-container properties the ViewModel exposes that the binding never writes. Informational: authored beats live here. */
  readonly extra: readonly string[];
  /** True only when `missing`, `wrongType` and `missingEnumValues` are all empty. */
  readonly satisfied: boolean;
}

/**
 * One lift artboard the stages select by name, checked the way the stages
 * bind it: the artboard must exist, carry a state machine OF THE SAME NAME
 * (data binding drives a running state machine — measured on the runtime
 * spike's first real-asset probe: bound, zero changed pixels without one),
 * and its DEFAULT ViewModel must expose the contract.
 */
export interface RivArtboardDiff extends RivViewModelDiff {
  readonly artboard: string;
  readonly present: boolean;
  readonly stateMachine: boolean;
}

export interface RivContractDiff extends RivViewModelDiff {
  /**
   * Artboards from `options.artboards` that the stages could not drive: absent,
   * without a same-named state machine, or without a default ViewModel.
   */
  readonly missingArtboards: readonly string[];
  /** The per-artboard diffs, one per `options.artboards` entry, in order. */
  readonly artboards: readonly RivArtboardDiff[];
}

export interface RivContractOptions {
  /** The ViewModel for the top-level diff; default: the engine's default for the default artboard (`useDefault: true`). */
  readonly viewModel?: string;
  /**
   * Artboards the stages select by name — for the athlete, one per lift
   * (`rigLiftArtboards()`), each with a state machine of the same name
   * (`ATHLETE-ASSET-PIPELINE.md` §11). Each is diffed on its own default
   * ViewModel.
   */
  readonly artboards?: readonly string[];
}

const EVERYTHING_MISSING = (spec: readonly RigInputSpec[]): RivViewModelDiff => ({
  viewModel: null,
  missing: spec.map((input) => input.path),
  wrongType: [],
  missingEnumValues: [],
  extra: [],
  satisfied: false,
});

/** Diff one named ViewModel of a valid schema against the spec. */
export function diffViewModel(schema: RivSchema, spec: readonly RigInputSpec[], viewModel: string | null): RivViewModelDiff {
  if (viewModel === null || schema.viewModels[viewModel] === undefined) return EVERYTHING_MISSING(spec);

  const platesGap = platesListContractGaps(schema, viewModel);
  const exposed = new Map<string, RivProperty>();
  for (const flat of flattenViewModel(schema, viewModel)) exposed.set(flat.path, flat.property);

  const missing: string[] = [];
  const wrongType: RivTypeMismatch[] = [];
  const missingEnumValues: RivEnumGap[] = [];
  for (const input of spec) {
    const property = exposed.get(input.path);
    if (property === undefined) {
      missing.push(input.path);
      continue;
    }
    if (property.type !== input.type) {
      wrongType.push({ path: input.path, expected: input.type, actual: property.type });
      continue;
    }
    if (input.type === 'enum') {
      const authored = new Set(property.values ?? []);
      const gap = input.values.filter((value) => !authored.has(value));
      if (gap.length > 0) missingEnumValues.push({ path: input.path, values: gap });
    }
  }

  const specified = new Set(spec.map((input) => input.path));
  const extra = [...exposed.entries()]
    .filter(([path, property]) => !specified.has(path) && property.type !== 'viewModel' && property.type !== 'list')
    .map(([path]) => path);

  // Surface List-shape failures on the plates paths so a missing List is not
  // reported as sixteen silent path misses alone — the gap names the structure.
  if (platesGap.length > 0) {
    for (const path of platesGap) {
      if (!missing.includes(path)) missing.push(path);
    }
  }

  return {
    viewModel,
    missing,
    wrongType,
    missingEnumValues,
    extra,
    satisfied: missing.length === 0 && wrongType.length === 0 && missingEnumValues.length === 0,
  };
}

/**
 * Structural gaps for the List plates route. Empty when `Athlete.plates` is a
 * List of `PlateSlot`. Returns the sixteen logical plate paths when the List
 * shape is wrong. Field-level PlateSlot defects (`on`/`size`) are left to
 * flatten + the ordinary path diff — this helper only refuses a non-List.
 */
export function platesListContractGaps(schema: RivSchema, viewModel: string): readonly string[] {
  const platePaths = Array.from({ length: ATHLETE_RIG.PLATE_SLOTS_PER_SIDE }, (_, i) => [
    `plates/${i}/on`,
    `plates/${i}/size`,
  ]).flat();

  const root = schema.viewModels[viewModel];
  if (root === undefined) return platePaths;

  const plates = root[ATHLETE_PLATES_LIST];
  if (plates === undefined || plates.type !== 'list') return platePaths;
  if (plates.itemRef !== ATHLETE_PLATE_SLOT) return platePaths;
  if (schema.viewModels[ATHLETE_PLATE_SLOT] === undefined) return platePaths;
  return [];
}

/**
 * Diff a file's schema against the rig's spec. The top-level diff binds to
 * `options.viewModel` when given, else to the engine's default for the
 * default artboard — the same choice `useDefault: true` makes on web. Each
 * artboard in `options.artboards` is additionally checked the way the
 * production stages drive it. `satisfied` is true only when the top-level
 * ViewModel AND every requested artboard satisfy the contract.
 */
export function diffRivContract(
  schema: RivSchema | RivInvalid,
  spec: readonly RigInputSpec[],
  options: RivContractOptions = {},
): RivContractDiff {
  const wanted = options.artboards ?? [];
  if (!schema.valid) {
    return {
      ...EVERYTHING_MISSING(spec),
      missingArtboards: [...wanted],
      artboards: wanted.map((artboard) => ({
        artboard,
        present: false,
        stateMachine: false,
        ...EVERYTHING_MISSING(spec),
      })),
    };
  }

  const top = diffViewModel(schema, spec, options.viewModel ?? schema.defaultViewModel);
  const artboards = wanted.map((artboard): RivArtboardDiff => {
    const present = schema.artboards.includes(artboard);
    const stateMachine = (schema.stateMachines[artboard] ?? []).includes(artboard);
    const own = diffViewModel(schema, spec, schema.defaultViewModelByArtboard[artboard] ?? null);
    return { artboard, present, stateMachine, ...own, satisfied: present && stateMachine && own.satisfied };
  });
  const missingArtboards = artboards
    .filter((a) => !a.present || !a.stateMachine || a.viewModel === null)
    .map((a) => a.artboard);

  return {
    ...top,
    missingArtboards,
    artboards,
    satisfied: top.satisfied && artboards.every((a) => a.satisfied),
  };
}

/**
 * Everything the editor handoff needs, from the one truth: the canvas, the
 * artboards and their state machines, the ViewModel name convention, and the
 * typed input spec. `docs/design/athlete-rig-manifest.json` is this object
 * written down, and `rivContract.test.ts` pins the file to it so the
 * document cannot drift from the binding.
 */
export interface RigManifest {
  readonly canvas: { readonly width: number; readonly height: number };
  readonly viewModel: string;
  readonly artboards: readonly { readonly name: string; readonly stateMachine: string }[];
  readonly plateSlotsPerSide: number;
  readonly inputs: readonly RigInputSpec[];
}

export function rigManifest(): RigManifest {
  return {
    canvas: { width: ATHLETE_RIG.CANVAS_PX.WIDTH, height: ATHLETE_RIG.CANVAS_PX.HEIGHT },
    viewModel: ATHLETE_RIG.VIEW_MODEL_NAME,
    artboards: rigLiftArtboards().map((name) => ({ name, stateMachine: name })),
    plateSlotsPerSide: ATHLETE_RIG.PLATE_SLOTS_PER_SIDE,
    inputs: rigInputSpec(),
  };
}
