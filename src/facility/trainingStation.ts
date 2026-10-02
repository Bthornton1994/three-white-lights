/**
 * trainingStation.ts — GDD §5.18 Stage D.1: equipment is not a training station.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock, no randomness. Its imports are `./floor`
 * (grid, furniture layout, footprints) and `./ladder` (the Barbell item
 * vocabulary). It does not import `floorSim.ts` or `stationCapability.ts` —
 * this file names the bay and says which footprints it occupies; the sim
 * seats members on it, and capability stores Q/C/T against its kind.
 *
 * ===========================================================================
 * Equipment ≠ training station
 * ===========================================================================
 *
 * A power-bar and a pair of competition plates are equipment. A Competition
 * Bench Bay is the place a powerlifter trains. Stage D attached Quality,
 * Capacity and Throughput to each starting SKU as if each were a destination.
 * Capacity 2 then meant two approach cells around one bench. That is the
 * abstraction this file replaces.
 *
 * Stage D.1's vertical slice is one functional station, assembled
 * deterministically from the opening garage's required starting equipment.
 * Future stations (squat rack, deadlift platform, combo rack) are named in
 * GDD §5.18 and are not built here.
 *
 *   Quality     — a property of the bay. May be painted on its equipment.
 *   Capacity    — a second physical bench footprint, or an honest refusal.
 *   Throughput  — the same bay, the same footprints, shorter service.
 *
 * Component equipment stays owned and movable. If a required piece is off
 * the floor, the bay is incomplete: members cannot train there.
 */

import {
  floorFurnitureLayout,
  floorGridSize,
  furnitureItemFootprint,
  type FloorState,
  type GridPosition,
  type GridSize,
} from './floor';
import { type LadderEquipmentItem } from './ladder';

/** The one Stage D.1 functional station. Not a catalog. */
export const COMPETITION_BENCH_BAY = 'competition-bench-bay' as const;

export const TRAINING_STATION_KINDS = Object.freeze([COMPETITION_BENCH_BAY] as const);

export type TrainingStationKind = (typeof TRAINING_STATION_KINDS)[number];

/**
 * Equipment the opening garage must have on the floor for the bay to be
 * usable. Order is primary surface first, then the bar, then the plates —
 * the same order a human names the setup, not a crafting recipe.
 */
export const COMPETITION_BENCH_BAY_REQUIRED = Object.freeze([
  'power-bar',
  'comp-plates',
  'flat-bench',
] as const);

export type CompetitionBenchBayRequired = (typeof COMPETITION_BENCH_BAY_REQUIRED)[number];

/** The surface members actually lie on. Tapping this, when the bay is complete, is tapping the station. */
export const COMPETITION_BENCH_BAY_PRIMARY: LadderEquipmentItem = 'flat-bench';

export function isCompetitionBenchBayComponent(
  item: string,
): item is CompetitionBenchBayRequired {
  return (COMPETITION_BENCH_BAY_REQUIRED as readonly string[]).includes(item);
}

export function isTrainingStationKind(value: string): value is TrainingStationKind {
  return (TRAINING_STATION_KINDS as readonly string[]).includes(value);
}

/** One physical bench position belonging to the bay. */
export interface BayBench {
  readonly position: GridPosition;
  readonly footprint: GridSize;
  readonly source: 'primary' | 'expansion';
}

/** One required component as it currently sits, or would sit, on the floor. */
export interface BayComponent {
  readonly item: LadderEquipmentItem;
  readonly position: GridPosition;
  readonly footprint: GridSize;
}

/**
 * The Competition Bench Bay derived from a floor and a purchased capacity
 * level. Never stored. Completeness is "all three required pieces are
 * currently placed", not a crafted recipe.
 *
 * `benches` is the realised physical training positions: one when the bay
 * is complete at stock, two when capacity is purchased AND a second 2×4
 * rectangle fits orthogonally adjacent to the primary. An incomplete bay
 * has no benches — members cannot train on a pile of parts.
 */
export interface CompetitionBenchBay {
  readonly kind: typeof COMPETITION_BENCH_BAY;
  readonly complete: boolean;
  readonly missing: readonly LadderEquipmentItem[];
  readonly primary: BayBench | null;
  readonly components: readonly BayComponent[];
  readonly benches: readonly BayBench[];
  readonly expansion: BayBench | null;
}

function sameCell(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y;
}

function footprintsOverlap(
  left: GridPosition,
  leftSize: GridSize,
  right: GridPosition,
  rightSize: GridSize,
): boolean {
  const leftRight = left.x + leftSize.width;
  const rightRight = right.x + rightSize.width;
  const leftBottom = left.y + leftSize.height;
  const rightBottom = right.y + rightSize.height;
  return left.x < rightRight && right.x < leftRight && left.y < rightBottom && right.y < leftBottom;
}

function withinGrid(position: GridPosition, size: GridSize, grid: GridSize): boolean {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) return false;
  if (position.x < 0 || position.y < 0) return false;
  return position.x + size.width <= grid.width && position.y + size.height <= grid.height;
}

/** Right, down, left, up of the primary — a second position of THIS bay, not a remote bench. */
function adjacentExpansionCandidates(
  primary: GridPosition,
  footprint: GridSize,
): readonly GridPosition[] {
  return Object.freeze([
    Object.freeze({ x: primary.x + footprint.width, y: primary.y }),
    Object.freeze({ x: primary.x, y: primary.y + footprint.height }),
    Object.freeze({ x: primary.x - footprint.width, y: primary.y }),
    Object.freeze({ x: primary.x, y: primary.y - footprint.height }),
  ]);
}

