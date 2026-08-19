/**
 * ladderView.test.ts — the render test for the stage-1 view: quantities, not
 * presence.
 *
 * `LadderView` is a pure function of its props (the stateful hook lives in
 * the dev mount at the repository root), so this file invokes it directly and
 * walks the returned element tree — no renderer, no DOM, no added dependency.
 * What is asserted is the "right number about the wrong lifter" lesson turned
 * into checks: every quantity the screen displays is compared against the
 * same quantity read from `ladder.ts`'s pure functions for the same state,
 * and every control is pressed and its dispatched action compared field by
 * field. What this file cannot grade is feel — pacing is the §5.11 human
 * gate's question, and the view's own header says so.
 */

import { describe, expect, it } from 'vitest';
import {
  type LadderViewAction,
  type LadderViewState,
  LadderView,
  createLadderViewState,
  ladderViewReduce,
} from './ladderView';
import {
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
import {
  type GymViewAction,
  type GymViewState,
  GymView,
  createGymViewState,
  gymViewReduce,
} from './ladderView';
import {
  type FlexibleSlot,
  type GymState,
  type GymWeekReport,
  type SessionEquipmentItem,
  type SlotOutcome,
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
import { EMPIRE_TUNING } from './empireTuning';

const T = EMPIRE_TUNING;

// ---------------------------------------------------------------------------
// A minimal element-tree walk. React elements are plain frozen objects with
// `type` and `props`; children live at `props.children` as a value or an
// array. No renderer is involved, so what is walked is exactly what the
// component returned.
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

/** Every element under `root` (root included) carrying `data-testid` = `id`. */
function findAllByTestId(root: unknown, id: string): readonly Rendered[] {
  if (!isRendered(root)) return [];
  const own = root.props['data-testid'] === id ? [root] : [];
  return [...own, ...childrenOf(root).flatMap((child) => findAllByTestId(child, id))];
}

/** Exactly one element with the id, or the test fails naming the id. */
function findByTestId(root: unknown, id: string): Rendered {
  const found = findAllByTestId(root, id);
  expect(found.length, `expected exactly one element with data-testid ${id}`).toBe(1);
  return found[0] as Rendered;
}

/** Press the element's onClick, which the component wires to dispatch. */
function press(element: Rendered): void {
  const handler = element.props['onClick'];
  expect(typeof handler, 'the pressed element carries no onClick').toBe('function');
  (handler as () => void)();
}

function render(state: LadderViewState, dispatched: LadderViewAction[]): Rendered {
  const element: unknown = LadderView({
    state,
    dispatch: (action) => {
      dispatched.push(action);
    },
  });
  expect(isRendered(element)).toBe(true);
  return element as Rendered;
}

/** Dispatch through the reducer the dev mount uses, returning the new state. */
function dispatchThrough(state: LadderViewState, action: LadderViewAction): LadderViewState {
  return ladderViewReduce(state, action);
}

/**
 * Every displayed-quantity comparison for one state, in one place, so each
 * screen the sequence test walks is graded identically. Returns how many
 * quantities were compared, and the caller pins the total — counts, not
 * bounds.
 */
function expectScreenMatchesState(root: Rendered, ladder: LadderState): number {
  let compared = 0;
  expect(textOf(findByTestId(root, 'ladder-rung'))).toBe(ladder.rung);
  compared += 1;
  expect(textOf(findByTestId(root, 'ladder-rate'))).toBe(
    String(ladderIncomeRatePerHour(ladder.rung)),
  );
  compared += 1;
  expect(textOf(findByTestId(root, 'ladder-gym-bucks'))).toBe(String(ladder.gymBucks));
  compared += 1;
  expect(textOf(findByTestId(root, 'ladder-clock'))).toBe(describeLadderClock(ladder.collectedAt));
  compared += 1;
  expect(textOf(findByTestId(root, 'ladder-lifts'))).toBe(
    `lifts unlocked: ${unlockedLifts(ladder.equipment).join(', ')}`,
  );
  compared += 1;
  // The shop: each item's shown cost and minimum rung are the priced ones,
  // and the buy control exists exactly for the items not held.
  const shopText = textOf(findByTestId(root, 'ladder-shop'));
  for (const item of T.LADDER_EQUIPMENT_ITEMS) {
    expect(shopText).toContain(
      `${item} costs ${ladderEquipmentCost(item)} gym bucks, fits from ${ladderEquipmentMinRung(item)}`,
    );
    compared += 1;
    const buyButtons = findAllByTestId(root, `buy-${item}`);
    expect(buyButtons.length, item).toBe(ladder.equipment.includes(item) ? 0 : 1);
    compared += 1;
  }
  // The relocation line: the shown cost is the charged one, or the top rung
  // says so and offers no button.
  const destination = nextLadderRung(ladder.rung);
  const moveText = textOf(findByTestId(root, 'ladder-move'));
  if (destination === null) {
    expect(moveText).toBe('top of the ladder - the portfolio arrives with stage four');
    expect(findAllByTestId(root, 'move-up').length).toBe(0);
  } else {
    expect(moveText).toContain(
      `next: ${destination} for ${ladderMoveCost(destination)} gym bucks`,
    );
    expect(findAllByTestId(root, 'move-up').length).toBe(1);
  }
  compared += 1;
  return compared;
}

// ---------------------------------------------------------------------------

describe('the opening screen displays the pure functions’ numbers', () => {
  it('matches ladder.ts on every displayed quantity of the opening state', () => {
    const state = createLadderViewState();
    expect(state.ladder).toEqual(createLadderState());
    const root = render(state, []);
    const compared = expectScreenMatchesState(root, state.ladder);
    // 5 header quantities + 2 per shop item + 1 relocation line.
    expect(compared).toBe(5 + T.LADDER_EQUIPMENT_ITEMS.length * 2 + 1);
    expect(compared).toBe(14);
    // Nothing has happened yet, so nothing is reported as having happened.
    expect(findAllByTestId(root, 'ladder-accrual').length).toBe(0);
    expect(findAllByTestId(root, 'ladder-refusal').length).toBe(0);
    // And the dev control is present and visibly labelled as one.
    expect(textOf(findByTestId(root, 'ladder-dev-controls'))).toContain('dev control');
  });
});

describe('every control dispatches exactly the action it names', () => {
  it('drives all five controls of the opening screen and reads the actions back', () => {
    const state = createLadderViewState();
    const dispatched: LadderViewAction[] = [];
    const root = render(state, dispatched);
    // The three dev steps, in tuning order.
    for (const step of ladderDevTimeSteps()) {
      press(findByTestId(root, `advance-${step.seconds}`));
    }
    // The one item the opening kit does not hold.
    press(findByTestId(root, 'buy-squat-rack'));
    // The relocation control.
    press(findByTestId(root, 'move-up'));
    expect(dispatched).toEqual([
      ...ladderDevTimeSteps().map((step) => ({
        kind: 'advance-clock',
        gapSeconds: step.seconds,
      })),
      { kind: 'buy', item: 'squat-rack' },
      { kind: 'move-up' },
    ]);
    expect(dispatched.length).toBe(5);
  });
});

describe('the reducer is ladder.ts, arm for arm', () => {
  it('reports byte-identical outcomes to the direct calls, on all three arms', () => {
    // A state with history: advanced once, so lastAccrual is non-null and the
    // buy/move arms can be seen preserving it.
    const opened = createLadderViewState();
    const step = ladderDevTimeSteps()[0]?.seconds as number;
    const advanced = dispatchThrough(opened, { kind: 'advance-clock', gapSeconds: step });
    const direct = ladderCheckInAfter(opened.ladder, step);
    expect(advanced.ladder).toEqual(direct.state);
    expect(advanced.lastAccrual).toEqual(direct.accrual);
    expect(advanced.lastRefusal).toBeNull();

    // Buy, refused arm: the rack does not fit a garage. State untouched,
    // reason surfaced, accrual report kept.
    const refusedBuy = dispatchThrough(advanced, { kind: 'buy', item: 'squat-rack' });
    const directRefusedBuy = buyLadderEquipment(advanced.ladder, 'squat-rack');
    expect(directRefusedBuy.kind).toBe('refused');
    expect(refusedBuy.ladder).toEqual(directRefusedBuy.state);
    expect(refusedBuy.lastRefusal).toBe('rung-too-low');
    expect(refusedBuy.lastAccrual).toEqual(advanced.lastAccrual);

    // Move, refused arm: not enough money after one hour at the garage.
    const refusedMove = dispatchThrough(advanced, { kind: 'move-up' });
    const directRefusedMove = moveUpLadder(advanced.ladder);
    expect(directRefusedMove.kind).toBe('refused');
    expect(refusedMove.ladder).toEqual(directRefusedMove.state);
    expect(refusedMove.lastRefusal).toBe('not-enough-gym-bucks');

    // The granted arms, on a state rich enough to afford both: bought and
    // moved outcomes equal the direct calls, and the refusal clears.
    const rich: LadderViewState = Object.freeze({
      ladder: Object.freeze({
        ...advanced.ladder,
        gymBucks:
          T.LADDER_MOVE_COST_GYM_BUCKS['storage-unit'] +
          T.LADDER_EQUIPMENT_COST_GYM_BUCKS['squat-rack'],
      }),
      lastAccrual: advanced.lastAccrual,
      lastRefusal: 'rung-too-low',
    });
    const moved = dispatchThrough(rich, { kind: 'move-up' });
    const directMoved = moveUpLadder(rich.ladder);
    expect(directMoved.kind).toBe('moved');
    expect(moved.ladder).toEqual(directMoved.state);
    expect(moved.lastRefusal).toBeNull();
    const bought = dispatchThrough(moved, { kind: 'buy', item: 'squat-rack' });
    const directBought = buyLadderEquipment(moved.ladder, 'squat-rack');
    expect(directBought.kind).toBe('bought');
    expect(bought.ladder).toEqual(directBought.state);
    expect(bought.lastRefusal).toBeNull();
    expect(bought.lastAccrual).toEqual(advanced.lastAccrual);
  });
});

describe('a played run: press, reduce, re-render, and the numbers stay the pure ones', () => {
  it('walks garage to storage unit to the rack, screens graded at every step', () => {
    // The script a human at the dev view would actually play: advance three
    // days at a time until the first relocation is affordable, relocate, keep
    // advancing until the rack is affordable, buy it. Expected quantities are
    // maintained on a parallel pure state advanced by direct ladder.ts calls,
    // so every screen is graded against the pure functions and not against
    // the reducer being tested.
    let view = createLadderViewState();
    let pure = createLadderState();
    let screensGraded = 0;
    let quantitiesCompared = 0;
    const threeDays = ladderDevTimeSteps()[2]?.seconds as number;
    expect(threeDays).toBe(259200);

    const playAdvance = (): void => {
      const dispatched: LadderViewAction[] = [];
      const root = render(view, dispatched);
      press(findByTestId(root, `advance-${threeDays}`));
      expect(dispatched.length).toBe(1);
      view = dispatchThrough(view, dispatched[0] as LadderViewAction);
      const direct = ladderCheckInAfter(pure, threeDays);
      pure = direct.state;
      // The accrual report on the next screen is the direct call's report.
      const after = render(view, []);
      expect(textOf(findByTestId(after, 'ladder-accrual'))).toBe(
        `last advance banked ${direct.accrual.secondsBanked}s of ${direct.accrual.secondsElapsed}s, paid ${direct.accrual.gymBucks} gym bucks, cap discarded ${direct.accrual.secondsDiscarded}s`,
      );
      quantitiesCompared += expectScreenMatchesState(after, pure);
      screensGraded += 1;
    };

    // Seven three-day advances: 360 bucks per capped gap at the garage rate,
    // so the 2500 relocation is first affordable at the seventh — the pacing
    // the view exists to let a human feel, here just walked.
    const advancesToAfford = 7;
    for (let i = 0; i < advancesToAfford; i += 1) playAdvance();
    expect(pure.gymBucks).toBeGreaterThanOrEqual(T.LADDER_MOVE_COST_GYM_BUCKS['storage-unit']);

    // Relocate, through the pressed control.
    {
      const dispatched: LadderViewAction[] = [];
      const root = render(view, dispatched);
      press(findByTestId(root, 'move-up'));
      view = dispatchThrough(view, dispatched[0] as LadderViewAction);
      const direct = moveUpLadder(pure);
      expect(direct.kind).toBe('moved');
      pure = direct.state;
      const after = render(view, []);
      expect(textOf(findByTestId(after, 'ladder-rung'))).toBe('storage-unit');
      quantitiesCompared += expectScreenMatchesState(after, pure);
      screensGraded += 1;
    }

    // Two more advances at the faster rung, then buy the rack.
    playAdvance();
    playAdvance();
    expect(pure.gymBucks).toBeGreaterThanOrEqual(T.LADDER_EQUIPMENT_COST_GYM_BUCKS['squat-rack']);
    {
      const dispatched: LadderViewAction[] = [];
      const root = render(view, dispatched);
      press(findByTestId(root, 'buy-squat-rack'));
      view = dispatchThrough(view, dispatched[0] as LadderViewAction);
      const direct = buyLadderEquipment(pure, 'squat-rack');
      expect(direct.kind).toBe('bought');
      pure = direct.state;
      const after = render(view, []);
      // The capability consequence, displayed: squat arrives with the rack.
      expect(textOf(findByTestId(after, 'ladder-lifts'))).toBe(
        `lifts unlocked: ${unlockedLifts(pure.equipment).join(', ')}`,
      );
      expect(textOf(findByTestId(after, 'ladder-lifts'))).toContain('squat');
      quantitiesCompared += expectScreenMatchesState(after, pure);
      screensGraded += 1;
    }

    // Counts, not bounds: eleven graded screens, fourteen quantities each.
    expect(screensGraded).toBe(11);
    expect(quantitiesCompared).toBe(11 * 14);

    // And a refusal a player can actually hit is displayed in its own words:
    // pressing relocate fresh off the move (funds spent) is refused on money.
    const dispatched: LadderViewAction[] = [];
    const refusedView = dispatchThrough(view, { kind: 'move-up' });
    expect(refusedView.lastRefusal).toBe('not-enough-gym-bucks');
    const refusedRoot = render(refusedView, dispatched);
    expect(textOf(findByTestId(refusedRoot, 'ladder-refusal'))).toBe(
      'refused: not-enough-gym-bucks',
    );
    // The refused press changed no displayed quantity: same screen as before.
    expect(refusedView.ladder).toEqual(view.ladder);
  });
});

// ===========================================================================
// GymView — the stage-2 gate's instrument: same standard as above, extended
// to the full loop. Every displayed quantity is compared against the same
// quantity read directly from `sessions.ts`'s (and, for the stage-1 rows,
// `ladder.ts`'s) pure functions for the same state.
// ===========================================================================

function renderGym(state: GymViewState, dispatched: GymViewAction[]): Rendered {
  const element: unknown = GymView({
    state,
    dispatch: (action) => {
      dispatched.push(action);
    },
  });
  expect(isRendered(element)).toBe(true);
  return element as Rendered;
}

function dispatchGymThrough(state: GymViewState, action: GymViewAction): GymViewState {
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
function expectGymScreenMatchesState(root: Rendered, state: GymViewState): number {
  let compared = 0;
  const { gym, weekIndex, allocation, allocationSetThisWeek, weekLog } = state;
  const shape = trainingWeekShape();
  const weekText = textOf(findByTestId(root, 'gym-week'));
  expect(weekText).toContain(String(weekIndex));
  expect(weekText).toContain(`${shape.fixed} fixed + ${shape.flexible} flexible = ${shape.total}`);
  expect(weekText).toContain(allocationSetThisWeek ? 'allocated this week' : 'not yet allocated');
  compared += 3;
  expect(textOf(findByTestId(root, 'gym-rung'))).toBe(gym.ladder.rung);
  compared += 1;
  expect(textOf(findByTestId(root, 'gym-gym-bucks'))).toBe(String(gym.ladder.gymBucks));
  compared += 1;
  expect(textOf(findByTestId(root, 'gym-accelerated-bucks'))).toBe(String(gym.acceleratedGymBucks));
  compared += 1;
  // The ladder shop: cost, min rung and the buy control's presence, per item.
  const ladderShopText = textOf(findByTestId(root, 'gym-ladder-shop'));
  const ownedLadder = new Set<string>(gym.ladder.equipment);
  for (const item of T.LADDER_EQUIPMENT_ITEMS) {
    expect(ladderShopText).toContain(`${item} costs`);
    const buyButtons = findAllByTestId(root, `gym-buy-ladder-${item}`);
    expect(buyButtons.length, item).toBe(ownedLadder.has(item) ? 0 : 1);
    compared += 1;
  }
  // The stage-2 shop: cost, group, min rung and the buy control, per item.
  const sessionShopText = textOf(findByTestId(root, 'gym-session-shop'));
  const ownedSession = new Set<string>(gym.sessionEquipment);
  for (const item of T.SESSION_EQUIPMENT_ITEMS) {
    expect(sessionShopText).toContain(
      `${item} (${sessionEquipmentGroup(item)}) costs ${sessionEquipmentCost(item)} gym bucks, fits from ${sessionEquipmentMinRung(item)}`,
    );
    const buyButtons = findAllByTestId(root, `gym-buy-session-${item}`);
    expect(buyButtons.length, item).toBe(ownedSession.has(item) ? 0 : 1);
    compared += 1;
  }
  // The allocation section: each slot's chosen value, its resolved (preview)
  // outcome against the equipment held RIGHT NOW, and the option controls.
  const previewOutcomes = resolveWeek(allocation, gym.sessionEquipment);
  const previewEffects = weeklyAttributeEffects(allocation, gym.sessionEquipment);
  for (const slotIndex of [0, 1, 2] as const) {
    const slotText = textOf(findByTestId(root, `gym-slot-${slotIndex}`));
    expect(slotText).toContain(allocation[slotIndex]);
    expectOutcomeInText(slotText, previewOutcomes[slotIndex]);
    compared += 1;
    for (const option of [...T.FLEXIBLE_ACTIVITIES, 'rest']) {
      expect(findAllByTestId(root, `gym-slot-${slotIndex}-set-${option}`).length, option).toBe(1);
      compared += 1;
    }
  }
  const previewText = textOf(findByTestId(root, 'gym-week-preview'));
  expect(previewText).toContain(String(previewEffects.residualCarryMultiplier));
  expect(previewText).toContain(String(previewEffects.injuryChanceMultiplier));
  expect(previewText).toContain(String(previewEffects.techniqueQualityBonus));
  expect(previewText).toContain(String(previewEffects.ceilingGrowthPerWeek));
  compared += 4;
  const availableText = textOf(findByTestId(root, 'gym-available-now'));
  const available = availableActivities(gym.sessionEquipment);
  expect(availableText).toBe(`available now: ${available.length === 0 ? 'none' : available.join(', ')}`);
  compared += 1;
  // The week log: one entry per completed week, in order, every effect number
  // and every slot's resolved outcome (the `unequipped` arm included).
  const logEntries = findAllByTestId(root, 'gym-week-log').length === 1
    ? childrenOf(findByTestId(root, 'gym-week-log'))
    : [];
  expect(logEntries.length).toBe(weekLog.length);
  compared += 1;
  for (const week of weekLog) {
    const entryText = textOf(findByTestId(root, `gym-week-log-${week.weekIndex}`));
    for (const outcome of week.slots) expectOutcomeInText(entryText, outcome);
    expect(entryText).toContain(String(week.effects.residualCarryMultiplier));
    expect(entryText).toContain(String(week.effects.injuryChanceMultiplier));
    expect(entryText).toContain(String(week.effects.techniqueQualityBonus));
    expect(entryText).toContain(String(week.effects.ceilingGrowthPerWeek));
    compared += 1;
  }
  return compared;
}

describe('GymView: the opening screen displays sessions.ts on every displayed quantity', () => {
  it('matches sessions.ts on every displayed quantity of the opening state', () => {
    const state = createGymViewState();
    expect(state.gym).toEqual(createGymState());
    expect(state.weekIndex).toBe(0);
    expect(state.allocation).toEqual(createRestAllocation());
    expect(state.allocationSetThisWeek).toBe(false);
    expect(state.weekLog).toEqual([]);
    const root = renderGym(state, []);
    const compared = expectGymScreenMatchesState(root, state);
    expect(compared).toBeGreaterThan(0);
    expect(findAllByTestId(root, 'gym-accrual').length).toBe(0);
    expect(findAllByTestId(root, 'gym-refusal').length).toBe(0);
    expect(textOf(findByTestId(root, 'gym-dev-controls'))).toContain('dev control');
    // Every fixed dev step plus the new week-boundary jump.
    for (const step of ladderDevTimeSteps()) {
      expect(findAllByTestId(root, `gym-advance-${step.seconds}`).length).toBe(1);
    }
    expect(findAllByTestId(root, 'gym-advance-next-week').length).toBe(1);
  });
});

describe('GymView: every control dispatches exactly the action it names', () => {
  it('drives the dev steps, the week-boundary jump, a session buy and a slot edit', () => {
    const state = createGymViewState();
    const dispatched: GymViewAction[] = [];
    const root = renderGym(state, dispatched);
    for (const step of ladderDevTimeSteps()) {
      press(findByTestId(root, `gym-advance-${step.seconds}`));
    }
    press(findByTestId(root, 'gym-advance-next-week'));
    press(findByTestId(root, 'gym-buy-session-mats'));
    press(findByTestId(root, 'gym-slot-0-set-cardio'));
    expect(dispatched).toEqual([
      ...ladderDevTimeSteps().map((step) => ({ kind: 'advance-clock', gapSeconds: step.seconds })),
      { kind: 'advance-to-next-week' },
      { kind: 'buy-session', item: 'mats' },
      { kind: 'set-allocation-slot', slotIndex: 0, slot: 'cardio' },
    ]);
    expect(dispatched.length).toBe(ladderDevTimeSteps().length + 3);
  });
});

describe('GymView: the reducer is sessions.ts/ladder.ts, arm for arm', () => {
  it('every simple arm makes exactly the one call it claims', () => {
    const opened = createGymViewState();

    // buy-ladder, refused: the rack does not fit a garage.
    const refusedLadderBuy = dispatchGymThrough(opened, { kind: 'buy-ladder', item: 'squat-rack' });
    expect(refusedLadderBuy.lastRefusal).toBe('rung-too-low');
    expect(refusedLadderBuy.gym).toEqual(opened.gym);

    // buy-session, refused: mats fit a garage but nothing is affordable yet
    // is not the case (mats are cheap) — refuse on an item needing a higher
    // rung instead, so the reason lines up with what a fresh garage can hit.
    const refusedSessionBuy = dispatchGymThrough(opened, { kind: 'buy-session', item: 'bike' });
    const directRefusedSessionBuy = buySessionEquipment(opened.gym, 'bike');
    expect(directRefusedSessionBuy.kind).toBe('refused');
    expect(refusedSessionBuy.gym).toEqual(directRefusedSessionBuy.state);
    expect(refusedSessionBuy.lastRefusal).toBe('rung-too-low');

    // move-up, refused: no money yet.
    const refusedMove = dispatchGymThrough(opened, { kind: 'move-up' });
    expect(refusedMove.lastRefusal).toBe('not-enough-gym-bucks');
    expect(refusedMove.gym).toEqual(opened.gym);

    // set-allocation-slot: one call, one slot changed, the others untouched.
    const edited = dispatchGymThrough(opened, {
      kind: 'set-allocation-slot',
      slotIndex: 1,
      slot: 'hypertrophy',
    });
    expect(edited.allocation).toEqual(['rest', 'hypertrophy', 'rest']);
    expect(edited.allocationSetThisWeek).toBe(true);
    expect(edited.gym).toEqual(opened.gym);
    expect(edited.weekIndex).toBe(opened.weekIndex);
    expect(edited.weekLog).toEqual(opened.weekLog);

    // A rich state, granted directly (not through a dispatch) so the buy and
    // move arms below can be driven on their GRANTED (not refused) outcome.
    const rich: GymViewState = Object.freeze({
      ...opened,
      gym: Object.freeze({
        ...opened.gym,
        ladder: Object.freeze({
          ...opened.gym.ladder,
          gymBucks:
            T.LADDER_MOVE_COST_GYM_BUCKS['storage-unit'] +
            T.LADDER_EQUIPMENT_COST_GYM_BUCKS['squat-rack'] +
            T.SESSION_EQUIPMENT_COST_GYM_BUCKS['bike'],
        }),
      }),
    });

    const moved = dispatchGymThrough(rich, { kind: 'move-up' });
    const directMove = moveUpLadder(rich.gym.ladder);
    expect(directMove.kind).toBe('moved');
    expect(moved.gym).toEqual(withLadder(rich.gym, directMove.state));
    expect(moved.lastRefusal).toBeNull();

    const bought = dispatchGymThrough(moved, { kind: 'buy-session', item: 'bike' });
    const directBought = buySessionEquipment(moved.gym, 'bike');
    expect(directBought.kind).toBe('bought');
    expect(bought.gym).toEqual(directBought.state);
    expect(bought.lastRefusal).toBeNull();

    const rackBought = dispatchGymThrough(bought, { kind: 'buy-ladder', item: 'squat-rack' });
    expect(rackBought.gym.ladder.equipment).toContain('squat-rack');
    expect(rackBought.lastRefusal).toBeNull();
  });

  it('advance-clock reports the direct gymCheckInAfter accrual, with no week crossed', () => {
    const opened = createGymViewState();
    const gap = ladderDevTimeSteps()[0]?.seconds as number;
    const advanced = dispatchGymThrough(opened, { kind: 'advance-clock', gapSeconds: gap });
    const direct = gymCheckInAfter(opened.gym, gap);
    expect(advanced.gym).toEqual(direct.state);
    expect(advanced.lastAccrual).toEqual(direct.accrual);
    expect(advanced.weekIndex).toBe(0);
    expect(advanced.weekLog).toEqual([]);
    expect(advanced.allocationSetThisWeek).toBe(false);
  });
});

describe('GymView: advance-to-next-week always lands on the boundary sessions.ts computes', () => {
  it('feeds gymCheckInAfter exactly secondsUntilNextWeekBoundary', () => {
    const opened = createGymViewState();
    const gap = secondsUntilNextWeekBoundary(opened.gym.ladder.collectedAt);
    const jumped = dispatchGymThrough(opened, { kind: 'advance-to-next-week' });
    const direct = gymCheckInAfter(opened.gym, gap);
    expect(jumped.gym).toEqual(direct.state);
    expect(jumped.gym.ladder.collectedAt).toBe(T.DAYS_PER_TRAINING_WEEK * T.SECONDS_PER_DAY);
    expect(jumped.weekIndex).toBe(1);
    // Exactly one week completed, all-rest, and reported against the equipment
    // held before the jump (none) — compared to the direct calls, not restated.
    expect(jumped.weekLog).toEqual([
      Object.freeze({
        weekIndex: 0,
        allocation: createRestAllocation(),
        slots: resolveWeek(createRestAllocation(), opened.gym.sessionEquipment),
        effects: weeklyAttributeEffects(createRestAllocation(), opened.gym.sessionEquipment),
      }),
    ]);
  });
});

describe('GymView: a single advance can complete more than one training week', () => {
  it('resolves every week the gap crosses, each against the SAME pre-advance equipment', () => {
    const opened = createGymViewState();
    const weekSeconds = T.DAYS_PER_TRAINING_WEEK * T.SECONDS_PER_DAY;
    const edited = dispatchGymThrough(opened, {
      kind: 'set-allocation-slot',
      slotIndex: 0,
      slot: 'cardio',
    });
    const threeWeeks = dispatchGymThrough(edited, {
      kind: 'advance-clock',
      gapSeconds: weekSeconds * 3,
    });
    expect(threeWeeks.weekIndex).toBe(3);
    expect(threeWeeks.weekLog.length).toBe(3);
    expect(threeWeeks.allocationSetThisWeek).toBe(false);
    const expectedOutcomes = resolveWeek(edited.allocation, edited.gym.sessionEquipment);
    const expectedEffects = weeklyAttributeEffects(edited.allocation, edited.gym.sessionEquipment);
    for (const [index, week] of threeWeeks.weekLog.entries()) {
      expect(week.weekIndex).toBe(index);
      expect(week.allocation).toEqual(edited.allocation);
      expect(week.slots).toEqual(expectedOutcomes);
      expect(week.effects).toEqual(expectedEffects);
      // Slot 0 is unequipped cardio on every one of the three — no equipment
      // changed mid-gap, so all three weeks agree with each other too.
      expect(week.slots[0]).toEqual({ kind: 'unequipped', activity: 'cardio', requires: 'conditioning' });
    }
  });
});

describe('GymView: a played run — Barbell and stage-2 equipment, relocation, and a resolved week', () => {
  it('walks the storage-unit move, a bike purchase, and a week that trains cardio', () => {
    // Pure model, advanced ONLY through direct sessions.ts / ladder.ts calls —
    // never through gymViewReduce — so every screen below is graded against
    // the pure functions and not against the reducer under test.
    let view = createGymViewState();
    let pureGym: GymState = createGymState();
    let pureWeekIndex = 0;
    let pureAllocation: WeekAllocation = createRestAllocation();
    let pureAllocationSetThisWeek = false;
    let pureWeekLog: GymWeekReport[] = [];
    let screensGraded = 0;
    let quantitiesCompared = 0;
    const threeDays = ladderDevTimeSteps()[2]?.seconds as number;
    expect(threeDays).toBe(259200);

    const pureAdvance = (gapSeconds: number): void => {
      const before = pureGym;
      const direct = gymCheckInAfter(before, gapSeconds);
      const previousWeek = trainingWeekIndexAt(before.ladder.collectedAt);
      const newWeek = trainingWeekIndexAt(direct.state.ladder.collectedAt);
      if (newWeek > previousWeek) {
        for (let weekIndex = previousWeek; weekIndex < newWeek; weekIndex += 1) {
          pureWeekLog = [
            ...pureWeekLog,
            {
              weekIndex,
              allocation: pureAllocation,
              slots: resolveWeek(pureAllocation, before.sessionEquipment),
              effects: weeklyAttributeEffects(pureAllocation, before.sessionEquipment),
            },
          ];
        }
        pureAllocationSetThisWeek = false;
      }
      pureGym = direct.state;
      pureWeekIndex = newWeek;
    };

    const playAdvance = (): void => {
      const dispatched: GymViewAction[] = [];
      const root = renderGym(view, dispatched);
      press(findByTestId(root, `gym-advance-${threeDays}`));
      expect(dispatched.length).toBe(1);
      view = dispatchGymThrough(view, dispatched[0] as GymViewAction);
      pureAdvance(threeDays);
      const after = renderGym(view, []);
      expect(view.gym).toEqual(pureGym);
      expect(view.weekIndex).toBe(pureWeekIndex);
      expect(view.weekLog).toEqual(pureWeekLog);
      expect(view.allocationSetThisWeek).toBe(pureAllocationSetThisWeek);
      quantitiesCompared += expectGymScreenMatchesState(after, view);
      screensGraded += 1;
    };

    // Seven +3d advances: proven S1 cadence, 360 gym bucks per capped gap at
    // the garage rate, so the 2500 relocation is first affordable at the
    // seventh. (Three training weeks complete along the way, opportunistically,
    // all-rest — graded exactly like any other screen, above.)
    for (let i = 0; i < 7; i += 1) playAdvance();
    expect(pureGym.ladder.gymBucks).toBeGreaterThanOrEqual(T.LADDER_MOVE_COST_GYM_BUCKS['storage-unit']);

    // Relocate.
    {
      const dispatched: GymViewAction[] = [];
      const root = renderGym(view, dispatched);
      press(findByTestId(root, 'gym-move-up'));
      view = dispatchGymThrough(view, dispatched[0] as GymViewAction);
      const direct = moveUpLadder(pureGym.ladder);
      expect(direct.kind).toBe('moved');
      pureGym = withLadder(pureGym, direct.state);
      const after = renderGym(view, []);
      expect(textOf(findByTestId(after, 'gym-rung'))).toBe('storage-unit');
      quantitiesCompared += expectGymScreenMatchesState(after, view);
      screensGraded += 1;
    }

    // Set slot 0 to cardio — unequipped for now, no conditioning item owned.
    {
      const dispatched: GymViewAction[] = [];
      const root = renderGym(view, dispatched);
      press(findByTestId(root, 'gym-slot-0-set-cardio'));
      view = dispatchGymThrough(view, dispatched[0] as GymViewAction);
      pureAllocation = ['cardio', 'rest', 'rest'];
      pureAllocationSetThisWeek = true;
      expect(view.allocation).toEqual(pureAllocation);
      const after = renderGym(view, []);
      expect(textOf(findByTestId(after, `gym-slot-0`))).toContain('unequipped');
      expect(textOf(findByTestId(after, `gym-slot-0`))).toContain('conditioning');
      quantitiesCompared += expectGymScreenMatchesState(after, view);
      screensGraded += 1;
    }

    // Two more advances to afford the bike (1440/gap at storage-unit rate).
    playAdvance();
    playAdvance();
    expect(pureGym.ladder.gymBucks).toBeGreaterThanOrEqual(T.SESSION_EQUIPMENT_COST_GYM_BUCKS['bike']);

    // Buy the bike: cardio is now equipped.
    {
      const dispatched: GymViewAction[] = [];
      const root = renderGym(view, dispatched);
      press(findByTestId(root, 'gym-buy-session-bike'));
      view = dispatchGymThrough(view, dispatched[0] as GymViewAction);
      const direct = buySessionEquipment(pureGym, 'bike');
      expect(direct.kind).toBe('bought');
      pureGym = direct.state;
      const after = renderGym(view, []);
      expect(textOf(findByTestId(after, `gym-slot-0`))).toContain('trained: cardio');
      quantitiesCompared += expectGymScreenMatchesState(after, view);
      screensGraded += 1;
    }

    // Advance to the next week boundary: the week now resolves cardio as
    // TRAINED (equipment was in place before this advance), against the
    // pure functions directly — the unequipped arm from two weeks back
    // stays in the log unchanged.
    const weekBeforeJump = view.weekIndex;
    const equipmentAtThisWeekStart = view.gym.sessionEquipment;
    const allocationThisWeek = view.allocation;
    {
      const dispatched: GymViewAction[] = [];
      const root = renderGym(view, dispatched);
      press(findByTestId(root, 'gym-advance-next-week'));
      view = dispatchGymThrough(view, dispatched[0] as GymViewAction);
      const gap = secondsUntilNextWeekBoundary(pureGym.ladder.collectedAt);
      pureAdvance(gap);
      const after = renderGym(view, []);
      const resolved = view.weekLog.find((week) => week.weekIndex === weekBeforeJump) as GymWeekReport;
      expect(resolved).toBeDefined();
      expect(resolved.slots).toEqual(resolveWeek(allocationThisWeek, equipmentAtThisWeekStart));
      expect(resolved.slots[0]).toEqual({ kind: 'trained', activity: 'cardio' });
      expect(resolved.effects).toEqual(
        weeklyAttributeEffects(allocationThisWeek, equipmentAtThisWeekStart),
      );
      expect(resolved.effects.residualCarryMultiplier).toBeLessThan(1);
      quantitiesCompared += expectGymScreenMatchesState(after, view);
      screensGraded += 1;
    }

    expect(screensGraded).toBeGreaterThan(0);
    expect(quantitiesCompared).toBeGreaterThan(0);

    // A refusal a player can actually hit: buying the already-owned bike.
    const dispatched: GymViewAction[] = [];
    const refusedView = dispatchGymThrough(view, { kind: 'buy-session', item: 'bike' });
    expect(refusedView.lastRefusal).toBe('already-owned');
    const refusedRoot = renderGym(refusedView, dispatched);
    expect(textOf(findByTestId(refusedRoot, 'gym-refusal'))).toBe('refused: already-owned');
    expect(refusedView.gym).toEqual(view.gym);
  });
});
