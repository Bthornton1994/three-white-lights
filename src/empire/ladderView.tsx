/**
 * ladderView.tsx — the §5.11 stage-1 gate's instrument: a playable,
 * render-only view of the ladder.
 *
 * How a human runs it, from a clean checkout:
 *
 *     npm ci
 *     npx vite --open /ladder-dev.html
 *
 * `ladder-dev.html` and `ladder-dev.tsx` at the repository root mount this
 * component with React's own reducer hook; vite serves them with zero config.
 * This module itself imports no host API and no react — with the project's
 * `jsx: react-jsx` transform the runtime arrives at build time and the types
 * arrive ambiently, so the directory's import fence and purity scan hold with
 * no new edges. The one stateful hook lives in the dev mount, outside this
 * directory, which is what keeps this file render-only in the checkable sense:
 * every export here is a pure function of its arguments.
 *
 * What the colocated render test covers, and what it does not: the test walks
 * the element tree this component returns and checks that every displayed
 * quantity — money, rate, costs, accrual seconds, the clock — equals the same
 * quantity read from `ladder.ts`'s pure functions for the same state, and that
 * every control dispatches the action it says it does. It cannot cover feel:
 * whether the four income magnitudes pace well (garage to storage unit in
 * about seven idle days, warehouse in about twenty-two) is the gate's open
 * question, and the dev time control below exists so a human can answer it.
 *
 * The reducer arms below each make exactly one `ladder.ts` call; no transition
 * is reimplemented and no arithmetic happens in this file. The dev time
 * control is labelled in the rendered output as a dev control, feeds elapsed
 * seconds to the shipped accrual path unchanged, and its step sizes are the
 * `LADDER_DEV_TIME_STEPS_SECONDS` knob — not values a player could reach.
 */

import { EMPIRE_TUNING } from './empireTuning';
import {
  type LadderAccrual,
  type LadderBuyResult,
  type LadderEquipmentItem,
  type LadderMoveResult,
  type LadderState,
  buyLadderEquipment,
  createLadderState,
  describeLadderClock,
  ladderCheckInAfter,
  ladderDevTimeSteps,
  ladderEquipmentCost,
  ladderEquipmentMinRung,
  ladderIncomeRatePerHour,
  ladderMoveCost,
  moveUpLadder,
  nextLadderRung,
  unlockedLifts,
} from './ladder';

// ---------------------------------------------------------------------------
// The view's state and actions — a thin envelope over LadderState
// ---------------------------------------------------------------------------

/**
 * What the screen holds: the ladder itself, plus the last transition's own
 * report, kept so consumption is shown rather than silent — the accrual that
 * paid (with what the cap discarded) and the refusal reason when a spend was
 * refused.
 */
export interface LadderViewState {
  readonly ladder: LadderState;
  readonly lastAccrual: LadderAccrual | null;
  readonly lastRefusal: LadderViewRefusal | null;
}

/**
 * Every reason a spend can be refused, derived from the two result types
 * rather than restated — a closed union, so the position census reads this
 * field as vocabulary and not as an open string.
 */
export type LadderViewRefusal =
  | Extract<LadderBuyResult, { readonly kind: 'refused' }>['reason']
  | Extract<LadderMoveResult, { readonly kind: 'refused' }>['reason'];

/** The three things a player can do on this screen. */
export type LadderViewAction =
  | { readonly kind: 'advance-clock'; readonly gapSeconds: number }
  | { readonly kind: 'buy'; readonly item: LadderEquipmentItem }
  | { readonly kind: 'move-up' };

/** The opening screen: a fresh garage, nothing yet to report. */
export function createLadderViewState(): LadderViewState {
  return Object.freeze({ ladder: createLadderState(), lastAccrual: null, lastRefusal: null });
}

/**
 * The reducer the dev mount hands to React. Each arm is one `ladder.ts` call
 * and a re-wrap of what that call reported; the colocated test drives all
 * three arms and compares every carried quantity against the same call made
 * directly.
 */
