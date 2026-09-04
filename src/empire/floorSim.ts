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
 * The beat has THREE causes rather than §5.13's two, and the third is this
 * file's own addition: `route-blocked`, for a target that is still on the floor
 * with the route to it walled off, and for a member that finds nothing on the
 * floor it can reach at all. §5.13's ruling is that the sim never freezes or
 * paths into empty space AND that the interruption is legible rather than
 * silent; the first draft of this module met the first half by dropping such a
 * target quietly, which broke the second. `FLOOR_SIM_INTERRUPTIONS` carries all
 * three and the census joins against it, so the widening is measured rather
 * than assumed. `FLOOR_SIM_INTERRUPTIBLE_STATES` is the same treatment for the
 * source arms — the three states the beat can be entered from, read by
 * `applyInterruptions` itself and joined against what a drive produced.
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
 * Run, not asserted. Replacing the exit with a re-arm gives nine red tests, the
 * named one failing at `target-removed at the exit: expected 'interrupted' to
 * be 'seeking'`, and the sweep's own arm census moving with it (`seeking:
 * expected 738 to be 967`). The count of red tests and the census number both
 * moved this round, because the sweep grew a phase; the mutant was re-run
 * rather than the sentence re-used.
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
 * LIVE CAPACITY, D2.1A. Buying a second bench does not recreate members, does
 * not clear the queue, and does not move `FloorStation.position` (still the
 * primary), so `applyInterruptions` does not fire. What does change is
 * `useCells` / `queueCells` / the blocked map: the expansion can land on the
 * stock approach. A using member standing in the new footprint is relocated
 * by `nearestWalkable`, and must not steal a newly-created seat from the
 * people already waiting. They keep consuming one slot (ghost-reserve the
 * primary if they are no longer on any use cell). Waiting members then take
 * remaining seats in `useCells` order, FIFO by claimant order — the same
 * assignment the cold-from-tick-zero Capacity fixture already proved. That
 * is a local replan, not a gym reset. `stationCapability.test.ts`'s
 * live-upgrade regression is the catcher.
 *
 * LIVE THROUGHPUT, D2.1B. Buying a plate tree does not shorten a set already
 * in progress and does not recreate members. Throughput is a station-level
 * changeover on `FloorSimState.changeovers`, keyed per seat: after a use
 * completes the seat stays reserved for `stationChangeoverTicks` (stock 18,
 * plate tree 6) while plates are changed. `useTicksFor` still writes the
 * lifter's duration. A live purchase caps an in-flight changeover at the
 * new duration and leaves a current user's timer alone. There is no
 * parallel timer in the renderer.
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
 * hold its cell in `seeking`. It enters the `route-blocked` beat and comes back
 * out into `seeking` with no claim — see the ROUTE LOST comment at the site.
 *
 * The sibling of that case is a member with no reachable station at all, sealed
 * into a pocket by two drags while stations stand elsewhere on the floor. That
 * one does not freeze either — it wanders — and the reason it needed work
 * anyway is that WANDERING IS WHAT PURPOSEFUL WALKING LOOKS LIKE from outside.
 * `holds no member in one state on one cell longer than the derived bound` stays
 * low for a member pacing a sealed 2x2 pocket for the rest of the run, and
 * `has a walkable neighbour under every cell` passes on a pocket that has four
 * of them. So the liveness instruments were both green on a member cut off from
 * the whole gym for good, which is the set-dressing reading §5.13's Phase 3 gate
 * is written against. `FloorSimMember.strandedAt` is the state that tells the
 * two apart, `route-blocked` is the reaction it arms once, and
 * `floorSim.test.ts`'s sealed-pocket sweep is what drives it on every rung with
 * an unsealed control beside it.
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
 * bound derived from the tuning values rather than picked — 57 ticks measured
 * against a derived ceiling of 272.
 *
 * ===========================================================================
 * 5. What this module may not read, and why the type is the fence
 * ===========================================================================
 *
 * `FloorSimContext` has exactly six fields: a rung, a `FloorState`, the
 * Barbell-group ownership list, the session-equipment ownership list, Stage D
 * station capability, and the authoritative living population (G.1A). Stock
 * There
 * is no wallet here, no Gym Bucks, no chalk, no Total, no e1RM, no streak
 * state, no covered-day concept and — the one this piece's brief called out
 * specifically — no reputation. Phase 2's `ambientMemberRoster` header already
 * says reputation must not grow onto this screen in this phase; this file
 * inherits that unchanged.
 *
 * The fence is the context type plus the import fence, and it is worth being
 * exact about which mechanism catches which widening, because an earlier
 * version of this paragraph named one check for a route it did not cover.
 *
 * A sixth field on `FloorSimContext` is caught by `floorSim.test.ts`'s `carries
 * exactly the six presentation inputs on its context`. That check used to read
 * `Object.keys` over a VALUE, which sees a required sixth field (the value could
 * not be built without it) and is blind to an OPTIONAL one. It now also carries
 * a `Record<keyof FloorSimContext, true>`, so the catcher for an optional field
 * is `tsc` rather than vitest: `keyof` includes optional keys, the literal is
 * missing one, and the compile fails. Both directions were run rather than
 * argued — the mutant and its error are recorded at the check.
 *
 * A tuning value this module has no business reading — reputation is the one
 * this piece's brief named — is caught by `reads exactly the sixteen tuning
 * entries it declares`, a set equality over every `EMPIRE_TUNING.KEY` this
 * file's source names. Its limits, and each has a catcher beside it: a computed
 * `EMPIRE_TUNING[key]` access would not match the dotted pattern, so bracket
 * access into that object is banned outright and the ban is driven; an alias
 * bound to `EMPIRE_TUNING` would read keys the scan never sees, so the total
 * count of the identifier in the file is pinned against the dotted matches plus
 * its one import.
 *
 * A seventh import edge is caught by `empireCore.test.ts`'s per-file import
 * fence, which pins this module's edges exactly. Stage D.1 adds
 * `./trainingStation` so members target a bay, not a SKU.
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
  floorFurnitureLayout,
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
import {
  stationCapacitySlots,
  stationChangeoverTicks,
  stationLevels,
  stationQualityAffinityBonus,
  stationTrainingExperience,
  stationUseTicksFactor,
  stockStationCapability,
  type StationCapabilityState,
} from './stationCapability';
import {
  COMPETITION_BENCH_BAY,
  competitionBenchBay,
  isCompetitionBenchBayComponent,
  type TrainingStationKind,
} from './trainingStation';

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

/**
 * The three causes of an interruption, so a reaction cue can say which happened.
 *
 * The first two are GDD §5.13's own "moved or removed". The third is the case
 * §5.13 does not name and a player can produce with two drags: the target is
 * still standing on the floor, and the route to it has been walled off by OTHER
 * equipment. §5.13's ruling has two halves — the sim "never freezes or paths
 * into empty space, AND the interruption is legible rather than silent" — so
 * dropping that target quietly satisfied the first half by breaking the second.
 * It is a third cause flowing through the same beat rather than a fourth
 * behaviour, and `floorSim.test.ts` joins this list against the causes a drive
 * actually produced, in both directions, with each count pinned.
 */
export const FLOOR_SIM_INTERRUPTIONS = Object.freeze([
  'target-removed',
  'target-moved',
  'route-blocked',
] as const);

/** Why a member was interrupted: its target vanished, moved, or became unreachable. */
export type FloorSimInterruption = (typeof FLOOR_SIM_INTERRUPTIONS)[number];

/**
 * The states a member can be interrupted OUT of — the source arms of the beat,
 * declared as a value for the same reason the destination arms are.
 *
 * `applyInterruptions` reads this list rather than spelling the three states in
 * a condition, so the census in `floorSim.test.ts` joins against the thing the
 * code branches on instead of against a second copy of it. `leaving` is absent
 * because a leaving member has already let go of its station, and `interrupted`
 * because it is already in the beat.
 */
export const FLOOR_SIM_INTERRUPTIBLE_STATES = Object.freeze([
  'seeking',
  'queuing',
  'using',
] as const);

/** A state the beat can be entered from. */
export type FloorSimInterruptibleState = (typeof FLOOR_SIM_INTERRUPTIBLE_STATES)[number];

/**
 * A reference to something on the floor a member can walk to and use.
 *
 * Three kinds. `training` is a functional station — Stage D.1's Competition
 * Bench Bay, assembled from required equipment rather than pretending each
 * SKU is a destination. `session` is a placed `SESSION_EQUIPMENT_ITEMS`
 * member out of `floorLayout`. `fixed` remains for leftover Barbell that is
 * not a bay component (none in the opening garage; kept so a future squat
 * rack can join without a third rewrite of the ref).
 *
 * Identified by kind and identity rather than by an index into the station
 * list, on purpose: an index would silently re-point at a different station
 * when an earlier one is removed, and re-pointing is exactly the event this
 * piece exists to make visible as an interruption.
 */
export type FloorStationRef =
  | { readonly kind: 'training'; readonly station: TrainingStationKind }
  | { readonly kind: 'fixed'; readonly item: LadderEquipmentItem }
  | { readonly kind: 'session'; readonly item: SessionEquipmentItem };

/** Stable identity for a ref — kind plus the station or item it names. */
export function floorStationRefKey(ref: FloorStationRef): string {
  if (ref.kind === 'training') return `training:${ref.station}`;
  return `${ref.kind}:${ref.item}`;
}

/** Per-seat changeover map key: the station plus the use cell. */
export function changeoverSeatKey(ref: FloorStationRef, cell: GridPosition): string {
  return `${floorStationRefKey(ref)}:${cell.x},${cell.y}`;
}

/** Remaining changeover ticks on `cell` of `ref`, or 0. */
export function seatChangeoverTicks(
  changeovers: Readonly<Record<string, number>>,
  ref: FloorStationRef,
  cell: GridPosition,
): number {
  const remaining = changeovers[changeoverSeatKey(ref, cell)];
  return remaining === undefined ? 0 : remaining;
}

/** How many of `useCells` currently hold a plate changeover. */
export function stationChangeoverSeats(
  changeovers: Readonly<Record<string, number>>,
  ref: FloorStationRef,
  useCells: readonly GridPosition[],
): number {
  let count = 0;
  for (const cell of useCells) {
    if (seatChangeoverTicks(changeovers, ref, cell) > 0) count += 1;
  }
  return count;
}

/**
 * One usable station: what it is, where it sits, the cell a member stands in
 * to use it, and the cells the queue behind it stands on.
 *
 * `queueCells` is ordered nearest-first from `useCell` by walking distance
 * (ties by row then column), so slot k stands on `queueCells[k]` and the line
 * visibly shuffles forward when the head is served. Every cell here is free of
 * every other station's use cell and queue cells — `routePlan`'s two passes are
 * what make that true, and `floorSim.test.ts` measures both the ordering and
 * the disjointness rather than taking this sentence for it.
 */
export interface FloorStation {
  readonly ref: FloorStationRef;
  readonly position: GridPosition;
  readonly footprint: GridSize;
  /** Primary standing cell — `useCells[0]`. Capacity seats more on `useCells[1..]`. */
  readonly useCell: GridPosition;
  /** Simultaneous standing positions. Length is the realised capacity. */
  readonly useCells: readonly GridPosition[];
  readonly queueCells: readonly GridPosition[];
}

/** Authoritative member facts the played path hands to the sim — types and ids only. */
export interface FloorSimPopulationEntry {
  readonly memberId: string;
  readonly type: MemberType;
}

/** One member, mid-behaviour. Everything a renderer needs and nothing it does not. */
export interface FloorSimMember {
  /** Stable living-member id from `FloorSimContext.livingPopulation`. */
  readonly memberId: string;
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
  /**
   * The tick this member first stood in a station queue, preserved through
   * `using` so G.1 can measure true queue wait (queue arrival → use start).
   */
  readonly queueArrivedAt: number | null;
  /** Ticks left in `using`, `leaving` or `interrupted`. Zero in the other two states. */
  readonly timer: number;
  /** Set for the length of an `interrupted` beat, so a reaction cue can name the cause. */
  readonly interruptedBy: FloorSimInterruption | null;
  /** The cell a `leaving` member is walking away from. */
  readonly awayFrom: GridPosition | null;
  /**
   * The tick this member last found itself with stations on the floor and no
   * route to any of them, or null while at least one station was in reach.
   *
   * This is the second half of the route-blocked case, and it is a field rather
   * than a counter because a renderer needs it: a member sealed into a pocket
   * keeps walking, so "still moving" is exactly what a walled-off member and a
   * member walking with purpose have in common. Whoever draws this screen holds
   * the reaction cue up for as long as this is set.
   *
   * Set once per stretch, on the tick the member first finds nothing reachable,
   * and cleared the moment it claims a station or finds one merely full. That
   * edge is also what arms the `route-blocked` beat, so a stranded member
   * reacts once and then paces rather than beating on a loop.
   *
   * An empty floor is deliberately not this: a garage on opening day has no
   * stations at all, nobody is walled off from anything, and its members wander
   * with this field null. `floorSim.test.ts` drives both.
   */
  readonly strandedAt: number | null;
  /**
   * Tick this member entered `using`, or null otherwise. Stage G.1 reads it to
   * compute wait-before-use without storing history inside `FloorSimState`.
   */
  readonly usingStartedAt: number | null;
}

/**
 * One service event emitted when a member finishes or is yanked off a station.
 * Observations are returned from `stepFloorSimWithObservations`; nothing here
 * stores them — `livingMembers.ts` owns durable history.
 */
export interface FloorSimServiceObservation {
  readonly memberId: string;
  readonly memberIndex: number;
  readonly memberType: MemberType;
  readonly stationKind: 'training' | 'fixed' | 'session';
  readonly stationKey: string;
  /** True queue wait in ticks: queue arrival → use start. Not claim-to-use approach time. */
  readonly queueWaitTicks: number;
  readonly trainingExperience: number;
  readonly outcome: 'completed' | 'interrupted';
  readonly observedAtTick: number;
}

export interface FloorSimStepResult {
  readonly state: FloorSimState;
  readonly observations: readonly FloorSimServiceObservation[];
}

/** The whole simulation: a tick counter, the seed every choice is drawn from, and the members. */
export interface FloorSimState {
  readonly tick: number;
  readonly seed: number;
  readonly members: readonly FloorSimMember[];
  /**
   * Per-seat plate-changeover remaining, keyed by `changeoverSeatKey`.
   * A positive value reserves that use cell: nobody starts using it until
   * the count reaches zero. Session stations never appear here.
   */
  readonly changeovers: Readonly<Record<string, number>>;
}

/**
 * Everything the sim is allowed to see — header §5. Five fields, and the test
 * that pins them is a set equality over this type's own keys. The fifth is
 * Stage D capability; stock (`{}`) is the Stage C four-field machine.
 */
export interface FloorSimContext {
  readonly rung: LadderRung;
  readonly floor: FloorState;
  readonly barbellOwned: readonly LadderEquipmentItem[];
  readonly sessionOwned: readonly SessionEquipmentItem[];
  readonly capability: StationCapabilityState;
  /** Authoritative living members for the played path — not recomputed from ambient types. */
  readonly livingPopulation: readonly FloorSimPopulationEntry[];
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
  if (left.kind !== right.kind) return false;
  if (left.kind === 'training' && right.kind === 'training') {
    return left.station === right.station;
  }
  if (left.kind === 'fixed' && right.kind === 'fixed') return left.item === right.item;
  if (left.kind === 'session' && right.kind === 'session') return left.item === right.item;
  return false;
}

function refKeyOf(ref: FloorStationRef): string {
  return ref.kind === 'training' ? ref.station : ref.item;
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
  readonly capability: StationCapabilityState;
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
  const capability = context.capability ?? stockStationCapability();
  const grid = floorGridSize(context.rung);
  const cells = grid.width * grid.height;
  const blocked = new Array<boolean>(cells).fill(false);

  const furniture = floorFurnitureLayout(context.floor, context.barbellOwned);
  const placed = floorLayout(context.floor);
  const bay = competitionBenchBay(
    context.floor,
    context.barbellOwned,
    stationLevels(capability, COMPETITION_BENCH_BAY).capacity,
  );

  const occupants: {
    readonly ref: FloorStationRef;
    readonly position: GridPosition;
    readonly footprint: GridSize;
    readonly benches: readonly { readonly position: GridPosition; readonly footprint: GridSize }[];
  }[] = [];

  for (const row of furniture) {
    for (const covered of coveredCells(row.position, row.footprint)) {
      if (!insideGrid(covered, grid)) continue;
      blocked[cellIndex(covered, grid)] = true;
    }
  }
  for (const row of placed) {
    for (const covered of coveredCells(row.position, row.footprint)) {
      if (!insideGrid(covered, grid)) continue;
      blocked[cellIndex(covered, grid)] = true;
    }
  }
  if (bay.expansion !== null) {
    for (const covered of coveredCells(bay.expansion.position, bay.expansion.footprint)) {
      if (!insideGrid(covered, grid)) continue;
      blocked[cellIndex(covered, grid)] = true;
    }
  }

  if (bay.complete && bay.primary !== null) {
    occupants.push({
      ref: Object.freeze({ kind: 'training', station: COMPETITION_BENCH_BAY }),
      position: bay.primary.position,
      footprint: bay.primary.footprint,
      benches: bay.benches,
    });
  }
  for (const row of furniture) {
    if (isCompetitionBenchBayComponent(row.item)) continue;
    occupants.push({
      ref: { kind: 'fixed', item: row.item },
      position: row.position,
      footprint: row.footprint,
      benches: Object.freeze([{ position: row.position, footprint: row.footprint }]),
    });
  }
  for (const row of placed) {
    occupants.push({
      ref: { kind: 'session', item: row.item },
      position: row.position,
      footprint: row.footprint,
      benches: Object.freeze([{ position: row.position, footprint: row.footprint }]),
    });
  }

  // CELL RESERVATION RUNS IN TWO PASSES, AND THE ORDER IS THE WHOLE POINT.
  // Every station's use cell is assigned first, then every station's queue
  // cells are assigned against the finished set of use cells. A single pass
  // could only reserve against the stations it had already seen, so station A's
  // queue slot could be station B's use cell whenever B was processed second —
  // which is two bodies on one tile at the moment this sim is trying to make
  // "who is using what" legible. Measured on the four-phase sweep layouts this
  // file shipped last round, before the fix: 18 such collisions across the 92
  // stations those floors posted, `fixed:power-bar`'s queue cell at (2,2)
  // against `fixed:comp-plates`'s use cell on every rung and every phase. The
  // sweep has since grown a phase and two layouts, so that pair of numbers is
  // history rather than something a run today re-derives; what a run today
  // measures is 0 collisions over 131 stations.
  //
  // Stage D.1: a training bay gets one use cell per physical bench, each
  // adjacent to THAT bench's footprint. Capacity 2 is a second bench, not
  // two approaches around one. Session and leftover Barbell stay at one
  // use cell.
  //
  // A cell already spoken for is now INELIGIBLE rather than merely sorted last,
  // which is what makes `queueCells` genuinely nearest-first from `useCell` —
  // the ordering `FloorStation`'s own comment claims and `floorSim.test.ts`'s
  // `orders every queue nearest-first from its own use cell` measures with an
  // independent breadth-first search.
  //
  // Two degrades survive, both stated rather than buried. A station whose every
  // approach cell is already another station's use cell falls back to sharing
  // one, because a machine nobody can walk to reads worse than two bodies on a
  // tile and header §2 already says members do not block each other; `gives
  // every station on every registered rung its own use cell` is what says the
  // shipped rungs do not reach that fallback. A station left with no free cell
  // to queue on at all is dropped from the plan entirely, the same way a
  // station with no walkable approach is; `posts every station on every
  // registered rung after the two-pass reservation` pins that the shipped rungs
  // lose none.
  const takenUseCells = new Set<number>();
  const seated: {
    readonly occupant: (typeof occupants)[number];
    readonly useCells: readonly GridPosition[];
  }[] = [];
  for (const occupant of occupants) {
    const wanted = stationCapacitySlots(capability, occupant.ref.kind, refKeyOf(occupant.ref));
    const useCells: GridPosition[] = [];
    for (const bench of occupant.benches) {
      if (useCells.length >= wanted) break;
      const approaches = approachCells(bench.position, bench.footprint, grid, blocked);
      let seatedHere = false;
      for (const candidate of approaches) {
        const at = cellIndex(candidate, grid);
        if (takenUseCells.has(at)) continue;
        takenUseCells.add(at);
        useCells.push(candidate);
        seatedHere = true;
        break;
      }
      if (!seatedHere) {
        const fallback = approaches[0];
        if (fallback !== undefined && useCells.length === 0) useCells.push(fallback);
      }
    }
    if (useCells.length === 0) continue;
    seated.push({ occupant, useCells: Object.freeze(useCells) });
  }

  const takenQueueCells = new Set<number>();
  const stations: FloorStation[] = [];
  const fields: (readonly (readonly number[])[])[] = [];
  for (const { occupant, useCells } of seated) {
    const primary = useCells[0] as GridPosition;
    const useField = distanceField(primary, grid, blocked);
    const scored: { readonly cell: GridPosition; readonly steps: number }[] = [];
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const at = y * grid.width + x;
        if (blocked[at] === true) continue;
        const steps = useField[at] as number;
        if (steps === UNREACHABLE || steps === 0) continue;
        if (takenUseCells.has(at) || takenQueueCells.has(at)) continue;
        scored.push({ cell: { x, y }, steps });
      }
    }
    // Sorted on a COPY: the receiver is a fresh expression, so nothing outside
    // this function holds the array being reordered. The scan above is row
    // major, and `Array.prototype.sort` is stable, so equal-distance cells keep
    // (y, x) order.
    const ordered = [...scored].sort((left, right) => left.steps - right.steps);
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
        useCell: primary,
        useCells,
        queueCells,
      }),
    );
    fields.push(
      Object.freeze([
        ...useCells.map((cell) => distanceField(cell, grid, blocked)),
        ...queueCells.map((cell) => distanceField(cell, grid, blocked)),
      ]),
    );
  }

  return {
    grid,
    blocked: Object.freeze(blocked),
    stations: Object.freeze(stations),
    fields: Object.freeze(fields),
    capability,
  };
}

