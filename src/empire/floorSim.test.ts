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
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FLOOR_SIM_INTERRUPTIBLE_STATES,
  FLOOR_SIM_INTERRUPTIONS,
  FLOOR_SIM_MEMBER_STATES,
  createFloorSimState,
  floorSimStateCounts,
  floorStationRefKey,
  floorStations,
  runFloorSim,
  stationOccupancy,
  stepFloorSim,
  type FloorSimContext,
  type FloorSimInterruptibleState,
  type FloorSimInterruption,
  type FloorSimMember,
  type FloorSimMemberState,
  type FloorSimState,
  type FloorStation,
  type FloorStationRef,
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
import { stockStationCapability, upgradeStation } from './stationCapability';

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
   * The five phases every sweep run walks, in order. Each names how the floor
   * changes at its start, which is what makes the interruption arms reachable:
   * `first-item-moved` and `first-item-removed` are exactly GDD §5.13's two
   * causes, driven as a player would cause them (a drag on `FloorGrid.tsx`),
   * `route-cut` is the third cause this module adds, and `cleared` takes the
   * floor back to fixed furniture alone.
   *
   * `route-cut` EXISTS BECAUSE THE OTHER FOUR PHASES COULD NOT PRODUCE ITS ARM,
   * which is the finding rather than the fix. The generator only ever moved one
   * item down by two and then removed items, and removing an item frees cells
   * rather than walling anything off — so every member whose target changed was
   * caught by the interruption pass first, and the route-lost branch was
   * instrumented across all 66240 observations of the four-phase sweep at
   * exactly 0. This phase re-places the surviving layout and seals the approach
   * of one station that phase 3 left standing, so a member holding that station
   * loses its route without the station moving or being removed.
   */
  PHASES: Object.freeze([
    'as-laid-out',
    'first-item-moved',
    'first-item-removed',
    'route-cut',
    'cleared',
  ] as const),
  /** Where the moved item goes in the `first-item-moved` phase, as an offset from its laid-out corner. */
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
    Object.freeze(['wrist-wraps', Object.freeze({ x: 7, y: 5 })] as const),
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
    Object.freeze(['belts', Object.freeze({ x: 0, y: 15 })] as const),
  ] as const),
  warehouse: Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 10, y: 0 })] as const),
    Object.freeze(['treadmill', Object.freeze({ x: 16, y: 0 })] as const),
    Object.freeze(['rower', Object.freeze({ x: 22, y: 0 })] as const),
    Object.freeze(['mats', Object.freeze({ x: 30, y: 6 })] as const),
    Object.freeze(['dumbbells', Object.freeze({ x: 4, y: 12 })] as const),
    Object.freeze(['sauna', Object.freeze({ x: 20, y: 18 })] as const),
    Object.freeze(['belts', Object.freeze({ x: 0, y: 27 })] as const),
  ] as const),
});

/**
 * The `route-cut` phase's floor, per rung: everything the `first-item-removed`
 * phase left standing, plus the items that seal one surviving station's
 * approach into a pocket.
 *
 * The sealed station is each rung's bottom-left 1x1 — `wrist-wraps` on a
 * garage, `belts` on the other three — chosen because a one-tile item in a grid
 * corner has two approach cells rather than a ring of them, so three wall
 * pieces close it and the pocket that is left is a legal 3-tile room with a
 * walkable neighbour under every cell. The station keeps its use cell and its
 * queue cells; what changes is that they are all inside the pocket, so a member
 * standing outside holds a target it cannot reach and the station has neither
 * moved nor gone.
 *
 * THE SHIPPED COMMENT THIS REPLACES SAID SUCH A FIXTURE WOULD NEED A FLOOR NO
 * LAYOUT CAN PRODUCE. It needs one `LayoutRow` per wall piece, and the pieces
 * are ordinary session equipment placed through the real `placeFloorItem`.
 */
const ROUTE_CUT_LAYOUTS: Readonly<Record<LadderRung, readonly LayoutRow[]>> = Object.freeze({
  garage: Object.freeze([
    Object.freeze(['wrist-wraps', Object.freeze({ x: 7, y: 5 })] as const),
    Object.freeze(['bike', Object.freeze({ x: 6, y: 2 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 5, y: 3 })] as const),
  ] as const),
  'storage-unit': Object.freeze([
    Object.freeze(['mats', Object.freeze({ x: 6, y: 5 })] as const),
    Object.freeze(['belts', Object.freeze({ x: 0, y: 8 })] as const),
    Object.freeze(['dumbbells', Object.freeze({ x: 0, y: 5 })] as const),
    Object.freeze(['bike', Object.freeze({ x: 2, y: 7 })] as const),
  ] as const),
  'strip-mall-unit': Object.freeze([
    Object.freeze(['treadmill', Object.freeze({ x: 12, y: 0 })] as const),
    Object.freeze(['mats', Object.freeze({ x: 16, y: 6 })] as const),
    Object.freeze(['dumbbells', Object.freeze({ x: 2, y: 8 })] as const),
    Object.freeze(['sauna', Object.freeze({ x: 8, y: 11 })] as const),
    Object.freeze(['belts', Object.freeze({ x: 0, y: 15 })] as const),
    Object.freeze(['bike', Object.freeze({ x: 0, y: 12 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 2, y: 13 })] as const),
  ] as const),
  warehouse: Object.freeze([
    Object.freeze(['treadmill', Object.freeze({ x: 16, y: 0 })] as const),
    Object.freeze(['rower', Object.freeze({ x: 22, y: 0 })] as const),
    Object.freeze(['mats', Object.freeze({ x: 30, y: 6 })] as const),
    Object.freeze(['dumbbells', Object.freeze({ x: 4, y: 12 })] as const),
    Object.freeze(['sauna', Object.freeze({ x: 20, y: 18 })] as const),
    Object.freeze(['belts', Object.freeze({ x: 0, y: 27 })] as const),
    Object.freeze(['bike', Object.freeze({ x: 0, y: 24 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 2, y: 25 })] as const),
  ] as const),
});

/**
 * A pocket with NO station approach inside it, per rung — the floor a member
 * with nothing at all in reach stands on.
 *
 * THE FIRST VERSION OF THIS FIXTURE MEASURED ZERO, and the reason is worth
 * keeping. It reused `ROUTE_CUT_LAYOUTS`'s pocket, which is built around a
 * station's own use cell — so a member inside it could reach that station
 * perfectly well and was never stranded at all. The sealed sweep read 0
 * reactions and the pocket looked sealed, because it was: sealed around
 * something reachable is not the same shape as sealed away from everything.
 *
 * What makes this one different is which side of the wall the wall's own use
 * cell lands on. `routePlan` picks a station's use cell as the approach cell
 * with the lowest (row, column), so a pocket placed BELOW and RIGHT of the two
 * items that seal it leaves both of their use cells outside — and a station's
 * queue cells are found by walking out from its use cell, so those land outside
 * too. From inside the pocket every distance field reads unreachable, which is
 * the state `strandedAt` exists to name.
 */
const SEALED_LAYOUTS: Readonly<Record<LadderRung, readonly LayoutRow[]>> = Object.freeze({
  garage: Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 6, y: 2 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 5, y: 3 })] as const),
  ] as const),
  'storage-unit': Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 10, y: 5 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 9, y: 6 })] as const),
  ] as const),
  'strip-mall-unit': Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 20, y: 12 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 19, y: 13 })] as const),
  ] as const),
  warehouse: Object.freeze([
    Object.freeze(['bike', Object.freeze({ x: 38, y: 24 })] as const),
    Object.freeze(['specialty-bars', Object.freeze({ x: 37, y: 25 })] as const),
  ] as const),
});

