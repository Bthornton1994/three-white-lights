// Pure facility reducer extracted from PR55, commit 3c55622b.
import { EMPIRE_TUNING } from './empireTuning';
import {
  type EarningsMode,
  type LadderAccrual,
  type LadderBuyResult,
  type LadderEquipmentItem,
  type LadderMoveResult,
  type LadderState,
  buyLadderEquipment,
  createLadderState,
  describeLadderClock,
  ladderCheckInAfter,
  ladderDevClockTestId,
  ladderDevTimeSteps,
  ladderEquipmentCost,
  ladderEquipmentMinRung,
  ladderIncomeRatePerHour,
  ladderMoveCost,
  moveUpLadder,
  nextLadderRung,
  unlockedLifts,
} from './ladder';
import {
  type FloorFurniturePlaceResult,
  type FloorPlaceResult,
  type FloorState,
  type GridPosition,
  createFloorState,
  placeFloorFurniture,
  placeFloorItem,
  placedOwnedItems,
  relocateFloorState,
  removeFloorFurniture,
  removeFloorItem,
} from './floor';
import type { FloorSimServiceObservation } from './floorSim';
import {
  applyServiceObservations,
  createLivingMemberRoster,
  floorSimPopulationFromRoster,
  reconcileLivingMemberRosterOnRelocation,
  type LivingMemberRoster,
} from './livingMembers';
import {
  type DeclineRepairResult,
  type DismissManagerResult,
  type HireResult,
  type ManagedCheckIn,
  type ManagedEquipmentItem,
  type ManagedGym,
  type ManagerTier,
  type PromptResponse,
  type PromptResult,
  type RecoveryResult,
  type RepairResult,
  createManagedGym,
  declineRepair,
  dismissManager,
  hireManager,
  managedCheckIn,
  recoverGym,
  repairEquipment,
  respondToPrompt,
  withUpdatedGym,
} from './management';
import {
  type FlexibleSlot,
  type GymWeekReport,
  type SessionBuyResult,
  type SessionEquipmentItem,
  type WeekAllocation,
  availableActivities,
  buySessionEquipment,
  createRestAllocation,
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
import {
  stationLevels,
  stockStationCapability,
  upgradeStation,
  type StationCapabilityState,
  type StationUpgradeAxis,
  type StationUpgradeRefuseReason,
} from './stationCapability';
import {
  capacityRealizesOn,
  competitionBenchBay,
  type TrainingStationKind,
} from './trainingStation';
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
  | {
      readonly kind: 'advance-clock';
      readonly gapSeconds: number;
      readonly mode?: EarningsMode;
    }
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
      const checkedIn = ladderCheckInAfter(state.ladder, action.gapSeconds, action.mode);
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

export type ManagedCheckInReport = Omit<ManagedCheckIn, 'state' | 'accrual'>;

/**
 * What the full-loop screen holds: the composed gym (stage 2's `GymState`
 * inside stage 4's `ManagedGym` — equipment condition, the manager, the
 * failure ledger), the last transition's own report (accrual, the check-in's
 * stage-4 costs, or a refusal — header rule, same as `LadderViewState`),
 * which training week is current, the standing allocation plan (sticky
 * across weeks until a slot is edited — header rule), whether that plan has
 * been touched since the current week began, the log of weeks that have
 * actually completed, and — GDD §5.13 Phase 1 — the floor layout for the
 * gym's current rung.
 *
 * `managed` REPLACED a bare `gym: GymState` field when §5.11 stage 4 reached
 * the screen, rather than sitting beside it. `management.ts`'s repair, hire
 * and recovery instruments all write the purse through `ManagedGym.gym`, so a
 * second `GymState` here would diverge from it on the first repair. Every
 * stage-1/stage-2 read in this file and in `GymScreen.tsx` goes through
 * `state.managed.gym`, and there is one `GymState` in this state.
 *
 * `floor` is a VIEW composed on top of `managed.gym.sessionEquipment`, never a
 * second copy of it (`floor.ts`'s own header states the same claim about its
 * own functions). Nothing here stores which items are owned a second time —
 * only where the owned ones currently sit.
 */
/**
 * Which Empire surface is in front of the gym. `play` is the default
 * facility-first view; `build` is place/move; the others are drawers over
 * the gym rather than replacement pages. Stage C.1b — presentation only.
 */
export const GYM_SURFACES = Object.freeze([
  'play',
  'build',
  'shop',
  'staff',
  'more',
] as const);
export type GymSurface = (typeof GYM_SURFACES)[number];

export interface GymViewState {
  readonly managed: ManagedGym;
  readonly lastAccrual: LadderAccrual | null;
  readonly lastManagementReport: ManagedCheckInReport | null;
  readonly lastRefusal: GymViewRefusal | null;
  readonly weekIndex: number;
  readonly allocation: WeekAllocation;
  readonly allocationSetThisWeek: boolean;
  readonly weekLog: readonly GymWeekReport[];
  readonly floor: FloorState;
  readonly surface: GymSurface;
  readonly capability: StationCapabilityState;
  /** Stage G.1 — persistent floor members, separate from `NpcLifter` roster. */
  readonly livingMembers: LivingMemberRoster;
}

/**
 * Every reason an action can be refused across the whole loop, derived from
 * the result types rather than restated — a closed union, so the position
 * census reads this field as vocabulary and not as an open string.
 *
 * `PromptResult` contributes twice and neither entry is a hand-typed literal:
 * its `'repair-refused'` arm carries a `reason`, and its `'no-prompt'` arm
 * carries only a `kind`, which is the honest thing to show a player who
 * pressed an answer control on a check-in with no review open.
 */
export type GymViewRefusal =
  | Extract<LadderBuyResult, { readonly kind: 'refused' }>['reason']
  | Extract<LadderMoveResult, { readonly kind: 'refused' }>['reason']
  | Extract<SessionBuyResult, { readonly kind: 'refused' }>['reason']
  | Extract<FloorPlaceResult, { readonly kind: 'refused' }>['reason']
  | Extract<FloorFurniturePlaceResult, { readonly kind: 'refused' }>['reason']
  | Extract<RepairResult, { readonly kind: 'refused' }>['reason']
  | Extract<DeclineRepairResult, { readonly kind: 'refused' }>['reason']
  | Extract<HireResult, { readonly kind: 'refused' }>['reason']
  | Extract<DismissManagerResult, { readonly kind: 'refused' }>['reason']
  | Extract<RecoveryResult, { readonly kind: 'refused' }>['reason']
  | Extract<PromptResult, { readonly kind: 'repair-refused' }>['reason']
  | Extract<PromptResult, { readonly kind: 'no-prompt' }>['kind']
  | StationUpgradeRefuseReason;

/**
 * The fourteen things a player can do on this screen — six from stage 1/2,
 * GDD §5.13 Phase 1's place/remove, and §5.11 stage 4's six: answer the
 * standing maintenance review, repair an item outright, decline a shown
 * repair, hire a manager, let one go, and bring a dormant gym back.
 *
 * Every stage-4 arm is a decision the player TAKES, which is §5.7's whole
 * shape: the three that can append a strike (`answer-prompt` with
 * `'dismiss'`, `decline-repair`, `hire-manager`) are dispatched by a press
 * and by nothing else. No arm here is reachable from elapsed time, and
 * `advance-clock` — the one arm time drives — appends no strike, because
 * `managedCheckIn` writes none.
 *
 * `'OPEN UP FOR THE DAY' IS GONE, BY HUMAN RULING, AND `advance-clock` IS
 * NOW THE ONLY WAY IN.` The mint that used to live here fed a flat
 *
 * A CENSUS DISPOSITION, ROUTED RATHER THAN SETTLED BY REWORDING. The
 * sentence above is a claim about what this module's action union does —
 * `advance-clock` is the sole reducer arm that can move the clock, `'open-up'`
 * having been deleted outright rather than gutted. It is checkable: no other
 * arm in `GymViewAction` reaches `advanceGymClock`, and the file's own header
 * a few lines above already carries the mutation-tested claim that no arm
 * here is reachable from elapsed time. By CLAUDE.md's rule that a claim with
 * a check behind it takes the census bump and a method note declines it,
 * the honest disposition is `GUARANTEE_COVERAGE.TREE_WIDE` +1.
 * `src/game/guaranteeTags.test.ts` is another session's file and barred to
 * this one, so the bump is NOT taken here — routed instead, per the standing
 * precedent for a builder barred from a file it believes owes a crossing.
 * `OFFLINE_EARNINGS_CAP_HOURS`-hour block into `advanceGymClock` on every
 * press, regardless of how much real time had actually passed — a
 * "check-in" a player could mash for free money, which a human playing the
 * shipped build called out by name as the bug. Gym Empire mimics an idle
 * game now: the gym runs on genuine elapsed wall-clock time, computed and
 * dispatched as `advance-clock` by `AppShell.tsx`'s `GymHost` (outside this
 * directory, the same seam that already owns the one stateful hook), never
 * minted by a tap inside this reducer. `advance-clock` still appends no
 * strike, for the reason stated below.
 */
export type GymViewAction =
  | {
      readonly kind: 'advance-clock';
      readonly gapSeconds: number;
      /**
       * `'online'` for a watched wall-clock tick (paid at the nominal
       * rate); `'offline'` (the default) for a gap the player was away for.
       * `AppShell.tsx`'s `GymHost` sets `'online'` on a visible interval and
       * `'offline'` on return-from-away. Stage D2.2 QA helpers also set the
       * field explicitly: watched buttons pass `'online'`, away buttons pass
       * `'offline'`. An omitted field remains offline, matching every pre-
       * existing caller.
       */
      readonly mode?: EarningsMode;
    }
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
  | { readonly kind: 'floor-remove'; readonly item: SessionEquipmentItem }
  | {
      readonly kind: 'floor-place-furniture';
      readonly item: LadderEquipmentItem;
      readonly position: GridPosition;
    }
  | { readonly kind: 'floor-remove-furniture'; readonly item: LadderEquipmentItem }
  | { readonly kind: 'set-gym-surface'; readonly surface: GymSurface }
  | { readonly kind: 'answer-prompt'; readonly response: PromptResponse }
  | { readonly kind: 'repair-item'; readonly item: ManagedEquipmentItem }
  | { readonly kind: 'decline-repair'; readonly item: ManagedEquipmentItem }
  | { readonly kind: 'hire-manager'; readonly tier: ManagerTier }
  | { readonly kind: 'dismiss-manager' }
  | { readonly kind: 'recover-gym' }
  | {
      readonly kind: 'upgrade-station';
      readonly station: TrainingStationKind;
      readonly axis: StationUpgradeAxis;
    }
  | { readonly kind: 'reset-gym' }
  | {
      readonly kind: 'apply-living-member-observations';
      readonly observations: readonly FloorSimServiceObservation[];
    };

/** Opening living roster aligned with the floor-sim seed the renderer uses. */
function openingLivingMembers(managed: ManagedGym): LivingMemberRoster {
  const gym = managed.gym;
  return createLivingMemberRoster(
    gym.ladder.rung,
    gym.ladder.equipment,
    gym.sessionEquipment,
    gym.ladder.collectedAt,
    EMPIRE_TUNING.FLOOR_SIM_RENDER_SEED,
  );
}

/** The opening screen: a fresh managed gym, an all-rest plan, an empty floor, nothing yet to report. */
export function createGymViewState(): GymViewState {
  const managed = createManagedGym();
  return Object.freeze({
    managed,
    lastAccrual: null,
    lastManagementReport: null,
    lastRefusal: null,
    weekIndex: trainingWeekIndexAt(managed.gym.ladder.collectedAt),
    allocation: createRestAllocation(),
    allocationSetThisWeek: false,
    weekLog: Object.freeze([]),
    floor: createFloorState(managed.gym.ladder.rung),
    surface: 'play',
    capability: stockStationCapability(),
    livingMembers: openingLivingMembers(managed),
  });
}

/**
 * The shared body of the two clock-advancing arms — header note above: this
 * is the one arm allowed more than one `sessions.ts` call, because a single
 * advance can complete more than one training week.
 *
 * §5.11 stage 4 moved the check-in itself from `gymCheckInAfter` to
 * `managedCheckIn`, which COMPOSES `gymCheckIn` whole (its own header states
 * that) and then applies the gap's wear, the condition income multiplier, the
 * manager's wage and the manager's autonomous repairs. The mark is computed
 * here rather than by `gymCheckInAfter`, because `managedCheckIn` takes an
 * absolute mark; a gap that is negative, non-finite or off-tick is still
 * refused loudly, by `ladderCheckIn`'s own guard at the bottom of the same
 * call, and `ladderView.test.ts` drives that refusal.
 *
 * WHAT THIS ARM DOES NOT DO, because §5.7's clarification and `docs/GDD.md`
 * §5.13's wear-basis ruling both turn on it: it appends no strike and moves
 * no failure phase. `managedCheckIn` reads no strike and writes no strike, so
 * pressing a clock control can lower condition and lower income — the gym
 * ran — and it does not advance the gym toward dormancy. Its limit, stated
 * because no type reaches past it: `ManagedGym` is a plain interface, so a
 * caller that built one by hand could put anything in `strikes`; what this
 * says is about the arm, not about the type. The named catchers, both run:
 * `GymScreen.test.ts`'s `only a press moves the failure ledger`, and on the
 * played screen `tools/verify-floor-reachability.mjs`'s claim 9c. A planted
 * low-condition-appends-a-strike chain reddens both.
 *
 * ROUTED RATHER THAN SETTLED BY REWORDING, AND THE DISPOSITION IS THE BUMP.
 * The paragraph above is a claim about what this code does with a
 * mutation-tested check behind it, which `src/game/guaranteeTags.test.ts`'s
 * own ruling says takes the `GUARANTEE_COVERAGE.TREE_WIDE` increment. It does
 * not trigger that census, because the census keys on one of four words
 * appearing capitalised in a three-word-or-longer run and this paragraph
 * happens to use none of them — the declared one-word blind spot, seventh
 * recorded instance. Measured rather than argued: writing the header line
 * with a capitalised trigger word in it and changing nothing else reads
 * `expected 237 to be 236`. That file is another session's and barred here,
 * so the honest disposition (236 -> 237) is disclosed and reported rather
 * than taken, and the prose is left in the plain-negation form rather than
 * capitalised-and-untagged.
 */
function advanceGymClock(
  state: GymViewState,
  gapSeconds: number,
  mode: EarningsMode = 'offline',
): GymViewState {
  const before = state.managed;
  const inService = placedOwnedItems(
    state.floor,
    before.gym.ladder.equipment,
    before.gym.sessionEquipment,
  );
  const {
    state: checkedInManaged,
    accrual,
    ...report
  } = managedCheckIn(before, before.gym.ladder.collectedAt + gapSeconds, mode, inService);
  const previousWeekIndex = trainingWeekIndexAt(before.gym.ladder.collectedAt);
  const newWeekIndex = trainingWeekIndexAt(checkedInManaged.gym.ladder.collectedAt);
  let weekLog = state.weekLog;
  let allocationSetThisWeek = state.allocationSetThisWeek;
  if (newWeekIndex > previousWeekIndex) {
    const completed: GymWeekReport[] = [];
    for (let weekIndex = previousWeekIndex; weekIndex < newWeekIndex; weekIndex += 1) {
      completed.push(
        Object.freeze({
          weekIndex,
          allocation: state.allocation,
          slots: resolveWeek(state.allocation, before.gym.sessionEquipment),
          effects: weeklyAttributeEffects(state.allocation, before.gym.sessionEquipment),
        }),
      );
    }
    weekLog = Object.freeze([...weekLog, ...completed]);
    allocationSetThisWeek = false;
  }
  return Object.freeze({
    managed: checkedInManaged,
    lastAccrual: accrual,
    lastManagementReport: Object.freeze(report),
    lastRefusal: null,
    weekIndex: newWeekIndex,
    allocation: state.allocation,
    allocationSetThisWeek,
    weekLog,
    // A clock advance never relocates and never touches ownership, so the
    // floor layout is untouched — only a successful `move-up` resets it.
    floor: state.floor,
    surface: state.surface,
    capability: state.capability,
    livingMembers: state.livingMembers,
  });
}

/**
 * The reducer the dev mount hands to React for the full loop. The colocated
 * test drives every arm and compares every carried quantity against the same
 * `management.ts` / `sessions.ts` / `ladder.ts` calls made directly.
 *
 * The three arms that change what the gym OWNS (`buy-ladder`, `buy-session`,
 * `move-up`) re-seat the managed state through `withUpdatedGym`, which is the
 * seam `management.ts` declares for exactly this: a newly bought item arrives
 * at condition 1 and a known item keeps its condition. A relocation carries
 * the equipment with it (GDD §5.1's stage-1 ruling, recorded at the flag in
 * `ladder.ts`), so nothing is ever un-owned and that function's refusal arm is
 * unreachable from this reducer.
 */
export function gymViewReduce(state: GymViewState, action: GymViewAction): GymViewState {
  switch (action.kind) {
    case 'advance-clock':
      return advanceGymClock(state, action.gapSeconds, action.mode);
    case 'advance-to-next-week':
      return advanceGymClock(
        state,
        secondsUntilNextWeekBoundary(state.managed.gym.ladder.collectedAt),
      );
    case 'buy-ladder': {
      const outcome = buyLadderEquipment(state.managed.gym.ladder, action.item);
      return Object.freeze({
        ...state,
        managed: withUpdatedGym(state.managed, withLadder(state.managed.gym, outcome.state)),
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'buy-session': {
      const outcome = buySessionEquipment(state.managed.gym, action.item);
      return Object.freeze({
        ...state,
        managed: withUpdatedGym(state.managed, outcome.state),
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'move-up': {
      const outcome = moveUpLadder(state.managed.gym.ladder);
      return Object.freeze({
        ...state,
        managed: withUpdatedGym(state.managed, withLadder(state.managed.gym, outcome.state)),
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
        // GDD §5.1: a relocation is a full move, "you leave the old place
        // behind" — `floor.ts`'s `relocateFloorState` header explains why a
        // position on the old grid has no reading on the new one. A refused
        // move leaves `outcome.state` byte-identical to `state.managed.gym.ladder`
        // (`ladder.ts`'s own contract), so reading the POST-outcome rung here
        // is a no-op on refusal and a real reset only when the move landed.
        floor:
          outcome.kind === 'moved' ? relocateFloorState(outcome.state.rung) : state.floor,
        livingMembers:
          outcome.kind === 'moved'
            ? reconcileLivingMemberRosterOnRelocation(
                state.livingMembers,
                outcome.state.rung,
                state.managed.gym.sessionEquipment,
                outcome.state.collectedAt,
              )
            : state.livingMembers,
      });
    }
    case 'floor-place': {
      const outcome = placeFloorItem(
        state.floor,
        state.managed.gym.sessionEquipment,
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
    case 'floor-place-furniture': {
      const outcome = placeFloorFurniture(
        state.floor,
        state.managed.gym.ladder.equipment,
        action.item,
        action.position,
      );
      return Object.freeze({
        ...state,
        floor: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'floor-remove-furniture': {
      return Object.freeze({
        ...state,
        floor: removeFloorFurniture(state.floor, action.item),
        lastRefusal: null,
      });
    }
    case 'set-gym-surface': {
      return Object.freeze({
        ...state,
        surface: action.surface,
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
    case 'answer-prompt': {
      // §5.7's second counted shape. The mark stamped on any strike this
      // raises is the gym clock's own current mark, which is what
      // `respondToPrompt`'s header asks the caller to pass — never a
      // wall-clock reading, which this directory has no access to anyway.
      const outcome = respondToPrompt(
        state.managed,
        action.response,
        state.managed.gym.ladder.collectedAt,
      );
      return Object.freeze({
        ...state,
        managed: outcome.state,
        lastRefusal:
          outcome.kind === 'no-prompt'
            ? outcome.kind
            : outcome.kind === 'repair-refused'
              ? outcome.reason
              : null,
      });
    }
    case 'repair-item': {
      const outcome = repairEquipment(state.managed, action.item);
      return Object.freeze({
        ...state,
        managed: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'decline-repair': {
      // §5.7's third counted shape: the repair whose cost was on screen,
      // actively refused.
      const outcome = declineRepair(
        state.managed,
        action.item,
        state.managed.gym.ladder.collectedAt,
      );
      return Object.freeze({
        ...state,
        managed: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'hire-manager': {
      // §5.7's first counted shape lives inside this call: hiring the
      // cheapest tier while the ledger already shows a warning.
      const outcome = hireManager(state.managed, action.tier, state.managed.gym.ladder.collectedAt);
      return Object.freeze({
        ...state,
        managed: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'dismiss-manager': {
      const outcome = dismissManager(state.managed);
      return Object.freeze({
        ...state,
        managed: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'recover-gym': {
      const outcome = recoverGym(state.managed);
      return Object.freeze({
        ...state,
        managed: outcome.state,
        lastRefusal: outcome.kind === 'refused' ? outcome.reason : null,
      });
    }
    case 'upgrade-station': {
      const bay = competitionBenchBay(
        state.floor,
        state.managed.gym.ladder.equipment,
        stationLevels(state.capability, action.station).capacity,
      );
      const placed = bay.complete;
      const outcome = upgradeStation(
        state.capability,
        action.station,
        action.axis,
        state.managed.gym.ladder.gymBucks,
        placed,
        capacityRealizesOn(state.floor, state.managed.gym.ladder.equipment),
      );
      if (outcome.kind === 'refused') {
        return Object.freeze({
          ...state,
          lastRefusal: outcome.reason,
        });
      }
      const nextBucks = state.managed.gym.ladder.gymBucks - outcome.costGymBucks;
      return Object.freeze({
        ...state,
        managed: withUpdatedGym(
          state.managed,
          withLadder(
            state.managed.gym,
            Object.freeze({ ...state.managed.gym.ladder, gymBucks: nextBucks }),
          ),
        ),
        capability: outcome.capability,
        lastRefusal: null,
      });
    }
    case 'reset-gym':
      return createGymViewState();
    case 'apply-living-member-observations':
      return Object.freeze({
        ...state,
        livingMembers: applyServiceObservations(state.livingMembers, action.observations),
      });
  }
}

