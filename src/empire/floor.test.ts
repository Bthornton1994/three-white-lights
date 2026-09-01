/**
 * floor.test.ts — GDD §5.13 presentation Phase 1: the floor grid and
 * placement mechanics.
 *
 * Five groups, in the house shape this directory already uses: tuning
 * shape (both new tables keyed exactly, every footprint fits its item's own
 * minimum rung), state transitions (create/relocate/place/move/remove, each
 * arm driven directly against the same computation it claims), the ownership
 * guarantee (a floor never diverges from `owned` — driven with a
 * deliberately stale floor rather than trusted), the read model
 * (placed/unplaced/layout, exhaustive over every §5.4 stage-2 item), and
 * PLAYTEST 2's fixed Barbell furniture (keyed exactly, non-overlapping, fits
 * every rung's grid, and reads real ownership rather than assuming it).
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { type LadderEquipmentItem, type LadderRung } from './ladder';
import { equipmentBiasedMemberTypes } from './members';
import { type SessionEquipmentItem } from './sessions';
import {
  type FloorState,
  type GridPosition,
  ambientMemberRoster,
  createFloorState,
  fixedFloorFurniture,
  floorGridSize,
  floorFurnitureLayout,
  floorLayout,
  overlapsFixedFurniture,
  placeFloorFurniture,
  placeFloorItem,
  placedFloorItems,
  placedFurnitureItems,
  placedOwnedItems,
  relocateFloorState,
  removeFloorFurniture,
  removeFloorItem,
  requireFloorState,
  sessionItemFootprint,
  unplacedOwnedFloorItems,
} from './floor';

const T = EMPIRE_TUNING;

/** A 3x3-safe cell on a garage that already holds the opening Barbell layout. */
const OPEN_MATS: GridPosition = Object.freeze({ x: 5, y: 3 });

// ---------------------------------------------------------------------------
// Tuning shape
// ---------------------------------------------------------------------------

describe('the two floor tables are keyed exactly, and every footprint fits its item', () => {
  it('FLOOR_GRID_SIZE is keyed by exactly LADDER_RUNGS, both directions', () => {
    const keys = Object.keys(T.FLOOR_GRID_SIZE).sort();
    expect(keys).toEqual([...T.LADDER_RUNGS].sort());
    for (const rung of T.LADDER_RUNGS) {
      const size = floorGridSize(rung);
      expect(size.width, rung).toBeGreaterThan(0);
      expect(size.height, rung).toBeGreaterThan(0);
      expect(Number.isInteger(size.width), rung).toBe(true);
      expect(Number.isInteger(size.height), rung).toBe(true);
    }
  });

  it('SESSION_EQUIPMENT_FOOTPRINT is keyed by exactly SESSION_EQUIPMENT_ITEMS, both directions', () => {
    const keys = Object.keys(T.SESSION_EQUIPMENT_FOOTPRINT).sort();
    expect(keys).toEqual([...T.SESSION_EQUIPMENT_ITEMS].sort());
    for (const item of T.SESSION_EQUIPMENT_ITEMS) {
      const footprint = sessionItemFootprint(item);
      expect(footprint.width, item).toBeGreaterThan(0);
      expect(footprint.height, item).toBeGreaterThan(0);
      expect(Number.isInteger(footprint.width), item).toBe(true);
      expect(Number.isInteger(footprint.height), item).toBe(true);
    }
  });

  it("every item's footprint fits inside the grid of its OWN SESSION_EQUIPMENT_MIN_RUNG — the claim floor.ts's own header defers to this test rather than trusting the prose", () => {
    const misfits: string[] = [];
    for (const item of T.SESSION_EQUIPMENT_ITEMS) {
      const minRung = T.SESSION_EQUIPMENT_MIN_RUNG[item];
      const grid = floorGridSize(minRung);
      const footprint = sessionItemFootprint(item);
      if (footprint.width > grid.width || footprint.height > grid.height) {
        misfits.push(`${item} (${footprint.width}x${footprint.height}) at ${minRung} (${grid.width}x${grid.height})`);
      }
    }
    expect(misfits).toEqual([]);
    // Non-vacuity: the domain really is every stage-2 item, not an empty loop.
    expect(T.SESSION_EQUIPMENT_ITEMS.length).toBe(14);
  });

  it('every rung can simultaneously hold every item ownable by that rung, with room to spare — a sanity check on the proposal, not a game rule', () => {
    // Cumulative: an item bought at a lower rung stays owned after relocating
    // up (sessions.ts has no sell), so the floor at rung R must have room for
    // every item whose min rung is at or below R, not just R's own items.
    const rungIndex = new Map(T.LADDER_RUNGS.map((rung, index) => [rung, index]));
    for (const rung of T.LADDER_RUNGS) {
      const grid = floorGridSize(rung);
      const gridArea = grid.width * grid.height;
      let usedArea = 0;
      for (const item of T.SESSION_EQUIPMENT_ITEMS) {
        const minRungIndex = rungIndex.get(T.SESSION_EQUIPMENT_MIN_RUNG[item]) as number;
        if (minRungIndex > (rungIndex.get(rung) as number)) continue;
        const footprint = sessionItemFootprint(item);
        usedArea += footprint.width * footprint.height;
      }
      expect(usedArea, rung).toBeLessThan(gridArea);
    }
  });
});

