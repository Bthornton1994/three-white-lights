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
  Image: 'Image',
  // S4h: `GymScreen.tsx` now calls `StyleSheet.create` at module scope, so the
  // mock needs a stand-in or the import resolves to `undefined` and the
  // module throws before a single test runs. The real `StyleSheet.create`
  // on native returns opaque numeric style IDs; this stub is intentionally
  // simpler — the identity function — because nothing here needs to resolve
  // an ID back to a style object, only to see that `style` was passed a
  // truthy, non-empty value. See "every rendered Pressable is visibly a
  // control" below for what that buys.
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
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
  ladderDevClockTestId,
  ladderDevTimeSteps,
  ladderEquipmentCost,
  ladderIncomeRatePerHour,
  moveUpLadder,
  nextLadderRung,
} from './ladder';
import {
  fixedFloorFurniture,
  overlapsFixedFurniture,
  placeFloorItem,
  sessionItemFootprint,
} from './floor';
import { EMPIRE_TUNING } from './empireTuning';
import { institutionalReputation } from './institutionalReputation';
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
  reviewBankedTime,
  warningSigns,
  withUpdatedGym,
  wornItems,
} from './management';
import { scrubPrecision } from './production';
import {
  displayConditionPercent,
  playerFacingActivityGroupLabel,
  playerFacingEquipmentCatalog,
  playerFacingEquipmentLabel,
  playerFacingGymBucksLine,
  playerFacingGymNowLine,
  playerFacingGymNextLine,
  playerFacingIncomeRateLine,
  playerFacingLocationLine,
  playerFacingManagerCapability,
  playerFacingReputationHud,
  playerFacingSurfaceLabel,
  playerFacingWeekEffectsLine,
  stationConditionView,
} from './stationView';
import { FloorGrid } from './FloorGrid';
import type { FloorSimServiceObservation } from './floorSim';
import { GymScreen } from './GymScreen';
import {
  lastLivingMemberSeasonEvent,
  playerFacingSeasonLine,
} from './livingMemberSeason';
import {
  livingMemberById,
  type LivingGymMember,
  type LivingMemberRoster,
} from './livingMembers';

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

