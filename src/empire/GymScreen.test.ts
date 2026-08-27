/**
 * GymScreen.test.ts — the render test for the native screen: quantities, not
 * presence, the same standard `ladderView.test.ts` holds `GymView` to.
 *
 * `GymScreen` is a pure function of its props (the stateful hook lives
 * outside `src/empire/`, in `src/shell/`), so this file invokes it directly
 * and walks the returned element tree — no renderer, no native host, no
 * added dependency. What is asserted is every quantity the screen displays,
 * compared against the same quantity read from `ladder.ts` / `sessions.ts`'s
 * pure functions for the same state, and every control pressed with its
 * dispatched action compared field for field.
 *
 * A plain `.ts` file on purpose, not `.test.tsx`: `vitest.config.ts`'s
 * `include` is `['src/**\/*.test.ts']`, so a `.test.tsx` here would compile
 * and never run — the exact silent gap CLAUDE.md records under "A `.test.tsx`
 * COMPILES AND IS COLLECTED BY NOTHING." Nothing about walking a React
 * element tree needs JSX syntax in the test itself: `GymScreen(props)` is a
 * plain function call, and what it returns is a frozen `{ type, props }`
 * tree whether `type` is a DOM string or an imported `react-native`
 * component reference.
 *
 * `GymScreen` reuses `gymViewReduce` / `createGymViewState` /
 * `GymViewState` / `GymViewAction` unchanged from `./ladderView` — this file
 * does not re-verify the reducer arm-for-arm, because that exact code is
 * already the subject of `ladderView.test.ts`'s "GymView: the reducer is
 * sessions.ts/ladder.ts, arm for arm" battery. What is new here, and what
 * this file is about, is the RENDER: does the native tree show the right
 * numbers, and does every native control dispatch the action it names.
 *
 * `vi.mock('react-native', ...)` below, and why it is there rather than a
 * change to `vitest.config.ts`. `node_modules/react-native/index.js` is
 * written in Flow, and `vitest.config.ts`'s `environment: 'node'` has no
 * Flow-stripping transform — measured directly: `import { GymScreen } from
 * './GymScreen'` with no mock gives `RolldownError: Parse failure … Flow is
 * not supported`, at `react-native/index.js`, before a single test runs. That
 * is not a defect in this file: `grep -rl "from 'react-native'"
 * src/**\/*.test.ts` finds zero matches anywhere in this repository, so every
 * other native screen (`AppShell.tsx`, `SessionScreen.tsx`, `MeetScreen.tsx`,
 * …) has the same gap and is verified only by the browser tools in `tools/`,
 * never by a vitest unit import. Editing the shared `vitest.config.ts` to add
 * a Flow/Babel transform is outside this piece's scope (a repo-wide config
 * file affecting every suite, not listed in the approved crossing), so the
 * mock below is scoped to this one file instead: it replaces the `react-native`
 * specifier with plain string type-tags before the real module is ever
 * resolved, so the real Flow source is never parsed. What this buys, and what
 * it does not: the mock lets this file assert the exact claim `ladderView.
 * test.ts` asserts for `GymView` — every displayed quantity matches the pure
 * function it is read from, and every control dispatches the action it names
 * — because that claim is about the shape of the returned element tree, which
 * does not depend on what `View`/`Text`/`Pressable` actually do at runtime.
 * It does NOT verify that the tree is valid at a real RN runtime (e.g. that
 * a `View` is never asked to render where only `Text` is legal) — that is a
 * different question, and it is the one the Playwright-driven browser check
 * (this piece's reachability verification) answers instead, against the real
 * `react-native-web` renderer.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
}));
import {
  type GymViewAction,
  type GymViewState,
  createGymViewState,
  gymViewReduce,
} from './ladderView';
import {
  type SlotOutcome,
  availableActivities,
  buySessionEquipment,
  createRestAllocation,
  resolveWeek,
  sessionEquipmentCost,
  sessionEquipmentGroup,
  sessionEquipmentMinRung,
  trainingWeekShape,
  weeklyAttributeEffects,
} from './sessions';
import {
  buyLadderEquipment,
  ladderDevTimeSteps,
  ladderIncomeRatePerHour,
  moveUpLadder,
  nextLadderRung,
  playerCheckInGapSeconds,
} from './ladder';
import { EMPIRE_TUNING } from './empireTuning';
import {
  type CountedDecisionRecord,
  type ManagedEquipmentItem,
  type ManagerTier,
  conditionIncomeMultiplier,
  declineRepair,
  failurePhase,
  fullRepairCostGymBucks,
  hireManager,
  itemCondition,
  maintenancePrompt,
  managerAutoRepairCondition,
  managerHireCostGymBucks,
  managerWageRatePerBankedHour,
  meanCondition,
  orderOpensAt,
  ownedItemsOf,
  recoverGym,
  recoveryRepairCostGymBucks,
  recoveryRequirement,
  repairCostGymBucks,
  repairEquipment,
  respondToPrompt,
  unansweredItems,
  warningSigns,
  withUpdatedGym,
  wornItems,
} from './management';
import { scrubPrecision } from './production';
import { GymScreen } from './GymScreen';

const T = EMPIRE_TUNING;

// ---------------------------------------------------------------------------
// A minimal element-tree walk, the same shape `ladderView.test.ts` uses for
// `LadderView`/`GymView`, adjusted for the two props RN spells differently:
// `testID` (not `data-testid`) and `onPress` (not `onClick`).
// ---------------------------------------------------------------------------

interface Rendered {
  readonly type: unknown;
  readonly props: Readonly<Record<string, unknown>>;
}

function isRendered(value: unknown): value is Rendered {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'props' in value &&
    typeof (value as { props: unknown }).props === 'object'
  );
}

function childrenOf(node: Rendered): readonly unknown[] {
  const children = (node.props as { children?: unknown }).children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? (children.flat(20) as readonly unknown[]) : [children];
}

/** The text a reader would see under `node`: strings and numbers, in order. */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!isRendered(node)) return '';
  return childrenOf(node).map(textOf).join('');
}

/** Every element under `root` (root included) carrying `testID` = `id`. */
function findAllByTestId(root: unknown, id: string): readonly Rendered[] {
  if (!isRendered(root)) return [];
  const own = root.props['testID'] === id ? [root] : [];
  return [...own, ...childrenOf(root).flatMap((child) => findAllByTestId(child, id))];
}

/** Exactly one element with the id, or the test fails naming the id. */
function findByTestId(root: unknown, id: string): Rendered {
  const found = findAllByTestId(root, id);
  expect(found.length, `expected exactly one element with testID ${id}`).toBe(1);
  return found[0] as Rendered;
}

/** Every `testID` anywhere under `node` (node included), in tree order. */
function testIdsUnder(node: unknown): readonly string[] {
  if (!isRendered(node)) return [];
  const own = typeof node.props['testID'] === 'string' ? [node.props['testID'] as string] : [];
  return [...own, ...childrenOf(node).flatMap(testIdsUnder)];
}

/** Press the element's onPress, which `DispatchButton` wires to dispatch. */
function press(element: Rendered): void {
  const handler = element.props['onPress'];
  expect(typeof handler, 'the pressed element carries no onPress').toBe('function');
  (handler as () => void)();
}

function render(state: GymViewState, dispatched: GymViewAction[]): Rendered {
  const element: unknown = GymScreen({
    state,
    dispatch: (action) => {
      dispatched.push(action);
    },
  });
  expect(isRendered(element)).toBe(true);
  return element as Rendered;
}

function dispatchThrough(state: GymViewState, action: GymViewAction): GymViewState {
  return gymViewReduce(state, action);
}

/**
 * The same state with enough gym bucks to afford `target`, reached by taking
 * the PLAYER'S OWN check-in over and over rather than by hand-building a
 * purse.
 *
 * Every control this file gates is gated on the shipped transition's own
 * refusal, so a test that wants to press one has to reach a state where the
 * transition succeeds — and the honest way to reach it is the way a player
 * would. `'open-up'` is that way, which is a second reason it exists: before
 * it, the only route to a funded gym anywhere in this repository ran through
 * a control the screen labels "not part of the game".
 */
function fundedEnoughFor(state: GymViewState, target: number): GymViewState {
  let funded = state;
  let guard = 0;
  while (funded.managed.gym.ladder.gymBucks < target) {
    funded = dispatchThrough(funded, { kind: 'open-up' });
    guard += 1;
    expect(guard, 'opening the gym must eventually afford the target').toBeLessThan(2000);
  }
  return funded;
}

/** The words `describeSlotOutcome` must produce, checked without importing it. */
function expectOutcomeInText(text: string, outcome: SlotOutcome): void {
  if (outcome.kind === 'rested') {
    expect(text).toContain('rested');
    return;
  }
  expect(text).toContain(outcome.activity);
  if (outcome.kind === 'unequipped') expect(text).toContain(outcome.requires);
}

