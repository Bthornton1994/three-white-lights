/**
 * floorSim.ts — GDD §5.13 presentation Phase 3: "real pathing, queuing, use,
 * and visible reaction."
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its imports are
 * `./empireCore` (`refuseWith`, the directory's throw gate), `./empireTuning`,
 * `./floor` (the grid, the placements, the fixed furniture and Phase 2's
 * ambient roster), `./ladder` (`LadderRung`, `LadderEquipmentItem`),
 * `./members` (`MemberType`) and `./sessions` (`SessionEquipmentItem`) — the
 * same import-fence discipline every module in this directory carries.
 *
 * A SECOND BUILDER WIRES THIS TO A SCREEN. This file is the machine and
 * nothing else: it renders nothing, it holds no pixels, and it dispatches
 * nothing. `FLOOR_TILE_PIXELS` is the renderer's business, which is why the
 * position model below is a cell plus a fraction of a step rather than a
 * coordinate.
 *
 * ===========================================================================
 * 1. The state machine is GDD §5.13's, transcribed rather than designed here
 * ===========================================================================
 *
 * §5.13's "pathing-interruption fallback" bullet rules it: seeking → queuing →
 * using → leaving, plus one transient sub-state `interrupted`, entered when a
 * member's target equipment is moved or removed mid-approach or mid-use,
 * holding a short fixed beat with a visible reaction cue, then resolving back
 * into seeking. `FLOOR_SIM_MEMBER_STATES` is that list, and it is the alphabet
 * every census in this file joins against.
 *
 * `leaving` means leaving the EQUIPMENT, not leaving the gym. The roster is
 * fixed — Phase 2's `AMBIENT_MEMBER_COUNT_BY_RUNG`, read through
 * `ambientMemberRoster` — so a member that walked out of the building would
 * shrink a population a human already passed the Phase 2 gate on. A finished
 * member therefore steps away from the machine for `FLOOR_SIM_LEAVING_TICKS`
 * and then starts looking again, which is what closes the loop.
 *
 * `interrupted` is transient by construction rather than by convention: its
 * tick decrements a timer and, at zero, writes `seeking` with no branch beside
 * it. THE LIMIT, and it is a real one: nothing in the type stops a future edit
 * re-arming that timer instead of exiting, which would turn the transient state
 * into a permanent one while every signature stayed the same. The check that
 * covers that route is `floorSim.test.ts`'s `resolves the beat to seeking on
 * exactly the tuned tick, from both causes`, which asserts the exit tick
 * exactly rather than eventually.
 *
 * Run, not asserted. Replacing the exit with a re-arm gives four red tests, the
 * named one failing at `target-removed at the exit: expected 'interrupted' to
 * be 'seeking'`, and the sweep's own arm census moving with it (`seeking:
 * expected 708 to be 904`).
 *
 * ===========================================================================
 * 2. Position model: a cell, a next cell, and a fraction of the step
 * ===========================================================================
 *
 * A member holds `cell` (where it is), `next` (the cell it is stepping into,
 * or null when it is standing still) and `progress` in [0, 1) toward `next`.
 * The renderer lerps between the two. The sim advances `progress` by the
 * member's own speed each tick and, when it reaches 1, commits: `cell`
 * becomes `next`, `next` becomes null, `progress` becomes zero. At most one
 * cell per tick moves, which is why `FLOOR_SIM_STEP_PROGRESS_PER_TICK` above 1
 * would be discarded rather than fast — the tuning test pins that bound.
 *
 * A member occupies exactly one cell, and members do not block each other.
 * That is a design decision with a real consequence and it is stated rather
 * than buried: two bodies may share a tile, and a renderer that wants them
 * fanned out does the fanning. It is also what makes the liveness argument in
 * §4 hold, because mutual blocking is where a floor sim grows deadlocks.
 *
 * ===========================================================================
 * 3. Queues are DERIVED, so they cannot drift from the members
 * ===========================================================================
 *
 * There is no queue table in `FloorSimState`. A station's queue is recomputed
 * every tick from the members themselves: everyone whose target is that
 * station and whose state is `seeking` or `queuing`, ordered by
 *
 *   1. whether they have physically reached the queue (`queuedAt` set) —
 *      arrivals rank ahead of members still walking over;
 *   2. among arrivals, the tick they arrived, lowest first;
 *   3. among walkers, the tick they claimed the station, lowest first;
 *   4. member index, lowest first.
 *
 * That ordering IS the fairness rule: FIFO by arrival tick, with claim tick and
 * then member index as the deterministic tie-breaks. `floorSim.test.ts` pins it
 * directly, including the case the first rule exists for — a member that
 * claimed a station from across a warehouse does not hold slot zero against a
 * member standing at the machine, which is what claim-order alone would do and
 * what would read as queue-jumping on screen.
 *
 * The one place within-tick order matters is claiming: two members choosing a
 * target on the same tick would otherwise both read the same queue length. The
 * claim pass therefore runs in member-index order and each claim is visible to
 * the members after it, which is why two members claiming on one tick get the
 * same claim tick and are separated by index. Every other transition is
 * computed against the previous tick's snapshot, so the rest of the tick is
 * order-free.
 *
 * A consequence worth naming because it looks like a bug and is not: occupancy
 * is read from the previous snapshot, so no member can start using a station on
 * the same tick the previous one finished with it. That is the FLOOR on the
 * handover gap, not the gap itself — on a real floor the next member also has
 * to walk in from its queue cell, and `floorSim.test.ts`'s `pins the shortest
 * handover gap the driven fixture produces` measures what that costs rather
 * than letting this paragraph imply one tick.
 *
 * ===========================================================================
 * 4. Liveness — what this file guarantees about "a member does not freeze"
 * ===========================================================================
 *
 * Stated in the mechanism's own terms rather than as an absolute, because the
 * absolute is not true and the bounded version is.
 *
 * What the mechanism gives: every timed state has a strictly decreasing timer
 * and an unconditional exit (`using` → `leaving`, `leaving` → `seeking`,
 * `interrupted` → `seeking`), and `seeking` either walks toward a target, or —
 * when no station is reachable or every station is full — walks a wander leg.
 * So no state waits on a condition that nothing changes, with one exception,
 * named next.
 *
 * The second thing that would wait forever, and it is worth saying how it was
 * found because that is weaker than it sounds: it was reasoned out while
 * writing this paragraph, not caught by a check. No test in this file failed
 * on it, because the check that covers it was written afterwards — a member
 * whose target is still
 * on the floor but whose route to it has been walled off by OTHER equipment.
 * `stepDownField` returns nothing from an unreachable cell, so the member would
 * hold its cell in `seeking`. It drops the target and wanders instead — see the
 * ROUTE LOST comment at the site, which also says why that case does not enter
 * the beat.
 *
 * The exception: `queuing`. A queued member waits for the station ahead of it,
 * and that wait is bounded only because the member ahead is itself in a timed
 * state. If a floor were arranged so that a station's use cell were reachable
 * by the occupant but not by the queue, the queue would still be bounded,
 * because the occupant still finishes and leaves. What is NOT bounded by any
 * argument in this file is a member standing on a cell with no walkable
 * neighbour at all: it holds its cell and its state, which is a freeze. That
 * cannot arise on a registered rung — the fixed furniture and every session
 * footprint leave a connected margin — and the check that covers it is
 * `floorSim.test.ts`'s `has a walkable neighbour under every cell a
 * member can stand on, on every rung and layout`, which enumerates rather than
 * samples.
 *
 * The behavioural half of the same claim is `holds no member in one state on
 * one cell longer than the derived bound`, driven over the sweep, with the
 * bound derived from the tuning values rather than picked — 46 ticks measured
 * against a derived ceiling of 272.
 *
 * ===========================================================================
 * 5. What this module may not read, and why the type is the fence
 * ===========================================================================
 *
 * `FloorSimContext` has exactly four fields: a rung, a `FloorState`, the
 * Barbell-group ownership list and the session-equipment ownership list. There
 * is no wallet here, no Gym Bucks, no chalk, no Total, no e1RM, no streak
 * state, no covered-day concept and — the one this piece's brief called out
 * specifically — no reputation. Phase 2's `ambientMemberRoster` header already
 * says reputation must not grow onto this screen in this phase; this file
 * inherits that unchanged.
 *
 * The fence is the context type plus the import fence, and its limit is that a
 * type cannot stop a future edit from adding a fifth field. The check that
 * covers the limit is `floorSim.test.ts`'s `carries exactly the four
 * presentation inputs on its context`, a set equality over the context's own keys
 * driven from a real value, beside `empireCore.test.ts`'s per-file import
 * fence, which pins this module's six edges exactly. A fifth field or a
 * seventh edge is a red line somebody has to look at.
 *
 * Phase 2 deliberately took no `FloorState`; Phase 3 does, and the widening is
 * the pathing job itself — a member walking to equipment has to know where the
 * equipment is. The widening stops there.
 *
 * ===========================================================================
 * 6. Determinism, and where the variety comes from instead
 * ===========================================================================
 *
 * No `Math.random`, no `Date.now`, no `new Date` — `empireCore.test.ts`'s
 * free-of-dice census over this directory is the catcher, and GDD §12.3's
 * no-gacha rule is the reason: a member behaviour that is randomly rewarding is
 * the shape that rule refuses.
 *
 * Every choice this file makes is a function of the state, the context and a
 * seed carried explicitly in `FloorSimState.seed`. Variety across members comes
 * from a mixing function over (seed, member index, tick, station index) — the
 * same idea as Phase 2's bob stagger deriving from `index % LANES`, at more
 * resolution. Two runs from the same seed and context are byte-identical; two
 * seeds differ, and `floorSim.test.ts` pins HOW MANY members differ so
 * "deterministic" cannot quietly become "constant".
 *
 * The coarse form of that second measurement saturates, and the file says so
 * rather than reporting a ceiling as a result: the seed jitters every member's
 * walking speed, so by the second tick every member's record differs and the
 * count sits at 8 of 8. `moves a pinned number of FIRST TARGETS when only the
 * seed changes` is the reading with resolution — 4, 6 and 3 of 8 against a
 * control of 0 — and it isolates `FLOOR_SIM_TARGET_NOISE_TILES` from the speed
 * jitter, which is what makes turning that knob to zero red rather than
 * invisible.
 */

