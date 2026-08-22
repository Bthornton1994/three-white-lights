/**
 * floor.ts — GDD §5.13 presentation Phase 1: the floor grid and placement
 * mechanics ("Grid + placement alone. No members, no final art.").
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React,
 * zero side effects, zero I/O, no clock reading, no randomness. Its only
 * imports are `./empireCore` (for `refuseWith`, the directory's throw gate),
 * `./ladder` (for `LadderRung`), `./members` (for `equipmentBiasedMemberTypes`
 * and `MemberType` — GDD §5.13 presentation Phase 2's ambient-member type
 * mix, see that section below), `./sessions` (for `SessionEquipmentItem`) and
 * `./empireTuning` — the same import-fence discipline every module in this
 * directory carries.
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
import { equipmentBiasedMemberTypes, type MemberType } from './members';
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

// ---------------------------------------------------------------------------
// Ambient members — GDD §5.13 presentation Phase 2: "ambient members at fixed
// positions, static or idle-animated, from real count/type data. Gate: does
// the gym read as populated and alive?"
// ---------------------------------------------------------------------------

/**
 * One ambient body's type and fixed grid position. Never a `FloorPlacement`
 * (that names a `SessionEquipmentItem`) and never a `FixedFurniturePlacement`
 * (that names a `LadderEquipmentItem`) — a member is neither draggable
 * equipment nor Barbell-group furniture, and this is a third, disjoint read
 * model, kept apart from the other two for the same reason those two are
 * kept apart from each other (`FixedFurniturePlacement`'s own header).
 */
export interface AmbientMemberPlacement {
  readonly type: MemberType;
  readonly position: GridPosition;
}

/** A stable string key for a grid cell, used only to de-duplicate candidate positions below. */
function cellKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}

/**
 * Phase 2's ambient roster for a gym at `rung`, owning `barbellOwned` (the
 * Barbell-group ladder equipment — read only so members can be placed off
 * `fixedFloorFurniture`'s cells) and `sessionOwned` (the stage-2 session
 * equipment — read only to bias the type mix via `equipmentBiasedMemberTypes`,
 * GDD §5.6's own function; no second type-mix formula is invented here).
 *
 * Same pattern as `fixedFloorFurniture`, above: a plain read model, computed
 * fresh from real state on every call, never a `FloorState` and never stored
 * anywhere. Nothing here is draggable, nothing here is collidable with
 * `placeFloorItem`'s overlap check, and nothing here dispatches.
 *
 * COUNT: read off the provisional `AMBIENT_MEMBER_COUNT_BY_RUNG` table, keyed
 * by rung alone — garage sparse, warehouse populated, per that table's own
 * comment. This first version does not also scale by owned-equipment count;
 * that is a real, separate tuning axis this signature already has room for
 * (nothing about it would need a new parameter, since `barbellOwned` and
 * `sessionOwned` are already threaded through), deliberately not built now to
 * keep this function's first pass simple and testable.
 *
 * TYPE MIX: `equipmentBiasedMemberTypes(sessionOwned)` names the type(s) the
 * gym's owned equipment is biased toward (never empty — see that function's
 * own header). This roster is filled by CYCLING ROUND-ROBIN through that
 * list, in order, wrapping as needed: member index `i` gets
 * `biased[i % biased.length]`. STATED LIMIT: round-robin gives every biased
 * type an equal share of the roster; it does NOT weight members toward the
 * FIRST-biased type more than any other, which may or may not be the right
 * read of "the mix is a consequence of what you built" — a design call for
 * later, not one this function's shape resolves.
 *
 * POSITIONS: every candidate cell of the rung's own `floorGridSize` grid,
 * scanned row-major at `AMBIENT_MEMBER_FOOTPRINT_TILES` resolution, that does
 * NOT overlap any row of `fixedFloorFurniture(barbellOwned)` (via
 * `overlapsFixedFurniture`, reused rather than re-implemented) is a legal
 * candidate — so a member is never drawn standing exactly on top of a
 * furniture chip, even though nothing here is mechanically collidable. To
 * avoid every member clustering into the grid's top-left corner, candidates
 * are first taken every `AMBIENT_MEMBER_PLACEMENT_STRIDE`'th one in scan
 * order; only if that strided pass does not yield `count` positions does the
 * function fall back to filling the remaining slots from the skipped
 * candidates, in order. `floor.test.ts` drives that every returned position
 * lies inside the rung's grid and outside every fixed row's footprint.
 *
 * STATED LIMIT, NAMED RATHER THAN SILENTLY DECIDED: this avoids the FIXED
 * Barbell furniture only. It does NOT avoid a player's own placed session
 * equipment (`FloorState.placements`) — that state is mutable, per-gym, and
 * this function's signature deliberately does not take a `FloorState` at
 * all, so an ambient member's fixed position CAN visually coincide with a
 * chip a player has dragged onto the floor. Reading the live floor here would
 * make an ambient body move whenever equipment moves, which is a step toward
 * Phase 3's real pathing/reaction machinery ("NOT this piece", per this
 * piece's own brief) rather than a static Phase 2 body.
 *
 * WHAT THIS FUNCTION DOES NOT, AND MUST NOT, TAKE AS INPUT: reputation,
 * satisfaction, dues, or any other economic quantity `members.ts` computes
 * from a real economic roster — this screen's state (`sessions.ts`'s
 * `GymState`) has no roster field and no reputation field to read. This is
 * presentation reading real state (a rung and two ownership lists),
 * inventing no new source of truth — the same discipline
 * `fixedFloorFurniture`'s own header states. If a later, separately-
 * serialised piece puts reputation on this screen's state, this derivation
 * can grow to use it; it must not grow to use it in this phase.
 */