/**
 * The sealed-pocket sweep's parameters, kept apart from `FLOOR_SIM_SWEEP` for
 * the reason `streakSweep.ts` keeps its own: this is a different measurement
 * with a different domain, and folding it into the first one's numbers would
 * make neither re-derivable.
 *
 * The subject is a member with NOTHING it can reach — sealed into a pocket
 * while stations stand elsewhere on the floor. That case cannot be produced by
 * letting a roster wander into a corner and then walling it: which cells the
 * roster occupies at a phase boundary is not something a layout can decide, so
 * a sweep built that way would report a large honest number and reach the arm
 * by luck. The members here are hand-placed inside the pocket, on every rung,
 * which is what makes the arm reached rather than sampled for.
 */
const SEALED_SWEEP = Object.freeze({
  /** Two seeds, so the wander direction is not one point. */
  SEEDS: Object.freeze([3, 19]),
  /** Ticks per run — comfortably past the beat, the wander hold and a use. */
  TICKS: 90,
  /** Where the hand-placed member starts, per rung: a free cell inside the sealed pocket. */
  STARTS: Object.freeze({
    garage: Object.freeze({ x: 6, y: 4 }),
    'storage-unit': Object.freeze({ x: 10, y: 7 }),
    'strip-mall-unit': Object.freeze({ x: 20, y: 14 }),
    warehouse: Object.freeze({ x: 38, y: 26 }),
  }),
  /**
   * The wall piece removed to build the control. Taking one item away opens the
   * pocket and leaves everything else identical, so the control differs from
   * the subject on exactly the axis being measured.
   */
  CONTROL_OMITS: 'specialty-bars' as SessionEquipmentItem,
});

const RUNGS: readonly LadderRung[] = Object.freeze([...T.LADDER_RUNGS]);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The floor `rows` produce on `rung`, refusing loudly if a row does not place. */
function floorFrom(
  rung: LadderRung,
  rows: readonly LayoutRow[],
  keepFurniture = true,
): FloorState {
  let floor = keepFurniture
    ? createFloorState(rung)
    : Object.freeze({ ...createFloorState(rung), furniture: Object.freeze({}) });
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

/** The five floors one sweep run walks, in `FLOOR_SIM_SWEEP.PHASES` order. */
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
    floorFrom(rung, ROUTE_CUT_LAYOUTS[rung]),
    createFloorState(rung),
  ]);
}

/** Every item either layout for `rung` names, so ownership never gates a phase. */
function ownedFor(rung: LadderRung): readonly SessionEquipmentItem[] {
  const owned = new Set<SessionEquipmentItem>();
  for (const [item] of SWEEP_LAYOUTS[rung]) owned.add(item);
  for (const [item] of ROUTE_CUT_LAYOUTS[rung]) owned.add(item);
  return Object.freeze([...owned]);
}

function contextFor(rung: LadderRung, floor: FloorState): FloorSimContext {
  return {
    rung,
    floor,
    barbellOwned: KIT,
    sessionOwned: ownedFor(rung),
    capability: stockStationCapability(),
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
    strandedAt: null,
  });
}

function stateOf(seed: number, members: readonly FloorSimMember[]): FloorSimState {
  return Object.freeze({
    tick: 0,
    seed,
    members: Object.freeze([...members]),
    changeovers: Object.freeze({}),
  });
}

// ---------------------------------------------------------------------------
// The sweep itself
// ---------------------------------------------------------------------------

