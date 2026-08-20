/**
 * GymScreen.tsx — the native equivalent of `ladderView.tsx`'s `GymView`.
 *
 * WHY THIS FILE EXISTS, RATHER THAN REUSING `GymView` DIRECTLY. `GymView`
 * renders plain DOM host tags (`<span>`, `<button onClick={...}>`) with no
 * `react-native` import at all — a deliberate choice so the S1b/S2b stage-gate
 * instrument (`ladder-dev.tsx`/`ladder-dev.html`) could serve a human
 * play-through in a browser without widening this directory's import fence to
 * include `react-native`. The real app is Expo/React Native: every real
 * screen is built on `View`/`Text`/`Pressable`/`StyleSheet`, and the RN
 * reconciler does not understand a DOM host tag — mounting `GymView`'s markup
 * inside it throws at the point it is rendered. So this file exists to be the
 * thing that *can* be mounted there, reusing everything about `GymView` that
 * is not its JSX.
 *
 * WHAT IS REUSED, AND WHAT IS NOT. `GymViewState`, `GymViewAction`,
 * `GymViewProps`, `gymViewReduce` and `createGymViewState` are imported from
 * `./ladderView` and used UNCHANGED — this file declares no state shape, no
 * action union and no reducer of its own. `GymView`'s JSX itself is not
 * imported and not read from at runtime; only its *shape* is ported by hand,
 * tag for tag, into RN primitives, because CLAUDE.md's "Pure logic is
 * separate from UI" cuts both ways: a render tree is not pure logic to begin
 * with, so porting it is not a duplication of anything this repository asks
 * to live in one place. The only new code in this file is the render
 * function `GymScreen` itself — no new types, no new reducer arm, no new
 * arithmetic. Every displayed quantity is read directly from a `ladder.ts` or
 * `sessions.ts` pure function call, the same discipline `GymView`'s own
 * header states and the render test below drives.
 *
 * NO HELPER SUB-COMPONENT FOR ANYTHING THIS FILE COULD WRITE INLINE, ON
 * PURPOSE. An earlier version of this file factored the repeated "Pressable
 * wrapping a Text label" shape into a `DispatchButton` function and
 * referenced it as a JSX `type` (`<DispatchButton .../>`). That makes the
 * returned element's `type` field a FUNCTION rather than a string — unlike
 * every element `GymView` ever returns, whose `type` is always a DOM tag
 * name — and it is read by `empireForbiddenOutput.test.ts`'s driver as a new,
 * previously-unseen kind of declined closure position that instrument C's
 * own returned-closure census had no row for. `GymView` and `LadderView` both
 * avoid this by using no sub-components at all; every button in THIS file
 * that could be written inline still is, at its own call site, for the same
 * reason.
 *
 * ONE EXCEPTION, NAMED RATHER THAN SILENTLY BREAKING THE RULE ABOVE:
 * `<FloorGrid .../>` (GDD §5.13 Phase 1, `./FloorGrid`). Unlike
 * `DispatchButton`, `FloorGrid` cannot be written inline even in principle —
 * it needs component-local state to track a live drag gesture across a
 * grab/move/release sequence, and `GymScreen` itself must stay hook-free (see
 * "WHO OWNS THE STATE" below) because `GymScreen.test.ts` and
 * `empireForbiddenOutput.test.ts` both call `GymScreen({state, dispatch})`
 * directly, outside React's reconciler, where a hook throws. So this is a
 * second closure position — not a re-introduction of the first — and
 * `empireForbiddenOutput.test.ts`'s own registrations name it explicitly
 * rather than the census silently walking past it. `FloorGrid.tsx`'s own
 * header explains the shape in full.
 *
 * WHO OWNS THE STATE. `GymScreen` takes `{ state, dispatch }` as props and
 * computes nothing else — a pure function of its props, exactly like
 * `GymView`. The one stateful hook (`useReducer`) lives outside this
 * directory, in `src/shell/`, the same place `ladder-dev.tsx` puts it for the
 * web harness. That keeps this file render-only in the checkable sense this
 * directory already uses: no `react` import is needed for JSX itself (the
 * project's `jsx: react-jsx` transform supplies it at build time), and the
 * only external import this file adds is `react-native`, for the primitives
 * used as values (`View`, `Text`, `Pressable`, `ScrollView`) rather than as
 * JSX intrinsics — RN component references are not ambient the way a DOM tag
 * name is, so they must be imported explicitly, unlike `GymView`.
 *
 * WHAT IS DELIBERATELY NOT HERE: a "move down" control. GDD §5.1 states the
 * ladder is "linear and one-way" — `ladder.ts` ships `moveUpLadder` and no
 * inverse, and this screen does not invent one.
 *
 * TESTIDs. Every interactive or reported element carries a `testID`, prefixed
 * `gymscreen-` to stay distinct from `GymView`'s own `data-testid` values
 * (the two are never mounted at once, but the prefix keeps a browser-driven
 * check unambiguous about which screen it found). `react-native-web` — which
 * is what actually renders when this runs under `expo start --web` — maps
 * `testID` to the DOM `data-testid` attribute, so a Playwright check can
 * select on `[data-testid="gymscreen-..."]` exactly as the existing
 * `tools/verify-*.mjs` scripts select on the DOM screens.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';

import { EMPIRE_TUNING } from './empireTuning';
import { FloorGrid } from './FloorGrid';
import { type GymViewAction, type GymViewProps } from './ladderView';
import {
  describeLadderClock,
  ladderDevTimeSteps,
  ladderEquipmentCost,
  ladderEquipmentMinRung,
  ladderIncomeRatePerHour,
  ladderMoveCost,
  nextLadderRung,
  unlockedLifts,
} from './ladder';
import {
  type FlexibleSlot,
  type GymWeekReport,
  availableActivities,
  resolveWeek,
  sessionEquipmentCost,
  sessionEquipmentGroup,
  sessionEquipmentMinRung,
  trainingWeekShape,
  weeklyAttributeEffects,
} from './sessions';

/** Every slot value a player may choose, in the fixed §5.5 order plus rest — the same list `GymView` derives, ported rather than imported (it is a private helper there, not exported). */
function allocationOptions(): readonly FlexibleSlot[] {
  return Object.freeze([...EMPIRE_TUNING.FLEXIBLE_ACTIVITIES, 'rest']);
}