/** Every element anywhere under `root` (root included) whose `type` is `typeName`. */
function allNodesOfType(root: unknown, typeName: string): readonly Rendered[] {
  if (!isRendered(root)) return [];
  const own = root.type === typeName ? [root] : [];
  return [...own, ...childrenOf(root).flatMap((child) => allNodesOfType(child, typeName))];
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

function render(state: GymViewState, dispatched: GymViewAction[], onLeaveGym?: () => void): Rendered {
  const element: unknown = GymScreen({
    state,
    dispatch: (action) => {
      dispatched.push(action);
    },
    ...(onLeaveGym === undefined ? {} : { onLeaveGym }),
  });
  expect(isRendered(element)).toBe(true);
  return element as Rendered;
}

function dispatchThrough(state: GymViewState, action: GymViewAction): GymViewState {
  return gymViewReduce(state, action);
}

/**
 * The same state with enough gym bucks to afford `target`, reached by
 * repeatedly advancing the clock by one whole offline-cap window — the
 * shipped horizon the real wall-clock catch-up in `AppShell.tsx`'s `GymHost`
 * banks in full whenever the gap it is fed is at least that long — rather
 * than by hand-building a purse.
 *
 * Every control this file gates is gated on the shipped transition's own
 * refusal, so a test that wants to press one has to reach a state where the
 * transition succeeds. `'open up for the day'` used to be that route and was
 * removed by human ruling (`GymScreen.tsx`'s header) because it minted the
 * same span on every tap regardless of real elapsed time; `advance-clock` is
 * the one shipped arm that reaches the same accrual honestly, so it is what
 * this fixture drives.
 */
function fundedEnoughFor(state: GymViewState, target: number): GymViewState {
  const oneWindowSeconds = T.OFFLINE_EARNINGS_CAP_HOURS * T.SECONDS_PER_HOUR;
  let funded = state;
  let guard = 0;
  while (funded.managed.gym.ladder.gymBucks < target) {
    funded = dispatchThrough(funded, { kind: 'advance-clock', gapSeconds: oneWindowSeconds });
    guard += 1;
    expect(guard, 'advancing the clock must eventually afford the target').toBeLessThan(2000);
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
/**
 * Mirrors `GymScreen.tsx`'s private `isDustRepairCost` / `displayRepairCost`
 * — re-derived here rather than imported, the same discipline this file's
 * own header states for every other displayed quantity: compared against the
 * pure tuning value, not against the component's internals.
 */
function isDustRepairCost(costGymBucks: number): boolean {
  return costGymBucks < EMPIRE_TUNING.DUST_REPAIR_COST_GYM_BUCKS;
}

function displayRepairCost(costGymBucks: number): number {
  return isDustRepairCost(costGymBucks) ? 0 : costGymBucks;
}

/**
 * Mirrors `GymScreen.tsx`'s private `isSoundCondition` — S4f's condition gate
 * for the per-item repair row, re-derived here rather than imported, same
 * discipline as `isDustRepairCost`/`displayRepairCost` above. This is the
 * gate the per-item row switched to; `isDustRepairCost` above stays the
 * mirror for the scheduled review's own control only, which S4f did not
 * touch.
 */
function isSoundCondition(condition: number): boolean {
  return condition >= EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION;
}

function displayRepairCostBySoundness(costGymBucks: number, condition: number): number {
  return isSoundCondition(condition) ? 0 : costGymBucks;
}

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

/**
 * S4h's own non-vacuity guard: every `Pressable` this component ACTUALLY
 * RENDERS, for a given props/state, carries `accessibilityRole="button"` and
 * a non-empty `style` — the two things a real phone playtest found missing
 * from all thirteen. Returns the count it checked, so the caller pins a
 * number rather than a boolean; a `Pressable` added later without the
 * treatment reddens a specific count instead of silently passing an
 * existential check over an empty domain.
 *
 * Walks the RENDERED tree rather than the source, on purpose: a Pressable
 * only reachable down a branch this fixture's state does not take is not
 * "checked" by this call, which is why the tests below drive several
 * distinct states rather than one.
 */
function expectEveryPressableIsAControl(root: Rendered, label: string): number {
  const pressables = allNodesOfType(root, 'Pressable');
  for (const node of pressables) {
    expect(node.props['accessibilityRole'], `${label}: a Pressable's accessibilityRole`).toBe(
      'button',
    );
    const style = node.props['style'];
    expect(style, `${label}: a Pressable's style`).toBeTruthy();
    const styleEntries = Array.isArray(style) ? style : [style];
    expect(styleEntries.length, `${label}: a Pressable's style array`).toBeGreaterThan(0);
    for (const entry of styleEntries) {
      expect(entry, `${label}: one entry of a Pressable's style`).toBeTruthy();
      expect(
        Object.keys(entry as object).length,
        `${label}: one entry of a Pressable's style has keys`,
      ).toBeGreaterThan(0);
    }
    // A disabled control (S4h Fix 2) must SAY it is disabled — otherwise the
    // accessibility tree reads it as a live control that happens not to fire.
    if (node.props['disabled'] === true) {
      expect(style, `${label}: a disabled Pressable's style still carries chrome`).toBeTruthy();
    }
  }
  return pressables.length;
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
  expect(textOf(findByTestId(root, 'gymscreen-rung'))).toBe(
    playerFacingLocationLine(gym.ladder.rung),
  );
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-gym-bucks'))).toBe(
    playerFacingGymBucksLine(gym.ladder.gymBucks),
  );
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-now'))).toBe(
    playerFacingGymNowLine(
      Object.freeze({
        memberCount: state.livingMembers.members.length,
        wornCount: wornItems(managed).length,
        wornLead:
          wornItems(managed)[0] === undefined
            ? null
            : playerFacingEquipmentLabel(wornItems(managed)[0] as string),
        reviewOpen: maintenancePrompt(managed).kind !== 'quiet',
        gymClosed: failurePhase(managed) === 'failed',
      }),
    ),
  );
  expect(textOf(findByTestId(root, 'gymscreen-next'))).toBe(
    playerFacingGymNextLine(
      Object.freeze({
        memberCount: state.livingMembers.members.length,
        wornCount: wornItems(managed).length,
        reviewOpen: maintenancePrompt(managed).kind !== 'quiet',
        gymClosed: failurePhase(managed) === 'failed',
      }),
    ),
  );
  compared += 2;
  expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).not.toContain('gymscreen-rate');
  expect(testIdsUnder(findByTestId(root, 'gymscreen-action-card'))).toContain('gymscreen-now');
  expect(testIdsUnder(findByTestId(root, 'gymscreen-action-card'))).toContain('gymscreen-next');
  expect(textOf(findByTestId(root, 'gymscreen-rate'))).toBe(
    playerFacingIncomeRateLine(ladderIncomeRatePerHour(gym.ladder.rung)),
  );
  expect(textOf(findByTestId(root, 'gymscreen-accelerated-bucks'))).toContain(
    String(gym.acceleratedGymBucks),
  );
  compared += 1;
  // The ladder shop: cost, min rung and the buy control's presence, per item.
  const ladderShopText = textOf(findByTestId(root, 'gymscreen-ladder-shop'));
  const ownedLadder = new Set<string>(gym.ladder.equipment);
  for (const item of T.LADDER_EQUIPMENT_ITEMS) {
    expect(findByTestId(root, `gymscreen-shop-card-${item}`)).toBeDefined();
    expect(textOf(findByTestId(root, `gymscreen-shop-name-${item}`))).toBe(
      playerFacingEquipmentLabel(item),
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-purpose-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).purpose,
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-effect-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).effect,
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-unlock-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).unlock,
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-tradeoff-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).tradeoff,
    );
    expect(ladderShopText).toContain(String(ladderEquipmentCost(item)));
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
    expect(findByTestId(root, `gymscreen-shop-card-${item}`)).toBeDefined();
    expect(textOf(findByTestId(root, `gymscreen-shop-name-${item}`))).toBe(
      playerFacingEquipmentLabel(item),
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-purpose-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).purpose,
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-effect-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).effect,
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-unlock-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).unlock,
    );
    expect(textOf(findByTestId(root, `gymscreen-shop-tradeoff-${item}`))).toBe(
      playerFacingEquipmentCatalog(item).tradeoff,
    );
    expect(sessionShopText).toContain(playerFacingActivityGroupLabel(sessionEquipmentGroup(item)));
    expect(sessionShopText).toContain(String(sessionEquipmentCost(item)));
    expect(sessionShopText).toContain(sessionEquipmentMinRung(item));
    if (ownedSession.has(item)) {
      expect(findAllByTestId(root, `gymscreen-buy-session-${item}`).length, item).toBe(0);
      expect(findAllByTestId(root, `gymscreen-buy-session-${item}-unavailable`).length, item).toBe(0);
      compared += 2;
    } else {
      const outcome = buySessionEquipment(gym, item);
      compared += expectGatedControl(
        root,
        `gymscreen-buy-session-${item}`,
        outcome.kind === 'refused',
        `buySessionEquipment ${item}`,
      );
      if (outcome.kind === 'refused') {
        // S4h Fix 2. Both refusal reasons draw the SAME `-unavailable`
        // testID (they are mutually exclusive per item, so there is no
        // collision) but no longer the same element: the unaffordable-but-
        // reached arm (`'not-enough-gym-bucks'`) is now a real, disabled
        // `Pressable` — dimmer chrome, `disabled`, `accessibilityRole`,
        // non-empty `style` — so a shortfall still reads as an upcoming
        // control rather than as nothing; the not-here-yet arm
        // (`'rung-too-low'`) stays plain, non-interactive `Text`, unchanged.
        // Checking the node's `type` (not just its presence) is what stops
        // Fix 2 from silently regressing back to Text-only.
        const unavailable = findByTestId(root, `gymscreen-buy-session-${item}-unavailable`);
        if (outcome.reason === 'not-enough-gym-bucks') {
          expect(unavailable.type, `${item} unavailable node type`).toBe('Pressable');
          expect(unavailable.props['disabled'], `${item} unavailable disabled`).toBe(true);
          expect(unavailable.props['accessibilityRole'], `${item} unavailable role`).toBe(
            'button',
          );
          expect(unavailable.props['style'], `${item} unavailable style`).toBeTruthy();
        } else {
          expect(unavailable.type, `${item} unavailable node type`).toBe('Text');
        }
        compared += 1;
      }
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
  expect(previewText).toBe(playerFacingWeekEffectsLine(previewEffects));
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
    expect(entryText).toContain(playerFacingWeekEffectsLine(week.effects));
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
  expect(phaseText).toBe(`gym status: ${signs.phase}`);
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-condition'))).toBe(
    `Equipment condition: ${displayConditionPercent(meanCondition(managed))}%`,
  );
  compared += 1;
  // S4f: `worn` is computed here, ahead of the full-repair line, because that
  // line now rounds to 0 under the SAME predicate the worn line already uses
  // (`worn.length === 0`) rather than under `fullRepairCostGymBucks`'s own
  // raw, cost-based sum — the human's 518s-watch report found the raw sum
  // still positive (`0.3456`) on a gym at 0.999712 mean condition, where every
  // individual item already read "as new".
  const worn = wornItems(managed);
  expect(textOf(findByTestId(root, 'gymscreen-full-repair'))).toBe(
    `Full repair: ${worn.length === 0 ? 0 : fullRepairCostGymBucks(managed)} gym bucks`,
  );
  compared += 1;
  expect(textOf(findByTestId(root, 'gymscreen-worn'))).toBe(
    `Needs attention: ${worn.length === 0 ? 'none' : worn.join(', ')}`,
  );
  compared += 1;
  // GDD §5.14 STAGE C.1: the per-item condition/repair-cost/repair-control
  // loop that used to be driven here (`gymscreen-condition-<item>`,
  // `gymscreen-repair-<item>`) is gone from this screen — it duplicated
  // exactly what the contextual station panel already shows for a tapped
  // item. The claim itself (an item's own condition, its real repair cost,
  // and the SAME `isSoundCondition`/`displayRepairCostBySoundness` gate)
  // is not weakened by the deletion; it moved with the code, to
  // `stationView.ts`'s `stationConditionView`, and is driven there —
  // `stationView.test.ts`'s "stationConditionView reads the real condition
  // and repair cost" and "...reports a sound item as 0 to repair even if the
  // raw cost is a tiny positive float" cover the exact two shapes this loop
  // used to prove on screen. The UI wiring half (a tap opening the panel, its
  // own repair button dispatching `repair-item`) is proven at the browser
  // level, where the panel actually renders —
  // `tools/verify-floor-reachability.mjs` §13c/§13e.
  expect(findAllByTestId(root, 'gymscreen-management')[0]).toBeDefined();
  // The maintenance review: WHETHER one is open is the check-in ordinal, and
  // WHICH item it names is condition — `management.ts` header §3a. Both are
  // read back off the screen against `maintenancePrompt` called directly.
  const prompt = maintenancePrompt(managed);
  const promptText = textOf(findByTestId(root, 'gymscreen-prompt'));
  const answerControls = ['gymscreen-prompt-repair', 'gymscreen-prompt-dismiss', 'gymscreen-prompt-decline'];
  if (prompt.kind === 'quiet') {
    expect(promptText).toBe('no maintenance review open');
    for (const id of answerControls) expect(findAllByTestId(root, id).length, id).toBe(0);
    expect(findAllByTestId(root, 'gymscreen-prompt-repair-unavailable').length).toBe(0);
    compared += 6;
  } else {
    expect(textOf(findByTestId(root, 'gymscreen-prompt-item'))).toBe(
      `maintenance review: ${prompt.item} at ${displayConditionPercent(itemCondition(managed, prompt.item))}% — repair costs ${displayRepairCost(prompt.repairCostGymBucks)} gym bucks`,
    );
    for (const id of answerControls.slice(1)) expect(findAllByTestId(root, id).length, id).toBe(1);
    // The review's own repair control is gated on the dust threshold or on
    // affordability, mirroring the same widened gate the per-item loop above
    // uses — not `respondToPrompt`'s own exact-zero "already-sound" refusal,
    // which the screen no longer matches one-for-one since the dust fix.
    compared += expectGatedControl(
      root,
      'gymscreen-prompt-repair',
      isDustRepairCost(prompt.repairCostGymBucks) ||
        prompt.repairCostGymBucks > managed.gym.ladder.gymBucks,
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
        `${tier}: hire ${managerHireCostGymBucks(tier)} gym bucks, wage ${managerWageRatePerBankedHour(tier)}/hour, ${playerFacingManagerCapability(tier)}`,
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
      `manager: ${tier} — ${managerWageRatePerBankedHour(tier)} gym bucks per banked hour, ${playerFacingManagerCapability(tier)}`,
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
      `since the last update: condition took ${report.incomeDeductedGymBucks} gym bucks off the accrual and paid ${report.incomePaidGymBucks} at ${report.incomeMultiplier}, wore the gym down by ${report.meanConditionWear}, paid ${report.wagePaidGymBucks} in wages (unpaid ${report.wageShortfallGymBucks}), and the manager repaired ${report.autoRepairs.length} item(s) for ${report.autoRepairSpendGymBucks}`,
    );
    for (const repair of report.autoRepairs) {
      expect(textOf(findByTestId(root, `gymscreen-auto-repair-${repair.item}`))).toBe(
        `your manager repaired ${repair.item} for ${repair.costGymBucks} gym bucks`,
      );
      compared += 2;
    }
    compared += 6;
  }
  const reputationReading = institutionalReputation(
    state.livingMembers.reputation,
    state.sportingReputation,
  );
  const reputationLine = playerFacingReputationHud(
    reputationReading.fromMembers,
    reputationReading.fromSporting,
  );
  expect(textOf(findByTestId(root, 'gymscreen-reputation'))).toBe(reputationLine);
  expect(textOf(findByTestId(root, 'gymscreen-reputation'))).not.toMatch(/\+REP/);
  // REP-EVIDENCE-01: both halves live on the HUD, not only the more-drawer
  // diagnostics block. testID readers still find the same ids.
  expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).toContain('gymscreen-reputation');
  expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
    'gymscreen-reputation',
  );
  expect(testIdsUnder(findByTestId(root, 'gymscreen-diagnostics'))).not.toContain(
    'gymscreen-reputation',
  );
  const credit = state.lastSportingCredit;
  if (credit === null) {
    expect(findAllByTestId(root, 'gymscreen-reputation-reason-0').length).toBe(0);
  } else if (credit.kind === 'credited') {
    credit.reasons.forEach((row, index) => {
      expect(textOf(findByTestId(root, `gymscreen-reputation-reason-${index}`))).toBe(row.text);
    });
    compared += credit.reasons.length;
  } else {
    expect(textOf(findByTestId(root, 'gymscreen-reputation-reason-0'))).toBe(
      T.SPORTING_REPUTATION.copy.unknownMeet,
    );
    compared += 1;
  }
  compared += 2;
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
      expect(findAllByTestId(root, ladderDevClockTestId('gymscreen-advance', step)).length).toBe(1);
    }
    expect(findAllByTestId(root, 'gymscreen-advance-next-week').length).toBe(1);
    expect(findAllByTestId(root, 'gymscreen-reset-gym').length).toBe(1);
    // THE OPENING FRAME'S OWN CLAIM, and the one this round changed. A cold
    // gym holds 0 gym bucks against a 2500 relocation, so the relocate
    // control is not offered and the price it could not meet is drawn in its
    // place — `moveUpLadder` refuses this exact state and the screen says so
    // instead of waiting to be pressed.
    expectGatedControl(root, 'gymscreen-move-up', true, 'a cold gym cannot afford a move');
    expect(moveUpLadder(state.managed.gym.ladder).kind).toBe('refused');
    // No tap on this screen advances the clock — the mint that used to live
    // here ('open up for the day') is gone by human ruling; see
    // `GymScreen.tsx`'s header. `checkInsTaken` only ever moves from a real
    // wall-clock catch-up dispatched by `AppShell.tsx`'s `GymHost`, outside
    // this screen's own controls entirely.
    expect(findAllByTestId(root, 'gymscreen-open-up-press').length).toBe(0);
  });
});