interface SweepReading {
  /** How many times each state was ENTERED, initial states included. */
  readonly entries: Readonly<Record<FloorSimMemberState, number>>;
  /** How many times each interruption cause fired. */
  readonly causes: Readonly<Record<FloorSimInterruption, number>>;
  /**
   * How many times the beat was entered FROM each interruptible state.
   *
   * The destination census answers "was `interrupted` ever reached"; this one
   * answers "from which of the three states `applyInterruptions` admits", which
   * is a different question and was the one nothing here asked.
   */
  readonly sources: Readonly<Record<FloorSimInterruptibleState, number>>;
  /** Observations where a member was holding `strandedAt` — walled off from every station. */
  readonly strandedObservations: number;
  /** Distinct (run, member) pairs that were ever stranded. */
  readonly strandedMembers: number;
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
    'route-blocked': 0,
  };
  const sources: Record<FloorSimInterruptibleState, number> = {
    seeking: 0,
    queuing: 0,
    using: 0,
  };
  let strandedObservations = 0;
  const strandedSeen = new Set<string>();
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
                if (
                  FLOOR_SIM_INTERRUPTIBLE_STATES.includes(
                    before.state as FloorSimInterruptibleState,
                  )
                ) {
                  sources[before.state as FloorSimInterruptibleState] += 1;
                }
              }
            }
            if (member.strandedAt !== null) {
              strandedObservations += 1;
              strandedSeen.add(`${rung}:${seed}:${member.index}`);
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
              const key = floorStationRefKey(member.target);
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
    sources: Object.freeze(sources),
    strandedObservations,
    strandedMembers: strandedSeen.size,
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

// ---------------------------------------------------------------------------
// The sealed-pocket sweep — the arm no roster wanders into
// ---------------------------------------------------------------------------

/** What one sealed-pocket run saw. */
interface SealedReading {
  /** (member, tick) pairs observed. */
  readonly observations: number;
  /** Observations where the member was holding `strandedAt`. */
  readonly stranded: number;
  /** Times the beat was entered naming `route-blocked`. */
  readonly reactions: number;
  /** Distinct cells the member stood on — how big the box it paces is. */
  readonly cells: number;
  /** Distinct states the member was ever in. */
  readonly states: readonly FloorSimMemberState[];
  /** Times the member claimed anything at all. */
  readonly claims: number;
  /** Stations standing on the floor it cannot reach. */
  readonly stations: number;
  /** Runs walked. */
  readonly runs: number;
}

/**
 * Drive one hand-placed member per rung, inside the `route-cut` phase's sealed
 * pocket, and read what a member cut off from the whole gym actually does.
 *
 * `omit` drops one wall piece, which is the control: the same pocket with a way
 * out. Every other input is held identical, so a difference between the two
 * readings is the seal and nothing else.
 */
function sealedSweep(omit: SessionEquipmentItem | null): SealedReading {
  let observations = 0;
  let stranded = 0;
  let reactions = 0;
  let claims = 0;
  let cells = 0;
  let stations = 0;
  let runs = 0;
  const states = new Set<FloorSimMemberState>();
  for (const rung of RUNGS) {
    const rows = SEALED_LAYOUTS[rung].filter(([item]) => item !== omit);
    const context: FloorSimContext = {
      rung,
      floor: floorFrom(rung, rows),
      barbellOwned: KIT,
      sessionOwned: rows.map(([item]) => item),
      capability: stockStationCapability(),
    };
    stations += floorStations(context).length;
    for (const seed of SEALED_SWEEP.SEEDS) {
      runs += 1;
      const start = SEALED_SWEEP.STARTS[rung];
      let at = stateOf(seed, [memberAt(0, 'casual', start)]);
      let previous = at.members[0] as FloorSimMember;
      const visited = new Set<string>([cellKey(start)]);
      for (let step = 0; step < SEALED_SWEEP.TICKS; step += 1) {
        at = stepFloorSim(at, context);
        const member = at.members[0] as FloorSimMember;
        observations += 1;
        states.add(member.state);
        visited.add(cellKey(member.cell));
        if (member.strandedAt !== null) stranded += 1;
        if (member.state !== previous.state && member.interruptedBy === 'route-blocked') {
          reactions += 1;
        }
        if (member.target !== null && previous.target === null) claims += 1;
        previous = member;
      }
      cells += visited.size;
    }
  }
  return {
    observations,
    stranded,
    reactions,
    claims,
    cells,
    states: Object.freeze([...states].sort()),
    stations,
    runs,
  };
}

const SEALED = sealedSweep(null);
const SEALED_CONTROL = sealedSweep(SEALED_SWEEP.CONTROL_OMITS);

/** Both readings, every number taken from its own assertion's failure value. */
const SEALED_CENSUS = Object.freeze({
  RUNS: 8,
  OBSERVATIONS: 720,
  SEALED: Object.freeze({
    STRANDED: 720,
    REACTIONS: 8,
    CLAIMS: 0,
    CELLS: 32,
    STATIONS: 11,
  }),
  CONTROL: Object.freeze({
    STRANDED: 0,
    REACTIONS: 0,
    CLAIMS: 20,
    CELLS: 66,
    STATIONS: 8,
  }),
});


/**
 * Every number the sweep produced, measured by running the assertions below
 * against a sentinel and reading the failure value — never computed by hand.
 */
const SWEEP_CENSUS = Object.freeze({
  RUNS: 16,
  // 66240 -> 82800: the sweep grew a fifth phase (`route-cut`), so every run
  // walks 60 more ticks. Read from this pin's own failure value.
  OBSERVATIONS: 82800,
  // Every number in this block moved when the fifth phase landed AND when the
  // roster's type mix changed with `contextFor`'s widened `sessionOwned`, which
  // now names the wall pieces the gym has to own to place them. Each is read
  // from its own assertion's failure value, never computed by hand. The
  // four-phase values, kept so the deltas are legible rather than asserted:
  // seeking 904, queuing 511, using 542, leaving 452, interrupted 183.
  ENTRIES: Object.freeze({
    seeking: 872,
    queuing: 457,
    using: 413,
    leaving: 326,
    interrupted: 270,
  }),
  // Four-phase values: 'target-removed' 150, 'target-moved' 33, and
  // 'route-blocked' did not exist. Instrumented on the shipped four-phase
  // sweep, the branch that now raises 'route-blocked' fired 0 times across all
  // 66240 observations, which is why the fifth phase exists.
  CAUSES: Object.freeze({
    'target-removed': 215,
    'target-moved': 39,
    'route-blocked': 16,
  }),
  // The source arms of the beat, measured for the first time this round.
  SOURCES: Object.freeze({
    seeking: 99,
    queuing: 99,
    using: 72,
  }),
  STRANDED_OBSERVATIONS: 18,
  STRANDED_MEMBERS: 2,
  LONGEST_STILL: 57,
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

  it('classifies the two guards apart from the twelve knobs', () => {
    const block = Object.keys(T).filter((key) => key.startsWith('FLOOR_SIM_'));
    // 13 -> 25: the `FLOOR_SIM_` prefix is TWO blocks since Phase 3's render
    // half landed — thirteen entries this module reads, denominated in sim
    // ticks and grid tiles, and the rest the renderer reads, denominated in
    // milliseconds, pixels and draw fractions. `empireTuning.ts` says exactly
    // that in the two block comments ("Read by `floorSim.ts` only", "Read by
    // `FloorGrid.tsx` only"), and the partition below is what holds that
    // sentence to it rather than leaving it as prose.
    // 25 -> 24: P4b retired the two `using`-pulse knobs and added the
    // renderer-side FLOOR_SIM_USING_ANCHOR_BIAS. Measured off this assertion.
    // 24 -> 25: D2.1B stock plate-changeover duration joined the sim block.
    expect(block.length).toBe(25);
    const guards = block.filter((key) => key.endsWith('BUDGET') || key.endsWith('MAX_RUN_TICKS'));
    expect(guards.sort()).toEqual(['FLOOR_SIM_MAX_RUN_TICKS', 'FLOOR_SIM_ROUTE_VISIT_BUDGET']);
    // And both guards are on the sim's side of the split, which is what makes
    // the sentence above about them rather than about a knob that happens to
    // be spelled like one.
    for (const guard of guards) expect(readByTheSim).toContain(guard);
  });

  it('splits the FLOOR_SIM_ prefix into the sim block and the renderer block, in both directions', () => {
    // WHAT THIS ADDS OVER THE COUNT ABOVE. A count of 25 is satisfied by any
    // 25 keys, including a renderer knob the sim started reading — which is
    // precisely the widening `empireTuning.ts`'s block comments promise cannot
    // happen. This reads BOTH modules' source and asserts the prefix
    // partitions exactly: every entry is read by one of the two and never by
    // both, with each side's count pinned.
    //
    // Its limit, stated because the mechanism does not reach past it: this is
    // a dotted-source scan of two files, so an alias or a computed access
    // reads keys it cannot see. That route already has a catcher on the sim's
    // side — the alias-count and bracket-access bans in `reads exactly the
    // sixteen tuning entries it declares` below — and none on the renderer's,
    // which is stated here rather than implied away.
    const block = Object.keys(T).filter((key) => key.startsWith('FLOOR_SIM_'));
    const readByTheRenderer = block.filter((key) => namedIn(FLOOR_GRID_SOURCE).has(key));
    expect(readByTheSim.length).toBe(14);
    // 12 -> 11: P4b — the two pulse knobs left the renderer block and the
    // anchor-bias table joined it. Measured off this assertion.
    expect(readByTheRenderer.length).toBe(11);
    expect([...readByTheSim, ...readByTheRenderer].sort()).toEqual([...block].sort());
    for (const key of readByTheSim) {
      expect(readByTheRenderer, `${key} is read by both modules`).not.toContain(key);
    }
    // The empty-domain guard: a scan that had stopped matching anything would
    // make both lists empty and the disjointness above vacuous.
    expect(namedIn(FLOOR_GRID_SOURCE).size).toBeGreaterThan(0);
    expect(namedIn(FLOOR_SIM_SOURCE).size).toBeGreaterThan(0);
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

  it('reaches all three interruption causes and pins each one', () => {
    const reached = FLOOR_SIM_INTERRUPTIONS.filter((cause) => SWEEP.causes[cause] > 0);
    expect([...reached].sort()).toEqual([...FLOOR_SIM_INTERRUPTIONS].sort());
    let pinned = 0;
    let total = 0;
    for (const cause of FLOOR_SIM_INTERRUPTIONS) {
      expect(SWEEP.causes[cause], cause).toBe(SWEEP_CENSUS.CAUSES[cause]);
      pinned += 1;
      total += SWEEP.causes[cause];
    }
    expect(pinned).toBe(3);
    expect(pinned).toBe(FLOOR_SIM_INTERRUPTIONS.length);
    // The causes sum to the entries into the beat, so a cause going unrecorded
    // is red here as well as on its own count.
    expect(total).toBe(SWEEP.entries.interrupted);
  });

  it('reaches every declared source arm of the beat and pins each one', () => {
    // The census one dimension over. `applyInterruptions` admits three states
    // and the destination census says nothing about which of them a drive
    // reached; before this existed, nothing here drove an interruption out of
    // `seeking` at all, while a test title claimed all three.
    const reached = FLOOR_SIM_INTERRUPTIBLE_STATES.filter((state) => SWEEP.sources[state] > 0);
    expect([...reached].sort()).toEqual([...FLOOR_SIM_INTERRUPTIBLE_STATES].sort());
    expect(Object.keys(SWEEP.sources).sort()).toEqual([...FLOOR_SIM_INTERRUPTIBLE_STATES].sort());
    let pinned = 0;
    let total = 0;
    for (const state of FLOOR_SIM_INTERRUPTIBLE_STATES) {
      expect(SWEEP.sources[state], state).toBe(SWEEP_CENSUS.SOURCES[state]);
      pinned += 1;
      total += SWEEP.sources[state];
    }
    expect(pinned).toBe(3);
    // Every entry into the beat came out of one of the three declared source
    // arms, so a fourth source would show up as a shortfall here.
    expect(total).toBe(SWEEP.entries.interrupted);
    // And the states this list leaves out are the two that hold no station.
    expect(
      FLOOR_SIM_MEMBER_STATES.filter(
        (state) => !FLOOR_SIM_INTERRUPTIBLE_STATES.includes(state as FloorSimInterruptibleState),
      ).sort(),
    ).toEqual(['interrupted', 'leaving']);
  });

  it('pins how many observations found a member walled off from every station', () => {
    // The counter that did not exist. A member sealed into a pocket keeps
    // walking, so nothing else in this file can tell it apart from a member
    // walking somewhere; `strandedAt` is the state that can, and this is the
    // census of it over the main sweep's own floors.
    expect(SWEEP.strandedObservations).toBe(SWEEP_CENSUS.STRANDED_OBSERVATIONS);
    expect(SWEEP.strandedMembers).toBe(SWEEP_CENSUS.STRANDED_MEMBERS);
    // WHAT THIS NUMBER IS AND IS NOT. Whether a roster member happens to be
    // standing inside the pocket when `route-cut` seals it is not something a
    // layout decides, so this count is a fact about these four floors and these
    // four seeds rather than a domain that was designed to reach the arm. The
    // domain that WAS designed to reach it is the sealed-pocket sweep below,
    // where the member is hand-placed inside the pocket on every rung.
    expect(SEALED.stranded).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2b. THE SEALED POCKET — a member with nothing it can reach
// ---------------------------------------------------------------------------

describe('a member sealed away from every station reacts once and then paces', () => {
  it('walked a non-empty domain, so the two readings below are measuring something', () => {
    expect(SEALED.runs).toBe(SEALED_CENSUS.RUNS);
    expect(SEALED.runs).toBe(RUNGS.length * SEALED_SWEEP.SEEDS.length);
    expect(SEALED.observations).toBe(SEALED_CENSUS.OBSERVATIONS);
    expect(SEALED.observations).toBe(
      RUNGS.length * SEALED_SWEEP.SEEDS.length * SEALED_SWEEP.TICKS,
    );
    expect(SEALED_CONTROL.observations).toBe(SEALED.observations);
  });

  it('finds stations on the floor and no route to any of them, on every rung', () => {
    // Both halves matter. Stations exist — so this is not the empty-garage case
    // that legitimately signals nothing — and none of them is reachable.
    expect(SEALED.stations).toBe(SEALED_CENSUS.SEALED.STATIONS);
    expect(SEALED.stations).toBeGreaterThan(0);
    expect(SEALED.claims).toBe(SEALED_CENSUS.SEALED.CLAIMS);
    expect(SEALED.claims).toBe(0);
    expect(SEALED.stranded).toBe(SEALED_CENSUS.SEALED.STRANDED);
  });

  it('holds up exactly one route-blocked reaction per run rather than beating on a loop', () => {
    // THE DECISION, PINNED. A member that armed the beat on every tick it found
    // nothing reachable would stand still for the rest of the run, which is the
    // freeze this module is written against; one that armed it never would be
    // the silent version the round before this one shipped. It arms once, on
    // the tick it first finds itself cut off, and then paces.
    expect(SEALED.reactions).toBe(SEALED_CENSUS.SEALED.REACTIONS);
    expect(SEALED.reactions).toBe(SEALED.runs);
  });

  it('paces a box rather than freezing, and the box is the pocket', () => {
    // The liveness half, and the reason it is not enough on its own: the member
    // really is still moving, which is exactly why `longestStill` and the
    // walkable-neighbour enumeration were both green on this case.
    expect(SEALED.cells).toBe(SEALED_CENSUS.SEALED.CELLS);
    expect(SEALED.cells).toBeGreaterThan(SEALED.runs);
    expect(SEALED.states).toEqual(['interrupted', 'seeking']);
  });

  it('reads differently from the same pocket with one wall piece taken away', () => {
    // The control. One `LayoutRow` removed and nothing else changed: the member
    // walks out, claims, and is never stranded. A subject-and-control pair whose
    // numbers matched would mean the seal is doing nothing.
    expect(SEALED_CONTROL.stations).toBe(SEALED_CENSUS.CONTROL.STATIONS);
    expect(SEALED_CONTROL.stranded).toBe(SEALED_CENSUS.CONTROL.STRANDED);
    expect(SEALED_CONTROL.stranded).toBe(0);
    expect(SEALED_CONTROL.reactions).toBe(SEALED_CENSUS.CONTROL.REACTIONS);
    expect(SEALED_CONTROL.reactions).toBe(0);
    expect(SEALED_CONTROL.claims).toBe(SEALED_CENSUS.CONTROL.CLAIMS);
    expect(SEALED_CONTROL.claims).toBeGreaterThan(0);
    expect(SEALED_CONTROL.cells).toBe(SEALED_CENSUS.CONTROL.CELLS);
    expect(SEALED_CONTROL.cells).toBeGreaterThan(SEALED.cells);
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
    // `mats` is 3x3 at (5,3), so (5,4) is inside it. (4,3) overlaps the
    // opening bench layout Stage C.1b seeds onto every floor.
    const inside: GridPosition = { x: 5, y: 4 };
    const built = contextFor(
      rung,
      floorFrom(rung, [['mats', { x: 5, y: 3 }] as LayoutRow]),
    );
    const before = stateOf(1, [memberAt(0, 'casual', inside)]);
    expect(blockedCells(clear).has(cellKey(inside))).toBe(false);
    expect(blockedCells(built).has(cellKey(inside))).toBe(true);
    const after = stepFloorSim(before, built);
    const moved = after.members[0] as FloorSimMember;
    expect(blockedCells(built).has(cellKey(moved.cell))).toBe(false);
    expect(moved.cell).toEqual({ x: 4, y: 4 });
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
    // 5949 -> 7381: the sweep grew a fifth phase, so this enumerates a fifth
    // floor per rung. Read from this pin's own failure value.
    expect(inspected).toBe(7379);
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
      capability: stockStationCapability(),
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

  it('sends a member whose route is walled off into the beat, naming route-blocked', () => {
    // The case GDD §5.13 does not name: the target has NEITHER moved NOR been
    // removed — it is still on the floor with a free cell beside it — but other
    // equipment has walled the member off from it. Distinguishing that from a
    // removal is the whole point of the fixture, and the assertions below say
    // so: the station is still reported, and the cause names the route.
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
      floor: floorFrom(rung, [far], false),
      barbellOwned: [],
      sessionOwned: owned,
      capability: stockStationCapability(),
    };
    const sealed: FloorSimContext = { ...open, floor: floorFrom(rung, wall, false) };

    let at = stepFloorSim(stateOf(2, [memberAt(0, 'casual', { x: 0, y: 0 })]), open);
    expect((at.members[0] as FloorSimMember).target).toEqual({ kind: 'session', item: 'mats' });

    // The station is still there — this is not a removal.
    expect(floorStations(sealed).some((station) => station.ref.kind === 'session' && station.ref.item === 'mats')).toBe(true);
    const after = stepFloorSim(at, sealed);
    const walker = after.members[0] as FloorSimMember;
    expect(walker.state).toBe('interrupted');
    expect(walker.interruptedBy).toBe('route-blocked');
    expect(walker.target).toBe(null);
    // Not stranded: this pocket is sealed against the mats and is NOT sealed
    // against the two items that seal it, and a wall a member can touch is a
    // wall a member can use. So there is something in reach, and the member is
    // route-blocked rather than cut off from everything.
    expect(walker.strandedAt).toBe(null);

    // WHAT IT DOES AFTERWARDS, STATED THE WAY THE DRIVE ACTUALLY RUNS IT rather
    // than the way the previous version of this comment described it. That
    // version said the member "drops the target and walks a wander leg
    // instead", and its own assertions three lines below showed it re-claiming
    // a wall piece on the very next tick and never wandering at all. The beat
    // resolves back to seeking on the tuned tick and the member then claims
    // `specialty-bars`, which is the fallback doing its job.
    let moving = after;
    const visited = new Set<string>([cellKey(walker.cell)]);
    const states = new Set<string>([walker.state]);
    let firstClaimAt: number | null = null;
    for (let step = 0; step < T.FLOOR_SIM_WANDER_HOLD_TICKS * 4; step += 1) {
      moving = stepFloorSim(moving, sealed);
      const member = moving.members[0] as FloorSimMember;
      visited.add(cellKey(member.cell));
      states.add(member.state);
      expect(member.strandedAt, `step ${step}`).toBe(null);
      if (member.target !== null && firstClaimAt === null) firstClaimAt = step;
    }
    const reclaimed = (moving.members[0] as FloorSimMember).target;
    expect(reclaimed).not.toBe(null);
    expect((reclaimed as { readonly item: string }).item).toBe('cables');
    // The beat runs first, so the claim lands after it rather than on the next
    // tick — the exact number, so a beat length change is visible here.
    expect(firstClaimAt).toBe(8);
    expect([...states].sort()).toEqual(['interrupted', 'seeking', 'using']);
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
    floor: floorFrom('garage', [['mats', position] as LayoutRow], false),
    barbellOwned: [],
    sessionOwned: ['mats'],
    capability: stockStationCapability(),
  };
}

/**
 * A member holding a reachable target, and the same floor with that target
 * walled off — the `route-blocked` disturbance, built once and reused.
 *
 * The station stays exactly where it is in both, which is what makes this a
 * lost route rather than a move or a removal.
 */
const walledOff = Object.freeze({
  context: ((): FloorSimContext => {
    const rung: LadderRung = 'storage-unit';
    return {
      rung,
      floor: floorFrom(
        rung,
        [
          ['mats', { x: 9, y: 6 }] as LayoutRow,
          ['specialty-bars', { x: 2, y: 0 }] as LayoutRow,
          ['cables', { x: 0, y: 2 }] as LayoutRow,
        ],
        false,
      ),
      barbellOwned: [],
      sessionOwned: ['mats', 'specialty-bars', 'cables'],
      capability: stockStationCapability(),
    };
  })(),
  before: (): FloorSimState => {
    const rung: LadderRung = 'storage-unit';
    const open: FloorSimContext = {
      rung,
      floor: floorFrom(rung, [['mats', { x: 9, y: 6 }] as LayoutRow], false),
      barbellOwned: [],
      sessionOwned: ['mats', 'specialty-bars', 'cables'],
      capability: stockStationCapability(),
    };
    return stepFloorSim(stateOf(2, [memberAt(0, 'casual', { x: 0, y: 0 })]), open);
  },
});

describe('a target that is moved or removed produces the beat, and the beat always ends', () => {
  const laid: GridPosition = { x: 5, y: 3 };
  const settled = (): FloorSimState => {
    const context = draggableGarage(laid);
    let at = createFloorSimState(context, 5);
    for (let step = 0; step < 30; step += 1) at = stepFloorSim(at, context);
    return at;
  };

  it('drives an interruption out of each of the three interruptible source states', () => {
    // THE TITLE THIS REPLACES CLAIMED COVERAGE THE BODY DID NOT HAVE. It
    // asserted that the settled fixture holds `queuing` and `using` members,
    // then built a third member, checked it was `seeking` with a target, and
    // never disturbed it — so no interruption was ever driven out of `seeking`
    // anywhere in this file, while the title said three.
    //
    // Each arm here is driven to the interruption and the resulting cause is
    // read, so the claim and the assertions are the same statement.
    const at = settled();
    const settledStates = new Set(at.members.map((member) => member.state));
    expect([...settledStates].sort()).toEqual(['queuing', 'using']);
    const removed = { ...draggableGarage(laid), floor: createFloorState('garage') };
    const disturbed = stepFloorSim(at, removed);
    const sourcesDriven = new Set<FloorSimInterruptibleState>();
    for (const member of at.members) {
      const after = disturbed.members[member.index] as FloorSimMember;
      expect(after.state, `member ${member.index}`).toBe('interrupted');
      sourcesDriven.add(member.state as FloorSimInterruptibleState);
    }
    expect([...sourcesDriven].sort()).toEqual(['queuing', 'using']);

    // `seeking` needs its own drive, because the settled fixture holds nobody
    // in it: a member that has just claimed from across the room, whose target
    // is then removed under it.
    const fresh = stepFloorSim(
      stateOf(5, [memberAt(0, 'casual', { x: 0, y: 5 })]),
      draggableGarage(laid),
    );
    const seeker = fresh.members[0] as FloorSimMember;
    expect(seeker.state).toBe('seeking');
    expect(seeker.target).not.toBe(null);
    const seekerAfter = stepFloorSim(fresh, removed).members[0] as FloorSimMember;
    expect(seekerAfter.state).toBe('interrupted');
    expect(seekerAfter.interruptedBy).toBe('target-removed');
    sourcesDriven.add('seeking');
    expect([...sourcesDriven].sort()).toEqual([...FLOOR_SIM_INTERRUPTIBLE_STATES].sort());
    expect(sourcesDriven.size).toBe(3);
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

  it('resolves the beat to seeking on exactly the tuned tick, from all three causes', () => {
    // EXACT, not eventual. The beat is armed on the interrupting tick and that
    // same tick's advance pass decrements it, so a member is in the beat for
    // exactly `FLOOR_SIM_INTERRUPTED_BEAT_TICKS` ticks counting the one that
    // armed it — and is `seeking` on the tick after that.
    //
    // The third cause needs its own fixture rather than the settled garage: a
    // route is lost by walling a member off from a station that stays exactly
    // where it is, which is a different disturbance from a drag.
    const causes = [
      [
        'target-removed',
        settled,
        { ...draggableGarage(laid), floor: createFloorState('garage') },
      ],
      ['target-moved', settled, draggableGarage({ x: 1, y: 3 })],
      ['route-blocked', walledOff.before, walledOff.context],
    ] as const;
    let driven = 0;
    for (const [cause, start, disturbed] of causes) {
      let at = stepFloorSim(start(), disturbed);
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
    expect(driven).toBe(3);
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
    // the speed jitter, and it has real resolution — 5, 5 and 4 of 8 rather
    // than the ceiling of 8. A noise knob turned to zero collapses all three
    // to the control's 0, which is exactly what this exists to catch.
    const context = contextFor('storage-unit', phaseFloors('storage-unit')[0] as FloorState);
    const firstTargets = (seed: number): readonly string[] =>
      runFloorSim(createFloorSimState(context, seed), context, 1).members.map((member) =>
        member.target === null ? 'none' : floorStationRefKey(member.target),
      );
    const base = firstTargets(FLOOR_SIM_SWEEP.SEEDS[0] as number);
    expect(base.length).toBe(8);
    expect(base.filter((choice) => choice === 'none').length).toBe(0);
    const moved = (seed: number): number =>
      firstTargets(seed).filter((choice, index) => choice !== base[index]).length;
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[0] as number)).toBe(0);
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[1] as number)).toBe(5);
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[2] as number)).toBe(5);
    expect(moved(FLOOR_SIM_SWEEP.SEEDS[3] as number)).toBe(4);
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
      capability: stockStationCapability(),
    };
    expect(floorStations(context).length).toBe(7);
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
        return target === null ? 'none' : floorStationRefKey(target);
      });
    const control = choicesFor('casual');
    expect(control.length).toBe(12);
    expect(control.filter((choice) => choice === 'none').length).toBe(0);
    const disagreements = (type: MemberType): number =>
      choicesFor(type).filter((choice, index) => choice !== control[index]).length;
    // The control first, so a reader sees what zero means here.
    expect(disagreements('casual')).toBe(0);
    expect({
      bodybuilder: disagreements('bodybuilder'),
      powerlifter: disagreements('powerlifter'),
      athlete: disagreements('athlete'),
      'serious-lifter': disagreements('serious-lifter'),
    }).toEqual({
      bodybuilder: 8,
      powerlifter: 4,
      athlete: 2,
      'serious-lifter': 1,
    });
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
    // 16 -> 20: a fifth phase per rung.
    expect(checked).toBe(20);
  });

  it('gives every station on every registered rung its own queue cells too', () => {
    // GAP THE `use cell` CHECK ABOVE DOES NOT COVER, and it was open: queue
    // cells used to be reserved only against the stations already processed, so
    // station A's queue slot could be station B's use cell whenever B came
    // second. Measured on the four-phase sweep this file shipped last round,
    // before the fix: 18 such collisions across the 92 stations those floors
    // posted, `fixed:power-bar`'s queue cell at (2,2) against
    // `fixed:comp-plates`'s use cell on every rung and every phase. Two bodies
    // on one tile, on the screen whose gate is whether this reads as real
    // behaviour. Those two numbers are history — the sweep has since grown a
    // phase and two layouts — and the counts this check pins below are what a
    // run today re-derives.
    let collisions = 0;
    let cellsChecked = 0;
    let stationsChecked = 0;
    for (const rung of RUNGS) {
      for (const [phase, floor] of phaseFloors(rung).entries()) {
        const context = contextFor(rung, floor);
        const stations = floorStations(context);
        const spokenFor = new Map<string, string>();
        for (const station of stations) {
          spokenFor.set(cellKey(station.useCell), `use:${floorStationRefKey(station.ref)}`);
        }
        for (const station of stations) {
          stationsChecked += 1;
          for (const cell of station.queueCells) {
            cellsChecked += 1;
            const held = spokenFor.get(cellKey(cell));
            const mine = `queue:${floorStationRefKey(station.ref)}`;
            if (held !== undefined) {
              collisions += 1;
              expect(held, `${rung} phase ${phase} ${cellKey(cell)}`).toBe(mine);
            }
            spokenFor.set(cellKey(cell), mine);
          }
        }
      }
    }
    expect(collisions).toBe(0);
    // Counts rather than bounds, so an empty enumeration reports itself.
    expect(stationsChecked).toBe(91);
    expect(cellsChecked).toBe(267);
  });

  it('orders every queue nearest-first from its own use cell', () => {
    // The claim `FloorStation.queueCells` makes about itself, which nothing
    // used to check — and which was FALSE while a spoken cell was merely sorted
    // last instead of dropped, because an unspoken far cell then preceded a
    // spoken near one. The oracle is an independent breadth-first search over
    // the same blocked set, written here rather than read out of the module.
    let inspected = 0;
    let queues = 0;
    for (const rung of RUNGS) {
      for (const floor of phaseFloors(rung)) {
        const context = contextFor(rung, floor);
        const grid = floorGridSize(rung);
        const blocked = blockedCells(context);
        for (const station of floorStations(context)) {
          const distance = new Map<string, number>([[cellKey(station.useCell), 0]]);
          let frontier: GridPosition[] = [station.useCell];
          while (frontier.length > 0) {
            const next: GridPosition[] = [];
            for (const at of frontier) {
              const here = distance.get(cellKey(at)) as number;
              for (const step of [
                { x: 0, y: -1 },
                { x: 1, y: 0 },
                { x: 0, y: 1 },
                { x: -1, y: 0 },
              ]) {
                const to: GridPosition = { x: at.x + step.x, y: at.y + step.y };
                if (to.x < 0 || to.y < 0 || to.x >= grid.width || to.y >= grid.height) continue;
                if (blocked.has(cellKey(to))) continue;
                if (distance.has(cellKey(to))) continue;
                distance.set(cellKey(to), here + 1);
                next.push(to);
              }
            }
            frontier = next;
          }
          const steps = station.queueCells.map((cell) => distance.get(cellKey(cell)));
          for (const value of steps) {
            expect(value, `${rung} ${floorStationRefKey(station.ref)}`).not.toBe(undefined);
            inspected += 1;
          }
          for (let k = 1; k < steps.length; k += 1) {
            expect(
              (steps[k] as number) >= (steps[k - 1] as number),
              `${rung} ${floorStationRefKey(station.ref)} slot ${k}`,
            ).toBe(true);
          }
          queues += 1;
        }
      }
    }
    expect(queues).toBe(91);
    expect(inspected).toBe(267);
  });

  it('posts every station on every registered rung after the two-pass reservation', () => {
    // Making a spoken cell ineligible rather than merely last can drop a
    // station that is left with nowhere to queue. This is the census that says
    // the shipped rungs lose none: the station count per rung and phase, pinned
    // against the items each floor actually holds.
    const counted: number[] = [];
    for (const rung of RUNGS) {
      for (const [phase, floor] of phaseFloors(rung).entries()) {
        const context = contextFor(rung, floor);
        const stations = floorStations(context);
        const drawn =
          fixedFloorFurniture(context.barbellOwned).length + floorLayout(context.floor).length;
        expect(stations.length, `${rung} phase ${phase}`).toBeLessThanOrEqual(drawn);
        counted.push(stations.length);
      }
    }
    // Every count read from this pin's own failure value. Twenty entries, four
    // rungs by five phases, in `RUNGS` x `PHASES` order.
    //
    // WHAT THESE NUMBERS SAY, AND IT IS THE POINT OF PINNING THEM RATHER THAN
    // BOUNDING THEM. On the four shipped sweep layouts every drawn item posts a
    // station: garage 5 = three fixed plus two placed, storage-unit 6 = three
    // plus three, and so on down each rung's column. The `route-cut` phase is
    // where a drop shows, and garage's 5-of-6 is a real one: that floor's
    // top-right corner is seven walkable cells with three stations competing for
    // them, so `specialty-bars` is left with nowhere to queue and is dropped the
    // same way a station with no walkable approach is. The pocket's own station
    // survives, which is what the phase is for.
    expect(JSON.stringify(counted)).toBe('[3,3,2,3,1,4,4,3,5,1,7,7,6,8,1,8,8,7,9,1]');
  });

  it('puts every use cell and queue cell on a free tile beside the equipment', () => {
    let inspected = 0;
    for (const rung of RUNGS) {
      const context = contextFor(rung, phaseFloors(rung)[0] as FloorState);
      const blocked = blockedCells(context);
      const grid = floorGridSize(rung);
      for (const station of floorStations(context)) {
        expect(blocked.has(cellKey(station.useCell)), `${rung} ${floorStationRefKey(station.ref)}`).toBe(false);
        // Adjacent to the footprint, not merely somewhere on the floor.
        const touching =
          station.useCell.x >= station.position.x - 1 &&
          station.useCell.x <= station.position.x + station.footprint.width &&
          station.useCell.y >= station.position.y - 1 &&
          station.useCell.y <= station.position.y + station.footprint.height;
        expect(touching, `${rung} ${floorStationRefKey(station.ref)} use cell adjacency`).toBe(true);
        expect(station.queueCells.length).toBeGreaterThan(0);
        expect(station.queueCells.length).toBeLessThanOrEqual(T.FLOOR_SIM_QUEUE_MAX_LENGTH);
        for (const cell of station.queueCells) {
          expect(blocked.has(cellKey(cell)), `${rung} ${floorStationRefKey(station.ref)} queue cell`).toBe(false);
          expect(cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height).toBe(
            true,
          );
          expect(cellKey(cell)).not.toBe(cellKey(station.useCell));
        }
        inspected += 1;
      }
    }
    // 28 -> 30: strip-mall-unit and warehouse each gained a corner item, so
    // each posts one more station on its laid-out floor.
    expect(inspected).toBe(22);
  });

  it('reports the Competition Bench Bay and the placed session items, and nothing else', () => {
    const rung: LadderRung = 'storage-unit';
    const context = contextFor(rung, phaseFloors(rung)[0] as FloorState);
    const refs = floorStations(context).map((station) => floorStationRefKey(station.ref));
    expect(refs).toEqual([
      'training:competition-bench-bay',
      'session:bike',
      'session:mats',
      'session:belts',
    ]);
    // An item that is owned but not placed has no station — placement is what
    // puts something on the floor, which is `floor.ts`'s own rule. Starting
    // Barbell still assembles the bay on the opening furniture layout.
    const unplaced = floorStations({ ...context, floor: createFloorState(rung) });
    expect(unplaced.map((station) => floorStationRefKey(station.ref))).toEqual([
      'training:competition-bench-bay',
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
      capability: stockStationCapability(),
    };
    expect(floorLayout(sealed).map((row) => row.item)).toEqual([
      'foam-rollers',
      'wrist-wraps',
      'belts',
    ]);
    const reported = floorStations(context).map((station) => floorStationRefKey(station.ref));
    expect(reported).not.toContain('session:foam-rollers');
    // Its two neighbours are still targetable, so the drop is about this item
    // and not about the whole corner.
    expect(reported).toContain('session:wrist-wraps');
    expect(reported).toContain('session:belts');
  });
});

// ---------------------------------------------------------------------------
// 10. What this module is allowed to see
// ---------------------------------------------------------------------------

/**
 * The context's key set, stated as a TYPE-LEVEL requirement rather than read
 * off a value.
 *
 * The check below used to be `Object.keys` over a value `contextFor` built,
 * which sees a REQUIRED sixth field — the value could not be constructed
 * without one — and is blind to an OPTIONAL one, which is the shape a widening
 * would most plausibly take. `keyof` includes optional keys, so this literal
 * stops compiling the moment a sixth field of either kind is declared.
 *
 * Both mutants were run rather than argued, and the interesting one is the
 * second. `readonly reputation: number` on `FloorSimContext` gives `npx tsc
 * --noEmit` exit 2 with 21 errors across this file and
 * `empireForbiddenOutput.test.ts`, because no fixture anywhere can build the
 * context any more. `readonly reputation?: number` gives exit 2 with exactly
 * ONE error, and it is this literal — "Property 'reputation' is missing in type
 * 'Readonly<{ rung: true; floor: true; barbellOwned: true; sessionOwned: true;
 * capability: true; }>' but required in type 'Readonly<Record<keyof FloorSimContext, true>>'".
 *
 * Under that same optional mutant `npx vitest run src/empire/floorSim.test.ts`
 * is 58 of 58 green, which is the honest statement of where the catcher lives:
 * it is `tsc`, and a run of this file alone does not see it.
 *
 * Its own limit, and the catcher for it: this says which keys the type has and
 * nothing about what the module reads out of `EMPIRE_TUNING`, which is the
 * other way an economic quantity could arrive. That is the next check.
 */
const CONTEXT_KEYS: Readonly<Record<keyof FloorSimContext, true>> = Object.freeze({
  rung: true,
  floor: true,
  barbellOwned: true,
  sessionOwned: true,
  capability: true,
});

/**
 * Every `EMPIRE_TUNING` entry `floorSim.ts` is allowed to read, as a set the
 * scan below joins against in both directions.
 *
 * Fifteen entries: thirteen `FLOOR_SIM_` knobs and guards, plus §5.6's two
 * published affinity tables. `MEMBER_TYPE_REPUTATION_PER_MEMBER_PER_DAY` is the
 * one this piece's brief named, and it is refused by not being on this list
 * rather than by being named on a ban list, which is the difference between a
 * closed set and a list of the routes somebody thought of.
 */
const TUNING_READS: readonly string[] = Object.freeze([
  'FLOOR_SIM_AFFINITY_PULL_TILES',
  'FLOOR_SIM_INTERRUPTED_BEAT_TICKS',
  'FLOOR_SIM_LEAVING_TICKS',
  'FLOOR_SIM_MAX_RUN_TICKS',
  'FLOOR_SIM_QUEUE_AVERSION_TILES',
  'FLOOR_SIM_QUEUE_MAX_LENGTH',
  'FLOOR_SIM_ROUTE_VISIT_BUDGET',
  'FLOOR_SIM_SPEED_JITTER_FRACTION',
  'FLOOR_SIM_STATION_CHANGEOVER_TICKS',
  'FLOOR_SIM_STEP_PROGRESS_PER_TICK',
  'FLOOR_SIM_TARGET_NOISE_TILES',
  'FLOOR_SIM_USE_TICKS_BY_TYPE',
  'FLOOR_SIM_USE_TICKS_SPREAD',
  'FLOOR_SIM_WANDER_HOLD_TICKS',
  'MEMBER_TYPE_BARBELL_AFFINITY',
  'MEMBER_TYPE_ITEM_AFFINITY',
]);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FLOOR_SIM_SOURCE = readFileSync(path.join(HERE, 'floorSim.ts'), 'utf8');
const FLOOR_GRID_SOURCE = readFileSync(path.join(HERE, 'FloorGrid.tsx'), 'utf8');

/**
 * Which `EMPIRE_TUNING` entries a body of source actually reads, comments
 * stripped first — the same reading `reads exactly the sixteen tuning entries
 * it declares` does, lifted out so the sim's source and the renderer's are
 * scanned by one function rather than two copies of one.
 */
function namedIn(source: string): ReadonlySet<string> {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const named = new Set<string>();
  for (const match of code.matchAll(/EMPIRE_TUNING\.([A-Z][A-Z0-9_]*)/g)) {
    named.add(match[1] as string);
  }
  return named;
}

/** The `FLOOR_SIM_` entries `floorSim.ts` itself reads. */
const readByTheSim: readonly string[] = Object.keys(T)
  .filter((key) => key.startsWith('FLOOR_SIM_'))
  .filter((key) => namedIn(FLOOR_SIM_SOURCE).has(key));
const EMPIRE_TUNING_SOURCE = readFileSync(path.join(HERE, 'empireTuning.ts'), 'utf8');

describe('the sim reads presentation inputs and nothing economic', () => {
  it('carries exactly the five presentation inputs on its context', () => {
    // Two directions and two mechanisms. The runtime half says the value
    // `contextFor` builds carries these five keys and no others; the type half
    // is `CONTEXT_KEYS` above, whose catcher is `tsc` rather than vitest and
    // which is what covers an optional sixth field.
    const context = contextFor('garage', createFloorState('garage'));
    expect(Object.keys(CONTEXT_KEYS).sort()).toEqual([
      'barbellOwned',
      'capability',
      'floor',
      'rung',
      'sessionOwned',
    ]);
    expect(Object.keys(context).sort()).toEqual(Object.keys(CONTEXT_KEYS).sort());
    expect(Object.keys(CONTEXT_KEYS).length).toBe(5);
  });

  it('reads exactly the sixteen tuning entries it declares', () => {
    // A set equality over the tuning keys this module's own source names, in
    // both directions, so reading a new entry is a red line somebody looks at
    // rather than a quiet widening.
    // Comments stripped first, the same way `empireCore.test.ts`'s import fence
    // strips them: prose in this module's header names `EMPIRE_TUNING.KEY` as a
    // shape, and a scan that counts that is reading documentation rather than
    // code.
    const code = FLOOR_SIM_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const named = new Set<string>();
    for (const match of code.matchAll(/EMPIRE_TUNING\.([A-Z][A-Z0-9_]*)/g)) {
      named.add(match[1] as string);
    }
    expect([...named].sort()).toEqual([...TUNING_READS].sort());
    expect(named.size).toBe(16);
    // And the keys are real, so a typo cannot pass by matching a list entry
    // that names nothing.
    for (const key of TUNING_READS) {
      expect(Object.prototype.hasOwnProperty.call(T, key), key).toBe(true);
    }
    // THE TWO ROUTES PAST A DOTTED SCAN, EACH WITH ITS OWN CATCHER. A computed
    // `EMPIRE_TUNING[key]` access matches no dotted pattern, so bracket access
    // into that identifier is banned outright. An alias — `const X =
    // EMPIRE_TUNING` and then `X.WHATEVER` — would read keys this scan never
    // sees, so the total number of times the identifier appears in the file is
    // pinned against the dotted matches plus its one import.
    expect(code.match(/EMPIRE_TUNING\s*\[/g)).toBe(null);
    const occurrences = code.match(/EMPIRE_TUNING/g) ?? [];
    const dotted = code.match(/EMPIRE_TUNING\.[A-Z][A-Z0-9_]*/g) ?? [];
    expect(occurrences.length - dotted.length).toBe(1);
    expect(dotted.length).toBe(20);
  });

  it('pins the realised affinity pull in tiles, derived from both published tables', () => {
    // THE KNOB'S OWN COMMENT SAID TEN TILES AND THE FUNCTION'S SAID ROUGHLY
    // FIVE, and the tables say seven. `affinityFor` reads both tables, so the
    // reachable maximum is the maximum over both — 0.7, at
    // `powerlifter.specialty-bars` and `athlete.sled` — and the pull is that
    // times the knob.
    let strongest = 0;
    let strongestName = '';
    let cellsRead = 0;
    for (const type of T.MEMBER_TYPES) {
      const barbell = T.MEMBER_TYPE_BARBELL_AFFINITY[type];
      cellsRead += 1;
      if (barbell > strongest) {
        strongest = barbell;
        strongestName = `barbell:${type}`;
      }
      const items: Readonly<Partial<Record<SessionEquipmentItem, number>>> =
        T.MEMBER_TYPE_ITEM_AFFINITY[type];
      for (const [item, value] of Object.entries(items)) {
        cellsRead += 1;
        if ((value as number) > strongest) {
          strongest = value as number;
          strongestName = `item:${type}.${item}`;
        }
      }
    }
    // Non-vacuity: both tables were really walked.
    expect(cellsRead).toBe(32);
    expect(strongest).toBe(0.7);
    expect(strongestName).toBe('item:powerlifter.specialty-bars');
    expect(T.FLOOR_SIM_AFFINITY_PULL_TILES).toBe(10);
    const realisedTiles = strongest * T.FLOOR_SIM_AFFINITY_PULL_TILES;
    expect(realisedTiles).toBe(7);
    // And the two sentences that got this wrong are read back out of their own
    // source files, so raising an affinity reddens here instead of quietly
    // making both comments wrong a second time. The match COUNT is pinned as
    // well as the presence, because a phrase with more than one witness in a
    // file is a pin that survives the edit it exists to catch.
    const knobClaim = new RegExp(`reads ${realisedTiles} tiles\\s*\\n?\\s*\\*?\\s*nearer`, 'g');
    expect((EMPIRE_TUNING_SOURCE.match(knobClaim) ?? []).length).toBe(1);
    const functionClaim = new RegExp(
      `realise is ${realisedTiles} of its ${T.FLOOR_SIM_AFFINITY_PULL_TILES}`,
      'g',
    );
    expect((FLOOR_SIM_SOURCE.match(functionClaim) ?? []).length).toBe(1);
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
    // 16 -> 18: the two corner items above.
    expect(placed).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// 11. Stage D — Quality / Capacity / Throughput change different sim quantities
// ---------------------------------------------------------------------------

describe('Stage D.1 Q/C/T on the real floor sim', () => {
  const KIT_OWNED: readonly LadderEquipmentItem[] = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);
  const BAY_REF: FloorStationRef = Object.freeze({
    kind: 'training',
    station: 'competition-bench-bay',
  });

  function openingContext(capability: ReturnType<typeof stockStationCapability>): FloorSimContext {
    return {
      rung: 'garage',
      floor: createFloorState('garage'),
      barbellOwned: KIT_OWNED,
      sessionOwned: [],
      capability,
    };
  }

  function purchased(axis: 'quality' | 'capacity' | 'throughput') {
    const outcome = upgradeStation(
      stockStationCapability(),
      'competition-bench-bay',
      axis,
      10_000,
      true,
      true,
    );
    if (outcome.kind !== 'upgraded') throw new Error(`fixture could not purchase ${axis}`);
    return outcome.capability;
  }

  function bayStation(context: FloorSimContext) {
    return floorStations(context).find(
      (row) => row.ref.kind === 'training' && row.ref.station === 'competition-bench-bay',
    );
  }

  it('stock realises exactly one use cell on the garage bay', () => {
    const context = openingContext(stockStationCapability());
    const bay = bayStation(context);
    expect(bay?.useCells.length).toBe(1);
    expect(bay?.useCell).toEqual(bay?.useCells[0]);
  });

  it('the opening garage layout can realise a second physical bench', () => {
    const context = openingContext(purchased('capacity'));
    const bay = bayStation(context);
    expect(bay?.useCells.length).toBe(2);
  });

  it('Capacity realises two use cells from two benches, Quality and Throughput do not', () => {
    expect(bayStation(openingContext(purchased('capacity')))?.useCells.length).toBe(2);
    expect(bayStation(openingContext(purchased('quality')))?.useCells.length).toBe(1);
    expect(bayStation(openingContext(purchased('throughput')))?.useCells.length).toBe(1);
  });

  it('Capacity can seat two members at once; stock cannot', () => {
    const stock = openingContext(stockStationCapability());
    const dual = openingContext(purchased('capacity'));
    const stockRun = runFloorSim(createFloorSimState(stock, 1), stock, 80);
    expect(stationOccupancy(stockRun.members, BAY_REF)).toBeLessThanOrEqual(1);
    let at = createFloorSimState(dual, 1);
    let peak = 0;
    for (let i = 0; i < 80; i += 1) {
      at = stepFloorSim(at, dual);
      peak = Math.max(peak, stationOccupancy(at.members, BAY_REF));
    }
    expect(peak).toBe(2);
  });

  it('Throughput does not shorten the use timer the sim writes; Quality does not either', () => {
    const stock = openingContext(stockStationCapability());
    const fast = openingContext(purchased('throughput'));
    const fancy = openingContext(purchased('quality'));
    const readUseTimer = (context: FloorSimContext): number => {
      let at = createFloorSimState(context, 1);
      for (let i = 0; i < 80; i += 1) {
        at = stepFloorSim(at, context);
        const using = at.members.find((member) => member.state === 'using');
        if (using !== undefined) return using.timer;
      }
      throw new Error('nobody started using');
    };
    const stockTimer = readUseTimer(stock);
    const fastTimer = readUseTimer(fast);
    const fancyTimer = readUseTimer(fancy);
    expect(fancyTimer).toBe(stockTimer);
    expect(fastTimer).toBe(stockTimer);
    expect(fastTimer).toBeGreaterThan(0);
  });
});