/**
 * A CONTROL IS DRAWN EXACTLY WHEN PRESSING IT WOULD DO SOMETHING (the plain
 * wording is deliberate — see `GymScreen.tsx`'s header), AND WHAT
 * DECIDES "WOULD" IS THE SHIPPED TRANSITION RATHER THAN THE SCREEN'S OWN
 * BRANCH.
 *
 * The gating this grades was added because a human on a phone dumped the
 * opening frame and found a wall of controls that could only refuse: three
 * "repair for 0" buttons on a gym with nothing worn, a "reopen the gym"
 * control under the words "open for business", three hire tiers priced
 * 150 / 600 / 2000 against a purse of 0.
 *
 * The obvious oracle for that — assert the button is absent when the cost
 * exceeds the purse — is the screen's own predicate written a second time,
 * and no state of `GymScreen.tsx` could make the two disagree. So `canAct` is
 * not a predicate at all here: every call site below RUNS the real transition
 * on the same state and asks whether it refused. A gate that drifts from
 * `repairEquipment`/`hireManager`/`recoverGym`/`buySessionEquipment`/
 * `buyLadderEquipment`/`moveUpLadder`'s own refusal order reddens on
 * whichever direction it drifted in, because both directions are asserted:
 * the control is present exactly when the transition succeeds, and the
 * reason-in-its-place is present exactly when it does not.
 *
 * Its limit, stated because no assertion here reaches past it: this grades
 * WHETHER a control is offered, not what its replacement sentence SAYS. A
 * reason line that named the wrong number would pass this; the copy is graded
 * separately, by the tests that read each line's text.
 */
function expectGatedControl(
  root: Rendered,
  id: string,
  refused: boolean,
  why: string,
): number {
  expect(findAllByTestId(root, id).length, `${id} drawn (${why})`).toBe(refused ? 0 : 1);
  expect(
    findAllByTestId(root, `${id}-unavailable`).length,
    `${id}-unavailable drawn (${why})`,
  ).toBe(refused ? 1 : 0);
  return 2;
}

/** Every displayed-quantity comparison for one `GymViewState`, counted. */
function expectScreenMatchesState(root: Rendered, state: GymViewState): number {
  let compared = 0;
  const { managed, weekIndex, allocation, allocationSetThisWeek, weekLog } = state;
  const gym = managed.gym;
  const shape = trainingWeekShape();
  const weekText = textOf(findByTestId(root, 'gymscreen-week'));
  expect(weekText).toContain(String(weekIndex));
  expect(weekText).toContain(`${shape.fixed} fixed + ${shape.flexible} flexible = ${shape.total}`);
  expect(weekText).toContain(allocationSetThisWeek ? 'allocated this week' : 'not yet allocated');
  compared += 3;
  expect(textOf(findByTestId(root, 'gymscreen-rung'))).toContain(String(gym.ladder.rung));
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-rate'))).toContain(
    String(ladderIncomeRatePerHour(gym.ladder.rung)),
  );
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-gym-bucks'))).toContain(String(gym.ladder.gymBucks));
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-accelerated-bucks'))).toContain(
    String(gym.acceleratedGymBucks),
  );
  compared += 1;
  // The ladder shop: cost, min rung and the buy control's presence, per item.
  const ladderShopText = textOf(findByTestId(root, 'gymscreen-ladder-shop'));
  const ownedLadder = new Set<string>(gym.ladder.equipment);
  for (const item of T.LADDER_EQUIPMENT_ITEMS) {
    expect(ladderShopText).toContain(`${item} costs`);
    if (ownedLadder.has(item)) {
      // An owned item offers neither a control nor a reason — the row says
      // "- owned" and that is the whole story.
      expect(findAllByTestId(root, `gymscreen-buy-ladder-${item}`).length, item).toBe(0);
      expect(findAllByTestId(root, `gymscreen-buy-ladder-${item}-unavailable`).length, item).toBe(0);
      compared += 2;
    } else {
      compared += expectGatedControl(
        root,
        `gymscreen-buy-ladder-${item}`,
        buyLadderEquipment(gym.ladder, item).kind === 'refused',
        `buyLadderEquipment ${item}`,
      );
    }
    compared += 1;
  }
  // The stage-2 shop: cost, group, min rung and the buy control, per item.
  const sessionShopText = textOf(findByTestId(root, 'gymscreen-session-shop'));
  const ownedSession = new Set<string>(gym.sessionEquipment);
  for (const item of T.SESSION_EQUIPMENT_ITEMS) {
    expect(sessionShopText).toContain(
      `${item} (${sessionEquipmentGroup(item)}) costs ${sessionEquipmentCost(item)} gym bucks, fits from ${sessionEquipmentMinRung(item)}`,
    );
    if (ownedSession.has(item)) {
      expect(findAllByTestId(root, `gymscreen-buy-session-${item}`).length, item).toBe(0);
      expect(findAllByTestId(root, `gymscreen-buy-session-${item}-unavailable`).length, item).toBe(0);
      compared += 2;
    } else {
      compared += expectGatedControl(
        root,
        `gymscreen-buy-session-${item}`,
        buySessionEquipment(gym, item).kind === 'refused',
        `buySessionEquipment ${item}`,
      );
    }
    compared += 1;
  }
  // The allocation section: each slot's chosen value, its resolved (preview)
  // outcome against the equipment held RIGHT NOW, and the option controls.
  const previewOutcomes = resolveWeek(allocation, gym.sessionEquipment);
  const previewEffects = weeklyAttributeEffects(allocation, gym.sessionEquipment);
  for (const slotIndex of [0, 1, 2] as const) {
    const slotText = textOf(findByTestId(root, `gymscreen-slot-${slotIndex}`));
    expect(slotText).toContain(allocation[slotIndex]);
    expectOutcomeInText(slotText, previewOutcomes[slotIndex]);
    compared += 1;
    for (const option of [...T.FLEXIBLE_ACTIVITIES, 'rest']) {
      expect(findAllByTestId(root, `gymscreen-slot-${slotIndex}-set-${option}`).length, option).toBe(1);
      compared += 1;
    }
  }
  const previewText = textOf(findByTestId(root, 'gymscreen-week-preview'));
  expect(previewText).toContain(String(previewEffects.residualCarryMultiplier));
  expect(previewText).toContain(String(previewEffects.injuryChanceMultiplier));
  expect(previewText).toContain(String(previewEffects.techniqueQualityBonus));
  expect(previewText).toContain(String(previewEffects.ceilingGrowthPerWeek));
  compared += 4;
  const availableText = textOf(findByTestId(root, 'gymscreen-available-now'));
  const available = availableActivities(gym.sessionEquipment);
  expect(availableText).toBe(`available now: ${available.length === 0 ? 'none' : available.join(', ')}`);
  compared += 1;
  // The week log: one entry per completed week, in order, every effect number
  // and every slot's resolved outcome (the `unequipped` arm included).
  const logEntries = findAllByTestId(root, 'gymscreen-week-log').length === 1
    ? childrenOf(findByTestId(root, 'gymscreen-week-log'))
    : [];
  expect(logEntries.length).toBe(weekLog.length);
  compared += 1;
  for (const week of weekLog) {
    const entryText = textOf(findByTestId(root, `gymscreen-week-log-${week.weekIndex}`));
    for (const outcome of week.slots) expectOutcomeInText(entryText, outcome);
    expect(entryText).toContain(String(week.effects.residualCarryMultiplier));
    expect(entryText).toContain(String(week.effects.injuryChanceMultiplier));
    expect(entryText).toContain(String(week.effects.techniqueQualityBonus));
    expect(entryText).toContain(String(week.effects.ceilingGrowthPerWeek));
    compared += 1;
  }
  // §5.11 stage 4's half of the same screen, graded at every state this
  // function is called on rather than only in its own tests.
  compared += expectManagementMatchesState(root, state);
  return compared;
}

/**
 * Every displayed §5.11 stage-4 quantity for one `GymViewState`, counted —
 * the same standard the stage-1/2 half above holds: each number on the screen
 * is compared against the same number read from `management.ts`'s own pure
 * function for the same state, never against a number restated here.
 */