export function ladderViewReduce(
  state: LadderViewState,
  action: LadderViewAction,
): LadderViewState {
  switch (action.kind) {
    case 'advance-clock': {
      const checkedIn = ladderCheckInAfter(state.ladder, action.gapSeconds);
      return Object.freeze({
        ladder: checkedIn.state,
        lastAccrual: checkedIn.accrual,
        lastRefusal: null,
      });
    }
    case 'buy': {
      const outcome = buyLadderEquipment(state.ladder, action.item);
      return Object.freeze({
        ladder: outcome.state,
        lastAccrual: state.lastAccrual,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'move-up': {
      const outcome = moveUpLadder(state.ladder);
      return Object.freeze({
        ladder: outcome.state,
        lastAccrual: state.lastAccrual,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// The component — renders state, dispatches actions, computes nothing
// ---------------------------------------------------------------------------

export interface LadderViewProps {
  readonly state: LadderViewState;
  readonly dispatch: (action: LadderViewAction) => void;
}

/**
 * The stage-1 screen. Prop-taking on purpose: with state injected, this is a
 * pure function of its props, so the node-side test can invoke it directly
 * and walk the returned element tree without a renderer.
 */
export function LadderView(props: LadderViewProps) {
  const { ladder, lastAccrual, lastRefusal } = props.state;
  const destination = nextLadderRung(ladder.rung);
  const owned = new Set<string>(ladder.equipment);
  return (
    <main data-testid={'ladder-view'}>
      <h1>the ladder</h1>
      <p>
        rung <strong data-testid={'ladder-rung'}>{ladder.rung}</strong> earning{' '}
        <span data-testid={'ladder-rate'}>{ladderIncomeRatePerHour(ladder.rung)}</span> gym bucks
        per hour
      </p>
      <p>
        gym bucks: <strong data-testid={'ladder-gym-bucks'}>{ladder.gymBucks}</strong> clock:{' '}
        <span data-testid={'ladder-clock'}>{describeLadderClock(ladder.collectedAt)}</span>
      </p>
      <p data-testid={'ladder-lifts'}>lifts unlocked: {unlockedLifts(ladder.equipment).join(', ')}</p>
      {lastAccrual === null ? null : (
        <p data-testid={'ladder-accrual'}>
          last advance banked {lastAccrual.secondsBanked}s of {lastAccrual.secondsElapsed}s, paid{' '}
          {lastAccrual.gymBucks} gym bucks, cap discarded {lastAccrual.secondsDiscarded}s
        </p>
      )}
      {lastRefusal === null ? null : (
        <p data-testid={'ladder-refusal'}>refused: {lastRefusal}</p>
      )}
      <ul data-testid={'ladder-shop'}>
        {EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map((item) => (
          <li key={item}>
            {item} costs {ladderEquipmentCost(item)} gym bucks, fits from{' '}
            {ladderEquipmentMinRung(item)}
            {owned.has(item) ? (
              ' - owned'
            ) : (
              <button
                data-testid={`buy-${item}`}
                onClick={() => props.dispatch({ kind: 'buy', item })}
              >
                buy
              </button>
            )}
          </li>
        ))}
      </ul>
      {destination === null ? (
        <p data-testid={'ladder-move'}>top of the ladder - the portfolio arrives with stage four</p>
      ) : (
        <p data-testid={'ladder-move'}>
          next: {destination} for {ladderMoveCost(destination)} gym bucks{' '}
          <button data-testid={'move-up'} onClick={() => props.dispatch({ kind: 'move-up' })}>
            relocate
          </button>
        </p>
      )}
      <section data-testid={'ladder-dev-controls'}>
        <h2>dev control</h2>
        <p>
          not part of the game: each button feeds that many elapsed seconds to the shipped
          accrual, so a human can judge the pacing without waiting it out.
        </p>
        {ladderDevTimeSteps().map((step) => (
          <button
            key={step.label}
            data-testid={`advance-${step.seconds}`}
            onClick={() => props.dispatch({ kind: 'advance-clock', gapSeconds: step.seconds })}
          >
            {step.label}
          </button>
        ))}
      </section>
    </main>
  );
}

// ===========================================================================
// GymView — the §5.11 stage-2 gate's instrument: the FULL stage-1+2 loop.
//
// This is an ADDITION to the file, not a rewrite of the section above.
// `LadderView`, `LadderViewState`, `LadderViewAction`, `ladderViewReduce` and
// `createLadderViewState` are untouched — every line above this one is
// byte-identical to the stage-1 gate's own instrument, because that gate
// already played (GDD §5.11's stage-1 gate record) and every census row this
// directory keeps about that exact source stays true unedited. `GymView` is
// a second, self-contained component: it does not call `LadderView` or reuse
// its reducer, because `GymViewState` carries the composed `GymState`
// (ladder + accelerated purse + stage-2 equipment) plus the weekly-allocation
// bookkeeping `LadderViewState` has no field for, and bolting that onto the
// stage-1 shape would have meant editing it after all — the thing this split
// avoids. `ladder-dev.tsx` mounts `GymView` now; `LadderView` stays reachable
// from its own colocated test as the closed stage-1 record.
//
// The two questions this view exists to let a human answer, near-verbatim
// from the piece's brief, because that is what makes the render test's own
// header honest about what it covers and what only a human can judge:
//
//   1. Does the new equipment close the felt emptiness of the strip-mall ->
//      warehouse stretch? The stage-1 play-through measured that stretch as
//      ~38 consecutive check-ins with nothing to buy after the rack — a
//      decision-density problem, not a pacing one. Stage 2's items were
//      priced against that measured band. This view must let a human FEEL
//      whether purchases now land inside that stretch, not just confirm they
//      exist in the tuning table.
//   2. Does weekly session allocation read as a real recurring decision, or
//      another flat number? The allocation happens once per week, repeatedly,
//      for the life of a save — so the view must make WHICH WEEK it is and
//      WHETHER THE PLAYER HAS ALREADY ALLOCATED THIS WEEK legible at a
//      glance, or the human cannot judge whether it's a decision or a chore.
//
// What the colocated render test covers, and what it does not: the same
// discipline `LadderView`'s own header states. Every displayed quantity —
// money, rates, costs, the week index, each allocated slot's resolved
// outcome (including the `unequipped` arm's named requirement), and the
// attribute-effect numbers — is compared against the same quantity read
// directly from `sessions.ts`'s (and, for the stage-1 rows, `ladder.ts`'s)
// pure functions for the same state. It cannot judge feel — that is what the
// two questions above are for, and the dev controls below exist so a human
// can reach the decision points fast enough to feel them.
//
// The reducer's simple arms (buy-ladder, buy-session, move-up,
// set-allocation-slot) each make exactly one `sessions.ts` or `ladder.ts`
// call, the same shape `ladderViewReduce` uses above. The
// `advance-clock` / `advance-to-next-week` arm is the one exception, stated
// plainly rather than claimed away: a single advance CAN complete more than
// one training week, so `advanceGymClock` runs a bounded loop of
// `resolveWeek` / `weeklyAttributeEffects` calls, one pair per week that
// completed, instead of one call. No arithmetic happens in the loop itself —
// `weekIndex` comes from `trainingWeekIndexAt`, and each week's outcome and
// effects come from the same two `sessions.ts` functions the render test
// calls directly for comparison. The equipment every completed week resolves
// against is `sessionEquipment` as it stood BEFORE this specific advance —
// never re-read afterward — which is what makes "a mid-week purchase counts
// from the next week" (`sessions.ts` header §5) hold for a live, clicked-
// through session and not only for a pre-built schedule: nothing can change
// `sessionEquipment` between the moment an advance is dispatched and the
// moment its completed weeks are resolved, because a purchase is a separate,
// earlier action.
// ===========================================================================

import {
  type FloorPlaceResult,
  type FloorState,
  type GridPosition,
  createFloorState,
  placeFloorItem,
  relocateFloorState,
  removeFloorItem,
} from './floor';
import {
  type FlexibleSlot,
  type GymState,
  type GymWeekReport,
  type SessionBuyResult,
  type SessionEquipmentItem,
  type WeekAllocation,
  availableActivities,
  buySessionEquipment,
  createGymState,
  createRestAllocation,
  gymCheckInAfter,
  resolveWeek,
  secondsUntilNextWeekBoundary,
  sessionEquipmentCost,
  sessionEquipmentGroup,
  sessionEquipmentMinRung,
  trainingWeekIndexAt,
  trainingWeekShape,
  weeklyAttributeEffects,
  withLadder,
} from './sessions';

/**
 * What the full-loop screen holds: the composed gym, the last transition's
 * own report (accrual or refusal — header rule, same as `LadderViewState`),
 * which training week is current, the standing allocation plan (sticky
 * across weeks until a slot is edited — header rule), whether that plan has
 * been touched since the current week began, the log of weeks that have
 * actually completed, and — GDD §5.13 Phase 1 — the floor layout for the
 * gym's current rung.
 *
 * `floor` is a VIEW composed on top of `gym.sessionEquipment`, never a second
 * copy of it (`floor.ts`'s own header states the same claim about its own
 * functions). Nothing here stores which items are owned a second time — only
 * where the owned ones currently sit.
 */
export interface GymViewState {
  readonly gym: GymState;
  readonly lastAccrual: LadderAccrual | null;
  readonly lastRefusal: GymViewRefusal | null;
  readonly weekIndex: number;
  readonly allocation: WeekAllocation;
  readonly allocationSetThisWeek: boolean;
  readonly weekLog: readonly GymWeekReport[];
  readonly floor: FloorState;
}

/**
 * Every reason a spend can be refused across the whole loop, derived from
 * the four result types rather than restated — a closed union, so the
 * position census reads this field as vocabulary and not as an open string.
 */
export type GymViewRefusal =
  | Extract<LadderBuyResult, { readonly kind: 'refused' }>['reason']
  | Extract<LadderMoveResult, { readonly kind: 'refused' }>['reason']
  | Extract<SessionBuyResult, { readonly kind: 'refused' }>['reason']
  | Extract<FloorPlaceResult, { readonly kind: 'refused' }>['reason'];

/** The eight things a player can do on this screen — six from stage 1/2, and GDD §5.13 Phase 1's place/remove. */
export type GymViewAction =
  | { readonly kind: 'advance-clock'; readonly gapSeconds: number }
  | { readonly kind: 'advance-to-next-week' }
  | { readonly kind: 'buy-ladder'; readonly item: LadderEquipmentItem }
  | { readonly kind: 'buy-session'; readonly item: SessionEquipmentItem }
  | { readonly kind: 'move-up' }
  | {
      readonly kind: 'set-allocation-slot';
      readonly slotIndex: 0 | 1 | 2;
      readonly slot: FlexibleSlot;
    }
  | {
      readonly kind: 'floor-place';
      readonly item: SessionEquipmentItem;
      readonly position: GridPosition;
    }
  | { readonly kind: 'floor-remove'; readonly item: SessionEquipmentItem };

/** The opening screen: a fresh gym, an all-rest plan, an empty floor, nothing yet to report. */
export function createGymViewState(): GymViewState {
  const gym = createGymState();
  return Object.freeze({
    gym,
    lastAccrual: null,
    lastRefusal: null,
    weekIndex: trainingWeekIndexAt(gym.ladder.collectedAt),
    allocation: createRestAllocation(),
    allocationSetThisWeek: false,
    weekLog: Object.freeze([]),
    floor: createFloorState(gym.ladder.rung),
  });
}

/**
 * The shared body of the two clock-advancing arms — header note above: this
 * is the one arm allowed more than one `sessions.ts` call, because a single
 * advance can complete more than one training week.
 */
function advanceGymClock(state: GymViewState, gapSeconds: number): GymViewState {
  const before = state.gym;
  const checkedIn = gymCheckInAfter(before, gapSeconds);
  const previousWeekIndex = trainingWeekIndexAt(before.ladder.collectedAt);
  const newWeekIndex = trainingWeekIndexAt(checkedIn.state.ladder.collectedAt);
  let weekLog = state.weekLog;
  let allocationSetThisWeek = state.allocationSetThisWeek;
  if (newWeekIndex > previousWeekIndex) {
    const completed: GymWeekReport[] = [];
    for (let weekIndex = previousWeekIndex; weekIndex < newWeekIndex; weekIndex += 1) {
      completed.push(
        Object.freeze({
          weekIndex,
          allocation: state.allocation,
          slots: resolveWeek(state.allocation, before.sessionEquipment),
          effects: weeklyAttributeEffects(state.allocation, before.sessionEquipment),
        }),
      );
    }
    weekLog = Object.freeze([...weekLog, ...completed]);
    allocationSetThisWeek = false;
  }
  return Object.freeze({
    gym: checkedIn.state,
    lastAccrual: checkedIn.accrual,
    lastRefusal: null,
    weekIndex: newWeekIndex,
    allocation: state.allocation,
    allocationSetThisWeek,
    weekLog,
    // A clock advance never relocates and never touches ownership, so the
    // floor layout is untouched — only a successful `move-up` resets it.
    floor: state.floor,
  });
}

/**
 * The reducer the dev mount hands to React for the full loop. The colocated
 * test drives every arm and compares every carried quantity against the same
 * `sessions.ts` / `ladder.ts` calls made directly.
 */
export function gymViewReduce(state: GymViewState, action: GymViewAction): GymViewState {
  switch (action.kind) {
    case 'advance-clock':
      return advanceGymClock(state, action.gapSeconds);
    case 'advance-to-next-week':
      return advanceGymClock(state, secondsUntilNextWeekBoundary(state.gym.ladder.collectedAt));
    case 'buy-ladder': {
      const outcome = buyLadderEquipment(state.gym.ladder, action.item);
      return Object.freeze({
        ...state,
        gym: withLadder(state.gym, outcome.state),
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'buy-session': {
      const outcome = buySessionEquipment(state.gym, action.item);
      return Object.freeze({
        ...state,
        gym: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'move-up': {
      const outcome = moveUpLadder(state.gym.ladder);
      return Object.freeze({
        ...state,
        gym: withLadder(state.gym, outcome.state),
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
        // GDD §5.1: a relocation is a full move, "you leave the old place
        // behind" — `floor.ts`'s `relocateFloorState` header explains why a
        // position on the old grid has no reading on the new one. A refused
        // move leaves `outcome.state` byte-identical to `state.gym.ladder`
        // (`ladder.ts`'s own contract), so reading the POST-outcome rung here
        // is a no-op on refusal and a real reset only when the move landed.
        floor:
          outcome.kind === 'moved' ? relocateFloorState(outcome.state.rung) : state.floor,
      });
    }
    case 'floor-place': {
      const outcome = placeFloorItem(
        state.floor,
        state.gym.sessionEquipment,
        action.item,
        action.position,
      );
      return Object.freeze({
        ...state,
        floor: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'floor-remove': {
      return Object.freeze({
        ...state,
        floor: removeFloorItem(state.floor, action.item),
        lastRefusal: null,
      });
    }
    case 'set-allocation-slot': {
      const next = [...state.allocation] as [FlexibleSlot, FlexibleSlot, FlexibleSlot];
      next[action.slotIndex] = action.slot;
      return Object.freeze({
        ...state,
        allocation: Object.freeze(next) as WeekAllocation,
        allocationSetThisWeek: true,
        lastRefusal: null,
      });
    }
  }
}

export interface GymViewProps {
  readonly state: GymViewState;
  readonly dispatch: (action: GymViewAction) => void;
}

/** Every slot value a player may choose, in the fixed §5.5 order plus rest. */
function allocationOptions(): readonly FlexibleSlot[] {
  return Object.freeze([...EMPIRE_TUNING.FLEXIBLE_ACTIVITIES, 'rest']);
}

/** One `SlotOutcome`, in words a player reads without decoding the union. */
function describeSlotOutcome(outcome: GymWeekReport['slots'][number]): string {
  if (outcome.kind === 'rested') return 'rested';
  if (outcome.kind === 'trained') return `trained: ${outcome.activity}`;
  return `${outcome.activity} - unequipped, needs ${outcome.requires}`;
}

/**
 * The stage-1+2 screen. Prop-taking on purpose, same reason `LadderView`
 * gives above: a pure function of its props, so the node-side test can
 * invoke it directly and walk the returned element tree without a renderer.
 */
export function GymView(props: GymViewProps) {
  const { gym, lastAccrual, lastRefusal, weekIndex, allocation, allocationSetThisWeek, weekLog } =
    props.state;
  const destination = nextLadderRung(gym.ladder.rung);
  const ownedLadder = new Set<string>(gym.ladder.equipment);
  const ownedSession = new Set<string>(gym.sessionEquipment);
  const shape = trainingWeekShape();
  const previewOutcomes = resolveWeek(allocation, gym.sessionEquipment);
  const previewEffects = weeklyAttributeEffects(allocation, gym.sessionEquipment);
  const available = availableActivities(gym.sessionEquipment);
  return (
    <main data-testid={'gym-view'}>
      <h1>the gym</h1>
      <p data-testid={'gym-week'}>
        week <strong>{weekIndex}</strong> ({shape.fixed} fixed + {shape.flexible} flexible ={' '}
        {shape.total} sessions) —{' '}
        {allocationSetThisWeek ? 'allocated this week' : 'not yet allocated this week'}
      </p>
      <p>
        rung <strong data-testid={'gym-rung'}>{gym.ladder.rung}</strong> earning{' '}
        <span data-testid={'gym-rate'}>{ladderIncomeRatePerHour(gym.ladder.rung)}</span> gym bucks
        per hour
      </p>
      <p>
        gym bucks: <strong data-testid={'gym-gym-bucks'}>{gym.ladder.gymBucks}</strong> accelerated:{' '}
        <strong data-testid={'gym-accelerated-bucks'}>{gym.acceleratedGymBucks}</strong> clock:{' '}
        <span data-testid={'gym-clock'}>{describeLadderClock(gym.ladder.collectedAt)}</span>
      </p>
      <p data-testid={'gym-lifts'}>lifts unlocked: {unlockedLifts(gym.ladder.equipment).join(', ')}</p>
      {lastAccrual === null ? null : (
        <p data-testid={'gym-accrual'}>
          last advance banked {lastAccrual.secondsBanked}s of {lastAccrual.secondsElapsed}s, paid{' '}
          {lastAccrual.gymBucks} gym bucks, cap discarded {lastAccrual.secondsDiscarded}s
        </p>
      )}
      {lastRefusal === null ? null : <p data-testid={'gym-refusal'}>refused: {lastRefusal}</p>}
      <ul data-testid={'gym-ladder-shop'}>
        {EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map((item) => (
          <li key={item}>
            {item} costs {ladderEquipmentCost(item)} gym bucks, fits from{' '}
            {ladderEquipmentMinRung(item)}
            {ownedLadder.has(item) ? (
              ' - owned'
            ) : (
              <button
                data-testid={`gym-buy-ladder-${item}`}
                onClick={() => props.dispatch({ kind: 'buy-ladder', item })}
              >
                buy
              </button>
            )}
          </li>
        ))}
      </ul>
      <ul data-testid={'gym-session-shop'}>
        {EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.map((item) => (
          <li key={item}>
            {item} ({sessionEquipmentGroup(item)}) costs {sessionEquipmentCost(item)} gym bucks,
            fits from {sessionEquipmentMinRung(item)}
            {ownedSession.has(item) ? (
              ' - owned'
            ) : (
              <button
                data-testid={`gym-buy-session-${item}`}
                onClick={() => props.dispatch({ kind: 'buy-session', item })}
              >
                buy
              </button>
            )}
          </li>
        ))}
      </ul>
      {destination === null ? (
        <p data-testid={'gym-move'}>top of the ladder - the portfolio arrives with stage four</p>
      ) : (
        <p data-testid={'gym-move'}>
          next: {destination} for {ladderMoveCost(destination)} gym bucks{' '}
          <button data-testid={'gym-move-up'} onClick={() => props.dispatch({ kind: 'move-up' })}>
            relocate
          </button>
        </p>
      )}
      <section data-testid={'gym-allocation'}>
        <h2>this week's allocation</h2>
        <p data-testid={'gym-available-now'}>available now: {available.length === 0 ? 'none' : available.join(', ')}</p>
        {([0, 1, 2] as const).map((slotIndex) => (
          <p data-testid={`gym-slot-${slotIndex}`} key={slotIndex}>
            slot {slotIndex}: {allocation[slotIndex]} —{' '}
            {describeSlotOutcome(previewOutcomes[slotIndex])}
            {allocationOptions().map((option) => (
              <button
                key={option}
                data-testid={`gym-slot-${slotIndex}-set-${option}`}
                onClick={() =>
                  props.dispatch({ kind: 'set-allocation-slot', slotIndex, slot: option })
                }
              >
                {option}
              </button>
            ))}
          </p>
        ))}
        <p data-testid={'gym-week-preview'}>
          if this week ended now: residual carry {previewEffects.residualCarryMultiplier}, injury
          chance {previewEffects.injuryChanceMultiplier}, technique bonus{' '}
          {previewEffects.techniqueQualityBonus}, ceiling growth {previewEffects.ceilingGrowthPerWeek}
        </p>
      </section>
      <ul data-testid={'gym-week-log'}>
        {weekLog.map((week) => (
          <li data-testid={`gym-week-log-${week.weekIndex}`} key={week.weekIndex}>
            week {week.weekIndex}: {week.slots.map(describeSlotOutcome).join('; ')} — residual carry{' '}
            {week.effects.residualCarryMultiplier}, injury chance{' '}
            {week.effects.injuryChanceMultiplier}, technique bonus{' '}
            {week.effects.techniqueQualityBonus}, ceiling growth {week.effects.ceilingGrowthPerWeek}
          </li>
        ))}
      </ul>
      <section data-testid={'gym-dev-controls'}>
        <h2>dev control</h2>
        <p>
          not part of the game: each button feeds that many elapsed seconds to the shipped
          accrual, so a human can judge the pacing without waiting it out. The last one jumps
          straight to the next weekly-allocation boundary, computed from the shipped week length,
          so a human can feel the allocation decision without grinding every check-in between.
        </p>
        {ladderDevTimeSteps().map((step) => (
          <button
            key={step.label}
            data-testid={`gym-advance-${step.seconds}`}
            onClick={() => props.dispatch({ kind: 'advance-clock', gapSeconds: step.seconds })}
          >
            {step.label}
          </button>
        ))}
        <button
          data-testid={'gym-advance-next-week'}
          onClick={() => props.dispatch({ kind: 'advance-to-next-week' })}
        >
          +1 week boundary
        </button>
      </section>
    </main>
  );
}