import { refuseWith } from './empireCore';
import {
  ambientMemberRoster,
  fixedFloorFurniture,
  floorGridSize,
  floorLayout,
  type GridPosition,
  type GridSize,
  type FloorState,
} from './floor';
import { type LadderEquipmentItem, type LadderRung } from './ladder';
import { type MemberType } from './members';
import { type SessionEquipmentItem } from './sessions';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The five arms of GDD §5.13's machine, declared as a value so a census can
 * join what the type declares against what a drive reached.
 *
 * Declared here rather than in `empireTuning.ts`, unlike `MEMBER_TYPES`: this
 * is a state machine's alphabet, not a value a playtester turns, and a knob
 * nobody can tune has no business in a tuning file whose whole subject is
 * values that get tuned. `EMPIRE_FORBIDDEN_OUTPUTS` in `empireCore.ts` is the
 * precedent for a vocabulary living beside the machine that owns it.
 */
export const FLOOR_SIM_MEMBER_STATES = Object.freeze([
  'seeking',
  'queuing',
  'using',
  'leaving',
  'interrupted',
] as const);

/** One member's behavioural state — GDD §5.13's four, plus the transient fifth. */
export type FloorSimMemberState = (typeof FLOOR_SIM_MEMBER_STATES)[number];

/** Both causes of an interruption, so a reaction cue can say which happened. */
export const FLOOR_SIM_INTERRUPTIONS = Object.freeze(['target-removed', 'target-moved'] as const);

/** Why a member was interrupted: its target vanished, or it was dragged elsewhere. */
export type FloorSimInterruption = (typeof FLOOR_SIM_INTERRUPTIONS)[number];

