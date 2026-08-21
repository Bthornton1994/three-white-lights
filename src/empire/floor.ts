/**
 * floor.ts — GDD §5.13 presentation Phase 1: the floor grid and placement
 * mechanics ("Grid + placement alone. No members, no final art.").
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React,
 * zero side effects, zero I/O, no clock reading, no randomness. Its only
 * imports are `./empireCore` (for `refuseWith`, the directory's throw gate),
 * `./ladder` (for `LadderRung`), `./sessions` (for `SessionEquipmentItem`)
 * and `./empireTuning` — the same import-fence discipline every module in
 * this directory carries.
 *
 * ===========================================================================
 * What this module is, and what it deliberately is not
 * ===========================================================================
 *
 * GDD §5.13's grounding check, read before any of this was written, states
 * plainly what does and does not exist in code yet: member types,
 * satisfaction and equipment condition are stage 3/4 concepts, and the
 * Barbell group (`LADDER_EQUIPMENT_ITEMS`) has no ownable *floor position*
 * state in this build — it is not gated by rung-fitting space the way
 * stage-2 equipment is, and the presentation piece's own brief scopes Phase 1
 * to `sessions.ts`'s `GymState.sessionEquipment` alone. So `FloorState.
 * placements` — the position table `placeFloorItem`/`removeFloorItem` write
 * — holds exactly the fourteen `SESSION_EQUIPMENT_ITEMS`, and nothing else;
 * this module invents no position/ownership schema for the Barbell group.
 *
 * PLAYTEST 2's ruling (GDD §5.13) answers a narrower, purely presentational
 * question the grounding check left open: `fixedFloorFurniture`, below,
 * draws the Barbell group's always-present starting baseline
 * (`LADDER_STARTING_EQUIPMENT` — power-bar, comp-plates, flat-bench) as
 * fixed, non-draggable furniture at set positions, reading `LadderState.
 * equipment` — real, already-existing ownership state — the same way
 * `floorLayout` reads `owned` for session items. It returns a plain read
 * model, never a `FloorState`, and adds no field to `FloorState` — see that
 * function's own header for what it does and does not guarantee.
 *
 * ===========================================================================
 * The hard constraint: a floor is a VIEW of ownership, never a second copy
 * ===========================================================================
 *
 * §5.13: "this is presentation, not a second source of truth. It reads owned
 * equipment... and may display consequences of it; it does not maintain its
 * own copy of anything progression-affecting."
 *
 * `FloorState` therefore carries no ownership list at all — only a position
 * per PLACED item. Every function that reads or writes a placement takes the
 * caller's real `owned` list (`GymState.sessionEquipment`, unchanged) as an
 * explicit argument, and `requireFloorState` refuses a floor holding a
 * placement for an item `owned` does not contain. That is a bounded claim
 * with a named limit: the refusal only fires when a function that takes
 * `owned` is actually called with a floor that has drifted, so a `FloorState`
 * constructed and never validated could still disagree with `owned` at rest,
 * with nothing running to notice. The catcher for that limit is
 * `floor.test.ts`'s battery driving every exported function that takes
 * `owned` against a deliberately stale floor and pinning that each one
 * refuses rather than returning a stale placement silently.
 *
 * `sessions.ts`'s own rule stands unchanged: there is no `sell` function, so
 * an owned item is never un-owned in this build. What placement covers is
 * narrower and real: an owned item may be off the floor (bought, not yet
 * placed), on the floor at a position, or moved to a new position — never
 * duplicated, never invented.
 *
 * ===========================================================================
 * Relocation resets the floor — a new room, not a bigger version of the old
 * one
 * ===========================================================================
 *
 * GDD §5.1: each ladder move in Phase 1 is a full relocation — "you leave
 * the old place behind." A grid position on an 8x6 garage floor has no
 * meaningful reading on a 40x28 warehouse floor, so `relocateFloorState`
 * does not carry positions forward: it returns a fresh, empty floor sized
 * for the destination rung. Ownership is untouched — every owned item is
 * simply unplaced again, waiting for the player to lay out the new room.
 * This is a design decision this piece is making, not one GDD §5.13 states
 * explicitly; it is named here and in this piece's report rather than
 * buried.
 *
 * ===========================================================================
 * Placement legality: bounds and non-overlap, nothing else, yet
 * ===========================================================================
 *
 * A placement is legal exactly when: the item is owned, the item's footprint
 * (width x height in tiles, `SESSION_EQUIPMENT_FOOTPRINT`) fits entirely
 * inside the rung's grid (`FLOOR_GRID_SIZE`) at the given top-left position,
 * and it overlaps no OTHER placed item's footprint. There is no clearance,
 * path-distance or satisfaction scoring here — GDD §5.13's own proposed
 * layout-to-satisfaction formula is explicitly deferred until stage 3's
 * satisfaction mechanic exists to multiply against, and this module does not
 * anticipate it.
 *
 * `placeFloorItem` is the one placement transition, and it serves both
 * "place" and "move": placing an already-placed item overwrites its
 * position, with the overlap check excluding the item's own prior footprint
 * (so an item never collides with itself while being repositioned).
 * `removeFloorItem` always succeeds, including as a no-op on an item that
 * was never placed — removing is not a decision the game needs to refuse.
 */

