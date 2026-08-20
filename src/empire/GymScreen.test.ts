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
  const { gym, weekIndex, allocation, allocationSetThisWeek, weekLog } = state;
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
  return compared;
}

describe('the opening screen displays ladder.ts / sessions.ts on every displayed quantity', () => {
  it('matches the pure functions on the opening state', () => {
    const state = createGymViewState();
    expect(state.gym).toEqual(
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
    expect(refused.gym).toEqual(state.gym);
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
    while (state.gym.ladder.gymBucks < target) {
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
    expect(state.gym.ladder.rung).toBe('storage-unit');
    root = render(state, dispatched);
    expectScreenMatchesState(root, state);

    // Press buy-ladder for the squat rack through the real control.
    press(findByTestId(root, 'gymscreen-buy-ladder-squat-rack'));
    expect(dispatched[dispatched.length - 1]).toEqual({ kind: 'buy-ladder', item: 'squat-rack' });
    state = dispatchThrough(state, { kind: 'buy-ladder', item: 'squat-rack' });
    expect(state.lastRefusal).toBeNull();
    expect(state.gym.ladder.equipment).toContain('squat-rack');
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