/**
 * A reference to something on the floor a member can walk to and use.
 *
 * Two kinds, and the split is the one the floor already draws: `fixed` is the
 * Barbell-group baseline `fixedFloorFurniture` reports, `session` is a placed
 * `SESSION_EQUIPMENT_ITEMS` member out of `floorLayout`. Both `item` fields are
 * closed vocabularies derived from `EMPIRE_TUNING`, so nothing here is a bare
 * string a caller can drift.
 *
 * Identified by kind and item rather than by an index into the station list,
 * on purpose: an index would silently re-point at a different station when an
 * earlier one is removed, and re-pointing is exactly the event this piece
 * exists to make visible as an interruption.
 */
export type FloorStationRef =
  | { readonly kind: 'fixed'; readonly item: LadderEquipmentItem }
  | { readonly kind: 'session'; readonly item: SessionEquipmentItem };

/**
 * One usable station: what it is, where it sits, the cell a member stands in
 * to use it, and the cells the queue behind it stands on.
 *
 * `queueCells` is ordered nearest-first from `useCell`, so slot k stands on
 * `queueCells[k]` and the line visibly shuffles forward when the head is
 * served.
 */
export interface FloorStation {
  readonly ref: FloorStationRef;
  readonly position: GridPosition;
  readonly footprint: GridSize;
  readonly useCell: GridPosition;
  readonly queueCells: readonly GridPosition[];
}

/** One member, mid-behaviour. Everything a renderer needs and nothing it does not. */
export interface FloorSimMember {
  /** Its roster index — stable for the life of a sim, and the deterministic tie-break everywhere. */
  readonly index: number;
  readonly type: MemberType;
  readonly state: FloorSimMemberState;
  /** The cell it is standing on, or stepping out of. */
  readonly cell: GridPosition;
  /** The cell it is stepping into, or null when it is standing still. */
  readonly next: GridPosition | null;
  /** How far into the step to `next` it is, in [0, 1). Zero whenever `next` is null. */
  readonly progress: number;
  /** The station it has claimed, or null. */
  readonly target: FloorStationRef | null;
  /** Where that station was when it was claimed — the snapshot a move is detected against. */
  readonly targetPosition: GridPosition | null;
  /** The tick the target was claimed — the queue's ordering key for members still walking over. */
  readonly claimedAt: number | null;
  /** The tick it reached the queue, or null while it is still walking there — the queue's primary ordering key. */
  readonly queuedAt: number | null;
  /** Ticks left in `using`, `leaving` or `interrupted`. Zero in the other two states. */
  readonly timer: number;
  /** Set for the length of an `interrupted` beat, so a reaction cue can name the cause. */
  readonly interruptedBy: FloorSimInterruption | null;
  /** The cell a `leaving` member is walking away from. */
  readonly awayFrom: GridPosition | null;
}

/** The whole simulation: a tick counter, the seed every choice is drawn from, and the members. */
export interface FloorSimState {
  readonly tick: number;
  readonly seed: number;
  readonly members: readonly FloorSimMember[];
}

/**
 * Everything the sim is allowed to see — header §5. Four fields, and the test
 * that pins them is a set equality over this type's own keys.
 */
export interface FloorSimContext {
  readonly rung: LadderRung;
  readonly floor: FloorState;
  readonly barbellOwned: readonly LadderEquipmentItem[];
  readonly sessionOwned: readonly SessionEquipmentItem[];
}

// ---------------------------------------------------------------------------
// Deterministic mixing — header §6
// ---------------------------------------------------------------------------

/**
 * A 32-bit avalanche mix. The two hexadecimal constants are the published
 * `lowbias32` multipliers; they are bit patterns rather than feel values,
 * which is why they sit here instead of in `empireTuning.ts`.
 */
function mix32(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** A 32-bit hash of an ordered list of whole numbers, seeded by the first. */
function hashOf(parts: readonly number[]): number {
  let accumulator = 0x9e3779b9;
  for (const part of parts) {
    accumulator = mix32((accumulator ^ (part >>> 0)) >>> 0);
  }
  return accumulator >>> 0;
}

/** The same hash, scaled into [0, 1). */
function hashUnit(parts: readonly number[]): number {
  return hashOf(parts) / 0x100000000;
}

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------

/** The four orthogonal steps, in the fixed order every tie-break in this file uses. */
const STEPS: readonly GridPosition[] = Object.freeze([
  Object.freeze({ x: 0, y: -1 }),
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: -1, y: 0 }),
]);

const UNREACHABLE = Number.POSITIVE_INFINITY;

function sameCell(left: GridPosition, right: GridPosition): boolean {
  return left.x === right.x && left.y === right.y;
}

function cellIndex(position: GridPosition, grid: GridSize): number {
  return position.y * grid.width + position.x;
}

function insideGrid(position: GridPosition, grid: GridSize): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < grid.width && position.y < grid.height;
}