function expectManagementMatchesState(root: Rendered, state: GymViewState): number {
  let compared = 0;
  const managed = state.managed;
  const signs = warningSigns(managed);
  const phaseText = textOf(findByTestId(root, 'gymscreen-phase'));
  expect(phaseText).toBe(
    `gym status: ${signs.phase} — ${signs.strikeCount} counted decision(s) on the ledger, ${signs.strikesUntilFailure} more would close it`,
  );
  compared += 3;
  expect(textOf(findByTestId(root, 'gymscreen-condition'))).toContain(
    `equipment condition ${meanCondition(managed)} — income paid at ${conditionIncomeMultiplier(managed)} of the rate`,
  );
  compared += 2;
  expect(textOf(findByTestId(root, 'gymscreen-full-repair'))).toBe(
    `everything back to new: ${fullRepairCostGymBucks(managed)} gym bucks`,
  );
  compared += 1;
  const worn = wornItems(managed);
  const unanswered = unansweredItems(managed);
  expect(textOf(findByTestId(root, 'gymscreen-worn'))).toBe(
    `under ${EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION} condition: ${worn.length === 0 ? 'nothing' : worn.join(', ')} — of those, not yet refused: ${unanswered.length === 0 ? 'none' : unanswered.join(', ')}. the review below is raised by your check-in count, not by this list.`,
  );
  compared += 2;
  const owned = ownedItemsOf(managed.gym);
  for (const item of owned) {
    expect(textOf(findByTestId(root, `gymscreen-condition-${item}`))).toBe(
      `${item}: condition ${itemCondition(managed, item)}, repairing it costs ${repairCostGymBucks(managed, item)} gym bucks`,
    );
    compared += expectGatedControl(
      root,
      `gymscreen-repair-${item}`,
      repairEquipment(managed, item).kind === 'refused',
      `repairEquipment ${item}`,
    );
    compared += 3;
  }
  // The screen shows a condition row for exactly what the gym owns.
  expect(findAllByTestId(root, 'gymscreen-management')[0]).toBeDefined();
  for (const item of EMPIRE_TUNING.SESSION_EQUIPMENT_ITEMS) {
    if (owned.includes(item as ManagedEquipmentItem)) continue;
    expect(findAllByTestId(root, `gymscreen-condition-${item}`).length, item).toBe(0);
    compared += 1;
  }
  // The maintenance review: WHETHER one is open is the check-in ordinal, and
  // WHICH item it names is condition — `management.ts` header §3a. Both are
  // read back off the screen against `maintenancePrompt` called directly.
  const prompt = maintenancePrompt(managed);
  const promptText = textOf(findByTestId(root, 'gymscreen-prompt'));
  const answerControls = ['gymscreen-prompt-repair', 'gymscreen-prompt-dismiss', 'gymscreen-prompt-decline'];
  if (prompt.kind === 'quiet') {
    expect(promptText).toBe(
      `no maintenance review open — ${managed.checkInsTaken} check-in(s) taken, the next review is raised at check-in ${orderOpensAt(managed)}`,
    );
    for (const id of answerControls) expect(findAllByTestId(root, id).length, id).toBe(0);
    expect(findAllByTestId(root, 'gymscreen-prompt-repair-unavailable').length).toBe(0);
    compared += 6;
  } else {
    expect(textOf(findByTestId(root, 'gymscreen-prompt-item'))).toBe(
      `maintenance review: ${prompt.item} is at condition ${itemCondition(managed, prompt.item)} and repairing it costs ${prompt.repairCostGymBucks} gym bucks`,
    );
    for (const id of answerControls.slice(1)) expect(findAllByTestId(root, id).length, id).toBe(1);
    // The review's own repair control is gated on the same transition answering
    // it would take, so an order the purse cannot cover shows the price it
    // cannot meet rather than a button that would refuse.
    compared += expectGatedControl(
      root,
      'gymscreen-prompt-repair',
      respondToPrompt(managed, 'repair', managed.gym.ladder.collectedAt).kind === 'repair-refused',
      'respondToPrompt repair',
    );
    // §5.7's "told the cost of": what the screen says a refusal is worth has
    // to be what the engine says it is worth, in both directions.
    //
    // THIS USED TO COMPARE THE DRAWN BRANCH AGAINST `prompt.dismissalWouldCount`
    // — the same flag `GymScreen.tsx` branched on — which is an oracle
    // restating its subject: no value of that flag could make the screen and
    // this check disagree. It reads the OUTCOME now: dismiss and decline are
    // each driven on this exact state through the shipped transitions, and
    // the sentence is graded against whether the ledger actually grew. A
    // `dismissalWouldCount` that stopped agreeing with `respondToPrompt`
    // reddens here; under the old form it could not.
    const wouldCountOnDismiss =
      respondToPrompt(managed, 'dismiss', managed.gym.ladder.collectedAt).state.strikes.length >
      managed.strikes.length;
    const declineOutcome = declineRepair(managed, prompt.item, managed.gym.ladder.collectedAt);
    const wouldCountOnDecline = declineOutcome.state.strikes.length > managed.strikes.length;
    // Three of the four outcome pairs are reachable and each owns one
    // sentence; the fourth (dismiss counts, decline does not) is refused by
    // the engine's own arithmetic — `dismissalWouldCount` is
    // `!alreadyRefused && …` and a decline is counted on `!isNeglected`, so
    // a counting dismiss implies a counting decline. It is asserted rather
    // than assumed, so a change that makes it reachable is red here.
    expect(wouldCountOnDismiss && !wouldCountOnDecline, 'dismiss counts while decline does not').toBe(
      false,
    );
    const stakes = textOf(findByTestId(root, 'gymscreen-prompt-stakes'));
    if (!wouldCountOnDismiss && !wouldCountOnDecline) {
      expect(stakes).toContain('refusing it again adds nothing');
    } else if (!wouldCountOnDismiss) {
      expect(stakes).toContain('is free this once');
      expect(stakes).toContain('“decline the repair” counts');
    } else {
      expect(stakes).toContain('both count against the gym now');
    }
    // The half of the sentence that is true of every state, and the half the
    // old copy got backwards: the ledger moves on a press and on nothing else.
    expect(stakes).toContain('only a press moves the ledger; leaving this open does not.');
    compared += 10;
  }
  // The failure ledger, record for record — every strike carries the price
  // that was on screen when the decision was taken, and the screen shows it.
  for (let index = 0; index < managed.strikes.length; index += 1) {
    const record = managed.strikes[index] as CountedDecisionRecord;
    expect(textOf(findByTestId(root, `gymscreen-strike-${index}`))).toBe(
      `${record.decision} at ${record.atSeconds}s, price shown ${record.shownCostGymBucks} gym bucks`,
    );
    compared += 3;
  }
  expect(findAllByTestId(root, `gymscreen-strike-${managed.strikes.length}`).length).toBe(0);
  compared += 1;
  // Staffing.
  if (managed.manager === null) {
    for (const tier of EMPIRE_TUNING.MANAGER_TIERS) {
      expect(textOf(findByTestId(root, `gymscreen-manager-tier-${tier}`))).toBe(
        `${tier}: ${managerHireCostGymBucks(tier)} gym bucks to hire, ${managerWageRatePerBankedHour(tier)} per banked hour, repairs on their own below condition ${managerAutoRepairCondition(tier)}`,
      );
      compared += expectGatedControl(
        root,
        `gymscreen-hire-${tier}`,
        hireManager(managed, tier, managed.gym.ladder.collectedAt).kind === 'refused',
        `hireManager ${tier}`,
      );
      compared += 4;
    }
    expect(findAllByTestId(root, 'gymscreen-dismiss-manager').length).toBe(0);
    compared += 1;
  } else {
    const tier = managed.manager.tier;
    const managerText = textOf(findByTestId(root, 'gymscreen-manager-state'));
    expect(managerText).toContain(
      `manager: ${tier} — ${managerWageRatePerBankedHour(tier)} gym bucks per banked hour, repairs on their own below condition ${managerAutoRepairCondition(tier)}`,
    );
    expect(managerText.includes('hired while the gym was already warned')).toBe(
      managed.manager.hiredUnderWarning,
    );
    expect(findAllByTestId(root, 'gymscreen-dismiss-manager').length).toBe(1);
    for (const other of EMPIRE_TUNING.MANAGER_TIERS) {
      expect(findAllByTestId(root, `gymscreen-hire-${other}`).length, other).toBe(0);
      expect(findAllByTestId(root, `gymscreen-hire-${other}-unavailable`).length, other).toBe(0);
      compared += 2;
    }
    compared += 3;
  }
  // Dormancy and the way back out of it.
  const recovery = recoveryRequirement(managed);
  const recoveryText = textOf(findByTestId(root, 'gymscreen-recovery-state'));
  if (recovery.kind === 'not-dormant') {
    expect(recoveryText).toBe(`open for business — ${failurePhase(managed)}`);
  } else {
    expect(recoveryText).toContain('dormant');
    expect(failurePhase(managed)).toBe('failed');
    if (recovery.kind === 'blocked' && recovery.equipmentBelowMinimum) {
      expect(recoveryText).toContain(`condition ${EMPIRE_TUNING.RECOVERY_CONDITION_MIN}`);
    }
    if (recovery.kind === 'blocked' && recovery.managerHiredUnderWarning) {
      expect(recoveryText).toContain('manager hired under warning let go');
    }
  }
  // The reopening PRICE and the reopen CONTROL are two separate gates, and
  // the human's report was about both being drawn on a gym that was open:
  // a price is quoted only for a gym that is actually shut, and the control
  // is offered only where `recoverGym` does not refuse.
  expect(findAllByTestId(root, 'gymscreen-recovery-cost').length).toBe(
    recovery.kind === 'not-dormant' ? 0 : 1,
  );
  if (recovery.kind !== 'not-dormant') {
    expect(textOf(findByTestId(root, 'gymscreen-recovery-cost'))).toBe(
      `reopening would cost ${recoveryRepairCostGymBucks(managed)} gym bucks in repairs`,
    );
  }
  expect(findAllByTestId(root, 'gymscreen-recover').length).toBe(
    recoverGym(managed).kind === 'refused' ? 0 : 1,
  );
  // The reopen count is history rather than an offer, so it is drawn once
  // there is any, and not before.
  expect(findAllByTestId(root, 'gymscreen-recovery-history').length).toBe(
    managed.recoveries === 0 ? 0 : 1,
  );
  if (managed.recoveries !== 0) {
    expect(textOf(findByTestId(root, 'gymscreen-recovery-history'))).toBe(
      `this gym has reopened ${managed.recoveries} time(s)`,
    );
  }
  compared += 6;
  // What the last check-in COST, reported rather than silent.
  const report = state.lastManagementReport;
  if (report === null) {
    expect(findAllByTestId(root, 'gymscreen-check-in-costs').length).toBe(0);
    compared += 1;
  } else {
    expect(textOf(findByTestId(root, 'gymscreen-check-in-costs'))).toBe(
      `last check-in: condition took ${report.incomeDeductedGymBucks} gym bucks off the accrual and paid ${report.incomePaidGymBucks} at ${report.incomeMultiplier}, wore the gym down by ${report.meanConditionWear}, paid ${report.wagePaidGymBucks} in wages (unpaid ${report.wageShortfallGymBucks}), and the manager repaired ${report.autoRepairs.length} item(s) for ${report.autoRepairSpendGymBucks}`,
    );
    for (const repair of report.autoRepairs) {
      expect(textOf(findByTestId(root, `gymscreen-auto-repair-${repair.item}`))).toBe(
        `your manager repaired ${repair.item} for ${repair.costGymBucks} gym bucks`,
      );
      compared += 2;
    }
    compared += 6;
  }
  return compared;
}

