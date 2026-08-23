/**
 * floorSim.test.ts — GDD §5.13 presentation Phase 3's checks.
 *
 * THE ONE THAT MATTERS MOST IS THE ARM CENSUS. CLAUDE.md's "A Domain Says
 * Which Inputs You Offered, Not Which Branches Ran" is the rule this piece is
 * most likely to fail: a sweep that drives tens of thousands of member-ticks
 * and never once produces `interrupted` is a large honest number that says
 * nothing about the state this piece exists to add. So `FLOOR_SIM_MEMBER_STATES`
 * — the arms the type DECLARES — is joined set-equal in both directions against
 * the arms the sweep REACHED, with a per-arm entry count pinned exactly. A
 * fixture change that stops reaching one reddens here instead of quietly
 * shrinking coverage.
 *
 * The sweep's own parameters live in `FLOOR_SIM_SWEEP` below, in one place, for
 * the reason `src/game/streakSweep.ts` exists: a measurement whose inputs are
 * not written down is an anecdote.
 */

import { describe, expect, it } from 'vitest';
import {
  FLOOR_SIM_INTERRUPTIONS,
  FLOOR_SIM_MEMBER_STATES,
  createFloorSimState,
  floorSimStateCounts,
  floorStations,
  runFloorSim,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimInterruption,
  type FloorSimMember,
  type FloorSimMemberState,
  type FloorSimState,
  type FloorStation,
} from './floorSim';
import {
  ambientMemberRoster,
  createFloorState,
  fixedFloorFurniture,
  floorGridSize,
  floorLayout,
  placeFloorItem,
  sessionItemFootprint,
  type FloorState,
  type GridPosition,
  type GridSize,
} from './floor';
import { type LadderEquipmentItem, type LadderRung } from './ladder';
import { type MemberType } from './members';
import { type SessionEquipmentItem } from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

const T = EMPIRE_TUNING;
const KIT: readonly LadderEquipmentItem[] = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);

// ---------------------------------------------------------------------------
// The sweep's parameters, in one place
// ---------------------------------------------------------------------------

/** One placed item: what, and where its top-left corner sits. */
type LayoutRow = readonly [SessionEquipmentItem, GridPosition];

/**
 * Every parameter of the sampled measurements below.
 *
 * `streakSweep.ts`'s discipline, applied here: the seeds, the horizons, the
 * layouts and the disturbance schedule are named values rather than numbers at
 * a call site, so a later round can re-derive the pinned counts instead of
 * guessing which parameterisation produced them.
 */
export const FLOOR_SIM_SWEEP = Object.freeze({
  /** Four seeds, chosen only for being distinct small primes — the sim has no seed-dependent structure to tune them against. */
  SEEDS: Object.freeze([1, 7, 13, 29]),
  /** Ticks per phase. Four phases, so a run is four times this. */
  PHASE_TICKS: 60,
  /**
   * The four phases every sweep run walks, in order. Each names how the floor
   * changes at its start, which is what makes the interruption arms reachable:
   * `removed` and `moved` are exactly GDD §5.13's two causes, driven as a
   * player would cause them (a drag on `FloorGrid.tsx`), and `cleared` takes
   * the floor back to fixed furniture alone.
   */
  PHASES: Object.freeze(['as-laid-out', 'first-item-moved', 'first-item-removed', 'cleared'] as const),
  /** Where the moved item goes in phase 3, as an offset from its laid-out corner. */
  MOVE_OFFSET: Object.freeze({ x: 0, y: 2 }),
});

/**
 * A hand-placed layout per rung, deliberately modest rather than maximal.
 *
 * Sized for wall time rather than for coverage: a warehouse holding all
 * fourteen session items is 17 stations and measured at 5.6 ms per
 * `stepFloorSim` call, which would put this file's sweep alone over half a
 * minute. Every position is asserted to actually place (`lays out every rung's
 * sweep layout`), so a footprint change reddens here rather than silently
 * shrinking a layout to nothing.
 */
const SWEEP_LAYOUTS: Readonly<Record<LadderRung, readonly LayoutRow[]>> = Object.freeze({
  garage: Object.freeze([
    Object.freeze(['foam-rollers', Object.freeze({ x: 7, y: 0 })] as const),
    Object.freeze(['wrist-wraps', Object.freeze({ x: 0, y: 5 })] as const),
  ] as const),
  'storage-unit': Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 9, y: 0 })] as const),
    Object.freeze(['mats', Object.freeze({ x: 6, y: 5 })] as const),
    Object.freeze(['belts', Object.freeze({ x: 0, y: 8 })] as const),
  ] as const),
  'strip-mall-unit': Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 8, y: 0 })] as const),
    Object.freeze(['treadmill', Object.freeze({ x: 12, y: 0 })] as const),
    Object.freeze(['mats', Object.freeze({ x: 16, y: 6 })] as const),
    Object.freeze(['dumbbells', Object.freeze({ x: 2, y: 8 })] as const),
    Object.freeze(['sauna', Object.freeze({ x: 8, y: 11 })] as const),
  ] as const),
  warehouse: Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 10, y: 0 })] as const),
    Object.freeze(['treadmill', Object.freeze({ x: 16, y: 0 })] as const),
    Object.freeze(['rower', Object.freeze({ x: 22, y: 0 })] as const),
    Object.freeze(['mats', Object.freeze({ x: 30, y: 6 })] as const),
    Object.freeze(['dumbbells', Object.freeze({ x: 4, y: 12 })] as const),
    Object.freeze(['sauna', Object.freeze({ x: 20, y: 18 })] as const),
  ] as const),
});

const RUNGS: readonly LadderRung[] = Object.freeze([...T.LADDER_RUNGS]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The floor `rows` produce on `rung`, refusing loudly if a row does not place. */
function floorFrom(rung: LadderRung, rows: readonly LayoutRow[]): FloorState {
  let floor = createFloorState(rung);
  const owned = rows.map(([item]) => item);
  for (const [item, position] of rows) {
    const result = placeFloorItem(floor, owned, item, position);
    if (result.kind !== 'placed') {
      throw new Error(`${rung}: ${item} at ${position.x},${position.y} refused as ${result.reason}`);
    }
    floor = result.state;
  }
  return floor;
}

/** The four floors one sweep run walks, in `FLOOR_SIM_SWEEP.PHASES` order. */
function phaseFloors(rung: LadderRung): readonly FloorState[] {
  const rows = SWEEP_LAYOUTS[rung];
  const first = rows[0] as LayoutRow;
  const moved: LayoutRow = [
    first[0],
    {
      x: first[1].x + FLOOR_SIM_SWEEP.MOVE_OFFSET.x,
      y: first[1].y + FLOOR_SIM_SWEEP.MOVE_OFFSET.y,
    },
  ];
  return Object.freeze([
    floorFrom(rung, rows),
    floorFrom(rung, [moved, ...rows.slice(1)]),
    floorFrom(rung, rows.slice(1)),
    createFloorState(rung),
  ]);
}

function contextFor(rung: LadderRung, floor: FloorState): FloorSimContext {
  return {
    rung,
    floor,
    barbellOwned: KIT,
    sessionOwned: SWEEP_LAYOUTS[rung].map(([item]) => item),
  };
}

/** Which cells a context's equipment covers — the cells no member may stand on. */
function blockedCells(context: FloorSimContext): ReadonlySet<string> {
  const cells = new Set<string>();
  const add = (position: GridPosition, footprint: GridSize): void => {
    for (let dy = 0; dy < footprint.height; dy += 1) {
      for (let dx = 0; dx < footprint.width; dx += 1) {
        cells.add(`${position.x + dx},${position.y + dy}`);
      }
    }
  };
  for (const row of fixedFloorFurniture(context.barbellOwned)) add(row.position, row.footprint);
  for (const row of floorLayout(context.floor)) add(row.position, row.footprint);
  return cells;
}

function cellKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}