describe('every control dispatches exactly the action it names', () => {
  it('drives the dev steps, the week-boundary jump, a session buy and a slot edit', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = render(state, dispatched);
    for (const step of ladderDevTimeSteps()) {
      press(findByTestId(root, ladderDevClockTestId('gymscreen-advance', step)));
    }
    press(findByTestId(root, 'gymscreen-advance-next-week'));
    press(findByTestId(root, 'gymscreen-reset-gym'));
    press(findByTestId(root, 'gymscreen-slot-0-set-cardio'));
    // The buy control is gated on `buySessionEquipment`'s own refusal now, so
    // a cold gym does not draw one — the press below is taken on a state that
    // can actually afford mats, which is the only state where a player could
    // have taken it either.
    const funded = fundedEnoughFor(state, sessionEquipmentCost('mats'));
    press(findByTestId(render(funded, dispatched), 'gymscreen-buy-session-mats'));
    expect(dispatched).toEqual([
      ...ladderDevTimeSteps().map((step) => ({
        kind: 'advance-clock',
        gapSeconds: step.seconds,
        mode: step.mode,
      })),
      { kind: 'advance-to-next-week' },
      { kind: 'reset-gym' },
      { kind: 'set-allocation-slot', slotIndex: 0, slot: 'cardio' },
      { kind: 'buy-session', item: 'mats' },
    ]);
    expect(dispatched.length).toBe(ladderDevTimeSteps().length + 4);
  });

  it('watched QA helpers dispatch online; away helpers dispatch offline', () => {
    const watched = ladderDevTimeSteps().filter((step) => step.mode === 'online');
    const away = ladderDevTimeSteps().filter((step) => step.mode === 'offline');
    expect(watched.map((step) => step.label)).toEqual(['+30m watched', '+1h watched']);
    expect(away.map((step) => step.label)).toEqual(['+1h away', '+8h away', '+3d away']);
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = render(state, dispatched);
    press(findByTestId(root, 'gymscreen-advance-online-3600'));
    press(findByTestId(root, 'gymscreen-advance-offline-3600'));
    expect(dispatched).toEqual([
      { kind: 'advance-clock', gapSeconds: T.SECONDS_PER_HOUR, mode: 'online' },
      { kind: 'advance-clock', gapSeconds: T.SECONDS_PER_HOUR, mode: 'offline' },
    ]);
  });

  it('one hour watched pays the online garage rate; one hour away pays the offline fraction', () => {
    const opened = createGymViewState();
    const hour = T.SECONDS_PER_HOUR;
    const watched = dispatchThrough(opened, {
      kind: 'advance-clock',
      gapSeconds: hour,
      mode: 'online',
    });
    const away = dispatchThrough(opened, {
      kind: 'advance-clock',
      gapSeconds: hour,
      mode: 'offline',
    });
    expect(T.OFFLINE_EARNINGS_FRACTION).toBe(0.5);
    expect(watched.lastAccrual).not.toBeNull();
    expect(away.lastAccrual).not.toBeNull();
    expect(watched.lastAccrual?.secondsBanked).toBe(away.lastAccrual?.secondsBanked);
    expect(watched.lastAccrual?.gymBucks).toBeCloseTo(
      (away.lastAccrual?.gymBucks as number) / T.OFFLINE_EARNINGS_FRACTION,
      5,
    );
    expect(watched.managed.gym.ladder.gymBucks).toBeGreaterThan(away.managed.gym.ladder.gymBucks);
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
      'Not enough gym bucks',
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

/**
 * How many `advanceTimes` presses, from a fresh (condition-1) gym, it takes
 * to cross `MAINTENANCE_PROMPT_CONDITION` — derived from the tuning rather
 * than hand-picked, mirroring the identical derivation
 * `stage 4: only a press moves the failure ledger` below already uses. The
 * wear per press is `EQUIPMENT_WEAR_PER_BANKED_HOUR * OFFLINE_EARNINGS_CAP_
 * HOURS`, not the largest dev step's own raw seconds: the largest step
 * (`ladderDevTimeSteps`'s +3d) is well past the offline banking cap, so what
 * actually banks — and therefore wears — per press is the capped 12h, which
 * that other test's own assertion pins (`step` is only ever asserted `>=`
 * the capped span, never equal to it).
 */
function checkInsToCrossWornLine(): number {
  const wearPerPress =
    EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR * EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS;
  return Math.ceil((1 - EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION) / wearPerPress);
}

describe('stage 4: every new control dispatches exactly the action it names', () => {
  it('drives hire on a state where it would actually go through, and proves repair-item the same way the deleted per-item row used to', () => {
    // THIS TEST USED TO PRESS ALL OF THESE ON THE OPENING SCREEN, which is
    // exactly the state the human's report was about: nothing worn, nothing
    // in the purse, nothing shut, and every one of these controls drawn
    // anyway. They are gated on their own transition's refusal now, so the
    // state that offers them is the state a player could have pressed them
    // in — reached here by taking check-ins, not by hand-building a gym.
    //
    // S4f widened the per-item row's own gate from cost to condition, so a
    // single check-in (condition ~0.976, well above the 0.5 worn line) no
    // longer offers a repair control at all — it never affected `worn`,
    // which took its name from the fixture affording the top manager tier,
    // not from the equipment being worn. `checkInsToCrossWornLine` gets the
    // fixture past the line the control is now actually gated on, and
    // `fundedEnoughFor` only ever wears it further from there.
    const worn = fundedEnoughFor(
      advanceTimes(createGymViewState(), checkInsToCrossWornLine()),
      managerHireCostGymBucks(
        EMPIRE_TUNING.MANAGER_TIERS[EMPIRE_TUNING.MANAGER_TIERS.length - 1] as ManagerTier,
      ),
    );
    const dispatched: GymViewAction[] = [];
    const root = render(worn, dispatched);
    const owned = ownedItemsOf(worn.managed.gym);
    // GDD §5.14 STAGE C.1: `gymscreen-repair-<item>` is gone from GymScreen.
    // Repair now lives on FloorGrid's station strip
    // (`floorgrid-station-panel-repair`, `FloorGrid.tsx`), which this file
    // cannot render (`GymScreen({state, dispatch})` never expands the
    // `<FloorGrid .../>` element descriptor — see this file's own header).
    // What stays checkable here, on the SAME `worn` fixture the deleted press
    // loop used, is that `repair-item` is still a real, correctly-wired
    // reducer arm: driven directly through `dispatchThrough` (the same
    // pattern this file already uses elsewhere for `repair-item`, e.g. the
    // "priced before it is taken" test below) rather than through a press,
    // because there is no press left on this screen to make it with. The UI
    // wiring — a tap opens the panel, the panel's own repair button
    // dispatches this exact action — is proven at the browser level, where
    // the panel actually renders: `tools/verify-floor-reachability.mjs`
    // §13e ("CONTEXTUAL REPAIR DISPATCHES THROUGH THE REAL REDUCER").
    for (const item of owned) {
      expect(repairEquipment(worn.managed, item).kind, item).toBe('repaired');
      const repaired = dispatchThrough(worn, { kind: 'repair-item', item });
      expect(repaired.lastRefusal, item).toBeNull();
      expect(itemCondition(repaired.managed, item), item).toBe(1);
    }
    for (const tier of EMPIRE_TUNING.MANAGER_TIERS) {
      expect(hireManager(worn.managed, tier, worn.managed.gym.ladder.collectedAt).kind, tier).toBe(
        'hired',
      );
      press(findByTestId(root, `gymscreen-hire-${tier}`));
    }
    expect(dispatched).toEqual(
      EMPIRE_TUNING.MANAGER_TIERS.map((tier) => ({ kind: 'hire-manager', tier })),
    );
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
    expect(textOf(findByTestId(root, 'gymscreen-strikes-lead'))).toBe('0 counted decision(s)');
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

// ---------------------------------------------------------------------------
// S4f: a human watched one gym continuously for 518s (no skip-row, no
// mint-tap) and found every per-item row still offering a live "repair for
// 0.1152" and the bulk line still reading "everything back to new: 0.3456",
// at mean condition 0.999712. The cost-based gate (`isDustRepairCost`, "kill
// the mint") cannot hide this: condition falls continuously the whole time
// the gym runs, so cost climbs past any fixed threshold given enough elapsed
// real time. The ruling repointed the per-item row and the bulk line onto
// the same condition-based worn line `gymscreen-worn` already prints, and
// left the scheduled review's own control alone. Both fixtures below are
// driven through the real reducer, not hand-built.
//
// GDD §5.14 STAGE C.1: the per-item row itself is gone from this screen (it
// duplicated the contextual station panel). What these two tests proved about
// it — that it agrees with `isSoundCondition`, not a cost-based gate — is now
// asked of `stationView.ts`'s `stationConditionView` directly, the pure
// function the panel calls; the bulk line (`gymscreen-full-repair`, still a
// real GymScreen control, kept as a gym-level aggregate — this file's own
// header explains why) is unchanged and still asserted here.
// ---------------------------------------------------------------------------
describe('stage 4: the per-item repair row and the bulk line are gated on condition, not cost', () => {
  it('reproduces the reported defect: no live station repair and no positive bulk total on a gym merely worn by real time, comfortably above the worn line', () => {
    // A single small, positive tick of continuous wear — the same shape the
    // played report measured, reproduced directly rather than by looping
    // 518s of real ticks. 1000s of banked operation is comfortably under
    // every offline cap in this file (so it banks in full) and small enough
    // that condition stays comfortably above `MAINTENANCE_PROMPT_CONDITION`.
    const worn = dispatchThrough(createGymViewState(), {
      kind: 'advance-clock',
      gapSeconds: 1000,
    });
    const owned = ownedItemsOf(worn.managed.gym);
    expect(owned.length).toBeGreaterThan(0);
    for (const item of owned) {
      const condition = itemCondition(worn.managed, item);
      const cost = repairCostGymBucks(worn.managed, item);
      // Non-vacuity: this really is the reported shape — worn enough that the
      // quoted cost clears dust, not worn enough to cross the worn line —
      // rather than an edge the fix happens not to touch.
      expect(condition, item).toBeLessThan(1);
      expect(condition, item).toBeGreaterThanOrEqual(EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION);
      expect(cost, item).toBeGreaterThan(EMPIRE_TUNING.DUST_REPAIR_COST_GYM_BUCKS);
      // What the (now deleted) per-item row used to draw for this exact
      // state, read instead off the pure function the station panel calls.
      const station = stationConditionView(worn.managed, item);
      expect(station.isSound, item).toBe(true);
      expect(station.displayRepairCostGymBucks, item).toBe(0);
      expect(station.repairCostGymBucks, item).toBe(cost);
    }
    expect(wornItems(worn.managed).length).toBe(0);
    const root = render(worn, []);
    expect(textOf(findByTestId(root, 'gymscreen-full-repair'))).toBe(
      'Full repair: 0 gym bucks',
    );
    expectManagementMatchesState(root, worn);
  });

  it('the real per-station price, and a real positive bulk total, once an item has genuinely crossed the worn line', () => {
    const worn = advanceTimes(createGymViewState(), checkInsToCrossWornLine());
    const owned = ownedItemsOf(worn.managed.gym);
    const wornList = wornItems(worn.managed);
    // Non-vacuity: the crossing this fixture is built to reach really was
    // reached.
    expect(wornList.length).toBeGreaterThan(0);
    let sawRepairableStation = false;
    for (const item of owned) {
      const condition = itemCondition(worn.managed, item);
      const cost = repairCostGymBucks(worn.managed, item);
      const station = stationConditionView(worn.managed, item);
      if (condition >= EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION) {
        expect(station.isSound, item).toBe(true);
        continue;
      }
      expect(cost, item).toBeGreaterThan(0);
      expect(station.isSound, item).toBe(false);
      expect(station.displayRepairCostGymBucks, item).toBe(cost);
      sawRepairableStation = true;
    }
    expect(
      sawRepairableStation,
      'at least one owned item reads as a real, priced repair on the station panel',
    ).toBe(true);
    const root = render(worn, []);
    const totalCost = fullRepairCostGymBucks(worn.managed);
    expect(totalCost).toBeGreaterThan(0);
    expect(textOf(findByTestId(root, 'gymscreen-full-repair'))).toBe(
      `Full repair: ${totalCost} gym bucks`,
    );
    expectManagementMatchesState(root, worn);
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
    // S4f: the station panel and the scheduled review read DIFFERENT pools —
    // `gymscreen-worn`'s own text says so, and this fixture drives the
    // disagreement rather than assuming it away. At the FIRST review
    // (`MAINTENANCE_ORDER_FIRST_CHECK_IN` check-ins) the named item has not
    // yet crossed `MAINTENANCE_PROMPT_CONDITION`, so the station panel (were
    // it open on this item — `stationConditionView` is the pure function it
    // calls, driven directly here since this file cannot render `FloorGrid`)
    // reads "as new" and rounds its own cost to 0 even though the review
    // above quotes a real, positive price for the SAME item.
    const itemConditionAtReview = itemCondition(reviewed.managed, item);
    const stationAtReview = stationConditionView(reviewed.managed, item);
    expect(stationAtReview.condition).toBe(itemConditionAtReview);
    if (isSoundCondition(itemConditionAtReview)) {
      expect(stationAtReview.isSound).toBe(true);
      expect(stationAtReview.displayRepairCostGymBucks).toBe(0);
    } else {
      expect(stationAtReview.isSound).toBe(false);
      expect(stationAtReview.displayRepairCostGymBucks).toBe(quoted);
    }
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
      'Already in good shape',
    );
  });

  it('answering a review on a check-in with none open is refused, not silent', () => {
    const quiet = advanceTimes(createGymViewState(), 1);
    expect(maintenancePrompt(quiet.managed).kind).toBe('quiet');
    const answered = dispatchThrough(quiet, { kind: 'answer-prompt', response: 'dismiss' });
    expect(answered.lastRefusal).toBe('no-prompt');
    expect(answered.managed).toEqual(quiet.managed);
    expect(textOf(findByTestId(render(answered, []), 'gymscreen-refusal'))).toBe(
      'No review is open',
    );
  });
});

describe('stage 4: staffing, on the screen', () => {
  it('hires, shows the wage and the auto-repair threshold, and lets them go', () => {
    const funded = advanceTimes(createGymViewState(), 3);
    const opening = render(funded, []);
    expect(textOf(findByTestId(opening, 'gymscreen-manager-state'))).toContain('No manager hired');
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
      playerFacingManagerCapability('steady'),
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
// THE GYM'S REAL-TIME LOOP — no control on this screen advances the clock.
//
// A human played the earlier build on a real phone and said, in their own
// words, that they could not open a review; the fix at the time was a real
// "open up for the day" control. A second, later human ruling withdrew that
// control by name — it minted a flat `OFFLINE_EARNINGS_CAP_HOURS` block on
// every press regardless of real elapsed time, which is the exact mashable
// shape a human playing the shipped build called out as the bug. Gym Empire
// mimics an idle game now: `AppShell.tsx`'s `GymHost` drives `advance-clock`
// itself, from genuine elapsed real time, outside every control this screen
// draws. These tests drive the loop the way `GymHost` actually does — by
// dispatching `advance-clock` directly — and assert no testID on this screen
// can reach it by a press.
// ---------------------------------------------------------------------------

describe('the gym real-time loop reaches the stage-4 machinery, and nothing on this screen can cause it', () => {
  it('no testID anywhere on this screen names a mint or a check-in tap', () => {
    const root = render(createGymViewState(), []);
    const allIds = testIdsUnder(root);
    for (const id of allIds) {
      expect(id).not.toMatch(/open-up/);
    }
  });

  it('advancing the clock by a whole offline window reaches a maintenance review, with no press involved', () => {
    let played = createGymViewState();
    expect(maintenancePrompt(played.managed).kind).toBe('quiet');
    expect(played.managed.checkInsTaken).toBe(0);
    const oneWindowSeconds = T.OFFLINE_EARNINGS_CAP_HOURS * T.SECONDS_PER_HOUR;
    for (let shift = 0; shift < T.MAINTENANCE_ORDER_FIRST_CHECK_IN; shift += 1) {
      played = dispatchThrough(played, { kind: 'advance-clock', gapSeconds: oneWindowSeconds });
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
  });

  it('the clock moves condition and money and never the failure ledger', () => {
    // The §5.7 claim, on the real-time arm. It holds for the same reason it
    // holds for the dev arm — both end in the same `managedCheckIn` — and is
    // asserted here because this is the arm a real device actually drives.
    let played = createGymViewState();
    const before = meanCondition(played.managed);
    const oneWindowSeconds = T.OFFLINE_EARNINGS_CAP_HOURS * T.SECONDS_PER_HOUR;
    for (let shift = 0; shift < T.MAINTENANCE_ORDER_FIRST_CHECK_IN * 3; shift += 1) {
      played = dispatchThrough(played, { kind: 'advance-clock', gapSeconds: oneWindowSeconds });
      expect(played.lastRefusal).toBeNull();
      expect(played.managed.strikes).toEqual([]);
      expect(failurePhase(played.managed)).toBe('sound');
    }
    expect(meanCondition(played.managed)).toBeLessThan(before);
    expect(played.managed.gym.ladder.gymBucks).toBeGreaterThan(0);
    expect(played.managed.checkInsTaken).toBe(T.MAINTENANCE_ORDER_FIRST_CHECK_IN * 3);
  });

  it('the no-open-review note reports banked time and the real next review, off the clock alone', () => {
    let played = createGymViewState();
    const oneWindowSeconds = T.OFFLINE_EARNINGS_CAP_HOURS * T.SECONDS_PER_HOUR;
    for (let shift = 0; shift <= T.MAINTENANCE_ORDER_FIRST_CHECK_IN; shift += 1) {
      const note = textOf(findByTestId(render(played, []), 'gymscreen-prompt'));
      if (maintenancePrompt(played.managed).kind === 'quiet') {
        const bankedTime = reviewBankedTime(played.managed);
        expect(bankedTime.bankedHours).toBeGreaterThanOrEqual(0);
        expect(bankedTime.hoursUntilNextReview).toBeGreaterThanOrEqual(0);
        expect(note).toBe('no maintenance review open');
      }
      played = dispatchThrough(played, { kind: 'advance-clock', gapSeconds: oneWindowSeconds });
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

// ---------------------------------------------------------------------------
// S4g — a cold garage can afford mats on a short live watch, and place it.
//
// The gap three phone dumps named: `SESSION_EQUIPMENT_COST_GYM_BUCKS.mats`'s
// own doc comment (`empireTuning.ts`) has the derivation and the reachability
// numbers this battery drives rather than asserts in prose. Every step below
// runs the real shipped mechanism — never a hand-set balance, never the dev
// skip-row (`gymscreen-advance-<step>`, labelled "not part of the game" in
// this file's own header) — and reads the real outcome.
// ---------------------------------------------------------------------------

describe('S4g: a cold garage can afford mats on a short live watch, and place it', () => {
  /**
   * Ten minutes is the length `SESSION_EQUIPMENT_COST_GYM_BUCKS.mats`'s own
   * doc comment derives the retuned price from. Driving exactly 600 seconds
   * through the real mechanism lands the purse at 9.99917, a hair under the
   * 10-Gym-Buck price — condition wear during the watch shaves a fraction of
   * a Gym Buck off the raw accrual before `management.ts`'s `managedCheckIn`
   * settles the check-in, an effect the tuning comment's first-order
   * derivation does not model. So this searches forward one real second at a
   * time from 600, through the SAME `advance-clock`/`'online'` dispatch a
   * live watch drives, rather than asserting the round number — "the exact
   * equivalent the shipped accrual model uses", not a guess.
   */
  const SHORT_LIVE_WATCH_TARGET_SECONDS = 600;
  /** Eleven minutes — a generous ceiling on "short", not a tuned value: if the real mechanism needs longer than this to afford a 10-Gym-Buck item at a 60-Gym-Buck-per-hour rate, that is itself a finding worth surfacing as a failure rather than silently searching further. */
  const SHORT_LIVE_WATCH_SEARCH_LIMIT_SECONDS = 660;

  it('affords, buys and places mats without ever touching the dev skip-row', () => {
    const cold = createGymViewState();
    expect(cold.managed.gym.sessionEquipment).toEqual([]);
    expect(cold.managed.gym.ladder.gymBucks).toBe(0);
    expect(cold.floor.placements).toEqual({});

    // Drive the SAME dispatch a real watched tick sends — `advance-clock`,
    // `mode: 'online'` (`ladderView.tsx`'s own header: "`AppShell.tsx`'s
    // `GymHost` is the only caller that ever sets this to `'online'`") —
    // never `gymscreen-advance-<step>`, the dev skip-row.
    let watched: GymViewState | null = null;
    let watchedSeconds = SHORT_LIVE_WATCH_TARGET_SECONDS;
    for (; watchedSeconds <= SHORT_LIVE_WATCH_SEARCH_LIMIT_SECONDS; watchedSeconds += 1) {
      const candidate = dispatchThrough(cold, {
        kind: 'advance-clock',
        gapSeconds: watchedSeconds,
        mode: 'online',
      });
      if (candidate.managed.gym.ladder.gymBucks >= sessionEquipmentCost('mats')) {
        watched = candidate;
        break;
      }
    }
    expect(watched, 'a live watch of eleven minutes or less must afford mats').not.toBeNull();
    const funded = watched as GymViewState;
    // Comfortably inside "a short live watch" — nowhere near the 3.33-hour
    // watch the pre-S4g price (200) needed (see `empireTuning.ts`'s own
    // comment for that derivation), and reached with exactly one
    // `advance-clock` dispatch, no skip-row press anywhere in this test.
    expect(watchedSeconds).toBeLessThanOrEqual(SHORT_LIVE_WATCH_SEARCH_LIMIT_SECONDS);

    // (1) The gym can now afford mats.
    expect(funded.managed.gym.ladder.gymBucks).toBeGreaterThanOrEqual(
      EMPIRE_TUNING.SESSION_EQUIPMENT_COST_GYM_BUCKS.mats,
    );

    // (2, 3) `buySessionEquipment` succeeds, and the tray holds one unplaced
    // mats — re-derived from the pure function, this file's own discipline,
    // and then driven through the real dispatch path too, compared byte for
    // byte against the pure call.
    const bought = buySessionEquipment(funded.managed.gym, 'mats');
    expect(bought.kind).toBe('bought');
    if (bought.kind !== 'bought') throw new Error('unreachable — asserted above');
    expect(bought.state.sessionEquipment).toEqual(['mats']);
    expect(funded.floor.placements).toEqual({});

    const dispatchedBuy = dispatchThrough(funded, { kind: 'buy-session', item: 'mats' });
    expect(dispatchedBuy.lastRefusal).toBeNull();
    expect(dispatchedBuy.managed.gym).toEqual(bought.state);

    // (4) Dropping it on an empty floor cell succeeds — the real placement
    // function (`floor.ts`'s `placeFloorItem`), not a stub, driven directly
    // and then through the real `floor-place` dispatch.
    const emptyCell = { x: 5, y: 0 }; // clear of every fixed-furniture row on a garage — floor.test.ts uses the same geometry
    const placedDirect = placeFloorItem(
      dispatchedBuy.floor,
      dispatchedBuy.managed.gym.sessionEquipment,
      'mats',
      emptyCell,
    );
    expect(placedDirect.kind).toBe('placed');
    if (placedDirect.kind !== 'placed') throw new Error('unreachable — asserted above');
    expect(placedDirect.state.placements['mats']).toEqual(emptyCell);

    const placedViaDispatch = dispatchThrough(dispatchedBuy, {
      kind: 'floor-place',
      item: 'mats',
      position: emptyCell,
    });
    expect(placedViaDispatch.lastRefusal).toBeNull();
    expect(placedViaDispatch.floor).toEqual(placedDirect.state);

    // (5) A cell occupied by fixed furniture is refused — but not by
    // `placeFloorItem` itself, which `floor.ts`'s own header says never
    // learns about fixed furniture on purpose; the refusal lives one layer
    // up, at the one place a real drag can originate. `FloorGrid.tsx`'s drop
    // handler checks `overlapsFixedFurniture` BEFORE ever dispatching
    // `floor-place`, so a drop there never reaches the reducer at all — that
    // is the mechanism this drives, unchanged, rather than a claim about
    // `placeFloorItem` the code does not make.
    const fixed = fixedFloorFurniture(dispatchedBuy.managed.gym.ladder.equipment);
    const furnitureCell = { x: 0, y: 0 }; // power-bar's fixed position, garage rung
    expect(overlapsFixedFurniture(furnitureCell, sessionItemFootprint('mats'), fixed)).toBe(
      true,
    );

    // (6) A `recovery`-category flexible slot is actually available, read
    // through the real reader (`availableActivities`) rather than
    // re-derived from the tuning table by hand.
    expect(sessionEquipmentGroup('mats')).toBe('recovery');
    expect(availableActivities(dispatchedBuy.managed.gym.sessionEquipment)).toContain(
      'stretching-yoga',
    );
    // `other-recovery` additionally needs an `ADVANCED_RECOVERY_ITEMS` item
    // (sauna); mats alone does not unlock it — driving that boundary too,
    // rather than only the positive case.
    expect(availableActivities(dispatchedBuy.managed.gym.sessionEquipment)).not.toContain(
      'other-recovery',
    );
  });
});

// ---------------------------------------------------------------------------
// S4h — a real phone playtest found every Pressable on this screen untappable:
// no `style`, no `accessibilityRole`, no `cursor`. Fix 1 puts real chrome and
// `accessibilityRole="button"` on all thirteen (now fourteen — see Fix 2
// below); this battery is the non-vacuity guard `GymScreen.tsx`'s own header
// promises: every Pressable a state ACTUALLY DRAWS carries the treatment, on
// several distinct states rather than one, with the count pinned rather than
// only asserted non-zero.
// ---------------------------------------------------------------------------

describe('S4h: every rendered Pressable is visibly a control', () => {
  it('a cold garage, a heavily operated gym, a staffed gym and a dormant-then-ready gym', () => {
    const counts: Record<string, number> = {};

    const cold = createGymViewState();
    counts['cold garage'] = expectEveryPressableIsAControl(render(cold, []), 'cold garage');

    // Advancing the clock a long way affords buys/relocation and wears
    // equipment past the review line, so this state is the one most likely to
    // draw a live shop, repair and prompt control all at once — including the
    // S4h Fix 2 disabled-but-visible session-shop control, if any session item
    // is reachable but still short of its price at this point.
    const worked = advanceTimes(cold, 30);
    counts['heavily operated gym'] = expectEveryPressableIsAControl(
      render(worked, []),
      'heavily operated gym',
    );

    // A manager on staff draws the dismiss-manager control, which neither
    // state above is guaranteed to reach.
    const staffAttempt = dispatchThrough(worked, { kind: 'hire-manager', tier: 'novice' });
    expect(staffAttempt.lastRefusal, 'a heavily operated gym can afford the cheapest tier').toBeNull();
    counts['staffed gym'] = expectEveryPressableIsAControl(render(staffAttempt, []), 'staffed gym');

    // Walk a fresh gym to `'failed'` the same way the dormancy test does, then
    // repair it back to `'ready'` — the only state that draws
    // `gymscreen-recover`.
    let played = createGymViewState();
    let guard = 0;
    while (failurePhase(played.managed) !== 'failed' && guard < 60) {
      played = advanceTimes(played, 1);
      guard += 1;
      const prompt = maintenancePrompt(played.managed);
      if (prompt.kind !== 'offered' || prompt.alreadyRefused) continue;
      played = dispatchThrough(played, { kind: 'decline-repair', item: prompt.item });
    }
    expect(failurePhase(played.managed), 'a fresh gym can be walked to failed').toBe('failed');
    counts['dormant gym'] = expectEveryPressableIsAControl(render(played, []), 'dormant gym');
    for (const item of ownedItemsOf(played.managed.gym)) {
      if (itemCondition(played.managed, item) >= EMPIRE_TUNING.RECOVERY_CONDITION_MIN) continue;
      played = dispatchThrough(played, { kind: 'repair-item', item });
      expect(played.lastRefusal).toBeNull();
    }
    expect(recoveryRequirement(played.managed).kind, 'the repairs reach ready').toBe('ready');
    counts['ready-to-reopen gym'] = expectEveryPressableIsAControl(
      render(played, []),
      'ready-to-reopen gym',
    );

    // Non-vacuity, per state and in total: an empty or truncated domain would
    // make every assertion above pass by having nothing to check.
    for (const [label, count] of Object.entries(counts)) {
      expect(count, `${label} drew at least one Pressable`).toBeGreaterThan(0);
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    // Stage C.1b dock (play/shop/staff/more) plus Build FAB. A6-4 removed the
    // Developer More control; HUD review chip still on gyms with a standing
    // maintenance review (dormant and ready-to-reopen in this fixture).
    expect(counts).toEqual({
      'cold garage': 29,
      'heavily operated gym': 33,
      'staffed gym': 31,
      'dormant gym': 37,
      'ready-to-reopen gym': 37,
    });
    expect(total).toBe(167);
  });
});

function floorGridFrom(root: Rendered): Rendered {
  function walk(node: unknown): Rendered | null {
    if (!isRendered(node)) return null;
    if (node.type === FloorGrid) return node;
    for (const child of childrenOf(node)) {
      const found = walk(child);
      if (found !== null) return found;
    }
    return null;
  }
  const found = walk(root);
  expect(found, 'GymScreen embeds FloorGrid').not.toBeNull();
  return found as Rendered;
}

function livingRosterOf(root: Rendered): LivingMemberRoster {
  const livingMembers = floorGridFrom(root).props['livingMembers'];
  expect(livingMembers, 'FloorGrid receives livingMembers').toBeTruthy();
  return livingMembers as LivingMemberRoster;
}

function adverseVisit(member: LivingGymMember, tick: number): FloorSimServiceObservation {
  return Object.freeze({
    memberId: member.id,
    memberIndex: 0,
    memberType: member.type,
    stationKind: 'training' as const,
    stationKey: 'training:competition-bench-bay',
    queueWaitTicks: 200,
    trainingExperience: T.STATION_STOCK_TRAINING_EXPERIENCE,
    outcome: 'interrupted' as const,
    observedAtTick: tick,
  });
}

function departMember(state: GymViewState, memberId: LivingGymMember['id']): GymViewState {
  let next = state;
  for (let tick = 1; tick <= 10; tick += 1) {
    const current = livingMemberById(next.livingMembers, memberId);
    expect(current, `member ${memberId} still living at tick ${tick}`).not.toBeNull();
    next = gymViewReduce(next, {
      kind: 'apply-living-member-observations',
      observations: [adverseVisit(current as LivingGymMember, tick)],
    });
  }
  return next;
}

describe('Stage G.2C2 — FloorGrid receives compacted living identity after departure', () => {
  it('keeps C on FloorGrid props when B leaves A/B/C → A/C', () => {
    const openingState = createGymViewState();
    const roster = openingState.livingMembers;
    expect(roster.members.length).toBeGreaterThanOrEqual(3);
    const memberA = roster.members[0] as LivingGymMember;
    const memberB = roster.members[1] as LivingGymMember;
    const memberC = roster.members[2] as LivingGymMember;
    const before = livingRosterOf(render(openingState, []));
    expect(before.members.map((member) => member.id)).toEqual([memberA.id, memberB.id, memberC.id]);

    const after = departMember(openingState, memberB.id);
    expect(livingMemberById(after.livingMembers, memberB.id)).toBeNull();
    const gridRoster = livingRosterOf(render(after, []));
    expect(gridRoster).toBe(after.livingMembers);
    expect(gridRoster.members.map((member) => member.id)).toEqual([memberA.id, memberC.id]);
    expect(gridRoster.members[1]?.id).toBe(memberC.id);
    expect(gridRoster.members[1]?.id).not.toBe(memberB.id);
    expect(livingMemberById(gridRoster, memberC.id)?.displayName).toBe(memberC.displayName);
    expect(gridRoster.departures[0]?.member.id).toBe(memberB.id);
  });

  it('does not hand FloorGrid a replacement occupant for a departed selected member', () => {
    const openingState = createGymViewState();
    const memberB = openingState.livingMembers.members[1] as LivingGymMember;
    const memberC = openingState.livingMembers.members[2] as LivingGymMember;
    const after = departMember(openingState, memberB.id);
    const gridRoster = livingRosterOf(render(after, []));
    expect(livingMemberById(gridRoster, memberB.id)).toBeNull();
    expect(gridRoster.members.some((member) => member.id === memberB.id)).toBe(false);
    expect(gridRoster.members[1]?.id).toBe(memberC.id);
    expect(gridRoster.departures.some((record) => record.member.id === memberB.id)).toBe(true);
  });
});

describe('G2-ATHLETE-SEASON-01 — FloorGrid season notice', () => {
  const weekSeconds = T.DAYS_PER_TRAINING_WEEK * T.SECONDS_PER_DAY;
  const leaveAt = weekSeconds * T.ATHLETE_SEASON.firstInSeasonWeek;
  const returnAt = leaveAt + weekSeconds * T.ATHLETE_SEASON.inSeasonWeeks;

  function withAthlete(state: GymViewState): GymViewState {
    const member = state.livingMembers.members[0] as LivingGymMember;
    return Object.freeze({
      ...state,
      livingMembers: Object.freeze({
        ...state.livingMembers,
        members: Object.freeze(
          state.livingMembers.members.map((row, index) =>
            index === 0 ? Object.freeze({ ...row, type: 'athlete' as const }) : row,
          ),
        ),
      }),
    });
  }

  it('hands FloorGrid a leave event whose copy is the away line', () => {
    const opened = withAthlete(createGymViewState());
    const athlete = opened.livingMembers.members[0] as LivingGymMember;
    const left = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: leaveAt });
    const roster = livingRosterOf(render(left, []));
    expect(roster).toBe(left.livingMembers);
    const event = lastLivingMemberSeasonEvent(roster.season);
    expect(event?.kind).toBe('leave');
    const copy = playerFacingSeasonLine(event!);
    expect(copy).toBe(`${athlete.displayName} is away for the season.`);
    expect(copy).not.toMatch(/%/);
    expect(copy).not.toMatch(/\d+\s*week/);
    expect(copy).not.toMatch(/days/i);
  });

  it('hands FloorGrid a return event whose copy is the back line', () => {
    const opened = withAthlete(createGymViewState());
    const athlete = opened.livingMembers.members[0] as LivingGymMember;
    const back = gymViewReduce(opened, { kind: 'advance-clock', gapSeconds: returnAt });
    const event = lastLivingMemberSeasonEvent(livingRosterOf(render(back, [])).season);
    expect(event?.kind).toBe('return');
    const copy = playerFacingSeasonLine(event!);
    expect(copy).toBe(`${athlete.displayName} is back from the season.`);
    expect(copy).not.toMatch(/%/);
    expect(copy).not.toMatch(/days/i);
  });
});

describe('REP-EVIDENCE-01 — gymscreen-reputation on the HUD', () => {
  it('opens with both halves at zero and no reason rows on the play HUD', () => {
    const state = createGymViewState();
    expect(state.surface).toBe('play');
    const root = render(state, []);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).toBe(
      playerFacingReputationHud(0, 0),
    );
    expect(findAllByTestId(root, 'gymscreen-reputation-reason-0').length).toBe(0);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).not.toMatch(/\+REP/);
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).toContain('gymscreen-reputation');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).toContain('gymscreen-lights');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-action-card'))).toContain('gymscreen-now');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-action-card'))).toContain('gymscreen-next');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).not.toContain('gymscreen-now');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).not.toContain('gymscreen-rate');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).toContain('gymscreen-rate');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
      'gymscreen-reputation',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
      'gymscreen-diagnostics',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-developer-drawer'))).toContain(
      'gymscreen-diagnostics',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-dock'))).not.toContain(
      'gymscreen-surface-build',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-floor'))).toContain(
      'gymscreen-surface-build',
    );
    expect(findByTestId(root, 'gymscreen-surface-build').props.style).toEqual(
      expect.objectContaining({
        zIndex: EMPIRE_TUNING.FLOOR_SIM_STATION_HIGHLIGHT_Z_INDEX,
      }),
    );
    expect(findByTestId(root, 'gymscreen-action-card').props.style).toEqual(
      expect.objectContaining({
        right:
          EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS +
          EMPIRE_TUNING.GYM_SCREEN_BUTTON_MIN_HEIGHT_PIXELS +
          EMPIRE_TUNING.GYM_SCREEN_BUTTON_MIN_HEIGHT_PIXELS +
          EMPIRE_TUNING.GYM_SCREEN_BUTTON_PADDING_HORIZONTAL_PIXELS,
      }),
    );
    expect(findByTestId(root, 'gymscreen-hud').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'sienna' }),
    );
    expect(findAllByTestId(root, 'gymscreen-surface-build').length).toBe(1);
    expect(findAllByTestId(root, 'gymscreen-surface-developer').length).toBe(0);
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
      'gymscreen-surface-developer',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-dock'))).not.toContain(
      'gymscreen-surface-developer',
    );
    const developer = gymViewReduce(state, { kind: 'set-gym-surface', surface: 'developer' });
    expect(developer.surface).toBe('developer');
    expect(testIdsUnder(findByTestId(render(developer, []), 'gymscreen-developer-drawer'))).toContain(
      'gymscreen-diagnostics',
    );
    expect(textOf(findByTestId(root, 'gymscreen-gym-bucks'))).not.toMatch(/\./);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).not.toMatch(/\.\d/);
  });

  it('shows the placing reason after a first-of-16 PR credit, on More not the Play HUD', () => {
    const credited = gymViewReduce(createGymViewState(), {
      kind: 'credit-sporting-result',
      meetId: 'local-open-2026',
      facts: Object.freeze({
        totalKg: 600,
        isTotalPr: true,
        placing: Object.freeze({ place: 1, fieldSize: 16 }),
      }),
    });
    const root = render(credited, []);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).toBe(
      playerFacingReputationHud(0, 40),
    );
    expect(textOf(findByTestId(root, 'gymscreen-reputation-reason-0'))).toBe(
      T.SPORTING_REPUTATION.copy.placing
        .replace('{place}', '1')
        .replace('{field}', '16')
        .replace('{kind}', 'local'),
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).toContain(
      'gymscreen-reputation-reason-0',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).not.toContain(
      'gymscreen-reputation-reason-0',
    );
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).not.toMatch(/\+REP/);
  });

  it('shows the members half on the HUD after a played clock settle, meets still zero', () => {
    const opened = createGymViewState();
    const advanced = gymViewReduce(opened, {
      kind: 'advance-clock',
      gapSeconds: T.SECONDS_PER_DAY,
      mode: 'online',
    });
    const reading = institutionalReputation(
      advanced.livingMembers.reputation,
      advanced.sportingReputation,
    );
    expect(reading.fromMembers).toBeGreaterThan(0);
    expect(reading.fromSporting).toBe(0);
    const root = render(advanced, []);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).toBe(
      playerFacingReputationHud(reading.fromMembers, 0),
    );
    expect(findAllByTestId(root, 'gymscreen-reputation-reason-0').length).toBe(0);
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).toContain('gymscreen-reputation');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
      'gymscreen-reputation',
    );
  });

  it('shows both credited halves together on the HUD after a clock settle and a played meet', () => {
    const advanced = gymViewReduce(createGymViewState(), {
      kind: 'advance-clock',
      gapSeconds: T.SECONDS_PER_DAY,
      mode: 'online',
    });
    const credited = gymViewReduce(advanced, {
      kind: 'credit-sporting-result',
      meetId: 'local-open-2026',
      facts: Object.freeze({
        totalKg: 600,
        isTotalPr: true,
        placing: Object.freeze({ place: 1, fieldSize: 16 }),
      }),
    });
    const reading = institutionalReputation(
      credited.livingMembers.reputation,
      credited.sportingReputation,
    );
    expect(reading.fromMembers).toBeGreaterThan(0);
    expect(reading.fromSporting).toBe(40);
    const root = render(credited, []);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).toBe(
      playerFacingReputationHud(reading.fromMembers, 40),
    );
    expect(textOf(findByTestId(root, 'gymscreen-reputation-reason-0'))).toBe(
      T.SPORTING_REPUTATION.copy.placing
        .replace('{place}', '1')
        .replace('{field}', '16')
        .replace('{kind}', 'local'),
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).toContain('gymscreen-reputation');
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).toContain(
      'gymscreen-reputation-reason-0',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).not.toContain(
      'gymscreen-reputation-reason-0',
    );
  });

  it('fails closed on an unknown meet: HUD stays at zero sporting and names the stored refuse', () => {
    const opened = createGymViewState();
    const missed = gymViewReduce(opened, {
      kind: 'credit-sporting-result',
      meetId: 'not-on-the-sporting-map',
      facts: Object.freeze({
        totalKg: 600,
        isTotalPr: true,
        placing: Object.freeze({ place: 1, fieldSize: 16 }),
      }),
    });
    expect(missed.sportingReputation).toBe(opened.sportingReputation);
    expect(missed.sportingReputation.creditedReputation).toBe(0);
    expect(missed.lastSportingCredit).toEqual({
      kind: 'not-creditable',
      meetId: 'not-on-the-sporting-map',
      reason: 'unknown-meet',
    });
    const root = render(missed, []);
    expect(textOf(findByTestId(root, 'gymscreen-reputation'))).toBe(
      playerFacingReputationHud(0, 0),
    );
    expect(textOf(findByTestId(root, 'gymscreen-reputation-reason-0'))).toBe(
      T.SPORTING_REPUTATION.copy.unknownMeet,
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).toContain(
      'gymscreen-reputation-reason-0',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-hud'))).not.toContain(
      'gymscreen-reputation-reason-0',
    );
  });
});