// ---------------------------------------------------------------------------
// State: create, relocate
// ---------------------------------------------------------------------------

describe('createFloorState / relocateFloorState', () => {
  it('opens empty, at the given rung', () => {
    const floor = createFloorState('garage');
    expect(floor.rung).toBe('garage');
    expect(Object.keys(floor.placements)).toEqual([]);
    expect(Object.keys(floor.furniture).sort()).toEqual([...T.LADDER_STARTING_EQUIPMENT].sort());
  });

  it('relocating always returns a fresh empty floor at the destination — GDD §5.1, "you leave the old place behind"', () => {
    const garage = createFloorState('garage');
    const placed = placeFloorItem(garage, ['mats'], 'mats', OPEN_MATS);
    expect(placed.kind).toBe('placed');
    const relocated = relocateFloorState('storage-unit');
    expect(relocated.rung).toBe('storage-unit');
    expect(Object.keys(relocated.placements)).toEqual([]);
    // Independent of whatever the previous floor held — relocating never
    // reads the old floor at all, so a rich prior layout changes nothing.
    expect(relocated).toEqual(createFloorState('storage-unit'));
  });
});

// ---------------------------------------------------------------------------
// placeFloorItem: place, move, and every refusal
// ---------------------------------------------------------------------------

describe('placeFloorItem', () => {
  it('places an owned item at a legal position', () => {
    const floor = createFloorState('garage');
    const result = placeFloorItem(floor, ['mats'], 'mats', OPEN_MATS);
    expect(result.kind).toBe('placed');
    if (result.kind !== 'placed') throw new Error('unreachable');
    expect(result.state.placements['mats']).toEqual(OPEN_MATS);
    // The input floor is untouched — every transition in this directory
    // returns a new object rather than mutating.
    expect(Object.keys(floor.placements)).toEqual([]);
  });

  it('refuses an item that is not owned, leaving state unchanged', () => {
    const floor = createFloorState('garage');
    const result = placeFloorItem(floor, [], 'mats', { x: 0, y: 0 });
    expect(result.kind).toBe('refused');
    if (result.kind !== 'refused') throw new Error('unreachable');
    expect(result.reason).toBe('not-owned');
    expect(result.state).toBe(floor);
  });

  it('refuses a position that runs off the grid, on every edge', () => {
    const floor = createFloorState('garage');
    const grid = floorGridSize('garage');
    const footprint = sessionItemFootprint('wrist-wraps'); // 1x1, so the edges are exact
    const offRight = placeFloorItem(floor, ['wrist-wraps'], 'wrist-wraps', {
      x: grid.width,
      y: 0,
    });
    const offBottom = placeFloorItem(floor, ['wrist-wraps'], 'wrist-wraps', {
      x: 0,
      y: grid.height,
    });
    const negativeX = placeFloorItem(floor, ['wrist-wraps'], 'wrist-wraps', { x: -1, y: 0 });
    const negativeY = placeFloorItem(floor, ['wrist-wraps'], 'wrist-wraps', { x: 0, y: -1 });
    for (const outcome of [offRight, offBottom, negativeX, negativeY]) {
      expect(outcome.kind).toBe('refused');
      if (outcome.kind === 'refused') expect(outcome.reason).toBe('out-of-bounds');
    }
    // The discriminating half: the exact opposite corner, at the exact legal
    // extreme, is accepted — so the refusals above are a reading of the edge
    // and not a function that refuses everything.
    const legal = placeFloorItem(floor, ['wrist-wraps'], 'wrist-wraps', {
      x: grid.width - footprint.width,
      y: grid.height - footprint.height,
    });
    expect(legal.kind).toBe('placed');
  });

  it('refuses a larger footprint that would overhang the grid even from a legal top-left corner', () => {
    // mats is 3x3; a garage is 8x6. Placed at (6, 0) it overhangs the right edge.
    const floor = createFloorState('garage');
    const result = placeFloorItem(floor, ['mats'], 'mats', { x: 6, y: 0 });
    expect(result.kind).toBe('refused');
    if (result.kind === 'refused') expect(result.reason).toBe('out-of-bounds');
  });

  it('refuses a position overlapping another placed item, and accepts one that merely touches', () => {
    const floor = createFloorState('garage');
    const withMats = placeFloorItem(floor, ['mats', 'wrist-wraps'], 'mats', OPEN_MATS);
    expect(withMats.kind).toBe('placed');
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    // mats occupies (5,3)-(8,6). wrist-wraps (1x1) at (6,4) overlaps it.
    const overlapping = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 6, y: 4 },
    );
    expect(overlapping.kind).toBe('refused');
    if (overlapping.kind === 'refused') expect(overlapping.reason).toBe('overlaps');
    // Touching, not overlapping: wrist-wraps at (5,2) shares an edge with
    // mats but no area — legal, the discriminating half of the check above.
    const touching = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 5, y: 2 },
    );
    expect(touching.kind).toBe('placed');
  });

  it('placing an already-placed item MOVES it, excluding its own prior footprint from the overlap check — the one function serves place and move', () => {
    const floor = createFloorState('garage');
    const first = placeFloorItem(floor, ['mats'], 'mats', OPEN_MATS);
    expect(first.kind).toBe('placed');
    if (first.kind !== 'placed') throw new Error('unreachable');
    // Move mats to overlap its OWN old position — must succeed, because the
    // old footprint is excluded from the collision check for this exact item.
    const moved = placeFloorItem(first.state, ['mats'], 'mats', { x: 5, y: 2 });
    expect(moved.kind).toBe('placed');
    if (moved.kind !== 'placed') throw new Error('unreachable');
    expect(moved.state.placements['mats']).toEqual({ x: 5, y: 2 });
    // Still exactly one placement — moving never leaves a stale second entry.
    expect(Object.keys(moved.state.placements)).toEqual(['mats']);
  });

  it('a refused placement returns the SAME floor object, unchanged, in every refusal arm — never a half-applied state', () => {
    // Reference equality (`toBe`), not structural equality: this is the
    // mutation witness for "refusal never mutates" — replacing any refusal
    // arm's `state: floor` with `state: { ...floor }` (a fresh, distinct
    // object with equal contents) reddens this assertion specifically, while
    // every other assertion in this file stays green because they all read
    // `.placements` rather than object identity.
    const floor = createFloorState('garage');
    const notOwned = placeFloorItem(floor, [], 'mats', { x: 0, y: 0 });
    expect(notOwned.state).toBe(floor);
    const outOfBounds = placeFloorItem(floor, ['mats'], 'mats', { x: 99, y: 99 });
    expect(outOfBounds.state).toBe(floor);
    const withMats = placeFloorItem(floor, ['mats', 'wrist-wraps'], 'mats', OPEN_MATS);
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    const overlapping = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 6, y: 4 },
    );
    expect(overlapping.state).toBe(withMats.state);
  });
});