describe('the opening screen displays ladder.ts / sessions.ts on every displayed quantity', () => {
  it('matches the pure functions on the opening state', () => {
    const state = createGymViewState();
    expect(state.managed.gym).toEqual(
      Object.freeze({
        ladder: expect.any(Object),
        acceleratedGymBucks: 0,
        sessionEquipment: [],
      }),
    );
    expect(state.weekIndex).toBe(0);
    expect(state.allocation).toEqual(createRestAllocation());
    expect(state.allocationSetThisWeek).toBe(false);
    expect(state.weekLog).toEqual([]);
    const root = render(state, []);
    const compared = expectScreenMatchesState(root, state);
    expect(compared).toBeGreaterThan(0);
    expect(findAllByTestId(root, 'gymscreen-accrual').length).toBe(0);
    expect(findAllByTestId(root, 'gymscreen-refusal').length).toBe(0);
    for (const step of ladderDevTimeSteps()) {
      expect(findAllByTestId(root, `gymscreen-advance-${step.seconds}`).length).toBe(1);
    }
    expect(findAllByTestId(root, 'gymscreen-advance-next-week').length).toBe(1);
    // THE OPENING FRAME'S OWN CLAIM, and the one this round changed. A cold
    // gym holds 0 gym bucks against a 2500 relocation, so the relocate
    // control is not offered and the price it could not meet is drawn in its
    // place — `moveUpLadder` refuses this exact state and the screen says so
    // instead of waiting to be pressed.
    expectGatedControl(root, 'gymscreen-move-up', true, 'a cold gym cannot afford a move');
    expect(moveUpLadder(state.managed.gym.ladder).kind).toBe('refused');
    // The player's own check-in, on the other hand, IS offered from the first
    // frame — it is the control whose absence made every stage-4 beat
    // unreachable without touching the dev row.
    expect(findAllByTestId(root, 'gymscreen-open-up-press').length).toBe(1);
    expect(findAllByTestId(root, 'gymscreen-open-up-press-unavailable').length).toBe(0);
  });
});

describe('every control dispatches exactly the action it names', () => {
  it('drives the dev steps, the week-boundary jump, a session buy and a slot edit', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = render(state, dispatched);
    for (const step of ladderDevTimeSteps()) {
      press(findByTestId(root, `gymscreen-advance-${step.seconds}`));
    }
    press(findByTestId(root, 'gymscreen-advance-next-week'));
    press(findByTestId(root, 'gymscreen-slot-0-set-cardio'));
    // The buy control is gated on `buySessionEquipment`'s own refusal now, so
    // a cold gym does not draw one — the press below is taken on a state that
    // can actually afford mats, which is the only state where a player could
    // have taken it either.
    const funded = fundedEnoughFor(state, sessionEquipmentCost('mats'));
    press(findByTestId(render(funded, dispatched), 'gymscreen-buy-session-mats'));
    expect(dispatched).toEqual([
      ...ladderDevTimeSteps().map((step) => ({ kind: 'advance-clock', gapSeconds: step.seconds })),
      { kind: 'advance-to-next-week' },
      { kind: 'set-allocation-slot', slotIndex: 0, slot: 'cardio' },
      { kind: 'buy-session', item: 'mats' },
    ]);
    expect(dispatched.length).toBe(ladderDevTimeSteps().length + 3);
  });

  it('the move-up control dispatches move-up, and refused presses change nothing displayed', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const destination = nextLadderRung(state.managed.gym.ladder.rung);
    expect(destination).not.toBeNull();
    const funded = fundedEnoughFor(state, T.LADDER_MOVE_COST_GYM_BUCKS['storage-unit']);
    press(findByTestId(render(funded, dispatched), 'gymscreen-move-up'));
    expect(dispatched).toEqual([{ kind: 'move-up' }]);
    // THE REFUSAL BANNER IS STILL A REAL DISPLAY AND IS NO LONGER REACHABLE
    // FROM THIS CONTROL, which is the point of gating it: the reducer arm
    // still refuses and still reports, and the screen no longer offers the
    // press that would have produced it. Both halves are asserted, because
    // deleting the banner's producer without noticing is exactly how a
    // display goes dead.
    const refused = dispatchThrough(state, { kind: 'move-up' });
    expect(refused.lastRefusal).toBe('not-enough-gym-bucks');
    const refusedRoot = render(refused, []);
    expect(textOf(findByTestId(refusedRoot, 'gymscreen-refusal'))).toBe(
      'refused: not-enough-gym-bucks',
    );
    expect(refused.managed.gym).toEqual(state.managed.gym);
    expect(findAllByTestId(refusedRoot, 'gymscreen-move-up').length).toBe(0);
  });
});

describe('a played sequence: press, reduce, re-render, and the numbers stay the pure ones', () => {
  it('advances the clock, buys a rack, relocates, and re-checks every screen', () => {
    let state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    let root = render(state, dispatched);
    // Advance the clock with the largest fixed dev step until the garage can
    // afford the squat rack and the move to storage-unit.
    const target =
      T.LADDER_EQUIPMENT_COST_GYM_BUCKS['squat-rack'] + T.LADDER_MOVE_COST_GYM_BUCKS['storage-unit'];
    const bigStep = ladderDevTimeSteps()[ladderDevTimeSteps().length - 1]?.seconds as number;
    let guard = 0;
    while (state.managed.gym.ladder.gymBucks < target) {
      state = dispatchThrough(state, { kind: 'advance-clock', gapSeconds: bigStep });
      guard += 1;
      expect(guard, 'the dev step must eventually afford the target').toBeLessThan(1000);
    }
    root = render(state, dispatched);
    expectScreenMatchesState(root, state);

    // Press relocate through the real control first — the squat rack needs
    // storage-unit and above (LADDER_EQUIPMENT_MIN_RUNG), so the move must
    // land before the buy can succeed.
    press(findByTestId(root, 'gymscreen-move-up'));
    state = dispatchThrough(state, { kind: 'move-up' });
    expect(state.lastRefusal).toBeNull();
    expect(state.managed.gym.ladder.rung).toBe('storage-unit');
    root = render(state, dispatched);
    expectScreenMatchesState(root, state);

    // Press buy-ladder for the squat rack through the real control.
    press(findByTestId(root, 'gymscreen-buy-ladder-squat-rack'));
    expect(dispatched[dispatched.length - 1]).toEqual({ kind: 'buy-ladder', item: 'squat-rack' });
    state = dispatchThrough(state, { kind: 'buy-ladder', item: 'squat-rack' });
    expect(state.lastRefusal).toBeNull();
    expect(state.managed.gym.ladder.equipment).toContain('squat-rack');
    root = render(state, dispatched);
    expectScreenMatchesState(root, state);
    expect(findAllByTestId(root, 'gymscreen-buy-ladder-squat-rack').length).toBe(0);

    // Allocate a flexible slot and confirm the screen reflects it, including
    // the unequipped report (no conditioning equipment owned).
    press(findByTestId(root, 'gymscreen-slot-1-set-cardio'));
    state = dispatchThrough(state, { kind: 'set-allocation-slot', slotIndex: 1, slot: 'cardio' });
    root = render(state, dispatched);
    const slotText = textOf(findByTestId(root, 'gymscreen-slot-1'));
    expect(slotText).toContain('cardio');
    expect(slotText).toContain('unequipped');
    expectScreenMatchesState(root, state);
  });
});