function manhattan(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function refsEqual(left: FloorStationRef, right: FloorStationRef): boolean {
  return left.kind === right.kind && left.item === right.item;
}

// ---------------------------------------------------------------------------
// The route plan — derived from the context, held by nothing
// ---------------------------------------------------------------------------

/**
 * The derived geometry one tick reads: which cells are walkable, which
 * stations exist, and a distance field per station goal.
 *
 * Not exported and never stored on `FloorSimState`. It is a pure function of
 * the context, which is what lets `runFloorSim` build it once and
 * `stepFloorSim` build it per call without the two disagreeing —
 * `floorSim.test.ts` pins that equality directly.
 */
interface RoutePlan {
  readonly grid: GridSize;
  readonly blocked: readonly boolean[];
  readonly stations: readonly FloorStation[];
  /**
   * `fields[station][goal]` is the distance field to that goal cell, where
   * goal 0 is the station's use cell and goal k+1 is `queueCells[k]`.
   *
   * BUILT IN FULL, and the alternative was measured before it was rejected.
   * Filling these on demand instead cut a `stepFloorSim` call on a warehouse
   * holding all fourteen session items from 5.6 ms to 4.2 ms — but the cache it
   * needed was a write through the `plan` parameter, and
   * `empireForbiddenOutput.test.ts`'s channel census classifies a write through
   * a parameter as `argument-mutation`, a channel that census reports as
   * covered by nothing. Buying 1.4 ms by opening an escape channel the
   * directory has no coverage for is the wrong trade, so the plan is built
   * whole and nothing in this module writes through a parameter.
   */
  readonly fields: readonly (readonly (readonly number[])[])[];
}

/** Every cell an item of `footprint` at `position` covers. */
function coveredCells(position: GridPosition, footprint: GridSize): readonly GridPosition[] {
  const cells: GridPosition[] = [];
  for (let dy = 0; dy < footprint.height; dy += 1) {
    for (let dx = 0; dx < footprint.width; dx += 1) {
      cells.push({ x: position.x + dx, y: position.y + dy });
    }
  }
  return cells;
}

/**
 * A breadth-first distance field from `from` over walkable cells.
 *
 * Refuses past `FLOOR_SIM_ROUTE_VISIT_BUDGET` rather than running long on a
 * floor nobody has sized — see that knob's own comment.
 */
function distanceField(
  from: GridPosition,
  grid: GridSize,
  blocked: readonly boolean[],
): readonly number[] {
  const width = grid.width;
  const height = grid.height;
  const distances = new Array<number>(width * height).fill(UNREACHABLE);
  if (!insideGrid(from, grid) || blocked[cellIndex(from, grid)] === true) {
    return Object.freeze(distances);
  }
  const start = cellIndex(from, grid);
  distances[start] = 0;
  let frontier: number[] = [start];
  let visits = 0;
  while (frontier.length > 0) {
    const nextFrontier: number[] = [];
    for (const at of frontier) {
      visits += 1;
      if (visits > EMPIRE_TUNING.FLOOR_SIM_ROUTE_VISIT_BUDGET) {
        refuseWith(
          `a route search on a ${width}x${height} floor exceeded its visit budget of ${EMPIRE_TUNING.FLOOR_SIM_ROUTE_VISIT_BUDGET}`,
        );
      }
      const here = distances[at] as number;
      const x = at % width;
      const y = (at - x) / width;
      for (const step of STEPS) {
        const nx = x + step.x;
        const ny = y + step.y;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const to = ny * width + nx;
        if (blocked[to] === true) continue;
        if ((distances[to] as number) <= here + 1) continue;
        distances[to] = here + 1;
        nextFrontier.push(to);
      }
    }
    frontier = nextFrontier;
  }
  return Object.freeze(distances);
}

/** Cells orthogonally adjacent to a footprint, inside the grid and walkable, in (y, x) order. */
function approachCells(
  position: GridPosition,
  footprint: GridSize,
  grid: GridSize,
  blocked: readonly boolean[],
): readonly GridPosition[] {
  const seen = new Set<number>();
  const found: GridPosition[] = [];
  for (const covered of coveredCells(position, footprint)) {
    for (const step of STEPS) {
      const candidate: GridPosition = { x: covered.x + step.x, y: covered.y + step.y };
      if (!insideGrid(candidate, grid)) continue;
      const at = cellIndex(candidate, grid);
      if (blocked[at] === true) continue;
      if (seen.has(at)) continue;
      seen.add(at);
      found.push(candidate);
    }
  }
  return Object.freeze(
    found.sort((left, right) => (left.y === right.y ? left.x - right.x : left.y - right.y)),
  );
}

/**
 * Build the whole derived geometry for a context.
 *
 * A station that has no walkable adjacent cell, or no walkable cell behind
 * that one to queue on, is dropped from the station list entirely — a member
 * can never target it, which is how "a member is not sent to walk at empty
 * space" holds for equipment boxed in by other equipment. The dropped case is
 * driven by `floorSim.test.ts`'s `drops a station whose approach is sealed off,
 * instead of sending a member at a wall`.
 */
function routePlan(context: FloorSimContext): RoutePlan {
  const grid = floorGridSize(context.rung);
  const cells = grid.width * grid.height;
  const blocked = new Array<boolean>(cells).fill(false);

  const fixed = fixedFloorFurniture(context.barbellOwned);
  const placed = floorLayout(context.floor);
  const occupants: { readonly ref: FloorStationRef; readonly position: GridPosition; readonly footprint: GridSize }[] =
    [];
  for (const row of fixed) {
    occupants.push({ ref: { kind: 'fixed', item: row.item }, position: row.position, footprint: row.footprint });
  }
  for (const row of placed) {
    occupants.push({
      ref: { kind: 'session', item: row.item },
      position: row.position,
      footprint: row.footprint,
    });
  }
  for (const occupant of occupants) {
    for (const covered of coveredCells(occupant.position, occupant.footprint)) {
      if (!insideGrid(covered, grid)) continue;
      blocked[cellIndex(covered, grid)] = true;
    }
  }

  // Use cells are reserved across stations, so two machines beside each other
  // do not both send their user to the same tile — that would draw one body
  // on top of another at the moment the sim is trying to make "who is using
  // what" legible. Queue cells are reserved too, but only against each other
  // and against use cells, and both reservations DEGRADE rather than drop the
  // station: a boxed-in machine still gets a shared cell, because a machine
  // nobody can ever use reads worse on screen than two bodies on one tile, and
  // header §2 already says members do not block each other. The check that
  // says the shipped rungs do not fall back is `floorSim.test.ts`'s `gives
  // every station on every registered rung its own use cell`, driven at every
  // phase of every rung's layout rather than only on an empty floor.
  const takenUseCells = new Set<number>();
  const takenQueueCells = new Set<number>();
  const stations: FloorStation[] = [];
  const fields: (readonly (readonly number[])[])[] = [];
  for (const occupant of occupants) {
    const approaches = approachCells(occupant.position, occupant.footprint, grid, blocked);
    const useCell =
      approaches.find((candidate) => !takenUseCells.has(cellIndex(candidate, grid))) ??
      approaches[0];
    if (useCell === undefined) continue;
    takenUseCells.add(cellIndex(useCell, grid));
    const useField = distanceField(useCell, grid, blocked);
    const scored: { readonly cell: GridPosition; readonly steps: number; readonly spoken: boolean }[] =
      [];
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const at = y * grid.width + x;
        if (blocked[at] === true) continue;
        const steps = useField[at] as number;
        if (steps === UNREACHABLE || steps === 0) continue;
        scored.push({
          cell: { x, y },
          steps,
          spoken: takenUseCells.has(at) || takenQueueCells.has(at),
        });
      }
    }
    // Sorted on a COPY: the receiver is a fresh expression, so nothing outside
    // this function holds the array being reordered.
    const ordered = [...scored].sort((left, right) => {
      if (left.spoken !== right.spoken) return left.spoken ? 1 : -1;
      return left.steps - right.steps;
    });
    const queueCells = Object.freeze(
      ordered.slice(0, EMPIRE_TUNING.FLOOR_SIM_QUEUE_MAX_LENGTH).map((row) => row.cell),
    );
    if (queueCells.length === 0) continue;
    for (const cell of queueCells) takenQueueCells.add(cellIndex(cell, grid));
    stations.push(
      Object.freeze({
        ref: Object.freeze(occupant.ref),
        position: occupant.position,
        footprint: occupant.footprint,
        useCell,
        queueCells,
      }),
    );
    fields.push(
      Object.freeze([useField, ...queueCells.map((cell) => distanceField(cell, grid, blocked))]),
    );
  }

  return {
    grid,
    blocked: Object.freeze(blocked),
    stations: Object.freeze(stations),
    fields: Object.freeze(fields),
  };
}

