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
  createRestAllocation,
  resolveWeek,
  sessionEquipmentCost,
  sessionEquipmentGroup,
  sessionEquipmentMinRung,
  trainingWeekShape,
  weeklyAttributeEffects,
} from './sessions';
import { ladderDevTimeSteps, ladderIncomeRatePerHour } from './ladder';
import { EMPIRE_TUNING } from './empireTuning';
import {
  type CountedDecisionRecord,
  type ManagedEquipmentItem,
  conditionIncomeMultiplier,
  failurePhase,
  fullRepairCostGymBucks,
  itemCondition,
  maintenancePrompt,
  managerAutoRepairCondition,
  managerHireCostGymBucks,
  managerWageRatePerBankedHour,
  meanCondition,
  orderOpensAt,
  ownedItemsOf,
  recoveryRepairCostGymBucks,
  recoveryRequirement,
  repairCostGymBucks,
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

/** The words `describeSlotOutcome` must produce, checked without importing it. */
function expectOutcomeInText(text: string, outcome: SlotOutcome): void {
  if (outcome.kind === 'rested') {
    expect(text).toContain('rested');
    return;
  }
  expect(text).toContain(outcome.activity);
  if (outcome.kind === 'unequipped') expect(text).toContain(outcome.requires);
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
    const buyButtons = findAllByTestId(root, `gymscreen-buy-ladder-${item}`);
    expect(buyButtons.length, item).toBe(ownedLadder.has(item) ? 0 : 1);
    compared += 1;
  }
  // The stage-2 shop: cost, group, min rung and the buy control, per item.
  const sessionShopText = textOf(findByTestId(root, 'gymscreen-session-shop'));
  const ownedSession = new Set<string>(gym.sessionEquipment);
  for (const item of T.SESSION_EQUIPMENT_ITEMS) {
    expect(sessionShopText).toContain(
      `${item} (${sessionEquipmentGroup(item)}) costs ${sessionEquipmentCost(item)} gym bucks, fits from ${sessionEquipmentMinRung(item)}`,
    );
    const buyButtons = findAllByTestId(root, `gymscreen-buy-session-${item}`);
    expect(buyButtons.length, item).toBe(ownedSession.has(item) ? 0 : 1);
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
    `worn past the review line: ${worn.length === 0 ? 'nothing' : worn.join(', ')} — repair orders still unanswered: ${unanswered.length === 0 ? 'none' : unanswered.join(', ')}`,
  );
  compared += 2;
  const owned = ownedItemsOf(managed.gym);
  for (const item of owned) {
    expect(textOf(findByTestId(root, `gymscreen-condition-${item}`))).toBe(
      `${item}: condition ${itemCondition(managed, item)}, repairing it costs ${repairCostGymBucks(managed, item)} gym bucks`,
    );
    expect(findAllByTestId(root, `gymscreen-repair-${item}`).length, item).toBe(1);
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
    compared += 5;
  } else {
    expect(textOf(findByTestId(root, 'gymscreen-prompt-item'))).toBe(
      `maintenance review: ${prompt.item} is at condition ${itemCondition(managed, prompt.item)} and repairing it costs ${prompt.repairCostGymBucks} gym bucks`,
    );
    for (const id of answerControls) expect(findAllByTestId(root, id).length, id).toBe(1);
    // §5.7's "told the cost of": what the screen says a refusal is worth has
    // to be what the engine says it is worth, in both directions.
    const stakes = textOf(findByTestId(root, 'gymscreen-prompt-stakes'));
    if (prompt.alreadyRefused) expect(stakes).toContain('adds nothing to the ledger');
    else if (prompt.dismissalWouldCount) expect(stakes).toContain('counts against the gym');
    else expect(stakes).toContain('for free');
    compared += 7;
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
      expect(findAllByTestId(root, `gymscreen-hire-${tier}`).length, tier).toBe(1);
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
      compared += 1;
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
  expect(textOf(findByTestId(root, 'gymscreen-recovery-cost'))).toBe(
    `reopening would cost ${recoveryRepairCostGymBucks(managed)} gym bucks in repairs, and this gym has reopened ${managed.recoveries} time(s)`,
  );
  expect(findAllByTestId(root, 'gymscreen-recover').length).toBe(1);
  compared += 4;
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
    expect(findAllByTestId(root, 'gymscreen-move-up').length).toBe(1);
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
    press(findByTestId(root, 'gymscreen-buy-session-mats'));
    press(findByTestId(root, 'gymscreen-slot-0-set-cardio'));
    expect(dispatched).toEqual([
      ...ladderDevTimeSteps().map((step) => ({ kind: 'advance-clock', gapSeconds: step.seconds })),
      { kind: 'advance-to-next-week' },
      { kind: 'buy-session', item: 'mats' },
      { kind: 'set-allocation-slot', slotIndex: 0, slot: 'cardio' },
    ]);
    expect(dispatched.length).toBe(ladderDevTimeSteps().length + 3);
  });

  it('the move-up control dispatches move-up, and refused presses change nothing displayed', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = render(state, dispatched);
    press(findByTestId(root, 'gymscreen-move-up'));
    expect(dispatched).toEqual([{ kind: 'move-up' }]);
    const refused = dispatchThrough(state, { kind: 'move-up' });
    expect(refused.lastRefusal).toBe('not-enough-gym-bucks');
    const refusedRoot = render(refused, []);
    expect(textOf(findByTestId(refusedRoot, 'gymscreen-refusal'))).toBe(
      'refused: not-enough-gym-bucks',
    );
    expect(refused.managed.gym).toEqual(state.managed.gym);
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
  it('drives repair, hire and recover off the opening screen', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = render(state, dispatched);
    const owned = ownedItemsOf(state.managed.gym);
    for (const item of owned) press(findByTestId(root, `gymscreen-repair-${item}`));
    for (const tier of EMPIRE_TUNING.MANAGER_TIERS) press(findByTestId(root, `gymscreen-hire-${tier}`));
    press(findByTestId(root, 'gymscreen-recover'));
    expect(dispatched).toEqual([
      ...owned.map((item) => ({ kind: 'repair-item', item })),
      ...EMPIRE_TUNING.MANAGER_TIERS.map((tier) => ({ kind: 'hire-manager', tier })),
      { kind: 'recover-gym' },
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
    expect(wornItems(advanced.managed).length).toBeGreaterThan(0);
    // The ledger, and everything derived from it, is byte-identical.
    expect(advanced.managed.strikes).toEqual([]);
    expect(advanced.managed.neglected).toEqual([]);
    expect(advanced.managed.promptDismissals).toBe(0);
    expect(failurePhase(advanced.managed)).toBe('sound');
    expect(warningSigns(advanced.managed).strikeCount).toBe(0);
    expect(recoveryRequirement(advanced.managed).kind).toBe('not-dormant');
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
    const reopened = dispatchThrough(played, { kind: 'recover-gym' });
    expect(reopened.lastRefusal).toBeNull();
    expect(reopened.managed.strikes).toEqual([]);
    expect(reopened.managed.recoveries).toBe(1);
    expect(failurePhase(reopened.managed)).toBe('sound');
    const back = render(reopened, []);
    expect(textOf(findByTestId(back, 'gymscreen-recovery-state'))).toBe('open for business — sound');
    expect(textOf(findByTestId(back, 'gymscreen-recovery-cost'))).toContain('reopened 1 time(s)');
    expectManagementMatchesState(back, reopened);
    // Reopening a gym that is not dormant is refused, not silent.
    expect(dispatchThrough(reopened, { kind: 'recover-gym' }).lastRefusal).toBe('not-dormant');
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