/** A member built by hand at `cell` — the only way to drive one arm at a time. */
function memberAt(index: number, type: MemberType, cell: GridPosition): FloorSimMember {
  return Object.freeze({
    index,
    type,
    state: 'seeking' as FloorSimMemberState,
    cell,
    next: null,
    progress: 0,
    target: null,
    targetPosition: null,
    claimedAt: null,
    queuedAt: null,
    timer: 0,
    interruptedBy: null,
    awayFrom: null,
  });
}

function stateOf(seed: number, members: readonly FloorSimMember[]): FloorSimState {
  return Object.freeze({ tick: 0, seed, members: Object.freeze([...members]) });
}

// ---------------------------------------------------------------------------
// The sweep itself
// ---------------------------------------------------------------------------

interface SweepReading {
  /** How many times each state was ENTERED, initial states included. */
  readonly entries: Readonly<Record<FloorSimMemberState, number>>;
  /** How many times each interruption cause fired. */
  readonly causes: Readonly<Record<FloorSimInterruption, number>>;
  /** (member, tick) pairs observed — the non-vacuity guard. */
  readonly observations: number;
  /** Observations where a member stood on a blocked cell, or was stepping into one. */
  readonly onEquipment: number;
  /** The longest run of consecutive ticks any member held both one state and one cell. */
  readonly longestStill: number;
  /** The most claimants any one station held at once. */
  readonly longestQueue: number;
  /** Observations where a member's `progress` left [0, 1). */
  readonly badProgress: number;
  /** Observations where a member's state and its timer disagreed about being timed. */
  readonly badTimer: number;
  /** Runs walked. */
  readonly runs: number;
}

function sweep(): SweepReading {
  const entries: Record<FloorSimMemberState, number> = {
    seeking: 0,
    queuing: 0,
    using: 0,
    leaving: 0,
    interrupted: 0,
  };
  const causes: Record<FloorSimInterruption, number> = {
    'target-removed': 0,
    'target-moved': 0,
  };
  let observations = 0;
  let onEquipment = 0;
  let longestStill = 0;
  let longestQueue = 0;
  let badProgress = 0;
  let badTimer = 0;
  let runs = 0;

  for (const rung of RUNGS) {
    const floors = phaseFloors(rung);
    for (const seed of FLOOR_SIM_SWEEP.SEEDS) {
      runs += 1;
      let at = createFloorSimState(contextFor(rung, floors[0] as FloorState), seed);
      let previous: readonly FloorSimMember[] = at.members;
      for (const member of at.members) entries[member.state] += 1;
      const still = new Map<number, number>();
      for (const [phase] of FLOOR_SIM_SWEEP.PHASES.entries()) {
        const context = contextFor(rung, floors[phase] as FloorState);
        const blocked = blockedCells(context);
        for (let step = 0; step < FLOOR_SIM_SWEEP.PHASE_TICKS; step += 1) {
          at = stepFloorSim(at, context);
          const claims = new Map<string, number>();
          for (const member of at.members) {
            observations += 1;
            const before = previous[member.index] as FloorSimMember;
            if (member.state !== before.state) {
              entries[member.state] += 1;
              if (member.state === 'interrupted' && member.interruptedBy !== null) {
                causes[member.interruptedBy] += 1;
              }
            }
            if (blocked.has(cellKey(member.cell))) onEquipment += 1;
            if (member.next !== null && blocked.has(cellKey(member.next))) onEquipment += 1;
            if (!(member.progress >= 0 && member.progress < 1)) badProgress += 1;
            const timed =
              member.state === 'using' ||
              member.state === 'leaving' ||
              member.state === 'interrupted';
            if (timed !== member.timer > 0) badTimer += 1;
            if (member.target !== null && (member.state === 'seeking' || member.state === 'queuing')) {
              const key = `${member.target.kind}:${member.target.item}`;
              claims.set(key, (claims.get(key) ?? 0) + 1);
            }
            const held =
              member.state === before.state && cellKey(member.cell) === cellKey(before.cell)
                ? (still.get(member.index) ?? 0) + 1
                : 1;
            still.set(member.index, held);
            if (held > longestStill) longestStill = held;
          }
          for (const count of claims.values()) {
            if (count > longestQueue) longestQueue = count;
          }
          previous = at.members;
        }
      }
    }
  }

  return {
    entries: Object.freeze(entries),
    causes: Object.freeze(causes),
    observations,
    onEquipment,
    longestStill,
    longestQueue,
    badProgress,
    badTimer,
    runs,
  };
}

const SWEEP = sweep();

/**
 * Every number the sweep produced, measured by running the assertions below
 * against a sentinel and reading the failure value — never computed by hand.
 */
const SWEEP_CENSUS = Object.freeze({
  RUNS: 16,
  OBSERVATIONS: 66240,
  ENTRIES: Object.freeze({
    seeking: 904,
    queuing: 511,
    using: 542,
    leaving: 452,
    interrupted: 183,
  }),
  CAUSES: Object.freeze({
    'target-removed': 150,
    'target-moved': 33,
  }),
  LONGEST_STILL: 46,
  LONGEST_QUEUE: 3,
});

// ---------------------------------------------------------------------------
// 1. The tuning block
// ---------------------------------------------------------------------------

