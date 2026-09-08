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
import { MAX_VIEW_MODEL_DEPTH, type RivInvalid, type RivProperty, type RivPropertyType, type RivSchema } from '../../tools/rivSchema.mjs';
import type { RigInputSpec, RigInputType } from './athleteRig';

/** One property reachable from a ViewModel by Rive's nested-path grammar (`a/b/c`). */
export interface FlatRivProperty {
  readonly path: string;
  readonly property: RivProperty;
}

/**
 * Every property reachable from `viewModel`, nested references expanded to
 * slash paths, containers included. Depth-capped so a self-referencing
 * model terminates.
 */
export function flattenViewModel(schema: RivSchema, viewModel: string): readonly FlatRivProperty[] {
  const out: FlatRivProperty[] = [];
  const walk = (name: string, prefix: string, depth: number): void => {
    const properties = schema.viewModels[name];
    if (properties === undefined || depth > MAX_VIEW_MODEL_DEPTH) return;
    for (const [key, property] of Object.entries(properties)) {
      const path = prefix === '' ? key : `${prefix}/${key}`;
      out.push({ path, property });
      if (property.type === 'viewModel' && property.ref) walk(property.ref, path, depth + 1);
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

export interface RivContractDiff {
  /** The ViewModel the diff was taken against; null when the file is invalid or has no default. */
  readonly viewModel: string | null;
  /** Spec paths the file does not expose at all. */
  readonly missing: readonly string[];
  /** Spec paths exposed with a different type. */
  readonly wrongType: readonly RivTypeMismatch[];
  /** Enum paths whose authored values do not cover what the binding writes. */
  readonly missingEnumValues: readonly RivEnumGap[];
  /** Non-container properties the file exposes that the binding never writes. Informational: authored beats live here. */
  readonly extra: readonly string[];
  /** True only when `missing`, `wrongType` and `missingEnumValues` are all empty. */
  readonly satisfied: boolean;
}

/**
 * Diff a file's schema against the rig's spec. Binds to `viewModel` when
 * given, else to the engine's default for the default artboard — the same
 * choice the web stage's `useDefault: true` makes.
 */
export function diffRivContract(
  schema: RivSchema | RivInvalid,
  spec: readonly RigInputSpec[],
  viewModel?: string,
): RivContractDiff {
  const target = schema.valid ? (viewModel ?? schema.defaultViewModel) : null;
  if (!schema.valid || target === null) {
    return {
      viewModel: null,
      missing: spec.map((input) => input.path),
      wrongType: [],
      missingEnumValues: [],
      extra: [],
      satisfied: false,
    };
  }

  const exposed = new Map<string, RivProperty>();
  for (const flat of flattenViewModel(schema, target)) exposed.set(flat.path, flat.property);

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
    .filter(([path, property]) => !specified.has(path) && property.type !== 'viewModel')
    .map(([path]) => path);

  return {
    viewModel: target,
    missing,
    wrongType,
    missingEnumValues,
    extra,
    satisfied: missing.length === 0 && wrongType.length === 0 && missingEnumValues.length === 0,
  };
}
