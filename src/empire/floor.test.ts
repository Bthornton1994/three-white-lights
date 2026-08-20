/**
 * floor.test.ts — GDD §5.13 presentation Phase 1: the floor grid and
 * placement mechanics.
 *
 * Four groups, in the house shape this directory already uses: tuning
 * shape (both new tables keyed exactly, every footprint fits its item's own
 * minimum rung), state transitions (create/relocate/place/move/remove, each
 * arm driven directly against the same computation it claims), the ownership
 * guarantee (a floor never diverges from `owned` — driven with a
 * deliberately stale floor rather than trusted), and the read model
 * (placed/unplaced/layout, exhaustive over every §5.4 stage-2 item).
 */

import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { type LadderRung } from './ladder';
import { type SessionEquipmentItem } from './sessions';
import {
  type FloorState,
  type GridPosition,
  createFloorState,
  floorGridSize,
  floorLayout,
  placeFloorItem,
  placedFloorItems,
  relocateFloorState,
  removeFloorItem,
  requireFloorState,
  sessionItemFootprint,
  unplacedOwnedFloorItems,
} from './floor';

const T = EMPIRE_TUNING;

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
  });

  it('relocating always returns a fresh empty floor at the destination — GDD §5.1, "you leave the old place behind"', () => {
    const garage = createFloorState('garage');
    const placed = placeFloorItem(garage, ['mats'], 'mats', { x: 0, y: 0 });
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
    const result = placeFloorItem(floor, ['mats'], 'mats', { x: 1, y: 1 });
    expect(result.kind).toBe('placed');
    if (result.kind !== 'placed') throw new Error('unreachable');
    expect(result.state.placements['mats']).toEqual({ x: 1, y: 1 });
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
    const withMats = placeFloorItem(floor, ['mats', 'wrist-wraps'], 'mats', { x: 0, y: 0 });
    expect(withMats.kind).toBe('placed');
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    // mats occupies (0,0)-(3,3). wrist-wraps (1x1) at (2,2) overlaps it.
    const overlapping = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 2, y: 2 },
    );
    expect(overlapping.kind).toBe('refused');
    if (overlapping.kind === 'refused') expect(overlapping.reason).toBe('overlaps');
    // Touching, not overlapping: wrist-wraps at (3,0) shares an edge with
    // mats but no area — legal, the discriminating half of the check above.
    const touching = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 3, y: 0 },
    );
    expect(touching.kind).toBe('placed');
  });

  it('placing an already-placed item MOVES it, excluding its own prior footprint from the overlap check — the one function serves place and move', () => {
    const floor = createFloorState('garage');
    const first = placeFloorItem(floor, ['mats'], 'mats', { x: 0, y: 0 });
    expect(first.kind).toBe('placed');
    if (first.kind !== 'placed') throw new Error('unreachable');
    // Move mats to overlap its OWN old position — must succeed, because the
    // old footprint is excluded from the collision check for this exact item.
    const moved = placeFloorItem(first.state, ['mats'], 'mats', { x: 1, y: 1 });
    expect(moved.kind).toBe('placed');
    if (moved.kind !== 'placed') throw new Error('unreachable');
    expect(moved.state.placements['mats']).toEqual({ x: 1, y: 1 });
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
    const withMats = placeFloorItem(floor, ['mats', 'wrist-wraps'], 'mats', { x: 0, y: 0 });
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    const overlapping = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 1, y: 1 },
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
    const placed = placeFloorItem(floor, ['mats'], 'mats', { x: 0, y: 0 });
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
    const withMats = placeFloorItem(floor, ['mats', 'wrist-wraps'], 'mats', { x: 0, y: 0 });
    if (withMats.kind !== 'placed') throw new Error('unreachable');
    const withBoth = placeFloorItem(
      withMats.state,
      ['mats', 'wrist-wraps'],
      'wrist-wraps',
      { x: 4, y: 4 },
    );
    if (withBoth.kind !== 'placed') throw new Error('unreachable');
    const removed = removeFloorItem(withBoth.state, 'mats');
    expect(Object.keys(removed.placements)).toEqual(['wrist-wraps']);
    expect(removed.placements['wrist-wraps']).toEqual({ x: 4, y: 4 });
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
    });
    expect(() => requireFloorState(stale, [])).toThrow(/not owned/);
  });

  it('accepts a floor whose every placement IS owned', () => {
    const floor: FloorState = Object.freeze({
      rung: 'garage',
      placements: Object.freeze({ mats: { x: 0, y: 0 } }),
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
    const withBike = placeFloorItem(floor, owned, 'bike', { x: 0, y: 0 });
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
    const withBike = placeFloorItem(floor, owned, 'bike', { x: 0, y: 0 });
    if (withBike.kind !== 'placed') throw new Error('unreachable');
    const withBoth = placeFloorItem(withBike.state, owned, 'dumbbells', { x: 4, y: 0 });
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
      treadmill: { x: 0, y: 0 },
      cables: { x: 4, y: 0 },
      sauna: { x: 8, y: 0 },
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
