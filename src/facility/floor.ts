/** Pure layout truth. Ownership and economy stay in the facility reducer. */
import { refuseWith } from './empireCore';
import { type LadderEquipmentItem, type LadderRung } from './ladder';
import { equipmentBiasedMemberTypes, type MemberType } from './members';
import { type SessionEquipmentItem } from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

export interface GridSize { readonly width: number; readonly height: number }
export interface GridPosition { readonly x: number; readonly y: number }
export type FloorRotation = (typeof EMPIRE_TUNING.FLOOR_ROTATIONS)[number];
/** Coordinate-only inputs remain the stock orientation for older local callers. */
export interface FloorPosition extends GridPosition { readonly rotation?: FloorRotation }
export interface OrientedFloorPosition extends GridPosition { readonly rotation: FloorRotation }
export type FloorEditTarget =
  | { readonly kind: 'session'; readonly item: SessionEquipmentItem }
  | { readonly kind: 'furniture'; readonly item: LadderEquipmentItem };
export interface FloorLayoutEdit {
  readonly target: FloorEditTarget;
  readonly previous: OrientedFloorPosition | null;
  readonly current: OrientedFloorPosition | null;
  readonly appliedRevision: number;
}
export interface FloorPlacement {
  readonly item: SessionEquipmentItem;
  readonly position: FloorPosition;
  readonly rotation: FloorRotation;
  readonly footprint: GridSize;
}
export interface FixedFurniturePlacement {
  readonly item: LadderEquipmentItem;
  readonly position: FloorPosition;
  readonly rotation: FloorRotation;
  readonly footprint: GridSize;
}
export interface FloorState {
  readonly rung: LadderRung;
  readonly placements: Readonly<Partial<Record<SessionEquipmentItem, FloorPosition>>>;
  readonly furniture: Readonly<Partial<Record<LadderEquipmentItem, FloorPosition>>>;
  readonly layoutRevision: number;
  readonly lastLayoutEdit: FloorLayoutEdit | null;
}

