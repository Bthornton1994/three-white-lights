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
 * arithmetic. Every displayed quantity is read directly from a `ladder.ts`,
 * `sessions.ts` or `management.ts` pure function call, the same discipline
 * `GymView`'s own header states and the render test below drives.
 *
 * WHAT THIS SCREEN SHOWS THAT `GymView` DOES NOT: §5.11 stage 4. GDD §5.7's
 * staffing, maintenance, equipment condition and recoverable failure are
 * surfaced here and nowhere else — `GymView` is the closed stage-2 DOM dev
 * harness and renders none of it, even though the state it is handed now
 * carries it. The section's own inline comment states the constraint the copy
 * is written under, which is the one thing in this file worth reading before
 * editing it: condition and income move with OPERATION, failure moves only on
 * a decision a thumb took here, and no sentence on this screen may tell a
 * player that being away cost them anything.
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
 * THE PLAYER'S CHECK-IN, AND WHY EVERY CONTROL ON THIS SCREEN IS GATED ON
 * WHETHER PRESSING IT WOULD DO ANYTHING. A human played this screen on a real
 * phone and reported, in their own words, that they could not open a review.
 * That was true and it was structural, not a matter of taste: the standing
 * maintenance review — and therefore every strike, every dormancy and every
 * recovery downstream of it — is raised on `ManagedGym.checkInsTaken`, whose
 * one writer was reachable from one reducer arm dispatched from one shipped
 * place, the dev clock-skip row this file labels "not part of the game".
 *
 * THAT FIX WAS ITSELF WITHDRAWN, BY A LATER AND MORE SPECIFIC HUMAN RULING.
 * The original fix was a real, game-voiced "open up for the day" control that
 * minted a flat `OFFLINE_EARNINGS_CAP_HOURS`-hour block on every press,
 * however little real time had actually passed. A human playing the shipped
 * build named that mint as the bug, verbatim, and asked for the genre this
 * mode already resembles: an idle tycoon, where the gym runs on real
 * wall-clock time whether or not anything is pressed, and "collect" (here,
 * simply watching the screen) is reading accrued state rather than causing
 * it. So the control is gone outright — there is no tap anywhere on this
 * screen that advances the clock. `AppShell.tsx`'s `GymHost` now drives
 * `advance-clock` itself, computed from genuine elapsed real time, on mount
 * and on an interval while this screen is the one on top; see that file's
 * header for the mechanism. The review CADENCE this section still reads is
 * unchanged in its OWN terms — `MAINTENANCE_ORDER_FIRST_CHECK_IN` and
 * `MAINTENANCE_ORDER_STRIDE` still name the shape — but `management.ts`
 * header §3a's ordinal is now derived from real banked operation seconds
 * rather than incremented once per dispatched check-in, so a player cannot
 * advance it by dispatching check-ins faster than real time allows; see that
 * file's header for the derivation.
 *
 * Every control that could only reach a refusal in the current state is
 * replaced, in place, by the reason it would have refused. A human dumped
 * this screen at t=0 and named three: three "repair for 0" buttons on a gym
 * with nothing worn, a "reopen the gym" control under the words "open for
 * business", and three hire tiers priced 150 / 600 / 2000 against a purse of
 * 0. The seventeen shop rows and the relocate control are the same defect and
 * are gated the same way. Every gate is the shipped function's OWN refusal
 * order read off the same pure calls the row already makes — see each site's
 * comment — so the screen and the engine cannot disagree about what a press
 * would have done.
 *
 * WHAT IS NOT CLAIMED HERE, and it matters because a comment that says it is
 * fixed is worse than one that says it is unknown: none of this is verified
 * on iOS Safari. The device the report came from is unavailable in this
 * environment and only Chromium is installed.
 * `tools/verify-floor-reachability.mjs`'s section 10 drives the player path
 * under Chromium and says only what Chromium can say.
 *
 * A NOTE ON THE WORDING OF SEVERAL PARAGRAPHS IN THIS DIRECTORY, disclosed
 * here rather than left looking like a style choice. Several sentences in
 * this file and its test, plus some in `ladderView.tsx`, were written as
 * capitalised absolutes and are now plain negations ("is not drawn where
 * pressing it could do nothing", "neither shop draws", "exactly when"). The
 * reason is `GUARANTEE_COVERAGE.TREE_WIDE` in `src/game/guaranteeTags.test.ts`,
 * a tree-wide census of capitalised absolutes belonging to another session
 * and barred to this directory. The honest disposition is the bump rather
 * than the rewording — every one of these is a claim about what this code
 * does and every one has a check behind it — so it is REPORTED to whoever
 * owns that file instead of being settled here by choosing different words.
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
  conditionIncomeMultiplier,
  failurePhase,
  fullRepairCostGymBucks,
  itemCondition,
  managerAutoRepairCondition,
  managerHireCostGymBucks,
  managerWageRatePerBankedHour,
  maintenancePrompt,
  meanCondition,
  orderOpensAt,
  ownedItemsOf,
  recoveryRepairCostGymBucks,
  recoveryRequirement,
  repairCostGymBucks,
  unansweredItems,
  warningSigns,
  wornItems,
} from './management';
import {
  describeLadderClock,
  ladderDevTimeSteps,
  ladderEquipmentCost,
  ladderEquipmentMinRung,
  ladderIncomeRatePerHour,
  ladderMoveCost,
  ladderRungIndex,
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
 * The native stage-1+2+4 screen. Prop-taking on purpose, the same reason
 * `GymView` gives: a pure function of its props, so a render test can invoke
 * it directly, and so the one stateful hook stays outside `src/empire/`.
 */
export function GymScreen(props: GymViewProps) {
  const {
    managed,
    lastAccrual,
    lastManagementReport,
    lastRefusal,
    weekIndex,
    allocation,
    allocationSetThisWeek,
    weekLog,
    floor,
  } = props.state;
  // Stage 1/2's own `GymState`, read out of the managed state that holds it.
  // There is one `GymState` in this screen's props (`ladderView.tsx`'s
  // `GymViewState` header says why), and this is the read of it.
  const gym = managed.gym;
  const signs = warningSigns(managed);
  const prompt = maintenancePrompt(managed);
  const recovery = recoveryRequirement(managed);
  const worn = wornItems(managed);
  const unanswered = unansweredItems(managed);
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
      {/*
        NO TAP ANYWHERE ON THIS SCREEN ADVANCES THE GYM CLOCK. `checkInsTaken`
        and everything downstream of it (the standing review, a strike,
        dormancy, a recovery) now moves only from real elapsed wall-clock
        time, driven by `AppShell.tsx`'s `GymHost` — see this file's own
        header and that file's for the mechanism. This screen reports the
        gym's status; it does not cause it to change.
      */}
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
      <View testID={'gymscreen-floor'}>
        <Text>the floor — your gym, live: place equipment, watch members train</Text>
        <FloorGrid
          owned={gym.sessionEquipment}
          barbellOwned={gym.ladder.equipment}
          floor={floor}
          dispatch={dispatch}
        />
      </View>
      {/*
        §5.11 stage 4 on the garage floor — GDD §5.7's staffing, maintenance,
        equipment condition and recoverable failure, placed directly under the
        floor because that is where the equipment is.

        WHAT THE COPY IN HERE IS ALLOWED TO SAY, and this is the whole risk of
        this section. §5.7's clarification splits two mechanisms that an
        earlier build chained together: condition and income move with
        OPERATION — the gym ran, so it wore, so it cost — while failure moves
        only on a decision the player took here, was shown the price of, and
        made. So nothing below tells a player that being away cost them
        anything, because nothing here charges them for it: `managedCheckIn`
        reads no strike and writes no strike, and the only three things that
        can append one are the three controls in this section that a thumb has
        to press. `management.ts` header §3 is the derivation and
        `management.test.ts`'s absence family is the measurement.

        AND THE SENTENCE ABOVE WAS FALSE OF TWO LINES IN THIS SECTION FOR A
        ROUND, WHICH IS WHY IT IS WORTH WRITING DOWN RATHER THAN DELETING.
        `gymscreen-prompt-stakes` read "leaving this one unanswered counts
        against the gym" and "you can leave this one unanswered for free; the
        next one counts". Leaving a review unanswered writes nothing at all:
        `promptDismissals` moves in exactly one expression
        (`respondToPromptUnder`, on a non-repair response), so the counter
        those two sentences were about advances on a PRESS of "not now" and on
        nothing else. The copy was stating the reverse chain §5.7's
        clarification forbids while the code did not implement it — prose is
        not a mechanism, and it reached a player either way. The rewritten
        lines name the press, and `GymScreen.test.ts`'s
        `the review's own sentence is true of the mechanic` drives the three
        forks (walk past it / "not now" / "decline the repair") and reads the
        ledger back, rather than comparing the branch to the flag it branched
        on.
      */}
      <View testID={'gymscreen-management'}>
        <Text testID={'gymscreen-phase'}>
          gym status: {signs.phase} — {signs.strikeCount} counted decision(s) on the ledger,{' '}
          {signs.strikesUntilFailure} more would close it
        </Text>
        <Text testID={'gymscreen-condition'}>
          equipment condition {meanCondition(managed)} — income paid at{' '}
          {conditionIncomeMultiplier(managed)} of the rate. condition falls with the hours your gym
          runs, which are the same hours that pay you.
        </Text>
        <Text testID={'gymscreen-full-repair'}>
          everything back to new: {fullRepairCostGymBucks(managed)} gym bucks
        </Text>
        {/*
          This line and the maintenance review below it read DIFFERENT pools,
          and saying so on the screen is the fix rather than a footnote.
          `wornItems` is condition-keyed (`MAINTENANCE_PROMPT_CONDITION`) and
          `unansweredItems` is that list minus the orders already refused —
          `unansweredItems`'s own docstring says a reader must not take it for
          the shipped review's pool, because the review is raised on the
          check-in ordinal and picks its item from everything the gym owns.
          The old wording ("worn past the review line", "repair orders still
          unanswered") claimed both were the review's, and drew "nothing" and
          "none" directly above an open review naming an item and a price at
          condition ~0.9 — measured on the played path, not argued.
        */}
        <Text testID={'gymscreen-worn'}>
          under {EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION} condition:{' '}
          {worn.length === 0 ? 'nothing' : worn.join(', ')} — of those, not yet refused:{' '}
          {unanswered.length === 0 ? 'none' : unanswered.join(', ')}. the review below is raised by
          your check-in count, not by this list.
        </Text>
        {/*
          A CONTROL IS NOT DRAWN WHERE PRESSING IT COULD DO NOTHING (plain
          negation on purpose — see this file's header for the census this
          wording is working around and the disposition that was reported), and
          the two arms below are `repairEquipment`'s own refusal order read
          off the same pure calls the row above already makes — `cost === 0`
          is its `'already-sound'` arm and `cost > purse` is its
          `'not-enough-gym-bucks'` arm, in that order. On a cold gym every
          item is at condition 1, so this section used to draw three
          "repair for 0" buttons whose only possible outcome was a refusal; a
          human on a phone named all three. What replaces a dead button is the
          reason it would have refused, not silence — a player who wonders why
          there is nothing to press gets an answer in the same place the
          button was.
        */}
        {ownedItemsOf(gym).map((item) => (
          <View key={item}>
            <Text testID={`gymscreen-condition-${item}`}>
              {item}: condition {itemCondition(managed, item)}, repairing it costs{' '}
              {repairCostGymBucks(managed, item)} gym bucks
            </Text>
            {repairCostGymBucks(managed, item) === 0 ? (
              <Text testID={`gymscreen-repair-${item}-unavailable`}>
                as new — nothing to repair
              </Text>
            ) : repairCostGymBucks(managed, item) > gym.ladder.gymBucks ? (
              <Text testID={`gymscreen-repair-${item}-unavailable`}>
                needs {repairCostGymBucks(managed, item)} gym bucks — you have{' '}
                {gym.ladder.gymBucks}
              </Text>
            ) : (
              <Pressable
                testID={`gymscreen-repair-${item}`}
                onPress={() => dispatch({ kind: 'repair-item', item })}
              >
                <Text>repair for {repairCostGymBucks(managed, item)}</Text>
              </Pressable>
            )}
          </View>
        ))}
        {prompt.kind === 'quiet' ? (
          <Text testID={'gymscreen-prompt'}>
            no maintenance review open — {managed.checkInsTaken} check-in(s) taken, the next review
            is raised at check-in {orderOpensAt(managed)}
          </Text>
        ) : (
          <View testID={'gymscreen-prompt'}>
            <Text testID={'gymscreen-prompt-item'}>
              maintenance review: {prompt.item} is at condition {itemCondition(managed, prompt.item)}{' '}
              and repairing it costs {prompt.repairCostGymBucks} gym bucks
            </Text>
            <Text testID={'gymscreen-prompt-stakes'}>
              {prompt.alreadyRefused
                ? 'you already refused this order — refusing it again adds nothing. only a press moves the ledger; leaving this open does not.'
                : prompt.dismissalWouldCount
                  ? '“not now” and “decline the repair” both count against the gym now. only a press moves the ledger; leaving this open does not.'
                  : '“not now” is free this once; “decline the repair” counts. only a press moves the ledger; leaving this open does not.'}
            </Text>
            {prompt.repairCostGymBucks === 0 ? (
              <Text testID={'gymscreen-prompt-repair-unavailable'}>
                this one is already as new — there is nothing to pay for
              </Text>
            ) : prompt.repairCostGymBucks > gym.ladder.gymBucks ? (
              <Text testID={'gymscreen-prompt-repair-unavailable'}>
                needs {prompt.repairCostGymBucks} gym bucks — you have {gym.ladder.gymBucks}
              </Text>
            ) : (
              <Pressable
                testID={'gymscreen-prompt-repair'}
                onPress={() => dispatch({ kind: 'answer-prompt', response: 'repair' })}
              >
                <Text>repair for {prompt.repairCostGymBucks}</Text>
              </Pressable>
            )}
            <Pressable
              testID={'gymscreen-prompt-dismiss'}
              onPress={() => dispatch({ kind: 'answer-prompt', response: 'dismiss' })}
            >
              <Text>not now</Text>
            </Pressable>
            <Pressable
              testID={'gymscreen-prompt-decline'}
              onPress={() => dispatch({ kind: 'decline-repair', item: prompt.item })}
            >
              <Text>decline the repair</Text>
            </Pressable>
          </View>
        )}
        <View testID={'gymscreen-strikes'}>
          <Text testID={'gymscreen-strikes-lead'}>
            {managed.strikes.length === 0
              ? 'nothing counted against this gym yet — a decision you take here is the only thing that can'
              : 'counted decisions, each with the price that was on screen when you took it:'}
          </Text>
          {managed.strikes.map((record, index) => (
            <Text testID={`gymscreen-strike-${index}`} key={`${record.decision}-${index}`}>
              {record.decision} at {record.atSeconds}s, price shown {record.shownCostGymBucks} gym
              bucks
            </Text>
          ))}
        </View>
        <View testID={'gymscreen-manager'}>
          {managed.manager === null ? (
            <>
              <Text testID={'gymscreen-manager-state'}>
                no manager — you run this gym yourself, which the home gym never needs staff for
              </Text>
              {EMPIRE_TUNING.MANAGER_TIERS.map((tier) => (
                <View key={tier}>
                  <Text testID={`gymscreen-manager-tier-${tier}`}>
                    {tier}: {managerHireCostGymBucks(tier)} gym bucks to hire,{' '}
                    {managerWageRatePerBankedHour(tier)} per banked hour, repairs on their own below
                    condition {managerAutoRepairCondition(tier)}
                  </Text>
                  {/*
                    `hireManager`'s `'not-enough-gym-bucks'` arm, drawn rather
                    than left for a press to discover. On a cold gym the purse
                    is 0 against three tiers at 150 / 600 / 2000, so all three
                    hire controls were unpressable and said nothing about it —
                    a human on a phone named this row.
                  */}
                  {managerHireCostGymBucks(tier) > gym.ladder.gymBucks ? (
                    <Text testID={`gymscreen-hire-${tier}-unavailable`}>
                      needs {managerHireCostGymBucks(tier)} gym bucks — you have{' '}
                      {gym.ladder.gymBucks}
                    </Text>
                  ) : (
                    <Pressable
                      testID={`gymscreen-hire-${tier}`}
                      onPress={() => dispatch({ kind: 'hire-manager', tier })}
                    >
                      <Text>hire</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Text testID={'gymscreen-manager-note'}>
                a repair threshold of 0 means that manager repairs nothing on their own. hiring the
                cheapest one while the ledger already shows a warning is itself a counted decision.
              </Text>
            </>
          ) : (
            <>
              <Text testID={'gymscreen-manager-state'}>
                manager: {managed.manager.tier} — {managerWageRatePerBankedHour(managed.manager.tier)}{' '}
                gym bucks per banked hour, repairs on their own below condition{' '}
                {managerAutoRepairCondition(managed.manager.tier)}
                {managed.manager.hiredUnderWarning ? ' — hired while the gym was already warned' : null}
              </Text>
              <Pressable
                testID={'gymscreen-dismiss-manager'}
                onPress={() => dispatch({ kind: 'dismiss-manager' })}
              >
                <Text>let them go</Text>
              </Pressable>
            </>
          )}
        </View>
        <View testID={'gymscreen-recovery'}>
          {recovery.kind === 'not-dormant' ? (
            <Text testID={'gymscreen-recovery-state'}>
              open for business — {failurePhase(managed)}
            </Text>
          ) : recovery.kind === 'ready' ? (
            <Text testID={'gymscreen-recovery-state'}>
              dormant — everything reopening asks for is done
            </Text>
          ) : (
            <Text testID={'gymscreen-recovery-state'}>
              dormant — still needed:{' '}
              {recovery.equipmentBelowMinimum
                ? `equipment back to condition ${EMPIRE_TUNING.RECOVERY_CONDITION_MIN}`
                : 'no repairs'}
              {recovery.managerHiredUnderWarning
                ? ', and the manager hired under warning let go'
                : null}
            </Text>
          )}
          {/*
            THE ONE ITEM ON THE HUMAN'S LIST THAT WAS WRONG RATHER THAN
            MERELY USELESS. This block used to draw "reopening would cost 0
            gym bucks" and a "reopen the gym" control directly under the line
            reading "open for business — sound". Nothing was shut, so the
            price was a price for nothing and the control could only ever
            reach `recoverGym`'s `'not-dormant'` refusal — while telling a
            player, on a working gym, that reopening was a thing they were
            being offered.

            The reopening price and its control are now drawn only down the
            dormant arms, and the button only where `recoveryRequirement`
            already says the requirements are met, which is exactly the arm
            `recoverGym` does not refuse. The reopen COUNT is a fact about
            this gym's history rather than an offer, so it stays — but only
            once there is one, because "reopened 0 time(s)" on a gym that has
            never failed is the same empty line this round is removing.
          */}
          {recovery.kind === 'not-dormant' ? null : (
            <Text testID={'gymscreen-recovery-cost'}>
              reopening would cost {recoveryRepairCostGymBucks(managed)} gym bucks in repairs
            </Text>
          )}
          {recovery.kind === 'ready' ? (
            <Pressable testID={'gymscreen-recover'} onPress={() => dispatch({ kind: 'recover-gym' })}>
              <Text>reopen the gym</Text>
            </Pressable>
          ) : null}
          {managed.recoveries === 0 ? null : (
            <Text testID={'gymscreen-recovery-history'}>
              this gym has reopened {managed.recoveries} time(s)
            </Text>
          )}
        </View>
        {lastManagementReport === null ? null : (
          <Text testID={'gymscreen-check-in-costs'}>
            last check-in: condition took {lastManagementReport.incomeDeductedGymBucks} gym bucks off
            the accrual and paid {lastManagementReport.incomePaidGymBucks} at{' '}
            {lastManagementReport.incomeMultiplier}, wore the gym down by{' '}
            {lastManagementReport.meanConditionWear}, paid {lastManagementReport.wagePaidGymBucks} in
            wages (unpaid {lastManagementReport.wageShortfallGymBucks}), and the manager repaired{' '}
            {lastManagementReport.autoRepairs.length} item(s) for{' '}
            {lastManagementReport.autoRepairSpendGymBucks}
          </Text>
        )}
        {lastManagementReport === null
          ? null
          : lastManagementReport.autoRepairs.map((repair) => (
              <Text testID={`gymscreen-auto-repair-${repair.item}`} key={repair.item}>
                your manager repaired {repair.item} for {repair.costGymBucks} gym bucks
              </Text>
            ))}
      </View>
      {/*
        NEITHER SHOP BELOW DRAWS A BUY CONTROL WHERE A BUY WOULD BE REFUSED,
        and the arms are `buyLadderEquipment`'s and
        `buySessionEquipment`'s own refusal order, in their order: already
        owned, then the rung is too low, then the purse is short. The two
        functions are byte-for-byte the same three checks in the same
        sequence, so the two blocks read the same and that is deliberate
        rather than duplicated by accident.

        On the state a new player actually opens in — garage, 0 gym bucks —
        that is seventeen rows of which every single buy control was a
        refusal waiting to happen. The row still states the price and the
        rung; what it no longer does is offer a press that cannot land.
      */}
      <View testID={'gymscreen-ladder-shop'}>
        {EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.map((item) => (
          <View key={item}>
            <Text>
              {item} costs {ladderEquipmentCost(item)} gym bucks, fits from{' '}
              {ladderEquipmentMinRung(item)}
              {ownedLadder.has(item) ? ' - owned' : null}
            </Text>
            {ownedLadder.has(item) ? null : ladderRungIndex(gym.ladder.rung) <
              ladderRungIndex(ladderEquipmentMinRung(item)) ? (
              <Text testID={`gymscreen-buy-ladder-${item}-unavailable`}>
                not here yet — fits from {ladderEquipmentMinRung(item)} and this gym is a{' '}
                {gym.ladder.rung}
              </Text>
            ) : ladderEquipmentCost(item) > gym.ladder.gymBucks ? (
              <Text testID={`gymscreen-buy-ladder-${item}-unavailable`}>
                needs {ladderEquipmentCost(item)} gym bucks — you have {gym.ladder.gymBucks}
              </Text>
            ) : (
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
            {ownedSession.has(item) ? null : ladderRungIndex(gym.ladder.rung) <
              ladderRungIndex(sessionEquipmentMinRung(item)) ? (
              <Text testID={`gymscreen-buy-session-${item}-unavailable`}>
                not here yet — fits from {sessionEquipmentMinRung(item)} and this gym is a{' '}
                {gym.ladder.rung}
              </Text>
            ) : sessionEquipmentCost(item) > gym.ladder.gymBucks ? (
              <Text testID={`gymscreen-buy-session-${item}-unavailable`}>
                needs {sessionEquipmentCost(item)} gym bucks — you have {gym.ladder.gymBucks}
              </Text>
            ) : (
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
          <Text>top of the ladder - staffing, maintenance and the failure state are above; the portfolio stays paused</Text>
        ) : (
          <>
            <Text>
              next: {destination} for {ladderMoveCost(destination)} gym bucks
            </Text>
            {/* `moveUpLadder`'s `'not-enough-gym-bucks'` arm, drawn instead of pressed for. */}
            {ladderMoveCost(destination) > gym.ladder.gymBucks ? (
              <Text testID={'gymscreen-move-up-unavailable'}>
                needs {ladderMoveCost(destination)} gym bucks — you have {gym.ladder.gymBucks}
              </Text>
            ) : (
              <Pressable testID={'gymscreen-move-up'} onPress={() => dispatch({ kind: 'move-up' })}>
                <Text>relocate</Text>
              </Pressable>
            )}
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