import { refuseWith } from './empireCore';
import { type LadderEquipmentItem, type LadderRung } from './ladder';
import { type SessionEquipmentItem } from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** A size in grid tiles — width and height, both whole numbers at or above 1. */
export interface GridSize {
  readonly width: number;
  readonly height: number;
}

/** A top-left grid cell, in tiles, 0-indexed from the floor's top-left corner. */
export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

/** One item's placement: its position, its footprint alongside it for the caller's convenience. */
export interface FloorPlacement {
  readonly item: SessionEquipmentItem;
  readonly position: GridPosition;
  readonly footprint: GridSize;
}

// ---------------------------------------------------------------------------
// Reading the tuning tables — the two knobs this piece registers
// ---------------------------------------------------------------------------

/** The floor grid's size at `rung`, in tiles. Read from `FLOOR_GRID_SIZE`, keyed by exactly `LADDER_RUNGS` (`floor.test.ts` drives both directions). */
export function floorGridSize(rung: LadderRung): GridSize {
  const size = EMPIRE_TUNING.FLOOR_GRID_SIZE[rung];
  if (size === undefined) refuseWith(`${String(rung)} has no registered floor grid size`);
  return size;
}

/** `item`'s footprint on the floor, in tiles. Read from `SESSION_EQUIPMENT_FOOTPRINT`, keyed by exactly `SESSION_EQUIPMENT_ITEMS`. */
export function sessionItemFootprint(item: SessionEquipmentItem): GridSize {
  const footprint = EMPIRE_TUNING.SESSION_EQUIPMENT_FOOTPRINT[item];
  if (footprint === undefined) refuseWith(`${String(item)} has no registered floor footprint`);
  return footprint;
}

// ---------------------------------------------------------------------------
// Fixed furniture — GDD §5.13's PLAYTEST 2 ruling, gap 1
// ---------------------------------------------------------------------------

/**
 * One item of the Barbell-group starting baseline, drawn as fixed floor
 * furniture: its position and footprint, both read from
 * `FLOOR_FIXED_FURNITURE_LAYOUT`. Never a `FloorPlacement` — that type names
 * a `SessionEquipmentItem`, and this one deliberately does not, so a caller
 * cannot pass a fixed-furniture row to a function (`placeFloorItem`,
 * `removeFloorItem`, `requireFloorState`) that expects a real placement.
 */
export interface FixedFurniturePlacement {
  readonly item: LadderEquipmentItem;
  readonly position: GridPosition;
  readonly footprint: GridSize;
}

/**
 * The Barbell-group starting baseline (`LADDER_STARTING_EQUIPMENT` — "a bar,
 * some plates, a bench") as fixed, non-draggable floor furniture — GDD
 * §5.13's PLAYTEST 2 ruling, closing gap 1 ("opening day has nothing
 * placeable") and contributing to gap 3 (a floor with real objects on it
 * reads as a floor): "render the Barbell group's always-present baseline as
 * fixed, non-draggable floor furniture... drawn but not part of
 * `FloorState.placements` since there is no ownership or position data for
 * them to attach to."
 *
 * Filtered against `owned` — the caller's real `LadderState.equipment`, read
 * exactly the way `floorLayout` reads its caller's `owned` for session items
 * — rather than assumed present. In practice this is always every entry of
 * `LADDER_STARTING_EQUIPMENT`: `createLadderState` grants all three on
 * creation and there is no `sell` on the ladder any more than there is on
 * `sessions.ts`. The filter is what keeps this function a reader of real
 * state rather than an invented assumption, and is what `floor.test.ts`
 * drives directly (an `owned` list missing one of the three omits exactly
 * that one row).
 *
 * ONE LAYOUT FOR EVERY RUNG — see `FLOOR_FIXED_FURNITURE_LAYOUT`'s own
 * tuning comment for why a single arrangement, not a per-rung table, is the
 * right shape here: every rung's grid contains the garage's, so a layout
 * that fits the garage fits every rung. `floor.test.ts` drives the
 * containment claim against every rung in `LADDER_RUNGS`, not only the
 * garage.
 *
 * THE LIMIT, STATED RATHER THAN HIDDEN: this returns a plain read model, not
 * a `FloorState`, and nothing in `placeFloorItem`/`requireFloorState`'s
 * overlap logic knows this table exists — that is unchanged by GDD §5.13's
 * PLAYTEST 3 ruling on the furniture/session-item overlap gap, below.
 * `placeFloorItem`, `removeFloorItem` and `FloorState` stay exactly as blind
 * to fixed furniture as this paragraph originally said: a `FloorState` built
 * directly, or `placeFloorItem` called directly (as `floor.test.ts` and
 * `ladderView.test.ts`'s own reducer-level tests do), can still record a
 * session item at a position that visually overlaps a fixed row. What closed
 * is the PLAYER-REACHABLE route: `FloorGrid.tsx`'s drop handler is the only
 * place in the shipped app that ever dispatches a `floor-place` action (the
 * single production call site — grepped, not assumed), and it now refuses a
 * drop there using `overlapsFixedFurniture`, below, before ever reaching
 * `placeFloorItem`. So the data model's blindness stays exactly as
 * documented; the refusal lives one layer up, at the one place a real drag
 * can originate.
 */
