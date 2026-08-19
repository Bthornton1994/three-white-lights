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