/**
 * The stations a member could walk to on this floor, in the order the sim
 * itself ranks them — fixed Barbell furniture first, then placed session
 * equipment in `SESSION_EQUIPMENT_ITEMS` order.
 *
 * A plain read model, computed fresh on every call, never stored — the same
 * pattern `fixedFloorFurniture` and `ambientMemberRoster` already use. A
 * renderer draws queue cells and highlights an in-use station from this.
 */
export function floorStations(context: FloorSimContext): readonly FloorStation[] {
  return routePlan(context).stations;
}

// ---------------------------------------------------------------------------
// Per-member derived reads
// ---------------------------------------------------------------------------

/** The station a ref points at on this plan, or undefined if it is gone. */
function stationFor(plan: RoutePlan, ref: FloorStationRef): FloorStation | undefined {
  for (const station of plan.stations) {
    if (refsEqual(station.ref, ref)) return station;
  }
  return undefined;
}

/**
 * A station's index on the plan, which is the stable key its distance fields
 * are held under. Negative when the ref is not on this plan — a shape every
 * caller has already ruled out by calling `stationFor` first and refusing on
 * `undefined`, since both read the same equality.
 */
function stationSlot(plan: RoutePlan, ref: FloorStationRef): number {
  for (let slot = 0; slot < plan.stations.length; slot += 1) {
    if (refsEqual((plan.stations[slot] as FloorStation).ref, ref)) return slot;
  }
  return -1;
}

/**
 * Everyone claiming `ref`, in service order — header §3's four-key ordering:
 * arrivals first, then by arrival tick, then by claim tick, then by index.
 * This ordering IS the queue; there is no queue table to drift from it.
 *
 * Run, not asserted: dropping the arrival keys and ordering by claim tick
 * alone leaves `serves the member that arrived first, not the one that claimed
 * first` red at `expected +0 to be 1`, with the sweep's arm census moving
 * beside it.
 */
function claimantsOf(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): readonly FloorSimMember[] {
  const waiting: FloorSimMember[] = [];
  for (const member of members) {
    if (member.target === null) continue;
    if (!refsEqual(member.target, ref)) continue;
    if (member.state !== 'seeking' && member.state !== 'queuing') continue;
    waiting.push(member);
  }
  return waiting.sort((left, right) => {
      const leftArrived = left.queuedAt === null ? 1 : 0;
      const rightArrived = right.queuedAt === null ? 1 : 0;
      if (leftArrived !== rightArrived) return leftArrived - rightArrived;
      const leftAt = left.queuedAt ?? left.claimedAt ?? 0;
      const rightAt = right.queuedAt ?? right.claimedAt ?? 0;
      if (leftAt !== rightAt) return leftAt - rightAt;
      return left.index - right.index;
  });
}

/** Whether somebody is currently using `ref`. Capacity is one member per station. */
function isOccupied(members: readonly FloorSimMember[], ref: FloorStationRef): boolean {
  for (const member of members) {
    if (member.state !== 'using') continue;
    if (member.target !== null && refsEqual(member.target, ref)) return true;
  }
  return false;
}

/**
 * How attractive `station` is to `type`, read straight off §5.6's published
 * affinity tables rather than through a second formula.
 *
 * A NUMBER WHOSE SCALE IS THE TABLE'S, not [0, 1]. The published affinities top
 * out near 0.5 (`MEMBER_TYPE_BARBELL_AFFINITY.powerlifter`), so the realised
 * pull is roughly half of `FLOOR_SIM_AFFINITY_PULL_TILES` at best. That is
 * stated here because a tuner reading the knob's name would otherwise expect
 * the full value; the knob still scales the effect proportionally, which is
 * what a knob has to do.
 */
function affinityFor(type: MemberType, station: FloorStation): number {
  if (station.ref.kind === 'fixed') {
    return EMPIRE_TUNING.MEMBER_TYPE_BARBELL_AFFINITY[type];
  }
  const table: Readonly<Partial<Record<SessionEquipmentItem, number>>> =
    EMPIRE_TUNING.MEMBER_TYPE_ITEM_AFFINITY[type];
  return table[station.ref.item] ?? 0;
}

/** One member's own walking speed, in tiles per tick — the base rate with its seeded jitter. */
function speedOf(seed: number, member: FloorSimMember): number {
  const jitter = hashUnit([seed, member.index]) * 2 - 1;
  return (
    EMPIRE_TUNING.FLOOR_SIM_STEP_PROGRESS_PER_TICK *
    (1 + jitter * EMPIRE_TUNING.FLOOR_SIM_SPEED_JITTER_FRACTION)
  );
}