export function fixedFloorFurniture(
  owned: readonly LadderEquipmentItem[],
): readonly FixedFurniturePlacement[] {
  const ownedSet = new Set<string>(owned);
  return Object.freeze(
    EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT.filter((item) => ownedSet.has(item)).map((item) => {
      const layout = EMPIRE_TUNING.FLOOR_FIXED_FURNITURE_LAYOUT[item];
      if (layout === undefined) {
        refuseWith(`${String(item)} has no registered fixed-furniture layout`);
      }
      return Object.freeze({ item, position: layout.position, footprint: layout.footprint });
    }),
  );
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The whole of Phase 1's layout state: which rung's floor this is, and a
 * position per placed item. `placements` carries no entry for an owned but
 * unplaced item — presence in the record IS "placed", the same closed-world
 * reading `GymState.sessionEquipment` uses for ownership.
 */
export interface FloorState {
  readonly rung: LadderRung;
  readonly placements: Readonly<Partial<Record<SessionEquipmentItem, GridPosition>>>;
}

/** A fresh, empty floor at `rung` — the opening state, and what a relocation resets to. */
export function createFloorState(rung: LadderRung): FloorState {
  return Object.freeze({ rung, placements: Object.freeze({}) });
}

/** The floor a relocation to `rung` produces — header note above: a new room, nothing carried forward but ownership (which this module never held). */
export function relocateFloorState(rung: LadderRung): FloorState {
  return createFloorState(rung);
}

/** Every item this floor has a position for, in `SESSION_EQUIPMENT_ITEMS` order. */
export function placedFloorItems(floor: FloorState): readonly SessionEquipmentItem[] {
  const placed = new Set(Object.keys(floor.placements));
  return Object.freeze(
    EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.filter((item) => placed.has(item)),
  );
}

/** Every item `owned` holds that this floor has no position for yet, in `SESSION_EQUIPMENT_ITEMS` order. */
export function unplacedOwnedFloorItems(
  floor: FloorState,
  owned: readonly SessionEquipmentItem[],
): readonly SessionEquipmentItem[] {
  const ownedSet = new Set<string>(owned);
  const placed = new Set(Object.keys(floor.placements));
  return Object.freeze(
    EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.filter(
      (item) => ownedSet.has(item) && !placed.has(item),
    ),
  );
}

/** Every placement as a `{item, position, footprint}` row, in `SESSION_EQUIPMENT_ITEMS` order — the read model a screen renders from directly. */
export function floorLayout(floor: FloorState): readonly FloorPlacement[] {
  return Object.freeze(
    placedFloorItems(floor).map((item) =>
      Object.freeze({
        item,
        position: floor.placements[item] as GridPosition,
        footprint: sessionItemFootprint(item),
      }),
    ),
  );
}

/** Whether two axis-aligned footprints at `left`/`right` positions overlap at all. */
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

/**
 * Whether placing something of `footprint` at `position` would overlap ANY
 * row of `fixed` — GDD §5.13's PLAYTEST 3 ruling on the furniture/
 * session-item overlap gap: refuse the drop where the drop originates
 * (`FloorGrid.tsx`'s drop handler), not by teaching `placeFloorItem`/
 * `FloorState` about fixed furniture, which stays exactly as separate as
 * `fixedFloorFurniture`'s own header commits to above. Reuses the identical
 * geometry `requireFloorState` already applies between two session items,
 * against the fixed-furniture table instead — `fixed` is a plain parameter,
 * never stored, never threaded into `FloorState`.
 *
 * Pure and total: never throws, never reads `FloorState`, never calls
 * `placeFloorItem`/`removeFloorItem`. Read by `FloorGrid.tsx`'s drop handler
 * only — `floor.test.ts` drives it directly.
 */
export function overlapsFixedFurniture(
  position: GridPosition,
  footprint: GridSize,
  fixed: readonly FixedFurniturePlacement[],
): boolean {
  return fixed.some((row) => footprintsOverlap(position, footprint, row.position, row.footprint));
}

/** Whether `position`/`size` sits entirely inside a grid of `grid`. */
function withinGrid(position: GridPosition, size: GridSize, grid: GridSize): boolean {
  if (!Number.isInteger(position.x) || !Number.isInteger(position.y)) return false;
  if (position.x < 0 || position.y < 0) return false;
  return position.x + size.width <= grid.width && position.y + size.height <= grid.height;
}

/** Refuse a floor whose placements disagree with `owned`, or whose recorded positions are no longer legal. Hands a well-formed floor back unchanged. */
export function requireFloorState(
  floor: FloorState,
  owned: readonly SessionEquipmentItem[],
): FloorState {
  const ownedSet = new Set<string>(owned);
  const grid = floorGridSize(floor.rung);
  const entries = Object.entries(floor.placements) as ReadonlyArray<
    readonly [SessionEquipmentItem, GridPosition]
  >;
  for (const [item, position] of entries) {
    if (!ownedSet.has(item)) {
      refuseWith(`the floor holds a position for ${String(item)}, which is not owned`);
    }
    if (!withinGrid(position, sessionItemFootprint(item), grid)) {
      refuseWith(`the floor's position for ${String(item)} does not fit its rung's grid`);
    }
  }
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [itemA, positionA] = entries[i] as readonly [SessionEquipmentItem, GridPosition];
      const [itemB, positionB] = entries[j] as readonly [SessionEquipmentItem, GridPosition];
      if (
        footprintsOverlap(
          positionA,
          sessionItemFootprint(itemA),
          positionB,
          sessionItemFootprint(itemB),
        )
      ) {
        refuseWith(`the floor places ${String(itemA)} and ${String(itemB)} overlapping each other`);
      }
    }
  }
  return floor;
}

