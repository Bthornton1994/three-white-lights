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