/** How long one member of `type` holds a station this time — the per-type base plus seeded spread. */
function useTicksFor(seed: number, member: FloorSimMember, tick: number): number {
  const base = EMPIRE_TUNING.FLOOR_SIM_USE_TICKS_BY_TYPE[member.type];
  const spread = Math.floor(
    hashUnit([seed, member.index, tick]) * EMPIRE_TUNING.FLOOR_SIM_USE_TICKS_SPREAD,
  );
  return base + spread;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/** Where a member is after this tick's fraction of its current step is applied. */
interface Walk {
  readonly cell: GridPosition;
  readonly next: GridPosition | null;
  readonly progress: number;
}

/**
 * Continue the step already in flight: drop it if the cell it leads into has
 * just been built on, otherwise advance and commit on arrival.
 */
function continueStep(member: FloorSimMember, plan: RoutePlan, speed: number): Walk {
  let cell = member.cell;
  let next = member.next;
  let progress = member.progress;
  if (next !== null && (!insideGrid(next, plan.grid) || plan.blocked[cellIndex(next, plan.grid)] === true)) {
    next = null;
    progress = 0;
  }
  if (next !== null) {
    progress += speed;
    if (progress >= 1) {
      cell = next;
      next = null;
      progress = 0;
    }
  }
  return { cell, next, progress };
}

/** Start a step into `candidate`, if the member is standing still and has somewhere to go. */
function beginStep(walk: Walk, candidate: GridPosition | null): Walk {
  if (walk.next !== null || candidate === null) return walk;
  return { cell: walk.cell, next: candidate, progress: 0 };
}

/** The neighbour of `cell` that is one step closer to the goal `field` measures, or null. */
function stepDownField(
  cell: GridPosition,
  field: readonly number[],
  plan: RoutePlan,
): GridPosition | null {
  const here = field[cellIndex(cell, plan.grid)] as number;
  if (here === UNREACHABLE || here === 0) return null;
  for (const step of STEPS) {
    const neighbour: GridPosition = { x: cell.x + step.x, y: cell.y + step.y };
    if (!insideGrid(neighbour, plan.grid)) continue;
    const at = cellIndex(neighbour, plan.grid);
    if (plan.blocked[at] === true) continue;
    if ((field[at] as number) < here) return neighbour;
  }
  return null;
}

/** The walkable neighbour furthest from `from`, for a member stepping off a machine. */
function stepAwayFrom(cell: GridPosition, from: GridPosition, plan: RoutePlan): GridPosition | null {
  let best: GridPosition | null = null;
  let bestDistance = manhattan(cell, from);
  for (const step of STEPS) {
    const neighbour: GridPosition = { x: cell.x + step.x, y: cell.y + step.y };
    if (!insideGrid(neighbour, plan.grid)) continue;
    if (plan.blocked[cellIndex(neighbour, plan.grid)] === true) continue;
    const distance = manhattan(neighbour, from);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = neighbour;
    }
  }
  return best;
}

/** A wander leg for a member with nowhere to be: a seeded direction, held for a few ticks. */
function stepWander(
  cell: GridPosition,
  plan: RoutePlan,
  seed: number,
  index: number,
  tick: number,
): GridPosition | null {
  const leg = Math.floor(tick / EMPIRE_TUNING.FLOOR_SIM_WANDER_HOLD_TICKS);
  const first = hashOf([seed, index, leg]) % STEPS.length;
  for (let offset = 0; offset < STEPS.length; offset += 1) {
    const step = STEPS[(first + offset) % STEPS.length] as GridPosition;
    const neighbour: GridPosition = { x: cell.x + step.x, y: cell.y + step.y };
    if (!insideGrid(neighbour, plan.grid)) continue;
    if (plan.blocked[cellIndex(neighbour, plan.grid)] === true) continue;
    return neighbour;
  }
  return null;
}