export function ambientMemberRoster(
  rung: LadderRung,
  barbellOwned: readonly LadderEquipmentItem[],
  sessionOwned: readonly SessionEquipmentItem[],
): readonly AmbientMemberPlacement[] {
  const count: number = EMPIRE_TUNING.AMBIENT_MEMBER_COUNT_BY_RUNG[rung];
  if (count === undefined) refuseWith(`${String(rung)} has no registered ambient member count`);
  if (count === 0) return Object.freeze([]);

  const grid = floorGridSize(rung);
  const fixed = fixedFloorFurniture(barbellOwned);
  const footprint = EMPIRE_TUNING.AMBIENT_MEMBER_FOOTPRINT_TILES;
  const stride = EMPIRE_TUNING.AMBIENT_MEMBER_PLACEMENT_STRIDE;

  const candidates: GridPosition[] = [];
  for (let y = 0; y + footprint.height <= grid.height; y += 1) {
    for (let x = 0; x + footprint.width <= grid.width; x += 1) {
      const position: GridPosition = { x, y };
      if (!overlapsFixedFurniture(position, footprint, fixed)) candidates.push(position);
    }
  }

  const used = new Set<string>();
  const positions: GridPosition[] = [];
  for (const candidate of candidates.filter((_unused, index) => index % stride === 0)) {
    if (positions.length >= count) break;
    positions.push(candidate);
    used.add(cellKey(candidate));
  }
  if (positions.length < count) {
    for (const candidate of candidates) {
      if (positions.length >= count) break;
      const key = cellKey(candidate);
      if (used.has(key)) continue;
      positions.push(candidate);
      used.add(key);
    }
  }
  if (positions.length < count) {
    refuseWith(
      `${String(rung)}'s floor has room for only ${positions.length} of ${count} ambient members outside fixed furniture`,
    );
  }

  const types = equipmentBiasedMemberTypes(sessionOwned);
  return Object.freeze(
    positions.map((position, index) =>
      Object.freeze({
        type: types[index % types.length] as MemberType,
        position,
      }),
    ),
  );
}