// ---------------------------------------------------------------------------
// §5.11 stage 4 on the garage floor — GDD §5.7's staffing, maintenance,
// equipment condition and recoverable failure, as this screen shows them.
//
// The claim these tests are written around, and the one thing worth reading
// before editing them: condition and income move with OPERATION, and failure
// moves only on a decision a press took. `docs/GDD.md` §5.7's clarification
// forbids the reverse chain, and the check that would go red if this screen
// grew one is `only a press moves the failure ledger` below — it advances the
// clock as far as this screen can and reads the ledger back.
// ---------------------------------------------------------------------------

/** Advance the clock `times` times with the largest dev step, through the reducer. */
function advanceTimes(state: GymViewState, times: number): GymViewState {
  const step = ladderDevTimeSteps()[ladderDevTimeSteps().length - 1]?.seconds as number;
  let next = state;
  for (let at = 0; at < times; at += 1) {
    next = dispatchThrough(next, { kind: 'advance-clock', gapSeconds: step });
  }
  return next;
}

describe('stage 4: every new control dispatches exactly the action it names', () => {
  it('drives repair and hire on a state where each one would actually go through', () => {
    // THIS TEST USED TO PRESS ALL OF THESE ON THE OPENING SCREEN, which is
    // exactly the state the human's report was about: nothing worn, nothing
    // in the purse, nothing shut, and every one of these controls drawn
    // anyway. They are gated on their own transition's refusal now, so the
    // state that offers them is the state a player could have pressed them
    // in — reached here by taking check-ins, not by hand-building a gym.
    const worn = fundedEnoughFor(
      advanceTimes(createGymViewState(), 1),
      managerHireCostGymBucks(
        EMPIRE_TUNING.MANAGER_TIERS[EMPIRE_TUNING.MANAGER_TIERS.length - 1] as ManagerTier,
      ),
    );
    const dispatched: GymViewAction[] = [];
    const root = render(worn, dispatched);
    const owned = ownedItemsOf(worn.managed.gym);
    for (const item of owned) {
      expect(repairEquipment(worn.managed, item).kind, item).toBe('repaired');
      press(findByTestId(root, `gymscreen-repair-${item}`));
    }
    for (const tier of EMPIRE_TUNING.MANAGER_TIERS) {
      expect(hireManager(worn.managed, tier, worn.managed.gym.ladder.collectedAt).kind, tier).toBe(
        'hired',
      );
      press(findByTestId(root, `gymscreen-hire-${tier}`));
    }
    expect(dispatched).toEqual([
      ...owned.map((item) => ({ kind: 'repair-item', item })),
      ...EMPIRE_TUNING.MANAGER_TIERS.map((tier) => ({ kind: 'hire-manager', tier })),
    ]);
  });

  it('drives the three answers to a standing maintenance review, and the dismiss control', () => {
    // A review is open at check-in MAINTENANCE_ORDER_FIRST_CHECK_IN and at no
    // other — `orderOpensAt`. Reached by pressing the real clock control.
    const opened = createGymViewState();
    expect(maintenancePrompt(opened.managed).kind).toBe('quiet');
    const reviewed = advanceTimes(opened, EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN);
    expect(reviewed.managed.checkInsTaken).toBe(EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN);
    const prompt = maintenancePrompt(reviewed.managed);
    expect(prompt.kind).toBe('offered');
    const dispatched: GymViewAction[] = [];
    const root = render(reviewed, dispatched);
    press(findByTestId(root, 'gymscreen-prompt-repair'));
    press(findByTestId(root, 'gymscreen-prompt-dismiss'));
    press(findByTestId(root, 'gymscreen-prompt-decline'));
    expect(dispatched).toEqual([
      { kind: 'answer-prompt', response: 'repair' },
      { kind: 'answer-prompt', response: 'dismiss' },
      { kind: 'decline-repair', item: prompt.kind === 'offered' ? prompt.item : undefined },
    ]);
  });

  it('drives the dismiss-manager control once a manager is on staff', () => {
    const staffed = advanceTimes(createGymViewState(), 2);
    const hired = dispatchThrough(staffed, { kind: 'hire-manager', tier: 'novice' });
    expect(hired.managed.manager?.tier).toBe('novice');
    const dispatched: GymViewAction[] = [];
    const root = render(hired, dispatched);
    press(findByTestId(root, 'gymscreen-dismiss-manager'));
    expect(dispatched).toEqual([{ kind: 'dismiss-manager' }]);
  });
});

describe('stage 4: only a press moves the failure ledger', () => {
  it('advances the clock as far as this screen can and the ledger does not move', () => {
    // GDD §5.7's clarification and §5.13's wear-basis ruling, driven on the
    // screen rather than argued about: condition falls, income falls, the
    // review cadence advances — and nothing about failure moves, because
    // `managedCheckIn` writes no strike and no control was pressed.
    const opened = createGymViewState();
    // Far enough for the wear to cross the maintenance-prompt line, so the
    // screen really is in the state where a chained build would have charged
    // for it — derived from the tuning rather than a hand-picked count, and
    // then carried forward to the next review the ORDINAL raises, using
    // `orderOpensAt` itself rather than restating its arithmetic here.
    const step = ladderDevTimeSteps()[ladderDevTimeSteps().length - 1]?.seconds as number;
    expect(step).toBeGreaterThanOrEqual(
      EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR,
    );
    const wearPerPress =
      EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR * EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS;
    const crossing = Math.ceil((1 - EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION) / wearPerPress);
    const worn = advanceTimes(opened, crossing);
    const advanced = advanceTimes(worn, orderOpensAt(worn.managed) - worn.managed.checkInsTaken);
    const PRESSES = advanced.managed.checkInsTaken;
    expect(PRESSES).toBeGreaterThanOrEqual(crossing);
    expect(advanced.managed.checkInsTaken).toBe(PRESSES);
    expect(meanCondition(advanced.managed)).toBeLessThan(meanCondition(opened.managed));
    expect(conditionIncomeMultiplier(advanced.managed)).toBeLessThan(
      conditionIncomeMultiplier(opened.managed),
    );
    // The ledger, and everything derived from it, is byte-identical. THESE
    // COME BEFORE THE WORN-ITEMS READING BELOW ON PURPOSE, and the ordering
    // was chosen from a planted mutant rather than by taste: a build in which
    // low condition alone appends a strike takes the gym dormant, dormancy
    // applies no wear, and `wornItems` then comes back EMPTY — so with the
    // reading first, the mutant reddened at `expected 0 to be greater than 0`,
    // which names the wrong thing entirely. A check that bites and fails
    // uselessly is half a check.
    expect(advanced.managed.strikes).toEqual([]);
    expect(advanced.managed.neglected).toEqual([]);
    expect(advanced.managed.promptDismissals).toBe(0);
    expect(failurePhase(advanced.managed)).toBe('sound');
    expect(warningSigns(advanced.managed).strikeCount).toBe(0);
    expect(recoveryRequirement(advanced.managed).kind).toBe('not-dormant');
    // Non-vacuity, and it is the reason the zeros above are worth something:
    // the gym really is worn past the maintenance-prompt line here, which is
    // the exact state a build with the forbidden chain in it would have
    // charged for.
    expect(wornItems(advanced.managed).length).toBeGreaterThan(0);
    // And the screen says the same thing, in the words a player reads.
    const root = render(advanced, []);
    expect(textOf(findByTestId(root, 'gymscreen-phase'))).toContain('sound');
    expect(textOf(findByTestId(root, 'gymscreen-strikes-lead'))).toContain(
      'a decision you take here is the only thing that can',
    );
    expect(textOf(findByTestId(root, 'gymscreen-recovery-state'))).toBe(
      'open for business — sound',
    );
    // A worn gym SHOWS a review — which is exactly what §5.7's clarification
    // allows condition to do, and all it allows it to do.
    expect(findAllByTestId(root, 'gymscreen-prompt-repair').length).toBe(1);
    expectManagementMatchesState(root, advanced);
  });
});