/**
 * The stations a member could walk to on this floor, in the order the sim
 * itself ranks them — the complete Competition Bench Bay first, then leftover
 * Barbell that is not a bay component, then placed session equipment in
 * `SESSION_EQUIPMENT_ITEMS` order. Starting-kit pieces are never independent
 * destinations: a bar and plates are equipment, not a training station.
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

/** How many members are currently using `ref`. Capacity is `station.useCells.length`. */
export function stationOccupancy(
  members: readonly FloorSimMember[],
  ref: FloorStationRef,
): number {
  let count = 0;
  for (const member of members) {
    if (member.state !== 'using') continue;
    if (member.target !== null && refsEqual(member.target, ref)) count += 1;
  }
  return count;
}

/**
 * How attractive `station` is to `type`, read straight off §5.6's published
 * affinity tables rather than through a second formula.
 *
 * A NUMBER WHOSE SCALE IS THE TABLE'S, not [0, 1], and this function reads BOTH
 * tables: `MEMBER_TYPE_BARBELL_AFFINITY` for a fixed Barbell station and
 * `MEMBER_TYPE_ITEM_AFFINITY` for a placed session item. The largest value
 * either table holds is 0.7 — `powerlifter.specialty-bars` and `athlete.sled`
 * — so the most `FLOOR_SIM_AFFINITY_PULL_TILES` can realise is 7 of its 10
 * tiles. A tuner reading the knob's name would otherwise expect the full value.
 *
 * An earlier version of this paragraph said the tables top out near 0.5 at
 * `MEMBER_TYPE_BARBELL_AFFINITY.powerlifter`, which is the largest value in the
 * table this function reads FIRST rather than the largest value it can return.
 * The number is derived rather than transcribed now:
 * `floorSim.test.ts`'s `pins the realised affinity pull in tiles, derived from
 * both published tables` walks both tables, pins the maximum at 0.7 and the
 * realised pull at 7 tiles, and reads this sentence and the knob's own out of
 * their source files so that raising an affinity reddens instead of quietly
 * making two comments wrong again.
 */