// ---------------------------------------------------------------------------
// removeFloorItem
// ---------------------------------------------------------------------------

describe('removeFloorItem', () => {
  it('removes a placed item', () => {
    const floor = createFloorState('garage');
    const placed = placeFloorItem(floor, ['mats'], 'mats', OPEN_MATS);
    if (placed.kind !== 'placed') throw new Error('unreachable');
    const removed = removeFloorItem(placed.state, 'mats');
    expect(Object.keys(removed.placements)).toEqual([]);
  });

  it('always succeeds, including as a no-op on an item that was never placed — removing is never a decision the game refuses', () => {
    const floor = createFloorState('garage');
    const removed = removeFloorItem(floor, 'mats');
    expect(removed).toEqual(floor);
  });

  it('removing one item leaves every other placement untouched', () => {
    const floor = createFloorState('garage');
    const withMats = placeFloorItem(floor, ['mats', 'wrist-wraps'], 'mats', OPEN_MATS);
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    const withBoth = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 0, y: 5 },
    );
    if (withBoth.kind !== 'placed') throw new Error('unreachable');
    const removed = removeFloorItem(withBoth.state, 'mats');
    expect(Object.keys(removed.placements)).toEqual(['wrist-wraps']);
    expect(removed.placements['wrist-wraps']).toEqual({ x: 0, y: 5 });
  });
});

// ---------------------------------------------------------------------------
// requireFloorState — the ownership guarantee, driven with a stale floor
// ---------------------------------------------------------------------------

describe('requireFloorState refuses a floor that disagrees with owned, or with its own grid', () => {
  it('refuses a placement for an item owned is silent about', () => {
    const stale: FloorState = Object.freeze({
      rung: 'garage',
      placements: Object.freeze({ mats: { x: 0, y: 0 } }),
      furniture: Object.freeze({}),
    });
    expect(() => requireFloorState(stale, [])).toThrow(/not owned/);
  });

  it('accepts a floor whose every placement IS owned', () => {
    const floor: FloorState = Object.freeze({
      rung: 'garage',
      placements: Object.freeze({ mats: { x: 5, y: 3 } }),
      furniture: Object.freeze({}),
    });
    expect(() => requireFloorState(floor, ['mats'])).not.toThrow();
  });

  it("refuses a recorded position that no longer fits its rung's grid — a stale relocation, not just a stale ownership list", () => {
    // mats (3x3) at (0,0) fits a garage (8x6). Relabel the SAME floor as if
    // it belonged to a rung whose grid is too small — a shape no reducer
    // arm in this directory produces, and exactly what this refusal exists
    // to catch if one ever did.
    const stale: FloorState = Object.freeze({
      rung: 'garage',
      placements: Object.freeze({ sled: { x: 0, y: 0 } }), // sled is 3x12, never fits a garage
      furniture: Object.freeze({}),
    });
    expect(() => requireFloorState(stale, ['sled'])).toThrow(/does not fit/);
  });

  it('refuses two placements that overlap, even if each is individually owned and in-bounds', () => {
    const stale: FloorState = Object.freeze({
      rung: 'garage',
      placements: Object.freeze({
        mats: { x: 0, y: 0 },
        'wrist-wraps': { x: 1, y: 1 }, // inside mats' 3x3 footprint
      }),
      furniture: Object.freeze({}),
    });
    expect(() => requireFloorState(stale, ['mats', 'wrist-wraps'])).toThrow(/overlapping/);
  });

  /**
   * `placeFloorItem` and every other function that takes `owned` calls
   * `requireFloorState` first — so a stale floor is refused the moment ANY
   * of those functions is called with it, not just when read directly. The
   * bounded claim floor.ts's header states: this catches drift at the next
   * call, not at rest — a `FloorState` built and never passed to one of
   * these functions could still disagree with `owned` with nothing running
   * to notice, which is why the header names this as the limit rather than
   * claiming the type prevents it.
   */
  it('a stale floor is refused by placeFloorItem too, not only by calling requireFloorState directly', () => {
    const stale: FloorState = Object.freeze({
      rung: 'garage',
      placements: Object.freeze({ mats: { x: 0, y: 0 } }),
      furniture: Object.freeze({}),
    });
    expect(() => placeFloorItem(stale, [], 'wrist-wraps', { x: 5, y: 5 })).toThrow(/not owned/);
  });
});