describe('SF-TWL-GYM-EMPIRE-UX-02 — Play operating view vs Build overlay', () => {
  it('Play FloorGrid is not in build mode and More holds no diagnostics', () => {
    const root = render(createGymViewState(), []);
    expect(floorGridFrom(root).props['buildMode']).toBe(false);
    expect(floorGridFrom(root).props['developerChrome']).toBe(false);
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
      'gymscreen-diagnostics',
    );
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).not.toContain(
      'gymscreen-surface-developer',
    );
    expect(findAllByTestId(root, 'gymscreen-leave-gym').length).toBe(0);
    expect(textOf(findByTestId(root, 'gymscreen-surface-play'))).toBe(
      playerFacingSurfaceLabel('play'),
    );
  });

  it('paints A×C iron-and-amber chrome without purple admin', () => {
    const root = render(createGymViewState(), []);
    expect(findByTestId(root, 'gymscreen-hud').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'sienna' }),
    );
    expect(findByTestId(root, 'gymscreen-surface-build').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'goldenrod' }),
    );
    expect(findByTestId(root, 'gymscreen-dock').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'black' }),
    );
    expect(findByTestId(root, 'gymscreen-rung').props.style).toEqual(
      expect.objectContaining({ textTransform: 'uppercase' }),
    );
    expect(findByTestId(root, 'gymscreen-now').props.style).toEqual(
      expect.objectContaining({ textTransform: 'uppercase' }),
    );
    expect(findByTestId(root, 'gymscreen-next').props.style).not.toEqual(
      expect.objectContaining({ textTransform: 'uppercase' }),
    );
  });

  it('hides the Build FAB on Shop and Staff sheets', () => {
    const play = createGymViewState();
    const shop = gymViewReduce(play, { kind: 'set-gym-surface', surface: 'shop' });
    const shopFab = findByTestId(render(shop, []), 'gymscreen-surface-build');
    expect(shopFab.props.style).toEqual(
      expect.objectContaining({ display: 'none' }),
    );
    const staff = gymViewReduce(play, { kind: 'set-gym-surface', surface: 'staff' });
    const staffFab = findByTestId(render(staff, []), 'gymscreen-surface-build');
    expect(staffFab.props.style).toEqual(
      expect.objectContaining({ display: 'none' }),
    );
    const playFab = findByTestId(render(play, []), 'gymscreen-surface-build');
    expect(playFab.props.style).not.toEqual(
      expect.objectContaining({ display: 'none' }),
    );
  });

  it('paints Shop and Staff cards charcoal on a charcoal sheet', () => {
    const play = createGymViewState();
    const shopRoot = render(
      gymViewReduce(play, { kind: 'set-gym-surface', surface: 'shop' }),
      [],
    );
    expect(findByTestId(shopRoot, 'gymscreen-shop-card-power-bar').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'black' }),
    );
    expect(findByTestId(shopRoot, 'gymscreen-shop-drawer').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'black' }),
    );
    const staffRoot = render(
      gymViewReduce(play, { kind: 'set-gym-surface', surface: 'staff' }),
      [],
    );
    expect(findByTestId(staffRoot, 'gymscreen-staff-drawer').props.style).toEqual(
      expect.objectContaining({ backgroundColor: 'black' }),
    );
    expect(findByTestId(staffRoot, 'gymscreen-phase').props.style).toEqual(
      expect.objectContaining({ color: 'ivory' }),
    );
    expect(findByTestId(staffRoot, 'gymscreen-condition').props.style).toEqual(
      expect.objectContaining({ color: 'ivory' }),
    );
    const moreRoot = render(
      gymViewReduce(play, { kind: 'set-gym-surface', surface: 'more' }),
      [],
    );
    expect(findByTestId(moreRoot, 'gymscreen-lifts').props.style).toEqual(
      expect.objectContaining({ color: 'ivory' }),
    );
  });

  it('Build sets FloorGrid buildMode; Done returns Play with no buildMode', () => {
    const play = createGymViewState();
    const build = gymViewReduce(play, { kind: 'set-gym-surface', surface: 'build' });
    expect(floorGridFrom(render(build, [])).props['buildMode']).toBe(true);
    const back = gymViewReduce(build, { kind: 'set-gym-surface', surface: 'play' });
    expect(floorGridFrom(render(back, [])).props['buildMode']).toBe(false);
    expect(testIdsUnder(findByTestId(render(back, []), 'gymscreen-action-card'))).toContain(
      'gymscreen-now',
    );
  });

  it('leave-gym lives on More only when the shell supplies the callback', () => {
    const left: string[] = [];
    const root = render(createGymViewState(), [], () => {
      left.push('left');
    });
    expect(testIdsUnder(findByTestId(root, 'gymscreen-more-drawer'))).toContain(
      'gymscreen-leave-gym',
    );
    press(findByTestId(root, 'gymscreen-leave-gym'));
    expect(left).toEqual(['left']);
  });
});