export function floorGridSize(rung: LadderRung): GridSize {
  const size = EMPIRE_TUNING.FLOOR_GRID_SIZE[rung];
  if (size === undefined) refuseWith(`${String(rung)} has no registered floor grid size`);
  return size;
}
export function isFloorRotation(value: unknown): value is FloorRotation {
  return (EMPIRE_TUNING.FLOOR_ROTATIONS as readonly unknown[]).includes(value);
}
export function floorPositionRotation(position: FloorPosition): FloorRotation {
  const rotation = position.rotation ?? EMPIRE_TUNING.FLOOR_ROTATIONS[0];
  if (!isFloorRotation(rotation)) refuseWith('floor rotation must be a supported quarter turn');
  return rotation;
}
export function orientedFloorPosition(position: FloorPosition): OrientedFloorPosition {
  return Object.freeze({ x: position.x, y: position.y, rotation: floorPositionRotation(position) });
}
export function rotatedFloorFootprint(footprint: GridSize, rotation: FloorRotation): GridSize {
  if (!isFloorRotation(rotation)) refuseWith('floor rotation must be a supported quarter turn');
  return rotation % EMPIRE_TUNING.FLOOR_ROTATIONS[2] !== 0
    ? Object.freeze({ width: footprint.height, height: footprint.width }) : footprint;
}
export function sessionItemFootprint(item: SessionEquipmentItem, rotation: FloorRotation = EMPIRE_TUNING.FLOOR_ROTATIONS[0]): GridSize {
  const footprint = EMPIRE_TUNING.SESSION_EQUIPMENT_FOOTPRINT[item];
  if (footprint === undefined) refuseWith(`${String(item)} has no registered floor footprint`);
  return rotatedFloorFootprint(footprint, rotation);
}
export function furnitureItemFootprint(item: LadderEquipmentItem, rotation: FloorRotation = EMPIRE_TUNING.FLOOR_ROTATIONS[0]): GridSize {
  const footprint = item === 'squat-rack' ? EMPIRE_TUNING.FLOOR_SQUAT_RACK_FOOTPRINT
    : EMPIRE_TUNING.FLOOR_FIXED_FURNITURE_LAYOUT[item]?.footprint;
  if (footprint === undefined) refuseWith(`${String(item)} has no registered furniture footprint`);
  return rotatedFloorFootprint(footprint, rotation);
}
export function fixedFloorFurniture(owned: readonly LadderEquipmentItem[]): readonly FixedFurniturePlacement[] {
  return Object.freeze(EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT.filter(item => owned.includes(item)).map(item => {
    const layout = EMPIRE_TUNING.FLOOR_FIXED_FURNITURE_LAYOUT[item];
    return Object.freeze({ item, position: orientedFloorPosition(layout.position), rotation: EMPIRE_TUNING.FLOOR_ROTATIONS[0], footprint: layout.footprint });
  }));
}
function startingFurniturePositions(): FloorState['furniture'] {
  const next: Partial<Record<LadderEquipmentItem, FloorPosition>> = {};
  for (const row of fixedFloorFurniture(EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT)) next[row.item] = row.position;
  return Object.freeze(next);
}
export function createFloorState(rung: LadderRung): FloorState {
  return Object.freeze({ rung, placements: Object.freeze({}), furniture: startingFurniturePositions(), layoutRevision: EMPIRE_TUNING.FLOOR_LAYOUT_INITIAL_REVISION, lastLayoutEdit: null });
}
export function markFloorLayoutChanged(floor: FloorState): FloorState {
  const revision = floor.layoutRevision + 1;
  if (!Number.isSafeInteger(revision)) refuseWith('floor layout revision exceeded its integer range');
  return Object.freeze({ ...floor, layoutRevision: revision, lastLayoutEdit: null });
}
export function relocateFloorState(rung: LadderRung, previous?: FloorState): FloorState {
  return previous === undefined ? createFloorState(rung) : Object.freeze({ ...createFloorState(rung), layoutRevision: markFloorLayoutChanged(previous).layoutRevision });
}
export function placedFloorItems(floor: FloorState): readonly SessionEquipmentItem[] {
  return Object.freeze(EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.filter(item => floor.placements[item] !== undefined));
}
export function unplacedOwnedFloorItems(floor: FloorState, owned: readonly SessionEquipmentItem[]): readonly SessionEquipmentItem[] {
  return Object.freeze(EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.filter(item => owned.includes(item) && floor.placements[item] === undefined));
}
export function floorLayout(floor: FloorState): readonly FloorPlacement[] {
  return Object.freeze(placedFloorItems(floor).map(item => {
    const position = floor.placements[item] as FloorPosition;
    const rotation = floorPositionRotation(position);
    return Object.freeze({ item, position, rotation, footprint: sessionItemFootprint(item, rotation) });
  }));
}
export function placedFurnitureItems(floor: FloorState): readonly LadderEquipmentItem[] {
  return Object.freeze(EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.filter(item => floor.furniture[item] !== undefined));
}
export function placedOwnedItems(floor: FloorState, barbellOwned: readonly LadderEquipmentItem[], sessionOwned: readonly SessionEquipmentItem[]): readonly (LadderEquipmentItem | SessionEquipmentItem)[] {
  return Object.freeze([...placedFurnitureItems(floor).filter(item => barbellOwned.includes(item)), ...placedFloorItems(floor).filter(item => sessionOwned.includes(item))]);
}
export function unplacedOwnedFurnitureItems(floor: FloorState, owned: readonly LadderEquipmentItem[]): readonly LadderEquipmentItem[] {
  return Object.freeze(EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.filter(item => owned.includes(item) && floor.furniture[item] === undefined));
}
export function floorFurnitureLayout(floor: FloorState, owned: readonly LadderEquipmentItem[]): readonly FixedFurniturePlacement[] {
  return Object.freeze(placedFurnitureItems(floor).filter(item => owned.includes(item)).map(item => {
    const position = floor.furniture[item] as FloorPosition;
    const rotation = floorPositionRotation(position);
    return Object.freeze({ item, position, rotation, footprint: furnitureItemFootprint(item, rotation) });
  }));
}
export function footprintsOverlap(left: GridPosition, leftSize: GridSize, right: GridPosition, rightSize: GridSize): boolean {
  return left.x < right.x + rightSize.width && right.x < left.x + leftSize.width && left.y < right.y + rightSize.height && right.y < left.y + leftSize.height;
}
export function overlapsFixedFurniture(position: GridPosition, footprint: GridSize, fixed: readonly Pick<FixedFurniturePlacement, 'position' | 'footprint'>[]): boolean {
  return fixed.some(row => footprintsOverlap(position, footprint, row.position, row.footprint));
}
function withinGrid(position: GridPosition, size: GridSize, grid: GridSize): boolean {
  return Number.isSafeInteger(position.x) && Number.isSafeInteger(position.y) && position.x >= 0 && position.y >= 0 && position.x + size.width <= grid.width && position.y + size.height <= grid.height;
}
export function floorTargetPosition(floor: FloorState, target: FloorEditTarget): OrientedFloorPosition | null {
  const position = target.kind === 'session' ? floor.placements[target.item] : floor.furniture[target.item];
  return position === undefined ? null : orientedFloorPosition(position);
}
export function sameFloorPosition(left: FloorPosition | null, right: FloorPosition | null): boolean {
  return left === null || right === null ? left === right : left.x === right.x && left.y === right.y && floorPositionRotation(left) === floorPositionRotation(right);
}
export function requireFloorState(floor: FloorState, owned: readonly SessionEquipmentItem[], furnitureOwned?: readonly LadderEquipmentItem[]): FloorState {
  if (!Number.isSafeInteger(floor.layoutRevision) || floor.layoutRevision < 0) refuseWith('floor layout revision must be a nonnegative safe integer');
  const grid = floorGridSize(floor.rung);
  const rows: { item: string; position: FloorPosition; footprint: GridSize }[] = [];
  for (const [item, position] of Object.entries(floor.placements)) {
    if (!(EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS as readonly string[]).includes(item) || !owned.includes(item as SessionEquipmentItem)) refuseWith(`the floor holds a position for ${item}, which is not owned`);
    rows.push({ item, position, footprint: sessionItemFootprint(item as SessionEquipmentItem, floorPositionRotation(position)) });
  }
  for (const [item, position] of Object.entries(floor.furniture)) {
    if (!(EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS as readonly string[]).includes(item) || (furnitureOwned !== undefined && !furnitureOwned.includes(item as LadderEquipmentItem))) refuseWith(`the floor holds furniture ${item}, which is not owned`);
    rows.push({ item, position, footprint: furnitureItemFootprint(item as LadderEquipmentItem, floorPositionRotation(position)) });
  }
  for (const row of rows) if (!withinGrid(row.position, row.footprint, grid)) refuseWith(`the floor's position for ${row.item} does not fit its rung's grid`);
  for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) {
    const left = rows[i]; const right = rows[j];
    if (left && right && footprintsOverlap(left.position, left.footprint, right.position, right.footprint)) refuseWith(`the floor places ${left.item} and ${right.item} overlapping each other`);
  }
  const edit = floor.lastLayoutEdit;
  if (edit !== null) {
    if (edit === undefined || edit.appliedRevision <= EMPIRE_TUNING.FLOOR_LAYOUT_INITIAL_REVISION || edit.appliedRevision !== floor.layoutRevision || !sameFloorPosition(floorTargetPosition(floor, edit.target), edit.current) || sameFloorPosition(edit.previous, edit.current)) refuseWith('the last layout edit does not match the current floor revision');
    const targetOwned = edit.target.kind === 'session' ? owned.includes(edit.target.item) : furnitureOwned === undefined || furnitureOwned.includes(edit.target.item);
    if (!targetOwned) refuseWith('the last layout edit targets equipment that is not owned');
    if (edit.previous !== null) {
      const footprint = edit.target.kind === 'session' ? sessionItemFootprint(edit.target.item, floorPositionRotation(edit.previous)) : furnitureItemFootprint(edit.target.item, floorPositionRotation(edit.previous));
      if (!withinGrid(edit.previous, footprint, grid)) refuseWith('the last layout edit has an invalid previous placement');
    }
  }
  return floor;
}
export type FloorPlacementRefusal = 'not-owned' | 'out-of-bounds' | 'overlaps' | 'invalid-rotation';
export type FloorPlaceResult =
  | { readonly kind: 'placed'; readonly state: FloorState; readonly item: SessionEquipmentItem; readonly position: FloorPosition }
  | { readonly kind: 'refused'; readonly state: FloorState; readonly item: SessionEquipmentItem; readonly position: FloorPosition; readonly reason: FloorPlacementRefusal };