// ---------------------------------------------------------------------------
// Transitions — place (and move), and remove
// ---------------------------------------------------------------------------

/** Placing (or moving) an item on the floor: it lands, or the refusal says why, state unchanged. */
export type FloorPlaceResult =
  | {
      readonly kind: 'placed';
      readonly state: FloorState;
      readonly item: SessionEquipmentItem;
      readonly position: GridPosition;
    }
  | {
      readonly kind: 'refused';
      readonly state: FloorState;
      readonly item: SessionEquipmentItem;
      readonly position: GridPosition;
      readonly reason: 'not-owned' | 'out-of-bounds' | 'overlaps';
    };

/**
 * Place `item` at `position` on `floor`, or move it there if it is already
 * placed. `owned` is the real ownership list — this function never writes to
 * it and never trusts a cached copy of it.
 */
export function placeFloorItem(
  floor: FloorState,
  owned: readonly SessionEquipmentItem[],
  item: SessionEquipmentItem,
  position: GridPosition,
): FloorPlaceResult {
  requireFloorState(floor, owned);
  const ownedSet = new Set<string>(owned);
  if (!ownedSet.has(item)) {
    return Object.freeze({ kind: 'refused', state: floor, item, position, reason: 'not-owned' });
  }
  const grid = floorGridSize(floor.rung);
  const footprint = sessionItemFootprint(item);
  if (!withinGrid(position, footprint, grid)) {
    return Object.freeze({
      kind: 'refused',
      state: floor,
      item,
      position,
      reason: 'out-of-bounds',
    });
  }
  const others = (Object.entries(floor.placements) as ReadonlyArray<
    readonly [SessionEquipmentItem, GridPosition]
  >).filter(([existingItem]) => existingItem !== item);
  for (const [otherItem, otherPosition] of others) {
    if (footprintsOverlap(position, footprint, otherPosition, sessionItemFootprint(otherItem))) {
      return Object.freeze({ kind: 'refused', state: floor, item, position, reason: 'overlaps' });
    }
  }
  return Object.freeze({
    kind: 'placed',
    state: Object.freeze({
      ...floor,
      placements: Object.freeze({ ...floor.placements, [item]: Object.freeze(position) }),
    }),
    item,
    position,
  });
}

/** Take `item` off the floor. Always succeeds — a no-op if it was never placed. */
export function removeFloorItem(floor: FloorState, item: SessionEquipmentItem): FloorState {
  if (!(item in floor.placements)) return floor;
  const next = { ...floor.placements };
  delete next[item];
  return Object.freeze({ ...floor, placements: Object.freeze(next) });
}