/** One `SlotOutcome`, in words a player reads without decoding the union — ported from `GymView`'s private `describeSlotOutcome`. */
function describeSlotOutcome(outcome: GymWeekReport['slots'][number]): string {
  if (outcome.kind === 'rested') return 'rested';
  if (outcome.kind === 'trained') return `trained: ${outcome.activity}`;
  return `${outcome.activity} - unequipped, needs ${outcome.requires}`;
}

/**
 * The native stage-1+2 screen. Prop-taking on purpose, the same reason
 * `GymView` gives: a pure function of its props, so a render test can invoke
 * it directly, and so the one stateful hook stays outside `src/empire/`.
 */
export function GymScreen(props: GymViewProps) {
  const {
    gym,
    lastAccrual,
    lastRefusal,
    weekIndex,
    allocation,
    allocationSetThisWeek,
    weekLog,
    floor,
  } = props.state;
  const destination = nextLadderRung(gym.ladder.rung);
  const ownedLadder = new Set<string>(gym.ladder.equipment);
  const ownedSession = new Set<string>(gym.sessionEquipment);
  const shape = trainingWeekShape();
  const previewOutcomes = resolveWeek(allocation, gym.sessionEquipment);
  const previewEffects = weeklyAttributeEffects(allocation, gym.sessionEquipment);
  const available = availableActivities(gym.sessionEquipment);
  const dispatch = (action: GymViewAction): void => props.dispatch(action);

  return (
    <ScrollView testID={'gymscreen-root'}>
      <View testID={'gymscreen-week'}>
        <Text>
          week {weekIndex} ({shape.fixed} fixed + {shape.flexible} flexible = {shape.total}{' '}
          sessions) — {allocationSetThisWeek ? 'allocated this week' : 'not yet allocated this week'}
        </Text>
      </View>
      <View>
        <Text testID={'gymscreen-rung'}>rung {gym.ladder.rung}</Text>
        <Text testID={'gymscreen-rate'}>
          earning {ladderIncomeRatePerHour(gym.ladder.rung)} gym bucks per hour
        </Text>
      </View>
      <View>
        <Text testID={'gymscreen-gym-bucks'}>gym bucks: {gym.ladder.gymBucks}</Text>
        <Text testID={'gymscreen-accelerated-bucks'}>accelerated: {gym.acceleratedGymBucks}</Text>
        <Text testID={'gymscreen-clock'}>clock: {describeLadderClock(gym.ladder.collectedAt)}</Text>
      </View>
      <Text testID={'gymscreen-lifts'}>lifts unlocked: {unlockedLifts(gym.ladder.equipment).join(', ')}</Text>
      {lastAccrual === null ? null : (
        <Text testID={'gymscreen-accrual'}>
          last advance banked {lastAccrual.secondsBanked}s of {lastAccrual.secondsElapsed}s, paid{' '}
          {lastAccrual.gymBucks} gym bucks, cap discarded {lastAccrual.secondsDiscarded}s
        </Text>
      )}
      {lastRefusal === null ? null : (
        <Text testID={'gymscreen-refusal'}>refused: {lastRefusal}</Text>
      )}
      <View testID={'gymscreen-ladder-shop'}>
        {EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map((item) => (
          <View key={item}>
            <Text>
              {item} costs {ladderEquipmentCost(item)} gym bucks, fits from{' '}
              {ladderEquipmentMinRung(item)}
              {ownedLadder.has(item) ? ' - owned' : null}
            </Text>
            {ownedLadder.has(item) ? null : (
              <Pressable
                testID={`gymscreen-buy-ladder-${item}`}
                onPress={() => dispatch({ kind: 'buy-ladder', item })}
              >
                <Text>buy</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <View testID={'gymscreen-session-shop'}>
        {EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS.map((item) => (
          <View key={item}>
            <Text>
              {item} ({sessionEquipmentGroup(item)}) costs {sessionEquipmentCost(item)} gym bucks,
              fits from {sessionEquipmentMinRung(item)}
              {ownedSession.has(item) ? ' - owned' : null}
            </Text>
            {ownedSession.has(item) ? null : (
              <Pressable
                testID={`gymscreen-buy-session-${item}`}
                onPress={() => dispatch({ kind: 'buy-session', item })}
              >
                <Text>buy</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <View testID={'gymscreen-move'}>
        {destination === null ? (
          <Text>top of the ladder - the portfolio arrives with stage four</Text>
        ) : (
          <>
            <Text>
              next: {destination} for {ladderMoveCost(destination)} gym bucks
            </Text>
            <Pressable testID={'gymscreen-move-up'} onPress={() => dispatch({ kind: 'move-up' })}>
              <Text>relocate</Text>
            </Pressable>
          </>
        )}
      </View>
      <View testID={'gymscreen-allocation'}>
        <Text testID={'gymscreen-available-now'}>
          available now: {available.length === 0 ? 'none' : available.join(', ')}
        </Text>
        {([0, 1, 2] as const).map((slotIndex) => (
          <View testID={`gymscreen-slot-${slotIndex}`} key={slotIndex}>
            <Text>
              slot {slotIndex}: {allocation[slotIndex]} — {describeSlotOutcome(previewOutcomes[slotIndex])}
            </Text>
            {allocationOptions().map((option) => (
              <Pressable
                key={option}
                testID={`gymscreen-slot-${slotIndex}-set-${option}`}
                onPress={() => dispatch({ kind: 'set-allocation-slot', slotIndex, slot: option })}
              >
                <Text>{option}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <Text testID={'gymscreen-week-preview'}>
          if this week ended now: residual carry {previewEffects.residualCarryMultiplier}, injury
          chance {previewEffects.injuryChanceMultiplier}, technique bonus{' '}
          {previewEffects.techniqueQualityBonus}, ceiling growth {previewEffects.ceilingGrowthPerWeek}
        </Text>
      </View>
      <View testID={'gymscreen-week-log'}>
        {weekLog.map((week) => (
          <Text testID={`gymscreen-week-log-${week.weekIndex}`} key={week.weekIndex}>
            week {week.weekIndex}: {week.slots.map(describeSlotOutcome).join('; ')} — residual carry{' '}
            {week.effects.residualCarryMultiplier}, injury chance {week.effects.injuryChanceMultiplier},
            technique bonus {week.effects.techniqueQualityBonus}, ceiling growth{' '}
            {week.effects.ceilingGrowthPerWeek}
          </Text>
        ))}
      </View>
      <View testID={'gymscreen-floor'}>
        <Text>the floor — grid and placement, no members, no final art yet</Text>
        <FloorGrid owned={gym.sessionEquipment} floor={floor} dispatch={dispatch} />
      </View>
      <View testID={'gymscreen-dev-controls'}>
        <Text>
          not part of the game: each button feeds that many elapsed seconds to the shipped accrual,
          so a player checks in without waiting it out. The last one jumps straight to the next
          weekly-allocation boundary.
        </Text>
        {ladderDevTimeSteps().map((step) => (
          <Pressable
            key={step.label}
            testID={`gymscreen-advance-${step.seconds}`}
            onPress={() => dispatch({ kind: 'advance-clock', gapSeconds: step.seconds })}
          >
            <Text>{step.label}</Text>
          </Pressable>
        ))}
        <Pressable
          testID={'gymscreen-advance-next-week'}
          onPress={() => dispatch({ kind: 'advance-to-next-week' })}
        >
          <Text>+1 week boundary</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