/** Press `id` on the drawn screen and apply exactly the action it dispatched. */
function pressThrough(state: GymViewState, id: string): GymViewState {
  const dispatched: GymViewAction[] = [];
  press(findByTestId(render(state, dispatched), id));
  expect(dispatched.length, `pressing ${id} dispatched ${dispatched.length} action(s)`).toBe(1);
  return dispatchThrough(state, dispatched[0] as GymViewAction);
}

/**
 * Advance the clock `presses` times, counting how many of the states passed
 * through had a standing review on screen. The count is what makes a zero
 * ledger reading worth something: it says reviews really were drawn and
 * really were left alone, rather than the walk having crossed none.
 */
function walkPastReviews(
  state: GymViewState,
  presses: number,
): { readonly state: GymViewState; readonly reviewsSeen: number } {
  let next = state;
  let reviewsSeen = 0;
  for (let at = 0; at < presses; at += 1) {
    if (maintenancePrompt(next.managed).kind === 'offered') reviewsSeen += 1;
    next = advanceTimes(next, 1);
  }
  if (maintenancePrompt(next.managed).kind === 'offered') reviewsSeen += 1;
  return { state: next, reviewsSeen };
}

describe('stage 4: the sentence drawn over a standing review', () => {
  // The copy this test grades used to read "leaving this one unanswered counts
  // against the gym" and "you can leave this one unanswered for free; the next
  // one counts". Both were false of the engine: `promptDismissals` is written
  // in one expression, inside `respondToPromptUnder`, so what the counter
  // tracks is presses of "not now" — leaving a review alone writes nothing at
  // all. The check that stood behind those sentences asserted only that the
  // drawn branch matched `prompt.dismissalWouldCount`, which is the flag the
  // screen branched on, so it could not disagree with the screen whatever
  // either of them said. This one drives the forks instead.
  it("the review's own sentence is true of the mechanic", () => {
    const FIRST = EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN;
    const STRIDE = EMPIRE_TUNING.MAINTENANCE_ORDER_STRIDE;
    // One free dismissal is what the "free this once" half of the sentence is
    // about; if that knob moves, this test's shape is wrong rather than its
    // numbers, so it says so here instead of quietly re-deriving.
    expect(EMPIRE_TUNING.MAINTENANCE_PROMPT_FREE_DISMISSALS).toBe(1);

    // The fork point: the first standing review the cadence raises, reached by
    // pressing the real clock control, with an empty ledger behind it.
    const atFirstReview = advanceTimes(createGymViewState(), FIRST);
    expect(maintenancePrompt(atFirstReview.managed).kind).toBe('offered');
    expect(atFirstReview.managed.strikes).toEqual([]);
    expect(atFirstReview.managed.promptDismissals).toBe(0);
    const firstStakes = textOf(
      findByTestId(render(atFirstReview, []), 'gymscreen-prompt-stakes'),
    );
    expect(firstStakes).toContain('“not now” is free this once');
    expect(firstStakes).toContain('“decline the repair” counts');
    expect(firstStakes).toContain('only a press moves the ledger; leaving this open does not.');

    // CLAIM 1, and the one the old copy inverted: leaving it open writes
    // nothing. Nine more clock presses from check-in FIRST cross the review
    // ordinal three times — the count is asserted, so a cadence change that
    // stopped the walk crossing any review turns this red rather than leaving
    // a zero nobody could read.
    const walked = walkPastReviews(atFirstReview, STRIDE * 2 + 1);
    expect(walked.reviewsSeen).toBe(3);
    expect(walked.state.managed.checkInsTaken).toBe(FIRST + STRIDE * 2 + 1);
    expect(
      walked.state.managed.strikes.map((record) => record.decision),
      'a clock press with the review left unanswered wrote to the failure ledger',
    ).toEqual([]);
    expect(walked.state.managed.neglected).toEqual([]);
    expect(walked.state.managed.promptDismissals).toBe(0);
    expect(failurePhase(walked.state.managed)).toBe('sound');
    // The presses were not inert — the gym really ran while the ledger did not
    // move, which is the whole shape §5.7's clarification asks for.
    expect(meanCondition(walked.state.managed)).toBeLessThan(
      meanCondition(atFirstReview.managed),
    );

    // CLAIM 2: "not now" is free this once. Same fork state, one press.
    const dismissedOnce = pressThrough(atFirstReview, 'gymscreen-prompt-dismiss');
    expect(dismissedOnce.managed.promptDismissals).toBe(1);
    expect(dismissedOnce.managed.strikes).toEqual([]);

    // CLAIM 3: "decline the repair" counts, from that same untouched fork.
    const declinedCold = pressThrough(atFirstReview, 'gymscreen-prompt-decline');
    expect(declinedCold.managed.strikes.length).toBe(1);
    expect(declinedCold.managed.strikes[0]?.decision).toBe('repair-declined');

    // The second sentence, and the pair the brief for this round asked for:
    // two gyms identical up to this point, one that advances the clock and one
    // that presses. The screen now says both refusals count.
    const secondStakes = textOf(
      findByTestId(render(dismissedOnce, []), 'gymscreen-prompt-stakes'),
    );
    expect(secondStakes).toContain('both count against the gym now');
    expect(secondStakes).toContain('only a press moves the ledger; leaving this open does not.');
    const walkedAfterDismiss = walkPastReviews(dismissedOnce, STRIDE * 2 + 1);
    expect(walkedAfterDismiss.reviewsSeen).toBe(3);
    expect(
      walkedAfterDismiss.state.managed.strikes.map((record) => record.decision),
      'walking past a review whose next refusal WOULD count still wrote to the ledger',
    ).toEqual([]);
    expect(walkedAfterDismiss.state.managed.promptDismissals).toBe(1);
    expect(failurePhase(walkedAfterDismiss.state.managed)).toBe('sound');
    const dismissedTwice = pressThrough(dismissedOnce, 'gymscreen-prompt-dismiss');
    expect(dismissedTwice.managed.strikes.length).toBe(1);
    expect(dismissedTwice.managed.strikes[0]?.decision).toBe('prompt-dismissed-again');
    const declinedAfterDismiss = pressThrough(dismissedOnce, 'gymscreen-prompt-decline');
    expect(declinedAfterDismiss.managed.strikes.length).toBe(1);
    expect(declinedAfterDismiss.managed.strikes[0]?.decision).toBe('repair-declined');

    // The third sentence: once every standing order has been refused, the
    // review keeps showing and neither refusal writes anything.
    const ownedAtFork = ownedItemsOf(atFirstReview.managed.gym);
    expect(ownedAtFork.length).toBe(3);
    let allRefused = atFirstReview;
    for (let at = 0; at < ownedAtFork.length; at += 1) {
      allRefused = pressThrough(allRefused, 'gymscreen-prompt-decline');
    }
    const refusedPrompt = maintenancePrompt(allRefused.managed);
    expect(refusedPrompt.kind).toBe('offered');
    expect(refusedPrompt.kind === 'offered' && refusedPrompt.alreadyRefused).toBe(true);
    expect(allRefused.managed.strikes.length).toBe(ownedAtFork.length);
    const thirdStakes = textOf(findByTestId(render(allRefused, []), 'gymscreen-prompt-stakes'));
    expect(thirdStakes).toContain('refusing it again adds nothing');
    expect(thirdStakes).toContain('only a press moves the ledger; leaving this open does not.');
    expect(pressThrough(allRefused, 'gymscreen-prompt-decline').managed.strikes.length).toBe(
      ownedAtFork.length,
    );
    expect(pressThrough(allRefused, 'gymscreen-prompt-dismiss').managed.strikes.length).toBe(
      ownedAtFork.length,
    );
  });
});

