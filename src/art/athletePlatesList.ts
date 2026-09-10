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
 * normalize rule. Platform write surfaces differ (web `.value` vs native
 * `.set()`); each stage maps through the shared path parse.
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
 * short lists append instances from `createSlot`. Stops (ok: false) when the
 * list is missing or a required factory cannot supply an item.
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