/** The nearest walkable cell to `from`, by (distance, y, x) — where a member built on is moved to. */
function nearestWalkable(from: GridPosition, plan: RoutePlan): GridPosition {
  if (insideGrid(from, plan.grid) && plan.blocked[cellIndex(from, plan.grid)] !== true) return from;
  let best: GridPosition | null = null;
  let bestKey = UNREACHABLE;
  for (let y = 0; y < plan.grid.height; y += 1) {
    for (let x = 0; x < plan.grid.width; x += 1) {
      const candidate: GridPosition = { x, y };
      if (plan.blocked[cellIndex(candidate, plan.grid)] === true) continue;
      const key = manhattan(candidate, from);
      if (key < bestKey) {
        bestKey = key;
        best = candidate;
      }
    }
  }
  if (best === null) {
    refuseWith(
      `a ${plan.grid.width}x${plan.grid.height} floor has no walkable cell for a member to stand on`,
    );
  }
  return best;
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

/** A member, interrupted: the beat starts, the claim is dropped, the step in flight is dropped. */
function interrupt(member: FloorSimMember, cause: FloorSimInterruption): FloorSimMember {
  return Object.freeze({
    ...member,
    state: 'interrupted',
    next: null,
    progress: 0,
    target: null,
    targetPosition: null,
    claimedAt: null,
    queuedAt: null,
    // ARMED WITH ONE MORE THAN THE BEAT, deliberately. The tick that arms the
    // beat also runs the advance pass, which decrements — so arming with the
    // beat itself would show the member interrupted for one tick fewer than the
    // knob says, and the knob would stop meaning what its name claims. With the
    // extra tick a member is visibly in the beat for exactly
    // `FLOOR_SIM_INTERRUPTED_BEAT_TICKS` ticks, the arming tick included, which
    // is what `resolves the beat to seeking on exactly the tuned tick` asserts.
    timer: EMPIRE_TUNING.FLOOR_SIM_INTERRUPTED_BEAT_TICKS + 1,
    interruptedBy: cause,
    awayFrom: null,
  });
}

/**
 * Pass one: anybody whose target has been moved or removed since it was
 * claimed enters the beat. Applies to `seeking`, `queuing` and `using` — GDD
 * §5.13's "mid-approach or mid-use" — and deliberately not to `leaving`, which
 * has already let go of its station and is walking away from a cell rather
 * than toward an object.
 */
function applyInterruptions(
  members: readonly FloorSimMember[],
  plan: RoutePlan,
): readonly FloorSimMember[] {
  const settled: FloorSimMember[] = [];
  for (const member of members) {
    if (member.target === null || member.targetPosition === null) {
      settled.push(member);
      continue;
    }
    if (member.state === 'leaving' || member.state === 'interrupted') {
      settled.push(member);
      continue;
    }
    const station = stationFor(plan, member.target);
    if (station === undefined) {
      settled.push(interrupt(member, 'target-removed'));
      continue;
    }
    if (!sameCell(station.position, member.targetPosition)) {
      settled.push(interrupt(member, 'target-moved'));
      continue;
    }
    settled.push(member);
  }
  return Object.freeze(settled);
}

/**
 * Pass two, in member-index order: anybody in `seeking` with no target picks
 * one. Header §3 — this is the one pass where within-tick order is load
 * bearing, because a claim has to be visible to the members after it.
 */
function applyClaims(
  members: readonly FloorSimMember[],
  plan: RoutePlan,
  seed: number,
  tick: number,
): readonly FloorSimMember[] {
  const settled: FloorSimMember[] = [...members];
  for (let i = 0; i < settled.length; i += 1) {
    const member = settled[i] as FloorSimMember;
    if (member.state !== 'seeking' || member.target !== null) continue;
    let chosen: FloorStation | null = null;
    let chosenScore = UNREACHABLE;
    for (let slot = 0; slot < plan.stations.length; slot += 1) {
      const station = plan.stations[slot] as FloorStation;
      const goals = plan.fields[slot] as readonly (readonly number[])[];
      const field = goals[0] as readonly number[];
      const distance = field[cellIndex(member.cell, plan.grid)] as number;
      if (distance === UNREACHABLE) continue;
      const waiting = claimantsOf(settled, station.ref).length;
      if (waiting >= Math.min(EMPIRE_TUNING.FLOOR_SIM_QUEUE_MAX_LENGTH, station.queueCells.length)) {
        continue;
      }
      const score =
        distance +
        waiting * EMPIRE_TUNING.FLOOR_SIM_QUEUE_AVERSION_TILES -
        affinityFor(member.type, station) * EMPIRE_TUNING.FLOOR_SIM_AFFINITY_PULL_TILES +
        hashUnit([seed, member.index, tick, slot]) * EMPIRE_TUNING.FLOOR_SIM_TARGET_NOISE_TILES;
      if (score < chosenScore) {
        chosenScore = score;
        chosen = station;
      }
    }
    if (chosen === null) continue;
    settled[i] = Object.freeze({
      ...member,
      target: Object.freeze(chosen.ref),
      targetPosition: chosen.position,
      claimedAt: tick,
    });
  }
  return Object.freeze(settled);
}

/** Pass three: one member's own transition, computed against the snapshot `claimed`. */
function advanceMember(
  member: FloorSimMember,
  claimed: readonly FloorSimMember[],
  plan: RoutePlan,
  seed: number,
  tick: number,
): FloorSimMember {
  const speed = speedOf(seed, member);
  const standing = nearestWalkable(member.cell, plan);
  const relocated = sameCell(standing, member.cell)
    ? member
    : Object.freeze({ ...member, cell: standing, next: null, progress: 0 });

  if (relocated.state === 'interrupted') {
    const timer = relocated.timer - 1;
    if (timer > 0) return Object.freeze({ ...relocated, timer });
    return Object.freeze({ ...relocated, state: 'seeking', timer: 0, interruptedBy: null });
  }

  if (relocated.state === 'using') {
    const timer = relocated.timer - 1;
    if (timer > 0) return Object.freeze({ ...relocated, timer });
    return Object.freeze({
      ...relocated,
      state: 'leaving',
      timer: EMPIRE_TUNING.FLOOR_SIM_LEAVING_TICKS,
      target: null,
      targetPosition: null,
      claimedAt: null,
      queuedAt: null,
      awayFrom: relocated.cell,
    });
  }

  if (relocated.state === 'leaving') {
    const walked = continueStep(relocated, plan, speed);
    const away = relocated.awayFrom ?? walked.cell;
    const stepped = beginStep(walked, stepAwayFrom(walked.cell, away, plan));
    const timer = relocated.timer - 1;
    if (timer > 0) return Object.freeze({ ...relocated, ...stepped, timer });
    return Object.freeze({ ...relocated, ...stepped, state: 'seeking', timer: 0, awayFrom: null });
  }

  // seeking or queuing, with or without a target.
  if (relocated.target === null) {
    const walked = continueStep(relocated, plan, speed);
    const stepped = beginStep(
      walked,
      stepWander(walked.cell, plan, seed, relocated.index, tick),
    );
    return Object.freeze({ ...relocated, ...stepped, state: 'seeking' });
  }

  const station = stationFor(plan, relocated.target);
  if (station === undefined) {
    // NOT REACHABLE IN THE SHIPPED TICK ORDER, and a refusal rather than a
    // quiet fallback for exactly that reason. Pass one turns a vanished target
    // into the beat and clears the target, and it skips only `leaving` and
    // `interrupted` — both of which hold a null target — so every member that
    // gets here with a target has a station on this plan.
    //
    // Stated in the mechanism's own terms rather than as an absolute: what
    // makes it unreachable is the ORDER of the three passes inside
    // `stepAgainstPlan`, and nothing in the type system holds that order. No
    // test in this file drives this line, because no fixture can; reordering
    // the passes is what would reach it, and this refusal is what makes that
    // reordering fail loudly instead of pathing a member at nothing.
    refuseWith(
      `member ${relocated.index} holds a target the plan does not have — the tick's interruption pass did not run first`,
    );
  }
  const slot = stationSlot(plan, relocated.target);
  const order = claimantsOf(claimed, station.ref).findIndex(
    (claimant) => claimant.index === relocated.index,
  );
  const occupied = isOccupied(claimed, station.ref);
  const head = order <= 0 && !occupied;
  const goalCell = head
    ? station.useCell
    : (station.queueCells[Math.min(Math.max(order, 0), station.queueCells.length - 1)] as GridPosition);
  const goals = plan.fields[slot] as readonly (readonly number[])[];
  const goalField = goals[
    head ? 0 : Math.min(Math.max(order, 0), station.queueCells.length - 1) + 1
  ] as readonly number[];

  const walked = continueStep(relocated, plan, speed);
  if ((goalField[cellIndex(walked.cell, plan.grid)] as number) === UNREACHABLE) {
    // ROUTE LOST — the one liveness hole this file found in itself, and the
    // §5.13 case that section does not cover. The member's target has neither
    // moved nor been removed, so pass one does not interrupt it; what changed
    // is that OTHER equipment was placed between the member and the station,
    // and `stepDownField` on an unreachable cell returns nothing, which would
    // leave the member standing still in `seeking` forever.
    //
    // It drops the target and walks a wander leg instead, which puts it back
    // in the same position as a member that never had a target: it re-claims
    // on a later tick, from wherever it has walked to. It deliberately does
    // NOT enter the beat, because `FloorSimInterruption`'s two members are
    // §5.13's own "moved or removed" and widening them would make the
    // interruption census claim coverage §5.13 does not give it. Reported as a
    // design call rather than settled here.
    //
    // The check that covers it is `floorSim.test.ts`'s `drops a target it can
    // no longer reach and keeps walking`, which builds the wall, asserts the
    // station is still reported (so this is not a removal), and asserts the
    // target is gone without the member entering the beat. Run, not asserted:
    // deleting this branch leaves that test red at `expected { kind:
    // 'session', item: 'mats' } to be null`.
    const stepped = beginStep(
      walked,
      stepWander(walked.cell, plan, seed, relocated.index, tick),
    );
    return Object.freeze({
      ...relocated,
      ...stepped,
      state: 'seeking',
      target: null,
      targetPosition: null,
      claimedAt: null,
      queuedAt: null,
    });
  }
  if (head && walked.next === null && sameCell(walked.cell, station.useCell)) {
    return Object.freeze({
      ...relocated,
      ...walked,
      state: 'using',
      timer: useTicksFor(seed, relocated, tick),
      queuedAt: null,
    });
  }
  const stepped = beginStep(walked, stepDownField(walked.cell, goalField, plan));
  const arrived = sameCell(stepped.cell, goalCell) && stepped.next === null;
  const queuing = relocated.state === 'queuing' || arrived;
  return Object.freeze({
    ...relocated,
    ...stepped,
    state: queuing ? 'queuing' : 'seeking',
    queuedAt: queuing ? relocated.queuedAt ?? tick : null,
  });
}

// ---------------------------------------------------------------------------
// The exported transitions
// ---------------------------------------------------------------------------

/** Refuse a seed that is not a whole number at or above zero — the hash reads it as a 32-bit word. */
function requireSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0) {
    refuseWith(`a floor sim seed must be a whole number at or above zero, received ${seed}`);
  }
  return seed;
}