/**
 * Whether a second bench of `footprint` at `position` sits inside the grid
 * and on cells that no placed furniture currently occupies. The primary
 * itself is excluded from the occupancy check because a candidate that
 * overlaps the primary is adjacent-wrong, not "the primary blocking itself".
 */
function expansionFits(
  position: GridPosition,
  footprint: GridSize,
  grid: GridSize,
  blockers: readonly { readonly position: GridPosition; readonly footprint: GridSize }[],
): boolean {
  if (!withinGrid(position, footprint, grid)) return false;
  for (const blocker of blockers) {
    if (footprintsOverlap(position, footprint, blocker.position, blocker.footprint)) return false;
  }
  return true;
}

/**
 * Derive the Competition Bench Bay from live furniture. `capacityLevel` is
 * the purchased axis (0 or 1); this function realises that many physical
 * benches only when the second footprint actually fits.
 *
 * Session placements are not blockers here. The floor sim blocks them
 * separately, and FloorGrid refuses a drop onto the expansion the same way
 * it already refuses a drop onto furniture. Capacity's spatial consequence
 * is the Barbell layout.
 */
export function competitionBenchBay(
  floor: FloorState,
  barbellOwned: readonly LadderEquipmentItem[],
  capacityLevel: number,
): CompetitionBenchBay {
  const furniture = floorFurnitureLayout(floor, barbellOwned);
  const components: BayComponent[] = [];
  const placed = new Map<string, BayComponent>();
  for (const row of furniture) {
    if (!isCompetitionBenchBayComponent(row.item)) continue;
    const component: BayComponent = Object.freeze({
      item: row.item,
      position: row.position,
      footprint: row.footprint,
    });
    components.push(component);
    placed.set(row.item, component);
  }
  const missing: LadderEquipmentItem[] = [];
  for (const item of COMPETITION_BENCH_BAY_REQUIRED) {
    if (!placed.has(item)) missing.push(item);
  }
  const primaryRow = placed.get(COMPETITION_BENCH_BAY_PRIMARY);
  const primary: BayBench | null =
    primaryRow === undefined
      ? null
      : Object.freeze({
          position: primaryRow.position,
          footprint: primaryRow.footprint,
          source: 'primary' as const,
        });
  const complete = missing.length === 0 && primary !== null;
  if (!complete || primary === null) {
    return Object.freeze({
      kind: COMPETITION_BENCH_BAY,
      complete: false,
      missing: Object.freeze(missing),
      primary,
      components: Object.freeze(components),
      benches: Object.freeze([]),
      expansion: null,
    });
  }
  let expansion: BayBench | null = null;
  if (capacityLevel > 0) {
    const grid = floorGridSize(floor.rung);
    const blockers: { readonly position: GridPosition; readonly footprint: GridSize }[] = [];
    for (const row of furniture) {
      if (row.item === COMPETITION_BENCH_BAY_PRIMARY) continue;
      blockers.push(row);
    }
    for (const candidate of adjacentExpansionCandidates(primary.position, primary.footprint)) {
      if (!expansionFits(candidate, primary.footprint, grid, blockers)) continue;
      expansion = Object.freeze({
        position: candidate,
        footprint: primary.footprint,
        source: 'expansion' as const,
      });
      break;
    }
  }
  const benches: BayBench[] =
    expansion === null ? [primary] : [primary, expansion];
  return Object.freeze({
    kind: COMPETITION_BENCH_BAY,
    complete: true,
    missing: Object.freeze(missing),
    primary,
    components: Object.freeze(components),
    benches: Object.freeze(benches),
    expansion,
  });
}

/**
 * Whether purchasing Capacity on this layout would place a second 2×4.
 * The reducer's preview and the station panel's preflight both read this
 * so the UI cannot offer a live buy the domain will refuse. Not a second
 * placement search — it is `competitionBenchBay` at capacity 1.
 */
export function capacityRealizesOn(
  floor: FloorState,
  barbellOwned: readonly LadderEquipmentItem[],
): boolean {
  const preview = competitionBenchBay(floor, barbellOwned, 1);
  return preview.expansion !== null && preview.benches.length >= 2;
}

/**
 * Whether placing something of `footprint` at `position` would land on the
 * bay's expansion bench. The primary is ordinary furniture and is already
 * refused by `overlapsFixedFurniture`. Moving the primary itself does not
 * consult this — the expansion is derived from the primary, and picking the
 * bench up takes the second position with it.
 */
export function overlapsBayExpansion(
  position: GridPosition,
  footprint: GridSize,
  bay: CompetitionBenchBay,
): boolean {
  if (bay.expansion === null) return false;
  return footprintsOverlap(position, footprint, bay.expansion.position, bay.expansion.footprint);
}

/** Cells the bay's realised benches occupy — Capacity's physical cost. */
export function bayOccupiedCells(bay: CompetitionBenchBay): number {
  let cells = 0;
  for (const bench of bay.benches) {
    cells += bench.footprint.width * bench.footprint.height;
  }
  return cells;
}

export function sameBayBench(left: BayBench, right: BayBench): boolean {
  return left.source === right.source && sameCell(left.position, right.position);
}