describe('the Phase 3 tuning block is shaped the way `floorSim.ts` reads it', () => {
  it('keeps a step at or below one tile per tick, and a speed strictly above zero', () => {
    expect(T.FLOOR_SIM_STEP_PROGRESS_PER_TICK).toBeGreaterThan(0);
    // The bound `floorSim.ts`'s header §2 claims: above 1 the surplus is
    // discarded rather than fast, so the knob would stop meaning what it says.
    expect(T.FLOOR_SIM_STEP_PROGRESS_PER_TICK).toBeLessThanOrEqual(1);
    expect(T.FLOOR_SIM_SPEED_JITTER_FRACTION).toBeGreaterThanOrEqual(0);
    // Strictly below 1, so the slowest jittered member still moves.
    expect(T.FLOOR_SIM_SPEED_JITTER_FRACTION).toBeLessThan(1);
    expect(
      T.FLOOR_SIM_STEP_PROGRESS_PER_TICK * (1 - T.FLOOR_SIM_SPEED_JITTER_FRACTION),
    ).toBeGreaterThan(0);
  });

  it('publishes a use duration for exactly the five member types', () => {
    expect(Object.keys(T.FLOOR_SIM_USE_TICKS_BY_TYPE).sort()).toEqual([...T.MEMBER_TYPES].sort());
    let checked = 0;
    for (const type of T.MEMBER_TYPES) {
      const ticks = T.FLOOR_SIM_USE_TICKS_BY_TYPE[type];
      expect(Number.isInteger(ticks), type).toBe(true);
      expect(ticks, type).toBeGreaterThan(0);
      checked += 1;
    }
    expect(checked).toBe(T.MEMBER_TYPES.length);
    // §5.6's own quirk, made mechanical rather than left as prose: a
    // bodybuilder "occupies equipment for a long time", so its dwell is the
    // longest of the five.
    const longest = Math.max(...T.MEMBER_TYPES.map((type) => T.FLOOR_SIM_USE_TICKS_BY_TYPE[type]));
    expect(T.FLOOR_SIM_USE_TICKS_BY_TYPE.bodybuilder).toBe(longest);
    expect(T.FLOOR_SIM_USE_TICKS_BY_TYPE.casual).toBe(
      Math.min(...T.MEMBER_TYPES.map((type) => T.FLOOR_SIM_USE_TICKS_BY_TYPE[type])),
    );
  });

  it('keeps every tick count a whole number, and every beat at least one tick long', () => {
    const beats = [
      ['FLOOR_SIM_INTERRUPTED_BEAT_TICKS', T.FLOOR_SIM_INTERRUPTED_BEAT_TICKS],
      ['FLOOR_SIM_LEAVING_TICKS', T.FLOOR_SIM_LEAVING_TICKS],
      ['FLOOR_SIM_WANDER_HOLD_TICKS', T.FLOOR_SIM_WANDER_HOLD_TICKS],
      ['FLOOR_SIM_QUEUE_MAX_LENGTH', T.FLOOR_SIM_QUEUE_MAX_LENGTH],
    ] as const;
    let checked = 0;
    for (const [name, value] of beats) {
      expect(Number.isInteger(value), name).toBe(true);
      expect(value, name).toBeGreaterThanOrEqual(1);
      checked += 1;
    }
    expect(checked).toBe(beats.length);
    expect(checked).toBe(4);
    expect(Number.isInteger(T.FLOOR_SIM_USE_TICKS_SPREAD)).toBe(true);
    expect(T.FLOOR_SIM_USE_TICKS_SPREAD).toBeGreaterThanOrEqual(0);
  });

  it('sizes the route budget against the largest registered floor rather than a round number', () => {
    const largest = Math.max(
      ...RUNGS.map((rung) => floorGridSize(rung).width * floorGridSize(rung).height),
    );
    // 1120 today — the warehouse's 40x28. A rung whose grid outgrows the
    // budget reddens here rather than throwing inside a route search.
    expect(largest).toBe(1120);
    expect(T.FLOOR_SIM_ROUTE_VISIT_BUDGET).toBeGreaterThan(largest);
    expect(Number.isInteger(T.FLOOR_SIM_MAX_RUN_TICKS)).toBe(true);
    expect(T.FLOOR_SIM_MAX_RUN_TICKS).toBeGreaterThan(
      FLOOR_SIM_SWEEP.PHASE_TICKS * FLOOR_SIM_SWEEP.PHASES.length,
    );
  });

  it('classifies the two guards apart from the eleven knobs', () => {
    const block = Object.keys(T).filter((key) => key.startsWith('FLOOR_SIM_'));
    expect(block.length).toBe(13);
    const guards = block.filter((key) => key.endsWith('BUDGET') || key.endsWith('MAX_RUN_TICKS'));
    expect(guards.sort()).toEqual(['FLOOR_SIM_MAX_RUN_TICKS', 'FLOOR_SIM_ROUTE_VISIT_BUDGET']);
  });
});

// ---------------------------------------------------------------------------
// 2. THE ARM CENSUS — declared against reached
// ---------------------------------------------------------------------------