describe('stage 4: the repair decision, priced before it is taken', () => {
  it('shows the cost, then charges exactly it and restores the item', () => {
    const reviewed = advanceTimes(createGymViewState(), EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN);
    const prompt = maintenancePrompt(reviewed.managed);
    expect(prompt.kind).toBe('offered');
    const item = prompt.kind === 'offered' ? prompt.item : ('power-bar' as ManagedEquipmentItem);
    const quoted = repairCostGymBucks(reviewed.managed, item);
    expect(quoted).toBeGreaterThan(0);
    // The price is on the screen BEFORE the press — read it off the drawn tree.
    const before = render(reviewed, []);
    expect(textOf(findByTestId(before, 'gymscreen-prompt-item'))).toContain(`${quoted} gym bucks`);
    expect(textOf(findByTestId(before, `gymscreen-condition-${item}`))).toContain(
      `repairing it costs ${quoted} gym bucks`,
    );
    const purseBefore = reviewed.managed.gym.ladder.gymBucks;
    const repaired = dispatchThrough(reviewed, { kind: 'answer-prompt', response: 'repair' });
    expect(repaired.lastRefusal).toBeNull();
    expect(itemCondition(repaired.managed, item)).toBe(1);
    // `scrubPrecision` is the engine's own rounding instrument, applied here
    // because the DIFFERENCE of two individually-scrubbed purses is not itself
    // scrubbed — the engine is exact about each balance, not about subtraction.
    expect(scrubPrecision(purseBefore - repaired.managed.gym.ladder.gymBucks)).toBe(quoted);
    expect(repaired.managed.strikes).toEqual([]);
    expectManagementMatchesState(render(repaired, []), repaired);
    // Repairing an already-sound item is refused, and the refusal is shown.
    const again = dispatchThrough(repaired, { kind: 'repair-item', item });
    expect(again.lastRefusal).toBe('already-sound');
    expect(textOf(findByTestId(render(again, []), 'gymscreen-refusal'))).toBe(
      'refused: already-sound',
    );
  });

  it('answering a review on a check-in with none open is refused, not silent', () => {
    const quiet = advanceTimes(createGymViewState(), 1);
    expect(maintenancePrompt(quiet.managed).kind).toBe('quiet');
    const answered = dispatchThrough(quiet, { kind: 'answer-prompt', response: 'dismiss' });
    expect(answered.lastRefusal).toBe('no-prompt');
    expect(answered.managed).toEqual(quiet.managed);
    expect(textOf(findByTestId(render(answered, []), 'gymscreen-refusal'))).toBe(
      'refused: no-prompt',
    );
  });
});

describe('stage 4: staffing, on the screen', () => {
  it('hires, shows the wage and the auto-repair threshold, and lets them go', () => {
    const funded = advanceTimes(createGymViewState(), 3);
    const opening = render(funded, []);
    expect(textOf(findByTestId(opening, 'gymscreen-manager-state'))).toContain('no manager');
    const hired = dispatchThrough(funded, { kind: 'hire-manager', tier: 'steady' });
    expect(hired.lastRefusal).toBeNull();
    expect(hired.managed.manager).toEqual({ tier: 'steady', hiredUnderWarning: false });
    expect(funded.managed.gym.ladder.gymBucks - hired.managed.gym.ladder.gymBucks).toBe(
      managerHireCostGymBucks('steady'),
    );
    const staffed = render(hired, []);
    expect(textOf(findByTestId(staffed, 'gymscreen-manager-state'))).toContain(
      `${managerWageRatePerBankedHour('steady')} gym bucks per banked hour`,
    );
    expect(textOf(findByTestId(staffed, 'gymscreen-manager-state'))).toContain(
      `below condition ${managerAutoRepairCondition('steady')}`,
    );
    expectManagementMatchesState(staffed, hired);
    // A second hire is refused while one is on staff.
    const twice = dispatchThrough(hired, { kind: 'hire-manager', tier: 'novice' });
    expect(twice.lastRefusal).toBe('already-staffed');
    const gone = dispatchThrough(hired, { kind: 'dismiss-manager' });
    expect(gone.managed.manager).toBeNull();
    expect(gone.lastRefusal).toBeNull();
    expect(dispatchThrough(gone, { kind: 'dismiss-manager' }).lastRefusal).toBe('no-manager');
  });

  it('the manager repairs on its own and the screen reports every one it billed', () => {
    // A veteran repairs below 0.75. Reached by wearing the gym past that line
    // with real clock presses, on a purse big enough to pay the bill.
    let played = advanceTimes(createGymViewState(), 6);
    played = dispatchThrough(played, { kind: 'hire-manager', tier: 'veteran' });
    expect(played.managed.manager?.tier).toBe('veteran');
    let guard = 0;
    while (
      played.lastManagementReport !== null &&
      played.lastManagementReport.autoRepairs.length === 0 &&
      guard < 40
    ) {
      played = advanceTimes(played, 1);
      guard += 1;
    }
    const report = played.lastManagementReport;
    expect(report).not.toBeNull();
    expect((report as NonNullable<typeof report>).autoRepairs.length).toBeGreaterThan(0);
    const root = render(played, []);
    for (const repair of (report as NonNullable<typeof report>).autoRepairs) {
      expect(textOf(findByTestId(root, `gymscreen-auto-repair-${repair.item}`))).toBe(
        `your manager repaired ${repair.item} for ${repair.costGymBucks} gym bucks`,
      );
    }
    expect(textOf(findByTestId(root, 'gymscreen-check-in-costs'))).toContain(
      `paid ${(report as NonNullable<typeof report>).wagePaidGymBucks} in wages`,
    );
    expectManagementMatchesState(root, played);
  });
});

describe('stage 4: dormancy is reached by refusals and left by a repair investment', () => {
  it('walks three refused repair orders into dormancy, then reopens the gym', () => {
    let played = createGymViewState();
    const refusals: string[] = [];
    let guard = 0;
    while (failurePhase(played.managed) !== 'failed' && guard < 60) {
      played = advanceTimes(played, 1);
      guard += 1;
      const prompt = maintenancePrompt(played.managed);
      if (prompt.kind !== 'offered' || prompt.alreadyRefused) continue;
      const strikesBefore = played.managed.strikes.length;
      const shown = prompt.repairCostGymBucks;
      played = dispatchThrough(played, { kind: 'decline-repair', item: prompt.item });
      expect(played.lastRefusal).toBeNull();
      expect(played.managed.strikes.length).toBe(strikesBefore + 1);
      const record = played.managed.strikes[strikesBefore] as CountedDecisionRecord;
      // §5.7's "told the cost of": the record carries the price the screen
      // showed, and the screen shows the record.
      expect(record.decision).toBe('repair-declined');
      expect(record.shownCostGymBucks).toBe(shown);
      refusals.push(prompt.item);
    }
    expect(failurePhase(played.managed)).toBe('failed');
    expect(refusals.length).toBe(EMPIRE_TUNING.FAILURE_STRIKES);
    expect(played.managed.strikes.length).toBe(EMPIRE_TUNING.FAILURE_STRIKES);
    // Every strike on the ledger is a decision, and the screen names each one.
    const dormant = render(played, []);
    expect(textOf(findByTestId(dormant, 'gymscreen-phase'))).toContain('failed');
    expect(textOf(findByTestId(dormant, 'gymscreen-recovery-state'))).toContain('dormant');
    for (let index = 0; index < played.managed.strikes.length; index += 1) {
      expect(textOf(findByTestId(dormant, `gymscreen-strike-${index}`))).toContain(
        'repair-declined',
      );
    }
    expect(conditionIncomeMultiplier(played.managed)).toBe(EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER);
    expectManagementMatchesState(dormant, played);

    // The way back: the quoted repair investment, then reopen. The quote is on
    // the screen before any of it is spent.
    const quoted = recoveryRepairCostGymBucks(played.managed);
    expect(quoted).toBeGreaterThan(0);
    expect(textOf(findByTestId(dormant, 'gymscreen-recovery-cost'))).toContain(
      `reopening would cost ${quoted} gym bucks`,
    );
    expect(dispatchThrough(played, { kind: 'recover-gym' }).lastRefusal).toBe(
      'equipment-below-recovery-minimum',
    );
    const purseBefore = played.managed.gym.ladder.gymBucks;
    expect(purseBefore).toBeGreaterThan(quoted);
    for (const item of ownedItemsOf(played.managed.gym)) {
      if (itemCondition(played.managed, item) >= EMPIRE_TUNING.RECOVERY_CONDITION_MIN) continue;
      played = dispatchThrough(played, { kind: 'repair-item', item });
      expect(played.lastRefusal).toBeNull();
    }
    expect(scrubPrecision(purseBefore - played.managed.gym.ladder.gymBucks)).toBe(quoted);
    expect(recoveryRequirement(played.managed).kind).toBe('ready');
    // The reopen control is offered exactly here — on a dormant gym whose
    // requirements are met — and this is the press that proves it dispatches
    // what it names. It is drawn nowhere else, which is the whole change:
    // it used to sit on the opening screen under "open for business".
    const reopenPresses: GymViewAction[] = [];
    press(findByTestId(render(played, reopenPresses), 'gymscreen-recover'));
    expect(reopenPresses).toEqual([{ kind: 'recover-gym' }]);
    const reopened = dispatchThrough(played, { kind: 'recover-gym' });
    expect(reopened.lastRefusal).toBeNull();
    expect(reopened.managed.strikes).toEqual([]);
    expect(reopened.managed.recoveries).toBe(1);
    expect(failurePhase(reopened.managed)).toBe('sound');
    const back = render(reopened, []);
    expect(textOf(findByTestId(back, 'gymscreen-recovery-state'))).toBe('open for business — sound');
    // A reopened gym is open, so it quotes no reopening price — what it keeps
    // is the count, which is history rather than an offer.
    expect(findAllByTestId(back, 'gymscreen-recovery-cost').length).toBe(0);
    expect(textOf(findByTestId(back, 'gymscreen-recovery-history'))).toBe(
      'this gym has reopened 1 time(s)',
    );
    expectManagementMatchesState(back, reopened);
    // Reopening a gym that is not dormant is refused, not silent.
    expect(dispatchThrough(reopened, { kind: 'recover-gym' }).lastRefusal).toBe('not-dormant');
  });
});


