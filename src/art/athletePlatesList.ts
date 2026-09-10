/**
 * athletePlatesList — the runtime adapter for `Athlete.plates` as a native
 * Rive List of `PlateSlot` items.
 *
 * The logical contract still names `plates/<i>/on` and `plates/<i>/size`
 * (`rigInputSpec()` / the manifest). Nested ViewModel paths do not survive
 * `.riv` export for this asset; a List does. Stages therefore resolve those
 * logical paths through indexed List access — they do not invent aliases on
 * the ViewModel, and they do not rewrite the manifest.
 *
 * Pure helpers live here so web and native stages share one grammar and one
 * normalize + write rule. Platform write surfaces differ (web `.value` vs
 * native `.set()`); each stage supplies accessors and a real PlateSlot
 * factory from its pinned runtime (`ViewModel.instance()` on canvas;
 * `ViewModel.createInstance()` on native — the sync blank twin of
 * `createBlankInstanceAsync` in `@rive-app/react-native@0.4.20`).
 */
import { ATHLETE_RIG } from './spriteTuning';

/** The Athlete ViewModel property that holds the plate slots. */
export const ATHLETE_PLATES_LIST = 'plates';

/** The item ViewModel every list entry must be. */
export const ATHLETE_PLATE_SLOT = 'PlateSlot';

export type PlateSlotField = 'on' | 'size';

/** PlateSlot field names — stages write these identifiers, never string literals. */
export const PLATE_SLOT_ON: PlateSlotField = 'on';
export const PLATE_SLOT_SIZE: PlateSlotField = 'size';

export interface PlatePathParts {
  readonly index: number;
  readonly field: PlateSlotField;
}

const PLATE_PATH = /^plates\/(\d+)\/(on|size)$/;

/**
 * Parse a logical rig path into a List index + PlateSlot field. Returns
 * null for every non-plate path so stages keep their ordinary writers.
 */
export function parsePlatePath(path: string): PlatePathParts | null {
  const match = PLATE_PATH.exec(path);
  if (match === null) return null;
  const index = Number(match[1]);
  const field = match[2] as PlateSlotField;
  if (!Number.isInteger(index) || index < 0 || index >= ATHLETE_RIG.PLATE_SLOTS_PER_SIDE) {
    return null;
  }
  return { index, field };
}

/** Duck-typed List surface both runtimes expose (web `instanceAt`, native `getInstanceAt`). */
export interface PlatesListLike {
  readonly length: number;
  instanceAt?(index: number): unknown;
  getInstanceAt?(index: number): unknown;
  removeInstanceAt(index: number): void;
  addInstance(instance: unknown): void;
}

export interface NormalizePlatesResult {
  readonly ok: boolean;
  readonly length: number;
  readonly reason?: string;
}

/**
 * Establish exactly `count` list items. Oversized lists drop from the end;
 * short / empty lists append instances from `createSlot`. Stops (ok: false)
 * when the list is missing or a required factory cannot supply an item.
 */
export function normalizePlatesListLength(
  list: PlatesListLike | null | undefined,
  count: number,
  createSlot: () => unknown | null | undefined,
): NormalizePlatesResult {
  if (list == null) return { ok: false, length: 0, reason: 'plates list missing' };
  while (list.length > count) {
    list.removeInstanceAt(list.length - 1);
  }
  while (list.length < count) {
    const slot = createSlot();
    if (slot == null) {
      return { ok: false, length: list.length, reason: 'PlateSlot factory returned nothing' };
    }
    list.addInstance(slot);
  }
  return { ok: list.length === count, length: list.length };
}

/** Resolve a list item by index across web (`instanceAt`) and native (`getInstanceAt`). */
export function platesListItemAt(list: PlatesListLike, index: number): unknown {
  if (typeof list.instanceAt === 'function') return list.instanceAt(index);
  if (typeof list.getInstanceAt === 'function') return list.getInstanceAt(index);
  return undefined;
}

/** One authored sleeve slot from `AthleteRigInputs.plates`. */
export interface PlateSlotValues {
  readonly on: boolean;
  readonly size: number;
}

/**
 * Platform accessors for one list item. `writeOn` / `writeSize` return false
 * when the property is missing — never a silent no-op from this adapter.
 */
export interface PlateSlotAccess {
  /** ViewModel type name (`PlateSlot`). Null/undefined fails closed. */
  readonly viewModelName: (item: unknown) => string | null | undefined;
  readonly writeOn: (item: unknown, value: boolean) => boolean;
  readonly writeSize: (item: unknown, value: number) => boolean;
}

export interface ApplyPlatesResult {
  readonly ok: boolean;
  readonly length: number;
  readonly written: number;
  readonly reason?: string;
}

/**
 * Normalize `Athlete.plates` to exactly eight `PlateSlot` items, then write
 * all sixteen logical paths. Fails closed on a missing list, factory, item,
 * wrong item type, or missing writable `on`/`size` — never skips a path.
 */
export function applyAthletePlatesList(
  list: PlatesListLike | null | undefined,
  createSlot: () => unknown | null | undefined,
  plates: readonly PlateSlotValues[],
  access: PlateSlotAccess,
): ApplyPlatesResult {
  const expected = ATHLETE_RIG.PLATE_SLOTS_PER_SIDE;
  if (plates.length !== expected) {
    return {
      ok: false,
      length: list?.length ?? 0,
      written: 0,
      reason: `expected ${expected} plate slots in inputs, got ${plates.length}`,
    };
  }

  const norm = normalizePlatesListLength(list, expected, createSlot);
  if (!norm.ok || list == null) {
    return { ok: false, length: norm.length, written: 0, reason: norm.reason };
  }

  let written = 0;
  for (let i = 0; i < expected; i += 1) {
    const item = platesListItemAt(list, i);
    if (item == null) {
      return { ok: false, length: norm.length, written, reason: `plates[${i}] missing after normalize` };
    }
    const model = access.viewModelName(item);
    if (model !== ATHLETE_PLATE_SLOT) {
      return {
        ok: false,
        length: norm.length,
        written,
        reason: `plates[${i}] type is ${model ?? 'missing'}, expected ${ATHLETE_PLATE_SLOT}`,
      };
    }
    const slot = plates[i]!;
    if (!access.writeOn(item, slot.on)) {
      return { ok: false, length: norm.length, written, reason: `plates[${i}].on not writable` };
    }
    written += 1;
    if (!access.writeSize(item, slot.size)) {
      return { ok: false, length: norm.length, written, reason: `plates[${i}].size not writable` };
    }
    written += 1;
  }

  return { ok: true, length: norm.length, written };
}

/** The sixteen logical plate paths in index order — for tests and audits. */
export function plateLogicalPaths(): readonly string[] {
  const paths: string[] = [];
  for (let i = 0; i < ATHLETE_RIG.PLATE_SLOTS_PER_SIDE; i += 1) {
    paths.push(`plates/${i}/on`, `plates/${i}/size`);
  }
  return paths;
}