function affinityFor(
  type: MemberType,
  station: FloorStation,
  capability: StationCapabilityState,
): number {
  const base =
    station.ref.kind === 'session'
      ? ((
          EMPIRE_TUNING.MEMBER_TYPE_ITEM_AFFINITY[type] as Readonly<
            Partial<Record<SessionEquipmentItem, number>>
          >
        )[station.ref.item] ?? 0)
      : EMPIRE_TUNING.MEMBER_TYPE_BARBELL_AFFINITY[type];
  return base + stationQualityAffinityBonus(capability, station.ref.kind, refKeyOf(station.ref));
}

/** One member's own walking speed, in tiles per tick — the base rate with its seeded jitter. */
function speedOf(seed: number, member: FloorSimMember): number {
  const jitter = hashUnit([seed, member.index]) * 2 - 1;
  return (
    EMPIRE_TUNING.FLOOR_SIM_STEP_PROGRESS_PER_TICK *
    (1 + jitter * EMPIRE_TUNING.FLOOR_SIM_SPEED_JITTER_FRACTION)
  );
}

/** How long one member of `type` holds a station this time — the per-type base plus seeded spread, scaled by the station's throughput factor. */
function useTicksFor(
  seed: number,
  member: FloorSimMember,
  tick: number,
  factor: number,
): number {
  const base = EMPIRE_TUNING.FLOOR_SIM_USE_TICKS_BY_TYPE[member.type];
  const spread = Math.floor(
    hashUnit([seed, member.index, tick]) * EMPIRE_TUNING.FLOOR_SIM_USE_TICKS_SPREAD,
  );
  return Math.max(1, Math.round((base + spread) * factor));
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

/**
 * Nearest walkable cell that is not in `avoided`. Falls back to ordinary
 * `nearestWalkable` if every walkable cell is avoided — a boxed floor still
 * has to put the body somewhere. Used when a using member's standing cell
 * becomes the Capacity expansion: they must leave the new footprint without
 * landing on a brand-new seat the queue is about to take.
 */
function nearestWalkableAvoiding(
  from: GridPosition,
  plan: RoutePlan,
  avoided: readonly GridPosition[],
): GridPosition {
  const avoid = new Set<string>();
  for (const cell of avoided) avoid.add(`${cell.x},${cell.y}`);
  let best: GridPosition | null = null;
  let bestKey = UNREACHABLE;
  for (let y = 0; y < plan.grid.height; y += 1) {
    for (let x = 0; x < plan.grid.width; x += 1) {
      const candidate: GridPosition = { x, y };
      if (plan.blocked[cellIndex(candidate, plan.grid)] === true) continue;
      if (avoid.has(`${candidate.x},${candidate.y}`)) continue;
      const key = manhattan(candidate, from);
      if (key < bestKey) {
        bestKey = key;
        best = candidate;
      }
    }
  }
  if (best !== null) return best;
  return nearestWalkable(from, plan);
}

/**
 * Use cells currently consumed by `using` members of `station`.
 *
 * A body standing on a use cell occupies that cell. A body still `using` but
 * no longer on any use cell — the live-Capacity case where the expansion
 * ate their approach — still consumes one slot, reserved primary-first so
 * the NEW seat is the one the queue can take.
 */
function reservedUseCells(
  station: FloorStation,
  claimed: readonly FloorSimMember[],
  changeovers: Readonly<Record<string, number>>,
): ReadonlySet<string> {
  const reserved = new Set<string>();
  let ghosts = 0;
  for (const member of claimed) {
    if (member.state !== 'using') continue;
    if (member.target === null || !refsEqual(member.target, station.ref)) continue;
    let onSeat = false;
    for (const cell of station.useCells) {
      if (!sameCell(cell, member.cell)) continue;
      reserved.add(`${cell.x},${cell.y}`);
      onSeat = true;
      break;
    }
    if (!onSeat) ghosts += 1;
  }
  for (const cell of station.useCells) {
    if (seatChangeoverTicks(changeovers, station.ref, cell) <= 0) continue;
    reserved.add(`${cell.x},${cell.y}`);
  }
  for (let i = 0; i < ghosts; i += 1) {
    for (const cell of station.useCells) {
      const key = `${cell.x},${cell.y}`;
      if (reserved.has(key)) continue;
      reserved.add(key);
      break;
    }
  }
  return reserved;
}

/**
 * The use cell claimant `order` should walk to, or null if they are not yet
 * served. FIFO by claimant order over the seats `reservedUseCells` has not
 * consumed, in `useCells` order. Live Capacity relies on the ghost-reserve
 * putting the displaced user on the primary so the NEW seat is remaining[0]
 * for the queue head; cold Capacity has no ghosts and is unchanged.
 */
function assignedSeat(
  station: FloorStation,
  claimed: readonly FloorSimMember[],
  order: number,
  changeovers: Readonly<Record<string, number>>,
): GridPosition | null {
  const reserved = reservedUseCells(station, claimed, changeovers);
  const remaining: GridPosition[] = [];
  for (const cell of station.useCells) {
    if (reserved.has(`${cell.x},${cell.y}`)) continue;
    remaining.push(cell);
  }
  if (order < 0 || order >= remaining.length) return null;
  return remaining[order] as GridPosition;
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
    queueArrivedAt: null,
    usingStartedAt: null,
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
    if (!FLOOR_SIM_INTERRUPTIBLE_STATES.includes(member.state as FloorSimInterruptibleState)) {
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
    let reachable = 0;
    for (let slot = 0; slot < plan.stations.length; slot += 1) {
      const station = plan.stations[slot] as FloorStation;
      const goals = plan.fields[slot] as readonly (readonly number[])[];
      const field = goals[0] as readonly number[];
      const distance = field[cellIndex(member.cell, plan.grid)] as number;
      if (distance === UNREACHABLE) continue;
      reachable += 1;
      const waiting = claimantsOf(settled, station.ref).length;
      if (waiting >= Math.min(EMPIRE_TUNING.FLOOR_SIM_QUEUE_MAX_LENGTH, station.queueCells.length)) {
        continue;
      }
      const score =
        distance +
        waiting * EMPIRE_TUNING.FLOOR_SIM_QUEUE_AVERSION_TILES -
        affinityFor(member.type, station, plan.capability) * EMPIRE_TUNING.FLOOR_SIM_AFFINITY_PULL_TILES +
        hashUnit([seed, member.index, tick, slot]) * EMPIRE_TUNING.FLOOR_SIM_TARGET_NOISE_TILES;
      if (score < chosenScore) {
        chosenScore = score;
        chosen = station;
      }
    }
    if (chosen !== null) {
      settled[i] = Object.freeze({
        ...member,
        target: Object.freeze(chosen.ref),
        targetPosition: chosen.position,
        claimedAt: tick,
        strandedAt: null,
      });
      continue;
    }
    // Nothing was claimed, and the three reasons for that are different
    // situations that should not read the same on screen.
    //
    // A floor with no stations at all is a garage on opening day: nobody is cut
    // off from anything, so the member wanders and signals nothing. A floor
    // whose reachable stations are all full is an ordinary busy gym, and the
    // member walks on. What is left — stations standing on this floor and no
    // route from this cell to any of them — is a member sealed into a pocket by
    // two drags, and that is the case a liveness check written around "is it
    // still moving" cannot tell apart from purposeful walking, because it is
    // still moving.
    if (plan.stations.length === 0 || reachable > 0) {
      if (member.strandedAt !== null) settled[i] = Object.freeze({ ...member, strandedAt: null });
      continue;
    }
    // One reaction per stretch. `strandedAt` stays set while the member paces,
    // so the beat is armed on the edge into being walled off and not on every
    // tick after it — a member beating on a loop would stand still, which is
    // the freeze this whole section exists to avoid.
    if (member.strandedAt !== null) continue;
    settled[i] = Object.freeze({ ...interrupt(member, 'route-blocked'), strandedAt: tick });
  }
  return Object.freeze(settled);
}

/** Pass three: one member's own transition, computed against the snapshot `claimed`. */
function makeServiceObservation(
  member: FloorSimMember,
  stationRef: FloorStationRef,
  plan: RoutePlan,
  tick: number,
  outcome: 'completed' | 'interrupted',
): FloorSimServiceObservation {
  const useStart = member.usingStartedAt ?? tick;
  const queueWaitTicks =
    member.queueArrivedAt === null ? 0 : Math.max(0, useStart - member.queueArrivedAt);
  return Object.freeze({
    memberId: member.memberId,
    memberIndex: member.index,
    memberType: member.type,
    stationKind: stationRef.kind,
    stationKey: floorStationRefKey(stationRef),
    queueWaitTicks,
    trainingExperience: stationTrainingExperience(
      plan.capability,
      stationRef.kind,
      refKeyOf(stationRef),
    ),
    outcome,
    observedAtTick: tick,
  });
}

function advanceMember(
  member: FloorSimMember,
  claimed: readonly FloorSimMember[],
  plan: RoutePlan,
  seed: number,
  tick: number,
  changeovers: Readonly<Record<string, number>>,
  observations: FloorSimServiceObservation[],
): FloorSimMember {
  const speed = speedOf(seed, member);
  let standing = nearestWalkable(member.cell, plan);
  if (
    member.state === 'using' &&
    member.target !== null &&
    !sameCell(standing, member.cell)
  ) {
    const currentStation = stationFor(plan, member.target);
    if (currentStation !== undefined) {
      let seated: GridPosition | null = null;
      for (const cell of currentStation.useCells) {
        if (plan.blocked[cellIndex(cell, plan.grid)] === true) continue;
        seated = cell;
        break;
      }
      standing = seated ?? nearestWalkableAvoiding(member.cell, plan, currentStation.useCells);
    }
  }
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
    if (relocated.target !== null) {
      observations.push(
        makeServiceObservation(relocated, relocated.target, plan, tick, 'completed'),
      );
    }
    return Object.freeze({
      ...relocated,
      state: 'leaving',
      timer: EMPIRE_TUNING.FLOOR_SIM_LEAVING_TICKS,
      target: null,
      targetPosition: null,
      claimedAt: null,
      queuedAt: null,
      queueArrivedAt: null,
      usingStartedAt: null,
      awayFrom: relocated.cell,
    });
  }

  if (relocated.state === 'leaving') {
    const walked = continueStep(relocated, plan, speed);
    const away = relocated.awayFrom ?? walked.cell;
    const stepped = beginStep(walked, stepAwayFrom(walked.cell, away, plan));
    const timer = relocated.timer - 1;
    if (timer > 0) return Object.freeze({ ...relocated, ...stepped, timer });
    return Object.freeze({ ...relocated, ...stepped, state: 'seeking', timer: 0, awayFrom: null, queueArrivedAt: null });
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
  const seat = assignedSeat(station, claimed, order, changeovers);
  const canServe = seat !== null;
  const queueIndex = Math.min(Math.max(order, 0), station.queueCells.length - 1);
  const goalCell = canServe ? seat : (station.queueCells[queueIndex] as GridPosition);
  const goals = plan.fields[slot] as readonly (readonly number[])[];
  const useIndex = canServe ? station.useCells.findIndex((cell) => sameCell(cell, seat)) : -1;
  const goalField = goals[
    canServe ? Math.max(useIndex, 0) : station.useCells.length + queueIndex
  ] as readonly number[];
  const walked = continueStep(relocated, plan, speed);
  if ((goalField[cellIndex(walked.cell, plan.grid)] as number) === UNREACHABLE) {
    // ROUTE LOST — the liveness hole this file found in itself, and the §5.13
    // case that section does not name. The member's target has neither moved
    // nor been removed, so pass one leaves it alone; what changed is that OTHER
    // equipment was placed between the member and the station, and
    // `stepDownField` on an unreachable cell returns nothing, which would leave
    // the member standing still in `seeking` for good.
    //
    // It enters the beat as `route-blocked` and resolves back to `seeking` like
    // the other two causes, so it drops the claim, holds one legible reaction,
    // and then re-claims from wherever it has walked to.
    //
    // AN EARLIER VERSION DROPPED THE TARGET SILENTLY, and the reason it gave
    // for not widening `FloorSimInterruption` was wrong on its own terms: the
    // interruption census is a set equality over `FLOOR_SIM_INTERRUPTIONS`, an
    // array this module owns, so a third member plus a pinned count keeps it
    // exact rather than overclaiming. The silent version also had no measurable
    // subject — it wrote `seeking` onto members that were mostly already
    // `seeking`, and the sweep's arm census counts state CHANGES, so the branch
    // could not move a number. Instrumented directly across the whole 66240
    // observation sweep it fired 0 times, so what looked like coverage was an
    // empty domain.
    //
    // The checks that cover it now: `floorSim.test.ts`'s `sends a member whose
    // route is walled off into the beat, naming route-blocked` drives the exact
    // fixture, and the sweep reaches this cause 10 times across its four rungs
    // — a count the arm census pins. That total is shared with the stranded
    // arming in the claim pass, so it is the cause's number rather than this
    // branch's alone, and the split was measured rather than divided up by
    // argument: restoring the silent drop here takes the census from 10 to 2,
    // so 8 of the 10 are this branch and 2 are the claim pass.
    //
    // ARMED WITH THE BEAT ITSELF rather than one more, which is the opposite of
    // what `interrupt` does and for the same reason. That extra tick exists so
    // that a beat armed in the interruption pass survives the decrement this
    // advance pass runs later in the same tick; this branch IS the advance
    // pass, so there is no later decrement to survive. `resolves the beat to
    // seeking on exactly the tuned tick, from all three causes` drives it, and
    // arming with `interrupt`'s value leaves that check red at `route-blocked
    // at the exit: expected 'interrupted' to be 'seeking'`.
    return Object.freeze({
      ...interrupt(relocated, 'route-blocked'),
      timer: EMPIRE_TUNING.FLOOR_SIM_INTERRUPTED_BEAT_TICKS,
    });
  }
  if (canServe && walked.next === null && sameCell(walked.cell, goalCell)) {
    const factor = stationUseTicksFactor(
      plan.capability,
      station.ref.kind,
      refKeyOf(station.ref),
    );
    return Object.freeze({
      ...relocated,
      ...walked,
      state: 'using',
      timer: useTicksFor(seed, relocated, tick, factor),
      queuedAt: null,
      usingStartedAt: tick,
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
    queueArrivedAt: queuing ? relocated.queueArrivedAt ?? tick : relocated.queueArrivedAt,
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

/** Test-only population derived from ambient placement — not the played G.1 path. */
export function ambientLivingPopulation(
  rung: LadderRung,
  barbellOwned: readonly LadderEquipmentItem[],
  sessionOwned: readonly SessionEquipmentItem[],
  identityNonce = 0,
): readonly FloorSimPopulationEntry[] {
  const roster = ambientMemberRoster(rung, barbellOwned, sessionOwned);
  return Object.freeze(
    roster.map((row, index) =>
      Object.freeze({
        memberId: `member:n${identityNonce}:${index}`,
        type: row.type,
      }),
    ),
  );
}

/** Attach ambient-derived living population for floor-sim unit tests. */
export function withAmbientLivingPopulation(
  context: Omit<FloorSimContext, 'livingPopulation'>,
  identityNonce = 0,
): FloorSimContext {
  return Object.freeze({
    ...context,
    livingPopulation: ambientLivingPopulation(
      context.rung,
      context.barbellOwned,
      context.sessionOwned,
      identityNonce,
    ),
  });
}

/**
 * The opening state: authoritative member ids/types from `livingPopulation`,
 * starting POSITIONS from `ambientMemberRoster`.
 */
export function createFloorSimState(context: FloorSimContext, seed: number): FloorSimState {
  requireSeed(seed);
  const plan = routePlan(context);
  const placements = ambientMemberRoster(context.rung, context.barbellOwned, context.sessionOwned);
  if (context.livingPopulation.length !== placements.length) {
    refuseWith(
      `living population count ${context.livingPopulation.length} does not match ambient placement count ${placements.length}`,
    );
  }
  return Object.freeze({
    tick: 0,
    seed,
    members: Object.freeze(
      context.livingPopulation.map((entry, index) =>
        Object.freeze({
          memberId: entry.memberId,
          index,
          type: entry.type,
          state: 'seeking' as FloorSimMemberState,
          cell: nearestWalkable(placements[index]?.position ?? { x: 0, y: 0 }, plan),
          next: null,
          progress: 0,
          target: null,
          targetPosition: null,
          claimedAt: null,
          queuedAt: null,
          queueArrivedAt: null,
          timer: 0,
          interruptedBy: null,
          awayFrom: null,
          strandedAt: null,
          usingStartedAt: null,
        }),
      ),
    ),
    changeovers: Object.freeze({}),
  });
}

/** One tick, against a context that may have changed since the last one. */
export function stepFloorSim(state: FloorSimState, context: FloorSimContext): FloorSimState {
  return stepFloorSimWithObservations(state, context).state;
}

/** Like `stepFloorSim`, but also returns service observations for Stage G.1. */
export function stepFloorSimWithObservations(
  state: FloorSimState,
  context: FloorSimContext,
): FloorSimStepResult {
  return stepAgainstPlan(state, routePlan(context));
}

/** The tick's three passes, sharing one derived plan. */
function stepAgainstPlan(
  state: FloorSimState,
  plan: RoutePlan,
): FloorSimStepResult {
  requireSeed(state.seed);
  const observations: FloorSimServiceObservation[] = [];
  const beforeInterrupt = state.members;
  const interrupted = applyInterruptions(state.members, plan);
  for (let i = 0; i < beforeInterrupt.length; i += 1) {
    const before = beforeInterrupt[i] as FloorSimMember;
    const after = interrupted[i] as FloorSimMember;
    if (
      before.state === 'using' &&
      after.state === 'interrupted' &&
      before.target !== null
    ) {
      observations.push(
        makeServiceObservation(before, before.target, plan, state.tick, 'interrupted'),
      );
    }
  }
  const claimed = applyClaims(interrupted, plan, state.seed, state.tick);
  const nextMembers = Object.freeze(
    claimed.map((member) =>
      advanceMember(
        member,
        claimed,
        plan,
        state.seed,
        state.tick,
        state.changeovers,
        observations,
      ),
    ),
  );
  return Object.freeze({
    state: Object.freeze({
      tick: state.tick + 1,
      seed: state.seed,
      members: nextMembers,
      changeovers: nextChangeovers(state, nextMembers, plan),
    }),
    observations: Object.freeze([...observations]),
  });
}

/**
 * Per-seat plate-changeover remaining after this tick.
 *
 * Order, load-bearing: decrement live seats and drop at 0, drop keys whose
 * seat no longer exists (live Capacity geometry), cap remaining to the
 * current capability duration (live Throughput shortens an in-flight load),
 * then arm a fresh duration on `using` → `leaving`. Newly armed keys are
 * not decremented on the arming tick, so the seat is reserved for exactly
 * `stationChangeoverTicks` ticks. Do not arm on interrupt — a yanked
 * lifter did not finish a set, so nobody is changing plates for them.
 */
function nextChangeovers(
  previous: FloorSimState,
  nextMembers: readonly FloorSimMember[],
  plan: RoutePlan,
): Readonly<Record<string, number>> {
  const stockCeiling = EMPIRE_TUNING.FLOOR_SIM_STATION_CHANGEOVER_TICKS;
  const valid = new Set<string>();
  const durationByKey = new Map<string, number>();
  for (const station of plan.stations) {
    const duration = stationChangeoverTicks(
      plan.capability,
      station.ref.kind,
      refKeyOf(station.ref),
    );
    for (const cell of station.useCells) {
      const key = changeoverSeatKey(station.ref, cell);
      valid.add(key);
      durationByKey.set(key, duration);
    }
  }
  const next: Record<string, number> = {};
  for (const [key, remaining] of Object.entries(previous.changeovers)) {
    if (!valid.has(key)) continue;
    const decremented = remaining - 1;
    if (decremented <= 0) continue;
    const duration = durationByKey.get(key) ?? 0;
    if (duration <= 0) continue;
    next[key] = Math.min(decremented, duration, stockCeiling);
  }
  const previousByIndex = new Map<number, FloorSimMember>();
  for (const member of previous.members) previousByIndex.set(member.index, member);
  for (const member of nextMembers) {
    const was = previousByIndex.get(member.index);
    if (was === undefined) continue;
    if (was.state !== 'using' || member.state !== 'leaving') continue;
    if (was.target === null) continue;
    const station = stationFor(plan, was.target);
    if (station === undefined) continue;
    const duration = stationChangeoverTicks(
      plan.capability,
      station.ref.kind,
      refKeyOf(station.ref),
    );
    if (duration <= 0) continue;
    let cell = was.cell;
    let onSeat = false;
    for (const use of station.useCells) {
      if (!sameCell(use, cell)) continue;
      onSeat = true;
      break;
    }
    if (!onSeat) {
      const primary = station.useCells[0];
      if (primary === undefined) continue;
      cell = primary;
    }
    next[changeoverSeatKey(station.ref, cell)] = Math.min(duration, stockCeiling);
  }
  return Object.freeze(next);
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
    at = stepAgainstPlan(at, plan).state;
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