// ---------------------------------------------------------------------------
// THE PLAYER'S OWN CHECK-IN — the control this round exists for.
//
// A human played this screen on a real phone and said, in their own words,
// that they could not open a review. That was structural rather than a matter
// of taste: `ManagedGym.checkInsTaken` had exactly one writer, reached from
// exactly one reducer arm, dispatched from exactly one shipped place — the
// dev clock-skip row this screen labels "not part of the game". Every §5.11
// stage-4 beat hangs off that counter, so a player who touched no debug
// control could reach none of them.
//
// The tests below are written so that a regression to that state reddens
// them. The load-bearing one is `reaches a maintenance review without ever
// touching a control in the dev row`, which collects every testID inside
// `gymscreen-dev-controls` and asserts the ids it pressed are disjoint from
// it — so a "fix" that quietly routed the player control back through a dev
// button, or a future round that deleted the player control and left the
// screen reachable only through the dev row, fails here rather than passing
// on the strength of the review opening.
// ---------------------------------------------------------------------------

describe("the player's own check-in reaches the stage-4 loop without the dev row", () => {
  it('opens for a shift, and the shift is the whole offline window rather than a second knob', () => {
    // `bankableOfflineSeconds` discards everything past the cap, so a control
    // that advanced further would quietly throw part of what it earned away.
    // The relation is asserted rather than assumed — this is what keeps a
    // retune of the cap from silently making the player's own opening lossy.
    expect(playerCheckInGapSeconds()).toBe(
      T.OFFLINE_EARNINGS_CAP_HOURS * T.SECONDS_PER_HOUR,
    );
    const opened = dispatchThrough(createGymViewState(), { kind: 'open-up' });
    const accrual = opened.lastAccrual;
    expect(accrual).not.toBeNull();
    expect((accrual as NonNullable<typeof accrual>).secondsElapsed).toBe(playerCheckInGapSeconds());
    expect((accrual as NonNullable<typeof accrual>).secondsDiscarded).toBe(0);
    expect((accrual as NonNullable<typeof accrual>).secondsBanked).toBe(playerCheckInGapSeconds());
    expect((accrual as NonNullable<typeof accrual>).gymBucks).toBeGreaterThan(0);
  });

  it('the control dispatches open-up, and it is not in the dev row', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = render(state, dispatched);
    press(findByTestId(root, 'gymscreen-open-up-press'));
    expect(dispatched).toEqual([{ kind: 'open-up' }]);
    const devIds = testIdsUnder(findByTestId(root, 'gymscreen-dev-controls'));
    expect(devIds.length).toBeGreaterThan(0);
    expect(devIds).not.toContain('gymscreen-open-up-press');
    // And the dev row is still there, still labelled for what it is — this
    // round did not delete an instrument, it stopped the instrument being the
    // only way in.
    for (const step of ladderDevTimeSteps()) {
      expect(devIds).toContain(`gymscreen-advance-${step.seconds}`);
    }
  });

  it('reaches a maintenance review without ever touching a control in the dev row', () => {
    let played = createGymViewState();
    // The cadence is UNCHANGED by this round, and that is asserted first: the
    // fix is that a player can take check-ins, not that the first one is
    // special.
    expect(maintenancePrompt(played.managed).kind).toBe('quiet');
    expect(played.managed.checkInsTaken).toBe(0);

    const pressedIds: string[] = [];
    const devIdsAtStart = testIdsUnder(findByTestId(render(played, []), 'gymscreen-dev-controls'));
    for (let shift = 0; shift < T.MAINTENANCE_ORDER_FIRST_CHECK_IN; shift += 1) {
      const dispatched: GymViewAction[] = [];
      const root = render(played, dispatched);
      press(findByTestId(root, 'gymscreen-open-up-press'));
      pressedIds.push('gymscreen-open-up-press');
      expect(dispatched.length).toBe(1);
      played = dispatchThrough(played, dispatched[0] as GymViewAction);
    }

    expect(played.managed.checkInsTaken).toBe(T.MAINTENANCE_ORDER_FIRST_CHECK_IN);
    const prompt = maintenancePrompt(played.managed);
    expect(prompt.kind).toBe('offered');
    // Not just the model — the review is DRAWN, naming its item and quoting
    // its price, with all three answers offered.
    const reviewed = render(played, []);
    expect(textOf(findByTestId(reviewed, 'gymscreen-prompt-item'))).toContain('maintenance review:');
    expect(findAllByTestId(reviewed, 'gymscreen-prompt-dismiss').length).toBe(1);
    expect(findAllByTestId(reviewed, 'gymscreen-prompt-decline').length).toBe(1);
    // The disjointness that makes this claim about the PLAYER path: nothing
    // pressed here is a control the dev row draws.
    expect(devIdsAtStart.length).toBeGreaterThan(0);
    for (const id of pressedIds) expect(devIdsAtStart).not.toContain(id);
    expect(new Set(pressedIds).size).toBe(1);
  });

  it('opening the gym moves condition and money and never the failure ledger', () => {
    // The §5.7 claim, on the new arm. It holds for the same reason it holds
    // for the dev arm — both end in the same `managedCheckIn` — and it is
    // asserted on THIS arm rather than inherited by argument, because a
    // player-reachable check-in is the one that would matter if it stopped
    // holding.
    let played = createGymViewState();
    const before = meanCondition(played.managed);
    for (let shift = 0; shift < T.MAINTENANCE_ORDER_FIRST_CHECK_IN * 3; shift += 1) {
      played = dispatchThrough(played, { kind: 'open-up' });
      expect(played.lastRefusal).toBeNull();
      expect(played.managed.strikes).toEqual([]);
      expect(failurePhase(played.managed)).toBe('sound');
    }
    expect(meanCondition(played.managed)).toBeLessThan(before);
    expect(played.managed.gym.ladder.gymBucks).toBeGreaterThan(0);
    expect(played.managed.checkInsTaken).toBe(T.MAINTENANCE_ORDER_FIRST_CHECK_IN * 3);
  });

  it('the note over the control reports the real check-in count and the real next review', () => {
    let played = createGymViewState();
    for (let shift = 0; shift <= T.MAINTENANCE_ORDER_FIRST_CHECK_IN; shift += 1) {
      const note = textOf(findByTestId(render(played, []), 'gymscreen-open-up-note'));
      expect(note).toContain(`${played.managed.checkInsTaken} shift(s) opened so far`);
      if (maintenancePrompt(played.managed).kind === 'quiet') {
        expect(note).toContain(`comes up at shift ${orderOpensAt(played.managed)}`);
      } else {
        expect(note).toContain('a maintenance review is waiting for you');
      }
      played = dispatchThrough(played, { kind: 'open-up' });
    }
  });
});

describe('stage 4: the stale stage-four sentence is gone from the top of the ladder', () => {
  it('names what is actually surfaced and what is actually still paused', () => {
    let rich = createGymViewState();
    // Grant the warehouse rung directly rather than grinding to it — this test
    // is about one string on the top rung, not about the ladder's pacing.
    const top = EMPIRE_TUNING.LADDER_RUNGS[EMPIRE_TUNING.LADDER_RUNGS.length - 1] as
      (typeof EMPIRE_TUNING.LADDER_RUNGS)[number];
    rich = Object.freeze({
      ...rich,
      managed: withUpdatedGym(
        rich.managed,
        Object.freeze({
          ...rich.managed.gym,
          ladder: Object.freeze({ ...rich.managed.gym.ladder, rung: top }),
        }),
      ),
    });
    const moveText = textOf(findByTestId(render(rich, []), 'gymscreen-move'));
    expect(moveText).toBe(
      'top of the ladder - staffing, maintenance and the failure state are above; the portfolio stays paused',
    );
    expect(moveText).not.toContain('the portfolio arrives with stage four');
  });
});