describe('the arms this machine declares are the arms the sweep reached', () => {
  it('walked a non-empty domain, so the census below is measuring something', () => {
    expect(SWEEP.runs).toBe(SWEEP_CENSUS.RUNS);
    expect(SWEEP.runs).toBe(RUNGS.length * FLOOR_SIM_SWEEP.SEEDS.length);
    expect(SWEEP.observations).toBe(SWEEP_CENSUS.OBSERVATIONS);
    // Derived rather than transcribed: every run walks every phase, every
    // phase walks its ticks, and every tick observes every member.
    const expected = RUNGS.reduce(
      (total, rung) =>
        total +
        FLOOR_SIM_SWEEP.SEEDS.length *
          FLOOR_SIM_SWEEP.PHASES.length *
          FLOOR_SIM_SWEEP.PHASE_TICKS *
          ambientMemberRoster(rung, KIT, []).length,
      0,
    );
    expect(SWEEP.observations).toBe(expected);
  });

  it('reaches every declared state and declares every reached state', () => {
    const reached = FLOOR_SIM_MEMBER_STATES.filter((state) => SWEEP.entries[state] > 0);
    // Both directions. A sixth state added to the type with nothing producing
    // it fails the first line; a state produced that the type does not declare
    // cannot be represented, which is what makes the second line a join over
    // the type rather than over a string set.
    expect([...reached].sort()).toEqual([...FLOOR_SIM_MEMBER_STATES].sort());
    expect(Object.keys(SWEEP.entries).sort()).toEqual([...FLOOR_SIM_MEMBER_STATES].sort());
  });

  it('pins how many times each arm was entered, so a fixture that stops reaching one reddens', () => {
    // Counts and not bounds. `interrupted` is the arm this piece exists to
    // add, and it is reachable at all only because the sweep's phases move and
    // remove equipment the way a drag on `FloorGrid.tsx` does.
    let pinned = 0;
    for (const state of FLOOR_SIM_MEMBER_STATES) {
      expect(SWEEP.entries[state], state).toBe(SWEEP_CENSUS.ENTRIES[state]);
      pinned += 1;
    }
    expect(pinned).toBe(FLOOR_SIM_MEMBER_STATES.length);
    expect(pinned).toBe(5);
  });

  it('reaches both interruption causes and pins each one', () => {
    const reached = FLOOR_SIM_INTERRUPTIONS.filter((cause) => SWEEP.causes[cause] > 0);
    expect([...reached].sort()).toEqual([...FLOOR_SIM_INTERRUPTIONS].sort());
    let pinned = 0;
    for (const cause of FLOOR_SIM_INTERRUPTIONS) {
      expect(SWEEP.causes[cause], cause).toBe(SWEEP_CENSUS.CAUSES[cause]);
      pinned += 1;
    }
    expect(pinned).toBe(2);
    // The two causes sum to the entries into the beat, so a cause going
    // unrecorded is red here as well as on its own count.
    expect(SWEEP.causes['target-removed'] + SWEEP.causes['target-moved']).toBe(
      SWEEP.entries.interrupted,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Standing on equipment, progress, timers
// ---------------------------------------------------------------------------

describe('a member stands on the floor and never on the equipment', () => {
  it('never reports a member on, or stepping into, a blocked cell', () => {
    // THE CLAIM, BOUNDED: after `stepFloorSim(state, context)`, no member's
    // cell or next cell is covered by fixed furniture or by a placed item IN
    // THAT CONTEXT. A state read after the caller has changed the floor and
    // before the next step can disagree, because nothing has run to notice —
    // that limit is what `relocates a member the player builds on top of`
    // below covers.
    expect(SWEEP.onEquipment).toBe(0);
    // The zero is against a real domain: the sweep put equipment on every rung
    // and every member walked past it.
    expect(SWEEP.observations).toBeGreaterThan(0);
  });

  it('relocates a member the player builds on top of, rather than leaving it inside a machine', () => {
    const rung: LadderRung = 'garage';
    const clear = contextFor(rung, createFloorState(rung));
    // `mats` is 3x3 at (4,3), so (5,4) is inside it.
    const inside: GridPosition = { x: 5, y: 4 };
    const built = contextFor(
      rung,
      floorFrom(rung, [['mats', { x: 4, y: 3 }] as LayoutRow]),
    );
    const before = stateOf(1, [memberAt(0, 'casual', inside)]);
    expect(blockedCells(clear).has(cellKey(inside))).toBe(false);
    expect(blockedCells(built).has(cellKey(inside))).toBe(true);
    const after = stepFloorSim(before, built);
    const moved = after.members[0] as FloorSimMember;
    expect(blockedCells(built).has(cellKey(moved.cell))).toBe(false);
    // Nearest by (distance, y, x) from (5,4): the mats cover x 4..6, y 3..5,
    // so the nearest walkable cell is one step off that block.
    expect(moved.cell).toEqual({ x: 5, y: 2 });
  });

  it('keeps progress inside [0, 1) and a timer only in the timed states', () => {
    expect(SWEEP.badProgress).toBe(0);
    expect(SWEEP.badTimer).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Liveness
// ---------------------------------------------------------------------------

describe('a member does not freeze', () => {
  it('has a walkable neighbour under every cell a member can stand on, on every rung and layout', () => {
    // The STRUCTURAL half of `floorSim.ts`'s header §4: the one shape that
    // would freeze a member outright is a walkable cell with no walkable
    // neighbour, and this enumerates rather than samples — every cell of every
    // rung, at every phase of that rung's sweep layout.
    let isolated = 0;
    let inspected = 0;
    for (const rung of RUNGS) {
      for (const floor of phaseFloors(rung)) {
        const context = contextFor(rung, floor);
        const grid = floorGridSize(rung);
        const blocked = blockedCells(context);
        for (let y = 0; y < grid.height; y += 1) {
          for (let x = 0; x < grid.width; x += 1) {
            if (blocked.has(`${x},${y}`)) continue;
            inspected += 1;
            const neighbours = [
              { x, y: y - 1 },
              { x: x + 1, y },
              { x, y: y + 1 },
              { x: x - 1, y },
            ].filter(
              (cell) =>
                cell.x >= 0 &&
                cell.y >= 0 &&
                cell.x < grid.width &&
                cell.y < grid.height &&
                !blocked.has(cellKey(cell)),
            );
            if (neighbours.length === 0) isolated += 1;
          }
        }
      }
    }
    expect(isolated).toBe(0);
    // Non-vacuity: a count, not a bound, so an empty enumeration reports
    // itself instead of passing.
    expect(inspected).toBe(5949);
  });

  it('holds no member in one state on one cell longer than the derived bound', () => {
    // The BEHAVIOURAL half. The bound is derived from the tuning rather than
    // picked: the longest a member can legitimately hold one cell is a full
    // queue's worth of the slowest use, its spread, the leaving beat and the
    // interruption beat.
    const slowest = Math.max(...T.MEMBER_TYPES.map((type) => T.FLOOR_SIM_USE_TICKS_BY_TYPE[type]));
    const bound =
      (T.FLOOR_SIM_QUEUE_MAX_LENGTH + 1) *
      (slowest +
        T.FLOOR_SIM_USE_TICKS_SPREAD +
        T.FLOOR_SIM_LEAVING_TICKS +
        T.FLOOR_SIM_INTERRUPTED_BEAT_TICKS);
    expect(bound).toBe(272);
    expect(SWEEP.longestStill).toBe(SWEEP_CENSUS.LONGEST_STILL);
    expect(SWEEP.longestStill).toBeLessThanOrEqual(bound);
  });

  it('keeps walking on a floor with nothing to walk to', () => {
    // The declared answer to "what happens if a floor has no reachable
    // equipment at all": there are no stations, so nobody can target one, and
    // `seeking` falls through to a wander leg. A member that stood still here
    // would be the freeze the rule above is about.
    const rung: LadderRung = 'garage';
    const bare: FloorSimContext = {
      rung,
      floor: createFloorState(rung),
      barbellOwned: [],
      sessionOwned: [],
    };
    expect(floorStations(bare)).toEqual([]);
    let at = createFloorSimState(bare, 3);
    const visited = at.members.map((member) => new Set<string>([cellKey(member.cell)]));
    for (let step = 0; step < FLOOR_SIM_SWEEP.PHASE_TICKS; step += 1) {
      at = stepFloorSim(at, bare);
      for (const member of at.members) {
        (visited[member.index] as Set<string>).add(cellKey(member.cell));
      }
    }
    expect(at.members.length).toBe(3);
    for (const member of at.members) {
      expect(member.state, `member ${member.index}`).toBe('seeking');
      expect(member.target, `member ${member.index}`).toBe(null);
      // Strictly more than the cell it started on: a member that stood still
      // here would read 1, which is the freeze this check exists for.
      expect((visited[member.index] as Set<string>).size, `member ${member.index}`).toBeGreaterThan(
        1,
      );
    }
    // And the counts themselves, pinned rather than bounded.
    expect(visited.map((cells) => cells.size)).toEqual([8, 14, 12]);
  });

  it('drops a target it can no longer reach and keeps walking', () => {
    // The one liveness hole this file found in itself, and the case GDD §5.13
    // does not name: the target has NEITHER moved NOR been removed — it is
    // still on the floor with a free cell beside it — but other equipment has
    // walled the member off from it. Distinguishing that from a removal is the
    // whole point of the fixture, and the two assertions below say so: the
    // station is still reported, and the member is not in the beat.
    const rung: LadderRung = 'storage-unit';
    const owned: readonly SessionEquipmentItem[] = Object.freeze([
      'mats',
      'specialty-bars',
      'cables',
    ]);
    const far: LayoutRow = ['mats', { x: 9, y: 6 }];
    // A 2x2 pocket at the top-left corner, sealed by two items that touch
    // neither the member's cell nor the mats.
    const wall: readonly LayoutRow[] = Object.freeze([
      far,
      ['specialty-bars', { x: 2, y: 0 }] as LayoutRow,
      ['cables', { x: 0, y: 2 }] as LayoutRow,
    ]);
    const open: FloorSimContext = {
      rung,
      floor: floorFrom(rung, [far]),
      barbellOwned: [],
      sessionOwned: owned,
    };
    const sealed: FloorSimContext = { ...open, floor: floorFrom(rung, wall) };

    let at = stepFloorSim(stateOf(2, [memberAt(0, 'casual', { x: 0, y: 0 })]), open);
    expect((at.members[0] as FloorSimMember).target).toEqual({ kind: 'session', item: 'mats' });

    // The station is still there — this is not a removal.
    expect(floorStations(sealed).some((station) => station.ref.item === 'mats')).toBe(true);
    const after = stepFloorSim(at, sealed);
    const walker = after.members[0] as FloorSimMember;
    expect(walker.state).toBe('seeking');
    expect(walker.interruptedBy).toBe(null);
    expect(walker.target).toBe(null);

    // And it does not freeze afterwards. WHAT IT DOES INSTEAD IS WORTH BEING
    // EXACT ABOUT, because the pocket is sealed against the mats and is NOT
    // sealed against the two items that seal it — a wall a member can touch is
    // a wall a member can use, and the sim treats it as a station like any
    // other. So the member re-claims one of the wall pieces on the very next
    // tick. That is the fallback doing its job (a dropped target, then a fresh
    // reachable one) rather than the wander leg, and pretending otherwise
    // would need a fixture no floor can produce.
    let moving = after;
    const visited = new Set<string>([cellKey(walker.cell)]);
    const states = new Set<string>([walker.state]);
    for (let step = 0; step < T.FLOOR_SIM_WANDER_HOLD_TICKS * 4; step += 1) {
      moving = stepFloorSim(moving, sealed);
      const member = moving.members[0] as FloorSimMember;
      visited.add(cellKey(member.cell));
      states.add(member.state);
      expect(member.interruptedBy, `step ${step}`).toBe(null);
    }
    const reclaimed = (moving.members[0] as FloorSimMember).target;
    expect(reclaimed).not.toBe(null);
    expect((reclaimed as { readonly item: string }).item).toBe('specialty-bars');
    expect([...states].sort()).toEqual(['seeking', 'using']);
    expect(visited.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Interruption
// ---------------------------------------------------------------------------

/** A garage owning no Barbell baseline, so the one station is a session item a player can drag. */
function draggableGarage(position: GridPosition): FloorSimContext {
  return {
    rung: 'garage',
    floor: floorFrom('garage', [['mats', position] as LayoutRow]),
    barbellOwned: [],
    sessionOwned: ['mats'],
  };
}

describe('a target that is moved or removed produces the beat, and the beat always ends', () => {
  const laid: GridPosition = { x: 5, y: 3 };
  const settled = (): FloorSimState => {
    const context = draggableGarage(laid);
    let at = createFloorSimState(context, 5);
    for (let step = 0; step < 30; step += 1) at = stepFloorSim(at, context);
    return at;
  };

  it('reaches all three interruptible source states before the interruption', () => {
    // The domain guard for the two checks below: if every member happened to
    // be `seeking` at the moment the equipment moved, this section would be
    // measuring one arm and reading as three.
    const at = settled();
    const states = new Set(at.members.map((member) => member.state));
    expect([...states].sort()).toEqual(['queuing', 'using']);
    // `seeking` is driven separately, from a member that has just claimed.
    const fresh = stepFloorSim(
      stateOf(5, [memberAt(0, 'casual', { x: 0, y: 5 })]),
      draggableGarage(laid),
    );
    expect((fresh.members[0] as FloorSimMember).state).toBe('seeking');
    expect((fresh.members[0] as FloorSimMember).target).not.toBe(null);
  });

  it('interrupts every claimant when the target is removed, naming the cause', () => {
    const at = settled();
    const after = stepFloorSim(at, {
      ...draggableGarage(laid),
      floor: createFloorState('garage'),
    });
    expect(after.members.length).toBe(3);
    for (const member of after.members) {
      expect(member.state, `member ${member.index}`).toBe('interrupted');
      expect(member.interruptedBy, `member ${member.index}`).toBe('target-removed');
      expect(member.target, `member ${member.index}`).toBe(null);
    }
  });

  it('interrupts every claimant when the target is moved, naming the other cause', () => {
    const at = settled();
    const after = stepFloorSim(at, draggableGarage({ x: 1, y: 3 }));
    for (const member of after.members) {
      expect(member.state, `member ${member.index}`).toBe('interrupted');
      expect(member.interruptedBy, `member ${member.index}`).toBe('target-moved');
    }
  });

  it('resolves the beat to seeking on exactly the tuned tick, from both causes', () => {
    // EXACT, not eventual. The beat is armed on the interrupting tick and that
    // same tick's advance pass decrements it, so a member is in the beat for
    // exactly `FLOOR_SIM_INTERRUPTED_BEAT_TICKS` ticks counting the one that
    // armed it — and is `seeking` on the tick after that.
    const causes = [
      ['target-removed', { ...draggableGarage(laid), floor: createFloorState('garage') }],
      ['target-moved', draggableGarage({ x: 1, y: 3 })],
    ] as const;
    let driven = 0;
    for (const [cause, disturbed] of causes) {
      let at = stepFloorSim(settled(), disturbed);
      expect((at.members[0] as FloorSimMember).interruptedBy, cause).toBe(cause);
      for (let step = 1; step < T.FLOOR_SIM_INTERRUPTED_BEAT_TICKS; step += 1) {
        at = stepFloorSim(at, disturbed);
        for (const member of at.members) {
          expect(member.state, `${cause} at +${step}`).toBe('interrupted');
        }
      }
      at = stepFloorSim(at, disturbed);
      for (const member of at.members) {
        expect(member.state, `${cause} at the exit`).toBe('seeking');
        expect(member.interruptedBy, `${cause} at the exit`).toBe(null);
        expect(member.timer, `${cause} at the exit`).toBe(0);
      }
      driven += 1;
    }
    expect(driven).toBe(FLOOR_SIM_INTERRUPTIONS.length);
    expect(driven).toBe(2);
  });

  it('leaves a member that is walking away alone, because it has already let go', () => {
    // The scope boundary GDD §5.13 draws: the beat is for a target moved or
    // removed mid-approach or mid-use. `leaving` is neither.
    const context = draggableGarage(laid);
    let at = createFloorSimState(context, 5);
    let leaving: FloorSimState | null = null;
    for (let step = 0; step < 200 && leaving === null; step += 1) {
      at = stepFloorSim(at, context);
      if (at.members.some((member) => member.state === 'leaving')) leaving = at;
    }
    expect(leaving).not.toBe(null);
    const before = leaving as FloorSimState;
    const walker = before.members.find(
      (member) => member.state === 'leaving',
    ) as FloorSimMember;
    const after = stepFloorSim(before, { ...context, floor: createFloorState('garage') });
    expect((after.members[walker.index] as FloorSimMember).state).toBe('leaving');
  });
});

// ---------------------------------------------------------------------------
// 6. Queues
// ---------------------------------------------------------------------------

describe('the queue is FIFO by arrival, and it is bounded', () => {
  it('never lets a station hold more claimants than the tuned queue length', () => {
    expect(SWEEP.longestQueue).toBe(SWEEP_CENSUS.LONGEST_QUEUE);
    expect(SWEEP.longestQueue).toBeLessThanOrEqual(T.FLOOR_SIM_QUEUE_MAX_LENGTH);
    // Non-vacuous: a queue really formed, so the bound is not being met by
    // nobody ever queuing.
    expect(SWEEP.longestQueue).toBeGreaterThan(1);
  });

  it('serves the member that arrived first, not the one that claimed first', () => {
    // THE RULE, DRIVEN RATHER THAN DESCRIBED. Two members claim the same
    // station on the same tick; the one standing beside it arrives first and
    // is served first, even though the far one has the lower index and would
    // win a claim-order tie-break.
    const context = draggableGarage({ x: 5, y: 3 });
    const station = floorStations(context)[0] as FloorStation;
    const far: GridPosition = { x: 0, y: 0 };
    const near = station.queueCells[0] as GridPosition;
    let at = stateOf(11, [memberAt(0, 'casual', far), memberAt(1, 'casual', near)]);
    expect(at.members.length).toBe(2);
    let firstUser: number | null = null;
    for (let step = 0; step < 60 && firstUser === null; step += 1) {
      at = stepFloorSim(at, context);
      const user = at.members.find((member) => member.state === 'using');
      if (user !== undefined) firstUser = user.index;
    }
    expect(firstUser).toBe(1);
  });

  it('breaks a tie on member index when two members arrive on the same tick', () => {
    // Both start on the two queue cells, so both arrive on the same tick and
    // neither has a claim-tick edge. The lower index takes slot zero.
    const context = draggableGarage({ x: 5, y: 3 });
    const station = floorStations(context)[0] as FloorStation;
    const one = station.queueCells[0] as GridPosition;
    const two = station.queueCells[1] as GridPosition;
    let at = stateOf(17, [memberAt(0, 'casual', two), memberAt(1, 'casual', one)]);
    let firstUser: number | null = null;
    for (let step = 0; step < 60 && firstUser === null; step += 1) {
      at = stepFloorSim(at, context);
      const user = at.members.find((member) => member.state === 'using');
      if (user !== undefined) firstUser = user.index;
    }
    // Both are standing on queue cells at tick 0, so both are recorded as
    // arrived on the same tick and the index decides.
    expect(firstUser).toBe(0);
  });

  it('pins the shortest handover gap the driven fixture produces', () => {
    // Header §3 says occupancy is read from the previous snapshot, so a
    // handover cannot happen on the tick the previous member finished — one
    // tick is the FLOOR. What the floor costs in practice is this number,
    // measured rather than assumed, because the next member also has to walk
    // in from its queue cell.
    const context = draggableGarage({ x: 5, y: 3 });
    let at = createFloorSimState(context, 5);
    const gaps: number[] = [];
    let idle = 0;
    let sawUse = false;
    for (let step = 0; step < 400; step += 1) {
      at = stepFloorSim(at, context);
      const busy = at.members.some((member) => member.state === 'using');
      if (busy) {
        if (sawUse && idle > 0) gaps.push(idle);
        idle = 0;
        sawUse = true;
      } else if (sawUse) {
        idle += 1;
      }
    }
    expect(gaps.length).toBeGreaterThan(0);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(1);
    expect(Math.min(...gaps)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 7. Determinism, and the seed axis
// ---------------------------------------------------------------------------

describe('the sim is deterministic, and the seed is doing work', () => {
  it('produces a byte-identical run from the same seed and context', () => {
    const context = contextFor('storage-unit', phaseFloors('storage-unit')[0] as FloorState);
    const left = runFloorSim(createFloorSimState(context, 7), context, 200);
    const right = runFloorSim(createFloorSimState(context, 7), context, 200);
    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
    expect(left.members.length).toBeGreaterThan(0);
  });

  it('moves a pinned number of members when only the seed changes', () => {
    // "Deterministic" must not quietly mean "constant", and the coarse form of
    // that measurement SATURATES here: the seed jitters every member's walking
    // speed, so from the second tick onward every member's record differs and
    // the count sits at its ceiling. A count at its ceiling proves the axis is
    // not dead and measures nothing else, so it is recorded WITH its ceiling
    // and a finer reading is taken beside it.
    const context = contextFor('storage-unit', phaseFloors('storage-unit')[0] as FloorState);
    const finalFor = (seed: number): readonly FloorSimMember[] =>
      runFloorSim(createFloorSimState(context, seed), context, 200).members;
    const base = finalFor(FLOOR_SIM_SWEEP.SEEDS[0] as number);
    const differing = (other: readonly FloorSimMember[]): number =>
      base.filter((member, index) => JSON.stringify(member) !== JSON.stringify(other[index])).length;
    // The control first — a seed against itself is what a non-varying axis
    // reads as, and it is the number the three below are not.
    expect(differing(finalFor(FLOOR_SIM_SWEEP.SEEDS[0] as number))).toBe(0);
    expect(base.length).toBe(8);
    expect(differing(finalFor(FLOOR_SIM_SWEEP.SEEDS[1] as number))).toBe(8);
    expect(differing(finalFor(FLOOR_SIM_SWEEP.SEEDS[2] as number))).toBe(8);
    expect(differing(finalFor(FLOOR_SIM_SWEEP.SEEDS[3] as number))).toBe(8);
  });

  it('moves a pinned number of FIRST TARGETS when only the seed changes', () => {
    // The finer reading the check above needs: which station each member
    // claims on its first tick isolates `FLOOR_SIM_TARGET_NOISE_TILES` from
    // the speed jitter, and it has real resolution — 4, 6 and 3 of 8 rather
    // than the ceiling of 8. A noise knob turned to zero collapses all three
    // to the control's 0, which is exactly what this exists to catch.
    const context = contextFor('storage-unit', phaseFloors('storage-unit')[0] as FloorState);
    const firstTargets = (seed: number): readonly string[] =>
      runFloorSim(createFloorSimState(context, seed), context, 1).members.map((member) =>
        member.target === null ? 'none' : `${member.target.kind}:${member.target.item}`,
      );
    const base = firstTargets(FLOOR_SIM_SWEEP.SEEDS[0] as number);
    expect(base.length).toBe(8);
    expect(base.filter((choice) => choice === 'none').length).toBe(0);
    const moved = (seed: number): number =>
      firstTargets(seed).filter((choice, index) => choice !== base[index]).length;
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[0] as number)).toBe(0);
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[1] as number)).toBe(4);
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[2] as number)).toBe(6);
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[3] as number)).toBe(3);
    // The ceiling, recorded so the three numbers above read against something.
    expect(base.length).toBe(8);
  });

  it('agrees element by element between a batched run and a loop of single steps', () => {
    // `runFloorSim` builds the derived plan once and `stepFloorSim` builds it
    // per call. This is what says the shared plan is an optimisation rather
    // than a second behaviour.
    const context = contextFor('strip-mall-unit', phaseFloors('strip-mall-unit')[0] as FloorState);
    const batched = runFloorSim(createFloorSimState(context, 13), context, 120);
    let looped = createFloorSimState(context, 13);
    for (let step = 0; step < 120; step += 1) looped = stepFloorSim(looped, context);
    expect(batched.tick).toBe(120);
    expect(looped.members.length).toBe(batched.members.length);
    let compared = 0;
    for (const [index, member] of batched.members.entries()) {
      expect(JSON.stringify(looped.members[index]), `member ${index}`).toBe(JSON.stringify(member));
      compared += 1;
    }
    expect(compared).toBe(18);
  });

  it('refuses a seed or a run length it cannot mix', () => {
    const context = contextFor('garage', createFloorState('garage'));
    expect(() => createFloorSimState(context, -1)).toThrow(/whole number at or above zero/);
    expect(() => createFloorSimState(context, 1.5)).toThrow(/whole number at or above zero/);
    const at = createFloorSimState(context, 0);
    expect(() => runFloorSim(at, context, -1)).toThrow(/whole number at or above zero/);
    expect(() => runFloorSim(at, context, T.FLOOR_SIM_MAX_RUN_TICKS + 1)).toThrow(/past the budget/);
    expect(runFloorSim(at, context, 0)).toBe(at);
  });
});

// ---------------------------------------------------------------------------
// 8. The member-type axis — richness on the axis the choice is actually about
// ---------------------------------------------------------------------------

describe('a member type changes where a member goes', () => {
  it('measures how far each type disagrees with the control, rather than asserting it does', () => {
    // CLAUDE.md's "Richness On One Axis Is Not Evidence About An Axis Nobody
    // Varied": the injected dependency here is §5.6's affinity table, read
    // through the member's type, and the sweep above varies only seeds and
    // layouts — one point on this axis. So this drives one member of each type
    // from each of twelve start cells on one floor and counts the
    // disagreements against `casual`, with `casual` against itself beside them
    // as the number a non-varying axis produces.
    //
    // THE FIXTURE IS CHOSEN SO THE AXIS CAN EXPRESS ITSELF, and the first one
    // could not. Against the sweep's own strip-mall layout — bike, treadmill,
    // mats, dumbbells, sauna — `athlete` disagreed with `casual` at zero of
    // five cells, because the item an athlete is most drawn to (`sled`, 0.7)
    // was not on the floor and the two types differ only in magnitude on the
    // cardio rows. A zero there is indistinguishable from an affinity read
    // that does nothing. This layout puts each type's own top row down.
    const rung: LadderRung = 'warehouse';
    const rows: readonly LayoutRow[] = Object.freeze([
      ['sled', { x: 10, y: 8 }] as LayoutRow,
      ['cables', { x: 16, y: 8 }] as LayoutRow,
      ['specialty-bars', { x: 20, y: 8 }] as LayoutRow,
      ['dumbbells', { x: 25, y: 8 }] as LayoutRow,
      ['bike', { x: 30, y: 8 }] as LayoutRow,
      ['machines', { x: 34, y: 8 }] as LayoutRow,
    ]);
    const context: FloorSimContext = {
      rung,
      floor: floorFrom(rung, rows),
      barbellOwned: KIT,
      sessionOwned: rows.map(([item]) => item),
    };
    expect(floorStations(context).length).toBe(9);
    const starts: readonly GridPosition[] = Object.freeze([
      { x: 0, y: 25 },
      { x: 8, y: 25 },
      { x: 14, y: 25 },
      { x: 20, y: 25 },
      { x: 26, y: 25 },
      { x: 32, y: 25 },
      { x: 39, y: 25 },
      { x: 0, y: 14 },
      { x: 39, y: 14 },
      { x: 20, y: 4 },
      { x: 30, y: 2 },
      { x: 8, y: 5 },
    ]);
    const choicesFor = (type: MemberType): readonly string[] =>
      starts.map((cell, index) => {
        const at = stepFloorSim(stateOf(23, [memberAt(index, type, cell)]), context);
        const target = (at.members[0] as FloorSimMember).target;
        return target === null ? 'none' : `${target.kind}:${target.item}`;
      });
    const control = choicesFor('casual');
    expect(control.length).toBe(12);
    expect(control.filter((choice) => choice === 'none').length).toBe(0);
    const disagreements = (type: MemberType): number =>
      choicesFor(type).filter((choice, index) => choice !== control[index]).length;
    // The control first, so a reader sees what zero means here.
    expect(disagreements('casual')).toBe(0);
    expect(disagreements('bodybuilder')).toBe(4);
    expect(disagreements('powerlifter')).toBe(3);
    expect(disagreements('athlete')).toBe(5);
    expect(disagreements('serious-lifter')).toBe(1);
    // The ceiling, so the four numbers above read against a maximum rather
    // than against nothing. `serious-lifter`'s 1 is the flattest affinity row
    // in §5.6's table (0.2-0.3 on fourteen items), which is the table's own
    // design showing through rather than a weak measurement.
    expect(starts.length).toBe(12);
  });

  it('gives a bodybuilder the longest hold on a machine, in the sim and not only in the table', () => {
    // The tuning check above pins the ORDER of the table. This drives it: two
    // members of different types on the same station, and the dwell measured
    // from the state machine itself.
    const context = draggableGarage({ x: 5, y: 3 });
    const station = floorStations(context)[0] as FloorStation;
    const dwellOf = (type: MemberType): number => {
      let at = stateOf(31, [memberAt(0, type, station.useCell)]);
      let ticks = 0;
      let started = false;
      for (let step = 0; step < 200; step += 1) {
        at = stepFloorSim(at, context);
        const member = at.members[0] as FloorSimMember;
        if (member.state === 'using') {
          started = true;
          ticks += 1;
        } else if (started) break;
      }
      return ticks;
    };
    const casual = dwellOf('casual');
    const bodybuilder = dwellOf('bodybuilder');
    expect(casual).toBe(28);
    expect(bodybuilder).toBe(52);
    expect(bodybuilder).toBeGreaterThan(casual);
  });
});

// ---------------------------------------------------------------------------
// 9. The station read model
// ---------------------------------------------------------------------------

describe('floorStations reports somewhere real to stand', () => {
  it('gives every station on every registered rung its own use cell', () => {
    // The fallback in `routePlan` — sharing a use cell when a machine is boxed
    // in — is what this says the shipped rungs do not do. Driven at every
    // phase of every rung's layout, not only at the empty floor.
    let checked = 0;
    for (const rung of RUNGS) {
      for (const [phase, floor] of phaseFloors(rung).entries()) {
        const context = contextFor(rung, floor);
        const stations = floorStations(context);
        const cells = stations.map((station) => cellKey(station.useCell));
        expect(new Set(cells).size, `${rung} phase ${phase}`).toBe(cells.length);
        checked += 1;
      }
    }
    expect(checked).toBe(RUNGS.length * FLOOR_SIM_SWEEP.PHASES.length);
    expect(checked).toBe(16);
  });

  it('puts every use cell and queue cell on a free tile beside the equipment', () => {
    let inspected = 0;
    for (const rung of RUNGS) {
      const context = contextFor(rung, phaseFloors(rung)[0] as FloorState);
      const blocked = blockedCells(context);
      const grid = floorGridSize(rung);
      for (const station of floorStations(context)) {
        expect(blocked.has(cellKey(station.useCell)), `${rung} ${station.ref.item}`).toBe(false);
        // Adjacent to the footprint, not merely somewhere on the floor.
        const touching =
          station.useCell.x >= station.position.x - 1 &&
          station.useCell.x <= station.position.x + station.footprint.width &&
          station.useCell.y >= station.position.y - 1 &&
          station.useCell.y <= station.position.y + station.footprint.height;
        expect(touching, `${rung} ${station.ref.item} use cell adjacency`).toBe(true);
        expect(station.queueCells.length).toBeGreaterThan(0);
        expect(station.queueCells.length).toBeLessThanOrEqual(T.FLOOR_SIM_QUEUE_MAX_LENGTH);
        for (const cell of station.queueCells) {
          expect(blocked.has(cellKey(cell)), `${rung} ${station.ref.item} queue cell`).toBe(false);
          expect(cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height).toBe(
            true,
          );
          expect(cellKey(cell)).not.toBe(cellKey(station.useCell));
        }
        inspected += 1;
      }
    }
    expect(inspected).toBe(28);
  });

  it('reports the fixed Barbell baseline and the placed session items, and nothing else', () => {
    const rung: LadderRung = 'storage-unit';
    const context = contextFor(rung, phaseFloors(rung)[0] as FloorState);
    const refs = floorStations(context).map((station) => `${station.ref.kind}:${station.ref.item}`);
    expect(refs).toEqual([
      'fixed:power-bar',
      'fixed:comp-plates',
      'fixed:flat-bench',
      'session:bike',
      'session:mats',
      'session:belts',
    ]);
    // An item that is owned but not placed has no station — placement is what
    // puts something on the floor, which is `floor.ts`'s own rule.
    const unplaced = floorStations({ ...context, floor: createFloorState(rung) });
    expect(unplaced.map((station) => station.ref.item)).toEqual([
      'power-bar',
      'comp-plates',
      'flat-bench',
    ]);
  });

  it('drops a station whose approach is sealed off, instead of sending a member at a wall', () => {
    // A 1x1 item in a corner, boxed in on both open sides by other items, has
    // no walkable adjacent cell — it is drawn, and it is not targetable.
    const rung: LadderRung = 'garage';
    const sealed = floorFrom(rung, [
      ['foam-rollers', { x: 7, y: 5 }] as LayoutRow,
      ['wrist-wraps', { x: 6, y: 5 }] as LayoutRow,
      ['belts', { x: 7, y: 4 }] as LayoutRow,
    ]);
    const context: FloorSimContext = {
      rung,
      floor: sealed,
      barbellOwned: KIT,
      sessionOwned: ['foam-rollers', 'wrist-wraps', 'belts'],
    };
    expect(floorLayout(sealed).map((row) => row.item)).toEqual([
      'foam-rollers',
      'wrist-wraps',
      'belts',
    ]);
    const reported = floorStations(context).map((station) => station.ref.item);
    expect(reported).not.toContain('foam-rollers');
    // Its two neighbours are still targetable, so the drop is about this item
    // and not about the whole corner.
    expect(reported).toContain('wrist-wraps');
    expect(reported).toContain('belts');
  });
});

// ---------------------------------------------------------------------------
// 10. What this module is allowed to see
// ---------------------------------------------------------------------------

describe('the sim reads presentation inputs and nothing economic', () => {
  it('carries exactly the four presentation inputs on its context', () => {
    // The set equality `floorSim.ts`'s header §5 names as the check for its
    // own declared limit — a type cannot stop a fifth field being added, and
    // this reddens when one is.
    const context = contextFor('garage', createFloorState('garage'));
    expect(Object.keys(context).sort()).toEqual([
      'barbellOwned',
      'floor',
      'rung',
      'sessionOwned',
    ]);
  });

  it('builds the same opening roster Phase 2 already draws', () => {
    // Count and type mix come from `ambientMemberRoster` rather than a second
    // formula, so a rung's population is one number in one table.
    let checked = 0;
    for (const rung of RUNGS) {
      const context = contextFor(rung, createFloorState(rung));
      const roster = ambientMemberRoster(rung, KIT, context.sessionOwned);
      const state = createFloorSimState(context, 1);
      expect(state.members.length, rung).toBe(roster.length);
      expect(state.members.length, rung).toBe(T.AMBIENT_MEMBER_COUNT_BY_RUNG[rung]);
      expect(state.members.map((member) => member.type), rung).toEqual(
        roster.map((row) => row.type),
      );
      expect(state.tick, rung).toBe(0);
      expect(floorSimStateCounts(state).seeking, rung).toBe(roster.length);
      checked += 1;
    }
    expect(checked).toBe(4);
  });

  it('counts the members by state, totalling the roster', () => {
    const context = contextFor('storage-unit', phaseFloors('storage-unit')[0] as FloorState);
    const at = runFloorSim(createFloorSimState(context, 7), context, 150);
    const counts = floorSimStateCounts(at);
    expect(Object.keys(counts).sort()).toEqual([...FLOOR_SIM_MEMBER_STATES].sort());
    const total = FLOOR_SIM_MEMBER_STATES.reduce((sum, state) => sum + counts[state], 0);
    expect(total).toBe(at.members.length);
    expect(total).toBe(8);
  });

  it('lays out every rung’s sweep layout, so the sweep is not running on empty floors', () => {
    let placed = 0;
    for (const rung of RUNGS) {
      const rows = SWEEP_LAYOUTS[rung];
      expect(rows.length, rung).toBeGreaterThan(1);
      const floor = floorFrom(rung, rows);
      expect(floorLayout(floor).length, rung).toBe(rows.length);
      for (const [item, position] of rows) {
        const footprint = sessionItemFootprint(item);
        const grid = floorGridSize(rung);
        expect(position.x + footprint.width, `${rung} ${item}`).toBeLessThanOrEqual(grid.width);
        expect(position.y + footprint.height, `${rung} ${item}`).toBeLessThanOrEqual(grid.height);
        placed += 1;
      }
    }
    expect(placed).toBe(16);
  });
});