/**
 * The opening state: Phase 2's real roster — same count per rung, same
 * equipment-biased type mix — standing on the floor, everybody seeking.
 *
 * `ambientMemberRoster` places bodies clear of fixed furniture but knows
 * nothing about placed session equipment (its own header says so, and says
 * why). This function therefore moves any body that would open standing
 * inside a placed item to the nearest walkable cell, by (distance, y, x).
 */
export function createFloorSimState(context: FloorSimContext, seed: number): FloorSimState {
  requireSeed(seed);
  const plan = routePlan(context);
  const roster = ambientMemberRoster(context.rung, context.barbellOwned, context.sessionOwned);
  return Object.freeze({
    tick: 0,
    seed,
    members: Object.freeze(
      roster.map((row, index) =>
        Object.freeze({
          index,
          type: row.type,
          state: 'seeking' as FloorSimMemberState,
          cell: nearestWalkable(row.position, plan),
          next: null,
          progress: 0,
          target: null,
          targetPosition: null,
          claimedAt: null,
          queuedAt: null,
          timer: 0,
          interruptedBy: null,
          awayFrom: null,
        }),
      ),
    ),
  });
}

/** One tick, against a context that may have changed since the last one. */
export function stepFloorSim(state: FloorSimState, context: FloorSimContext): FloorSimState {
  return stepAgainstPlan(state, routePlan(context));
}

/** The tick's three passes, sharing one derived plan. */
function stepAgainstPlan(state: FloorSimState, plan: RoutePlan): FloorSimState {
  requireSeed(state.seed);
  const interrupted = applyInterruptions(state.members, plan);
  const claimed = applyClaims(interrupted, plan, state.seed, state.tick);
  return Object.freeze({
    tick: state.tick + 1,
    seed: state.seed,
    members: Object.freeze(
      claimed.map((member) => advanceMember(member, claimed, plan, state.seed, state.tick)),
    ),
  });
}

/**
 * `ticks` applications of `stepFloorSim` against one fixed context.
 *
 * The context is held constant for the whole run, which is what lets the
 * derived plan be built once. A caller whose floor changes mid-run calls
 * `stepFloorSim` again with the new context — and `floorSim.test.ts` pins that
 * this helper agrees with that loop element by element, so the shared plan is
 * an optimisation rather than a second behaviour.
 */
export function runFloorSim(
  state: FloorSimState,
  context: FloorSimContext,
  ticks: number,
): FloorSimState {
  if (!Number.isInteger(ticks) || ticks < 0) {
    refuseWith(`a floor sim run length must be a whole number at or above zero, received ${ticks}`);
  }
  if (ticks > EMPIRE_TUNING.FLOOR_SIM_MAX_RUN_TICKS) {
    refuseWith(
      `a floor sim run of ${ticks} ticks is past the budget of ${EMPIRE_TUNING.FLOOR_SIM_MAX_RUN_TICKS}`,
    );
  }
  const plan = routePlan(context);
  let at = state;
  for (let i = 0; i < ticks; i += 1) {
    at = stepAgainstPlan(at, plan);
  }
  return at;
}

/**
 * How many members are in each of the five states — the census a screen prints
 * and the one `floorSim.test.ts`'s arm census joins against
 * `FLOOR_SIM_MEMBER_STATES`.
 */
export function floorSimStateCounts(
  state: FloorSimState,
): Readonly<Record<FloorSimMemberState, number>> {
  const counts: Record<FloorSimMemberState, number> = {
    seeking: 0,
    queuing: 0,
    using: 0,
    leaving: 0,
    interrupted: 0,
  };
  for (const member of state.members) {
    counts[member.state] += 1;
  }
  return Object.freeze(counts);
}