export type FloorFurniturePlaceResult =
  | { readonly kind: 'placed'; readonly state: FloorState; readonly item: LadderEquipmentItem; readonly position: FloorPosition }
  | { readonly kind: 'refused'; readonly state: FloorState; readonly item: LadderEquipmentItem; readonly position: FloorPosition; readonly reason: FloorPlacementRefusal };
function withItemEdit(floor: FloorState, target: FloorEditTarget, placement: FloorPosition | null): FloorState {
  const previous = floorTargetPosition(floor, target);
  const current = placement === null ? null : orientedFloorPosition(placement);
  if (sameFloorPosition(previous, current)) return floor;
  const revision = markFloorLayoutChanged(floor).layoutRevision;
  const table: Partial<Record<SessionEquipmentItem | LadderEquipmentItem, FloorPosition>> = { ...(target.kind === 'session' ? floor.placements : floor.furniture) };
  if (current === null) delete table[target.item]; else table[target.item] = current;
  return Object.freeze({ ...floor, ...(target.kind === 'session' ? { placements: Object.freeze(table) } : { furniture: Object.freeze(table) }), layoutRevision: revision,
    lastLayoutEdit: Object.freeze({ target: Object.freeze({ ...target }), previous, current, appliedRevision: revision }) });
}
function placementRefusal(floor: FloorState, target: FloorEditTarget, position: FloorPosition): FloorPlacementRefusal | null {
  if (!isFloorRotation(position.rotation ?? EMPIRE_TUNING.FLOOR_ROTATIONS[0])) return 'invalid-rotation';
  const footprint = target.kind === 'session' ? sessionItemFootprint(target.item, floorPositionRotation(position)) : furnitureItemFootprint(target.item, floorPositionRotation(position));
  if (!withinGrid(position, footprint, floorGridSize(floor.rung))) return 'out-of-bounds';
  const others = [...floorLayout(floor).filter(row => target.kind !== 'session' || row.item !== target.item), ...floorFurnitureLayout(floor, EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS).filter(row => target.kind !== 'furniture' || row.item !== target.item)];
  return overlapsFixedFurniture(position, footprint, others) ? 'overlaps' : null;
}
export function placeFloorItem(floor: FloorState, owned: readonly SessionEquipmentItem[], item: SessionEquipmentItem, position: FloorPosition): FloorPlaceResult {
  requireFloorState(floor, owned);
  const reason = !owned.includes(item) ? 'not-owned' : placementRefusal(floor, { kind: 'session', item }, position);
  return reason !== null ? Object.freeze({ kind: 'refused', state: floor, item, position, reason }) : Object.freeze({ kind: 'placed', state: withItemEdit(floor, { kind: 'session', item }, position), item, position: orientedFloorPosition(position) });
}
export function placeFloorFurniture(floor: FloorState, owned: readonly LadderEquipmentItem[], item: LadderEquipmentItem, position: FloorPosition): FloorFurniturePlaceResult {
  requireFloorState(floor, placedFloorItems(floor), owned);
  const reason = !owned.includes(item) ? 'not-owned' : placementRefusal(floor, { kind: 'furniture', item }, position);
  return reason !== null ? Object.freeze({ kind: 'refused', state: floor, item, position, reason }) : Object.freeze({ kind: 'placed', state: withItemEdit(floor, { kind: 'furniture', item }, position), item, position: orientedFloorPosition(position) });
}
export function removeFloorFurniture(floor: FloorState, item: LadderEquipmentItem): FloorState { return withItemEdit(floor, { kind: 'furniture', item }, null); }
export function removeFloorItem(floor: FloorState, item: SessionEquipmentItem): FloorState { return withItemEdit(floor, { kind: 'session', item }, null); }
export type FloorEditRefusal = FloorPlacementRefusal | 'layout-conflict' | 'nothing-to-undo';
export type FloorEditResult = { readonly kind: 'edited'; readonly state: FloorState } | { readonly kind: 'refused'; readonly state: FloorState; readonly reason: FloorEditRefusal };
export function editFloorLayout(floor: FloorState, sessionOwned: readonly SessionEquipmentItem[], furnitureOwned: readonly LadderEquipmentItem[], target: FloorEditTarget, placement: FloorPosition | null, expectedLayoutRevision: number): FloorEditResult {
  requireFloorState(floor, sessionOwned, furnitureOwned);
  if (!Number.isSafeInteger(expectedLayoutRevision) || expectedLayoutRevision !== floor.layoutRevision) return Object.freeze({ kind: 'refused', state: floor, reason: 'layout-conflict' });
  const owned = target.kind === 'session' ? sessionOwned.includes(target.item) : furnitureOwned.includes(target.item);
  if (!owned) return Object.freeze({ kind: 'refused', state: floor, reason: 'not-owned' });
  if (placement === null) return Object.freeze({ kind: 'edited', state: withItemEdit(floor, target, null) });
  const result = target.kind === 'session' ? placeFloorItem(floor, sessionOwned, target.item, placement) : placeFloorFurniture(floor, furnitureOwned, target.item, placement);
  return result.kind === 'refused' ? result : Object.freeze({ kind: 'edited', state: result.state });
}
export function undoFloorLayout(floor: FloorState, sessionOwned: readonly SessionEquipmentItem[], furnitureOwned: readonly LadderEquipmentItem[], expectedLayoutRevision: number): FloorEditResult {
  if (!Number.isSafeInteger(expectedLayoutRevision) || expectedLayoutRevision !== floor.layoutRevision) return Object.freeze({ kind: 'refused', state: floor, reason: 'layout-conflict' });
  const edit = floor.lastLayoutEdit;
  if (edit === null) return Object.freeze({ kind: 'refused', state: floor, reason: 'nothing-to-undo' });
  if (edit.appliedRevision !== expectedLayoutRevision || !sameFloorPosition(floorTargetPosition(floor, edit.target), edit.current)) return Object.freeze({ kind: 'refused', state: floor, reason: 'layout-conflict' });
  const result = editFloorLayout(floor, sessionOwned, furnitureOwned, edit.target, edit.previous, expectedLayoutRevision);
  return result.kind === 'refused' ? result : Object.freeze({ kind: 'edited', state: Object.freeze({ ...result.state, lastLayoutEdit: null }) });
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