// ---------------------------------------------------------------------------
// The read model: placed / unplaced / layout
// ---------------------------------------------------------------------------

describe('the read model composes placements with ownership, never storing ownership itself', () => {
  it('placedFloorItems / unplacedOwnedFloorItems partition owned into placed and not, in SESSION_EQUIPMENT_ITEMS order', () => {
    const floor = createFloorState('warehouse');
    const owned: readonly SessionEquipmentItem[] = ['sled', 'bike', 'mats'];
    const withBike = placeFloorItem(floor, owned, 'bike', { x: 6, y: 4 });
    if (withBike.kind !== 'placed') throw new Error('unreachable');

    expect(placedFloorItems(withBike.state)).toEqual(['bike']);
    expect(unplacedOwnedFloorItems(withBike.state, owned)).toEqual(['sled', 'mats']);
    // The two partitions are exhaustive and disjoint over `owned` — every
    // owned item is in exactly one of them.
    const union = [...placedFloorItems(withBike.state), ...unplacedOwnedFloorItems(withBike.state, owned)];
    expect(union.length).toBe(owned.length);
    expect(new Set(union)).toEqual(new Set(owned));
  });

  it('unplacedOwnedFloorItems never lists an item the floor is not aware is owned, and never lists a placed item', () => {
    const floor = createFloorState('garage');
    // Not owned at all — never appears, whatever the floor holds.
    expect(unplacedOwnedFloorItems(floor, [])).toEqual([]);
  });

  it('floorLayout returns exactly the placed items, each with its position and its real footprint', () => {
    const floor = createFloorState('storage-unit');
    const owned: readonly SessionEquipmentItem[] = ['bike', 'dumbbells'];
    const withBike = placeFloorItem(floor, owned, 'bike', { x: 6, y: 4 });
    if (withBike.kind !== 'placed') throw new Error('unreachable');
    const withBoth = placeFloorItem(withBike.state, owned, 'dumbbells', { x: 6, y: 0 });
    if (withBoth.kind !== 'placed') throw new Error('unreachable');

    const layout = floorLayout(withBoth.state);
    expect(layout.map((row) => row.item)).toEqual(['bike', 'dumbbells']);
    for (const row of layout) {
      expect(row.footprint).toEqual(sessionItemFootprint(row.item));
      expect(row.position).toEqual(withBoth.state.placements[row.item]);
    }
  });

  it('floorLayout on an empty floor is empty, not a crash — the non-vacuity control for the two tests above', () => {
    expect(floorLayout(createFloorState('garage'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A full played sequence — place every owned item at the strip-mall rung,
// move one, remove one, relocate, and confirm the floor resets
// ---------------------------------------------------------------------------

describe('a played sequence', () => {
  it('places several items without collision, moves one, removes one, then relocating clears the floor', () => {
    let floor = createFloorState('strip-mall-unit');
    const owned: readonly SessionEquipmentItem[] = ['treadmill', 'cables', 'sauna', 'sleeves'];
    const positions: Record<string, GridPosition> = {
      treadmill: { x: 6, y: 0 },
      cables: { x: 10, y: 0 },
      sauna: { x: 8, y: 6 },
      sleeves: { x: 0, y: 6 },
    };
    for (const item of owned) {
      const result = placeFloorItem(floor, owned, item, positions[item] as GridPosition);
      expect(result.kind, item).toBe('placed');
      if (result.kind === 'placed') floor = result.state;
    }
    expect(placedFloorItems(floor)).toEqual(['treadmill', 'cables', 'sauna', 'sleeves']);

    // Move sleeves elsewhere — still legal, still exactly four placements.
    const moved = placeFloorItem(floor, owned, 'sleeves', { x: 12, y: 6 });
    expect(moved.kind).toBe('placed');
    if (moved.kind === 'placed') floor = moved.state;
    expect(placedFloorItems(floor)).toEqual(['treadmill', 'cables', 'sauna', 'sleeves']);
    expect(floor.placements['sleeves']).toEqual({ x: 12, y: 6 });

    // Remove cables — three left.
    floor = removeFloorItem(floor, 'cables');
    expect(placedFloorItems(floor)).toEqual(['treadmill', 'sauna', 'sleeves']);
    expect(unplacedOwnedFloorItems(floor, owned)).toEqual(['cables']);

    // Relocate — a new room, everything unplaced, ownership untouched by
    // this module (this test only demonstrates the floor side of that).
    const relocated = relocateFloorState('warehouse' as LadderRung);
    expect(placedFloorItems(relocated)).toEqual([]);
    expect(unplacedOwnedFloorItems(relocated, owned)).toEqual([...owned].sort(
      (left, right) => T.SESSION_EQUIPMENT_ITEMS.indexOf(left) - T.SESSION_EQUIPMENT_ITEMS.indexOf(right),
    ));
  });
});

// ---------------------------------------------------------------------------
// Fixed furniture — GDD §5.13's PLAYTEST 2 ruling, gap 1: the Barbell-group
// starting baseline drawn as fixed, non-draggable floor furniture.
// ---------------------------------------------------------------------------

describe('FLOOR_FIXED_FURNITURE_LAYOUT is keyed exactly, non-overlapping, and fits every rung', () => {
  it('is keyed by exactly LADDER_STARTING_EQUIPMENT, both directions', () => {
    const keys = Object.keys(T.FLOOR_FIXED_FURNITURE_LAYOUT).sort();
    expect(keys).toEqual([...T.LADDER_STARTING_EQUIPMENT].sort());
  });

  it('every entry is a positive whole-tile footprint at a non-negative whole-tile position', () => {
    for (const item of T.LADDER_STARTING_EQUIPMENT) {
      const layout = T.FLOOR_FIXED_FURNITURE_LAYOUT[item];
      expect(layout, item).toBeDefined();
      if (layout === undefined) continue;
      expect(layout.footprint.width, item).toBeGreaterThan(0);
      expect(layout.footprint.height, item).toBeGreaterThan(0);
      expect(Number.isInteger(layout.footprint.width), item).toBe(true);
      expect(Number.isInteger(layout.footprint.height), item).toBe(true);
      expect(layout.position.x, item).toBeGreaterThanOrEqual(0);
      expect(layout.position.y, item).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(layout.position.x), item).toBe(true);
      expect(Number.isInteger(layout.position.y), item).toBe(true);
    }
  });

  it('no two fixed-furniture items overlap each other', () => {
    const rows = T.LADDER_STARTING_EQUIPMENT.map((item) => {
      const layout = T.FLOOR_FIXED_FURNITURE_LAYOUT[item] as {
        position: GridPosition;
        footprint: { width: number; height: number };
      };
      return { item, ...layout };
    });
    let compared = 0;
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i] as (typeof rows)[number];
        const b = rows[j] as (typeof rows)[number];
        const overlaps =
          a.position.x < b.position.x + b.footprint.width &&
          b.position.x < a.position.x + a.footprint.width &&
          a.position.y < b.position.y + b.footprint.height &&
          b.position.y < a.position.y + a.footprint.height;
        expect(overlaps, `${a.item} and ${b.item}`).toBe(false);
        compared += 1;
      }
    }
    // Non-vacuity: the pairwise loop really compared something, over all three.
    expect(rows.length).toBe(3);
    expect(compared).toBe(3);
  });

  it("fits inside EVERY rung's grid, not only the garage the layout was hand-sized for — the containment claim fixedFloorFurniture's own header makes, driven rather than trusted", () => {
    let checked = 0;
    for (const rung of T.LADDER_RUNGS) {
      const grid = floorGridSize(rung);
      for (const item of T.LADDER_STARTING_EQUIPMENT) {
        const layout = T.FLOOR_FIXED_FURNITURE_LAYOUT[item] as {
          position: GridPosition;
          footprint: { width: number; height: number };
        };
        expect(layout.position.x + layout.footprint.width, `${item} at ${rung}`).toBeLessThanOrEqual(
          grid.width,
        );
        expect(layout.position.y + layout.footprint.height, `${item} at ${rung}`).toBeLessThanOrEqual(
          grid.height,
        );
        checked += 1;
      }
    }
    // Non-vacuity: every rung, every fixed item, really examined — 4 rungs x 3 items.
    expect(T.LADDER_RUNGS.length).toBe(4);
    expect(checked).toBe(12);
  });
});

describe('fixedFloorFurniture reads real ownership and invents nothing for squat-rack', () => {
  it('owning every LADDER_STARTING_EQUIPMENT item returns all three, in LADDER_STARTING_EQUIPMENT order, matching the registered layout exactly', () => {
    const rows = fixedFloorFurniture([...T.LADDER_STARTING_EQUIPMENT]);
    expect(rows.map((row) => row.item)).toEqual([...T.LADDER_STARTING_EQUIPMENT]);
    for (const row of rows) {
      const layout = (
        T.FLOOR_FIXED_FURNITURE_LAYOUT as Readonly<
          Record<LadderEquipmentItem, { position: GridPosition; footprint: { width: number; height: number } }>
        >
      )[row.item];
      expect(row.position).toEqual(layout.position);
      expect(row.footprint).toEqual(layout.footprint);
    }
  });

  it('a partial ownership list draws exactly what is owned, nothing invented for the rest', () => {
    const rows = fixedFloorFurniture(['flat-bench']);
    expect(rows.map((row) => row.item)).toEqual(['flat-bench']);
  });

  it('owning nothing on the ladder draws nothing — this function never assumes the starting kit is present', () => {
    expect(fixedFloorFurniture([])).toEqual([]);
  });

  it('owning squat-rack alone draws nothing — squat-rack is a real, refusable purchase with no fixed floor spot, not part of the always-present baseline', () => {
    expect(fixedFloorFurniture(['squat-rack'])).toEqual([]);
  });

  it('owning every LADDER_EQUIPMENT_ITEMS entry — the starting three plus a purchased squat-rack — still draws only the three starting items', () => {
    const rows = fixedFloorFurniture([...T.LADDER_EQUIPMENT_ITEMS]);
    expect(rows.map((row) => row.item)).toEqual([...T.LADDER_STARTING_EQUIPMENT]);
  });

  it('never draws a row for a SessionEquipmentItem — the two vocabularies are disjoint, so a fixed-furniture row can never be confused with a real FloorPlacement', () => {
    const rows = fixedFloorFurniture([...T.LADDER_STARTING_EQUIPMENT]);
    for (const row of rows) {
      expect(T.SESSION_EQUIPMENT_ITEMS).not.toContain(row.item);
    }
    // Non-vacuity: there really are rows to check this on.
    expect(rows.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// overlapsFixedFurniture — GDD §5.13's PLAYTEST 3 ruling on the furniture/
// session-item overlap gap
// ---------------------------------------------------------------------------

describe('overlapsFixedFurniture refuses a drop that shares a cell with fixed furniture, and only that', () => {
  // Driven against the REAL registered layout via fixedFloorFurniture — not
  // a hand-typed duplicate of FLOOR_FIXED_FURNITURE_LAYOUT — so a future
  // rearrangement of that table cannot silently disagree with this file.
  // power-bar (0,0)-(1,3), comp-plates (1,0)-(3,2), flat-bench (3,0)-(5,4).
  const fixed = fixedFloorFurniture([...T.LADDER_STARTING_EQUIPMENT]);
  const matsFootprint = sessionItemFootprint('mats'); // 3x3
  const wristWrapsFootprint = sessionItemFootprint('wrist-wraps'); // 1x1

  it('refuses a footprint sharing a cell with power-bar (and, at this size, comp-plates too — both are real overlaps)', () => {
    expect(overlapsFixedFurniture({ x: 0, y: 0 }, matsFootprint, fixed)).toBe(true);
  });

  it('refuses a footprint sharing a cell with comp-plates ALONE — not only the first row in the table', () => {
    // (1,0)-(2,1), 1x1: inside comp-plates ((1,0)-(3,2)), touches power-bar's
    // right edge (x=1) without crossing it, and is nowhere near flat-bench.
    // A predicate that only checked fixed[0] would wrongly clear this.
    expect(overlapsFixedFurniture({ x: 1, y: 0 }, wristWrapsFootprint, fixed)).toBe(true);
  });

  it('refuses a footprint sharing a cell with flat-bench ALONE — the last row, not only the first or second', () => {
    // (4,1)-(5,2), 1x1: inside flat-bench ((3,0)-(5,4)), clear of power-bar
    // (x=0-1) and comp-plates (x=1-3).
    expect(overlapsFixedFurniture({ x: 4, y: 1 }, wristWrapsFootprint, fixed)).toBe(true);
  });

  it('accepts a footprint that merely touches flat-bench — an edge, not an area, shared', () => {
    // mats at (5,0)-(8,3): flat-bench's right edge is x=5, mats' left edge is
    // x=5 — the same touching-not-overlapping boundary placeFloorItem's own
    // check already draws between two session items.
    expect(overlapsFixedFurniture({ x: 5, y: 0 }, matsFootprint, fixed)).toBe(false);
  });

  it('accepts a footprint entirely clear of every fixed row', () => {
    expect(overlapsFixedFurniture({ x: 0, y: 3 }, matsFootprint, fixed)).toBe(false);
  });

  it('is vacuously false against an empty fixed list — never refuses a floor with no fixed furniture drawn', () => {
    expect(overlapsFixedFurniture({ x: 0, y: 0 }, matsFootprint, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ambient members — GDD §5.13 presentation Phase 2
// ---------------------------------------------------------------------------

describe('the three ambient-member tables are well-shaped', () => {
  it('AMBIENT_MEMBER_COUNT_BY_RUNG is keyed by exactly LADDER_RUNGS, both directions, and is strictly increasing', () => {
    const keys = Object.keys(T.AMBIENT_MEMBER_COUNT_BY_RUNG).sort();
    expect(keys).toEqual([...T.LADDER_RUNGS].sort());
    const counts = T.LADDER_RUNGS.map((rung) => T.AMBIENT_MEMBER_COUNT_BY_RUNG[rung]);
    for (const count of counts) {
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThan(0);
    }
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i], `index ${i}`).toBeGreaterThan(counts[i - 1] as number);
    }
    // Non-vacuity: the ladder really has more than one rung to compare.
    expect(T.LADDER_RUNGS.length).toBe(4);
  });

  it('AMBIENT_MEMBER_FOOTPRINT_TILES is a positive whole-tile size', () => {
    expect(Number.isInteger(T.AMBIENT_MEMBER_FOOTPRINT_TILES.width)).toBe(true);
    expect(Number.isInteger(T.AMBIENT_MEMBER_FOOTPRINT_TILES.height)).toBe(true);
    expect(T.AMBIENT_MEMBER_FOOTPRINT_TILES.width).toBeGreaterThan(0);
    expect(T.AMBIENT_MEMBER_FOOTPRINT_TILES.height).toBeGreaterThan(0);
  });

  it('AMBIENT_MEMBER_PLACEMENT_STRIDE is a whole number of at least 1', () => {
    expect(Number.isInteger(T.AMBIENT_MEMBER_PLACEMENT_STRIDE)).toBe(true);
    expect(T.AMBIENT_MEMBER_PLACEMENT_STRIDE).toBeGreaterThanOrEqual(1);
  });

  it('every rung has enough candidate cells, outside fixed furniture, for its own registered count — the claim ambientMemberRoster would otherwise refuse at runtime, driven rather than trusted', () => {
    const fixed = fixedFloorFurniture([...T.LADDER_STARTING_EQUIPMENT]);
    const footprint = T.AMBIENT_MEMBER_FOOTPRINT_TILES;
    let checked = 0;
    for (const rung of T.LADDER_RUNGS) {
      const grid = floorGridSize(rung);
      let free = 0;
      for (let y = 0; y + footprint.height <= grid.height; y += 1) {
        for (let x = 0; x + footprint.width <= grid.width; x += 1) {
          if (!overlapsFixedFurniture({ x, y }, footprint, fixed)) free += 1;
        }
      }
      expect(free, rung).toBeGreaterThanOrEqual(T.AMBIENT_MEMBER_COUNT_BY_RUNG[rung]);
      checked += 1;
    }
    expect(checked).toBe(4);
  });
});

describe('ambientMemberRoster', () => {
  const barbellOwned: readonly LadderEquipmentItem[] = [...T.LADDER_STARTING_EQUIPMENT];

  it('is deterministic: the same inputs, called twice, produce a byte-identical roster', () => {
    const first = ambientMemberRoster('storage-unit', barbellOwned, ['bike', 'mats']);
    const second = ambientMemberRoster('storage-unit', barbellOwned, ['bike', 'mats']);
    expect(second).toEqual(first);
  });

  it('returns exactly AMBIENT_MEMBER_COUNT_BY_RUNG members (keyed by rung), for every rung', () => {
    let checked = 0;
    for (const rung of T.LADDER_RUNGS) {
      const roster = ambientMemberRoster(rung, barbellOwned, []);
      expect(roster.length, rung).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG[rung]);
      checked += 1;
    }
    expect(checked).toBe(4);
  });

  it('a real comparison, not two independent pins: the warehouse roster is strictly larger than the garage roster', () => {
    const garage = ambientMemberRoster('garage', barbellOwned, []);
    const warehouse = ambientMemberRoster('warehouse', barbellOwned, []);
    expect(warehouse.length).toBeGreaterThan(garage.length);
  });

  it('every position fits entirely inside the rung’s own grid', () => {
    const footprint = T.AMBIENT_MEMBER_FOOTPRINT_TILES;
    let checked = 0;
    for (const rung of T.LADDER_RUNGS) {
      const grid = floorGridSize(rung);
      const roster = ambientMemberRoster(rung, barbellOwned, []);
      for (const member of roster) {
        expect(member.position.x, `${rung} member x`).toBeGreaterThanOrEqual(0);
        expect(member.position.y, `${rung} member y`).toBeGreaterThanOrEqual(0);
        expect(member.position.x + footprint.width, `${rung} member right edge`).toBeLessThanOrEqual(
          grid.width,
        );
        expect(member.position.y + footprint.height, `${rung} member bottom edge`).toBeLessThanOrEqual(
          grid.height,
        );
        checked += 1;
      }
    }
    // Non-vacuity: really walked every rung's real roster, not an empty one.
    expect(checked).toBe(
      T.LADDER_RUNGS.reduce((sum, rung) => sum + T.AMBIENT_MEMBER_COUNT_BY_RUNG[rung], 0),
    );
  });

  it('no member overlaps a fixed-furniture row, at any rung', () => {
    const fixed = fixedFloorFurniture(barbellOwned);
    const footprint = T.AMBIENT_MEMBER_FOOTPRINT_TILES;
    let checked = 0;
    for (const rung of T.LADDER_RUNGS) {
      const roster = ambientMemberRoster(rung, barbellOwned, []);
      for (const member of roster) {
        expect(
          overlapsFixedFurniture(member.position, footprint, fixed),
          `${rung} member at (${member.position.x}, ${member.position.y})`,
        ).toBe(false);
        checked += 1;
      }
    }
    expect(checked).toBe(
      T.LADDER_RUNGS.reduce((sum, rung) => sum + T.AMBIENT_MEMBER_COUNT_BY_RUNG[rung], 0),
    );
  });

  it('the type mix is exactly a round-robin cycle over the REAL equipmentBiasedMemberTypes(sessionOwned) — not just a count', () => {
    const sessionOwned: readonly SessionEquipmentItem[] = ['dumbbells', 'cables'];
    const biased = equipmentBiasedMemberTypes(sessionOwned);
    // Non-vacuity: equipmentBiasedMemberTypes really returned something to cycle over.
    expect(biased.length).toBeGreaterThan(0);
    const roster = ambientMemberRoster('strip-mall-unit', barbellOwned, sessionOwned);
    const expectedTypes = roster.map((_unused, index) => biased[index % biased.length]);
    expect(roster.map((member) => member.type)).toEqual(expectedTypes);
  });

  it('a different owned-equipment set changes the type mix — the bias is real, not a fixed default', () => {
    const rosterEmpty = ambientMemberRoster('garage', barbellOwned, []);
    // Every §5.4 item this type table lists an affinity for, so the fit score
    // (and therefore the bias) moves away from the always-true Barbell
    // baseline that dominates an empty owned list.
    const rosterEquipped = ambientMemberRoster('garage', barbellOwned, [...T.SESSION_EQUIPMENT_ITEMS]);
    expect(rosterEquipped.map((member) => member.type)).not.toEqual(
      rosterEmpty.map((member) => member.type),
    );
  });

  it('refuses a rung with no registered count, rather than silently drawing nothing', () => {
    expect(() =>
      ambientMemberRoster('nonexistent-rung' as LadderRung, barbellOwned, []),
    ).toThrow(/no registered ambient member count/);
  });
});

describe('Stage C.1b furniture is player-positionable layout state', () => {
  const kit = [...T.LADDER_STARTING_EQUIPMENT];

  it('createFloorState seeds the opening Barbell layout, and relocate reseeds it', () => {
    const floor = createFloorState('garage');
    expect(placedFurnitureItems(floor)).toEqual(kit);
    const layout = floorFurnitureLayout(floor, kit);
    expect(layout.map((row) => row.item)).toEqual(kit);
    const relocated = relocateFloorState('storage-unit');
    expect(relocated.rung).toBe('storage-unit');
    expect(placedFurnitureItems(relocated)).toEqual(kit);
  });

  it('moving a barbell piece updates only layout, and overlapping a session item is refused', () => {
    const floor = createFloorState('garage');
    const moved = placeFloorFurniture(floor, kit, 'power-bar', { x: 6, y: 0 });
    expect(moved.kind).toBe('placed');
    if (moved.kind !== 'placed') throw new Error('unreachable');
    expect(moved.state.furniture['power-bar']).toEqual({ x: 6, y: 0 });
    const withMats = placeFloorItem(moved.state, ['mats'], 'mats', OPEN_MATS);
    expect(withMats.kind).toBe('placed');
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    const ontoMats = placeFloorFurniture(withMats.state, kit, 'flat-bench', { x: 5, y: 2 });
    expect(ontoMats.kind).toBe('refused');
    if (ontoMats.kind === 'refused') expect(ontoMats.reason).toBe('overlaps');
  });

  it('removing furniture leaves ownership with the caller and puts the piece in the unplaced set', () => {
    const floor = createFloorState('garage');
    const removed = removeFloorFurniture(floor, 'flat-bench');
    expect(removed.furniture['flat-bench']).toBeUndefined();
    expect(placedFurnitureItems(removed)).toEqual(['power-bar', 'comp-plates']);
    const back = placeFloorFurniture(removed, kit, 'flat-bench', { x: 5, y: 0 });
    expect(back.kind).toBe('placed');
  });

  it('placedOwnedItems is owned ∩ placed, no mats special-case, never a second ownership list', () => {
    const opening = createFloorState('garage');
    expect(placedOwnedItems(opening, kit, [])).toEqual(kit);
    expect(placedOwnedItems(opening, kit, ['mats'])).toEqual(kit);
    const withMats = placeFloorItem(opening, ['mats'], 'mats', OPEN_MATS);
    expect(withMats.kind).toBe('placed');
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    expect(placedOwnedItems(withMats.state, kit, ['mats'])).toEqual([...kit, 'mats']);
    const benchOff = removeFloorFurniture(withMats.state, 'flat-bench');
    expect(placedOwnedItems(benchOff, kit, ['mats'])).toEqual(['power-bar', 'comp-plates', 'mats']);
    expect(placedOwnedItems(benchOff, kit, [])).toEqual(['power-bar', 'comp-plates']);
    expect(placedOwnedItems(opening, [], [])).toEqual([]);
  });

  it('placing a session item onto seeded furniture is refused as overlaps', () => {
    const floor = createFloorState('garage');
    const ontoBar = placeFloorItem(floor, ['mats'], 'mats', { x: 0, y: 0 });
    expect(ontoBar.kind).toBe('refused');
    if (ontoBar.kind === 'refused') expect(ontoBar.reason).toBe('overlaps');
  });
});
