/**
 * ladder.ts — GDD §5 (v2) stage 1: the ladder, minimal.
 *
 * §5.11's first stage, pure logic only: four rungs (Garage -> Storage Unit ->
 * Strip-Mall Unit -> Warehouse), one-way relocation, money accruing under the
 * aggregate offline cap, and one equipment group — §5.4's Barbell row, the
 * competition-lift group. No members (stage 3), no portfolio (stage 4), no
 * sponsors (stage 5), nothing social (§5.9). The sessions model is stage 2's
 * `sessions.ts`, which composes this module whole — the rung, the settled
 * purse and the Barbell group stay here and are not re-implemented there.
 *
 * Pure module (CLAUDE.md, "Pure logic is separate from UI"): zero React, zero
 * side effects, zero I/O, no clock reading, no randomness. Its three imports
 * are `./empireTuning`, `./production` and `./empireCore` (for `refuseWith`,
 * the directory's one throw gate), so every magnitude is named in one place
 * and the offline cap is the v1 mechanism rather than a rewrite.
 *
 * ===========================================================================
 * 1. One rung, not a list — why two phase-1 locations cannot be written
 * ===========================================================================
 *
 * §5.1: "The ladder is linear and one-way. You do not run a garage and a
 * warehouse simultaneously in phase 1 — you move, and the old space is gone."
 *
 * `LadderState.rung` is a single scalar of a four-member literal union. There
 * is no location list, no second-location field and no optional annex, so a
 * state holding two phase-1 locations is not a refused value — it has no
 * spelling in the type at all. The portfolio (stage 4) will grow a DIFFERENT
 * shape beside this one rather than widening this field, per §5.10's note
 * that `EmpireState`'s v1 shape does not survive either.
 *
 * Bounded claim, limit, catcher: the type closes the honest route; a caller
 * can still cast a fifth rung string in, which is why every transition runs
 * `requireLadderState` and refuses a rung off the ladder at runtime, and
 * `ladder.test.ts` drives that refusal rather than trusting this sentence.
 *
 * ===========================================================================
 * 2. Relocation: one-way, decided, costed — and the equipment reading
 * ===========================================================================
 *
 * `moveUpLadder` is the one writer of `rung`, it only moves one rung up, and
 * it charges `LADDER_MOVE_COST_GYM_BUCKS` — a cost the caller can quote first
 * via `ladderMoveCost`, because §5.7's rule (active decisions with shown
 * costs, nothing forced by elapsed time) applies to relocation too. Nothing
 * in this module moves a rung on a clock.
 *
 * THE §5.1 EQUIPMENT DISPOSITION, decided here and pinned by test: the spec
 * says the old SPACE is gone; it does not say the gear is. Barbell equipment
 * is movable chattel — a bar, plates and a bench go in a truck — so this
 * module takes the reading that loses less: relocation leaves `equipment`
 * untouched (the same frozen array, byte-identical), and what is lost is the
 * old rung's income context. `ladder.test.ts` pins the array through a move.
 * RULED AT THE STAGE GATE, confirmed as correct rather than accepted as a
 * reasonable reading: equipment travels; the space is what is abandoned.
 * The human's reasoning, recorded because it is the design argument and not
 * merely a preference: shedding gear would make every relocation a partial
 * reset — re-buying a bar and plates at each rung punishes the exact move
 * that is supposed to feel like pure progress — and it breaks the intuition
 * a lifter brings, since nobody sells their barbell when they move to a
 * bigger space. The byte-identity pin in `ladder.test.ts` stays as-is, and
 * the buy-back-pricing question is moot: no mechanic is to be designed for
 * the branch not taken.
 *
 * ===========================================================================
 * 3. The offline cap is reused, not rebuilt
 * ===========================================================================
 *
 * §5.10: the cap and fraction apply once, across everything owned, fed by a
 * SUMMED production rate. `accrueLadderGymBucks` therefore takes the rate SUM
 * as its input — stage 1 sums one location, stage 4 changes the input and not
 * the mechanism — and delegates the capped-catch-up arithmetic to
 * `production.ts`'s `bankableOfflineSeconds` / `quantiseElapsedSeconds` /
 * `scrubPrecision`, at the shipped `SHIPPED_OFFLINE_BANKING_POLICY`. The v1
 * call sites of those helpers are untouched and their sweeps still grade the
 * same bytes; this module adds call sites, not variants.
 *
 * Bounded claim, limit, catcher, for the cap itself: accrual is
 * non-decreasing in the gap and flat past the horizon because
 * `bankableOfflineSeconds` is, and that helper's own sweeps in
 * `production.test.ts` plus the stage-1 sweep in `ladder.test.ts` (boundary
 * probes at the horizon, plateau derived from the tuning rather than
 * transcribed) are the checks. The limit: a gap is offline in full, exactly
 * as v1's model — a foreground tick at the undiscounted rate is a screen
 * concern no stage owns yet.
 *
 * ===========================================================================
 * 4. Check-in times are whole ticks, and that is what makes splitting exact
 * ===========================================================================
 *
 * `ladderCheckIn` refuses an `atSeconds` that is not a whole multiple of
 * `TICK_SECONDS`. With that contract, quantisation drops nothing between two
 * aligned check-ins, so banked seconds are exactly additive under splitting a
 * gap below the horizon and never lossy above it — which is the arithmetic
 * the never-punish sweep leans on. Without the contract, a sub-tick remainder
 * is dropped per gap and an extra check-in could cost up to one tick; the
 * refusal makes that a loud error instead of a quiet debit.
 *
 * ===========================================================================
 * 5. What stage 1 deliberately does not have
 * ===========================================================================
 *
 *   - No failure state, no decay, no maintenance (§5.7 is stage 4). The
 *     absence invariant is still swept from birth: more absence differs from
 *     less by capped foregone income and by nothing else.
 *   - No wallet edge. This module reaches `src/game/` in no direction; money
 *     here is a plain non-negative number local to the ladder, exactly as the
 *     v1 modules kept their math against local types.
 *   - No accelerants and no second clock. Stage 1 has no build timers, so
 *     there is nothing to skip; the single time axis is wall-clock seconds.
 *
 * ===========================================================================
 * 6. The stage gate's instrument reads this module and adds nothing to it
 * ===========================================================================
 *
 * §5.11 gates stage 1 on a human having PLAYED it. `ladderView.tsx` is that
 * gate's instrument: a render-only view whose reducer arms each make exactly
 * one call into this module, so every quantity a player sees here is computed
 * here. The view-facing helpers below (`ladderCheckInAfter`,
 * `ladderDevTimeSteps`, `describeLadderClock`) exist so the view carries no
 * arithmetic of its own — the rule that game math does not live in a `.tsx`,
 * applied at the view's birth rather than retrofitted.
 */

import { refuseWith } from './empireCore';
import {
  type OfflineBankingPolicy,
  SHIPPED_OFFLINE_BANKING_POLICY,
  bankableOfflineSeconds,
  quantiseElapsedSeconds,
  scrubPrecision,
} from './production';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// Vocabulary, derived from the tuning block rather than restated
// ---------------------------------------------------------------------------

/** A phase-1 location. One of these at a time; see §1 of the header. */
export type LadderRung = (typeof EMPIRE_TUNING.LADDER_RUNGS)[number];

/** A rung a relocation can be TO — every rung except the opening garage. */
export type LadderDestination = keyof typeof EMPIRE_TUNING.LADDER_MOVE_COST_GYM_BUCKS;

/** A competition lift, in meet order. */
export type CompetitionLift = (typeof EMPIRE_TUNING.LADDER_LIFTS)[number];

/** A Barbell-group item — stage 1's one equipment group. */
export type LadderEquipmentItem = (typeof EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS)[number];

/**
 * The decision policies `runLadder` composes with. Vocabulary, not injection:
 * a policy is a name for a deterministic rule below, so the composed loop
 * stays a pure function of its arguments and the sweep can vary the axis
 * without handing this module a callback.
 *
 * `cheapest-affordable-first` reuses the v1 spending-model token on purpose —
 * same meaning, same census row.
 */
export const LADDER_POLICIES = Object.freeze(['hoard', 'cheapest-affordable-first'] as const);

export type LadderPolicy = (typeof LADDER_POLICIES)[number];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The whole of stage 1's state.
 *
 * `rung` is scalar — see §1 of the header. `equipment` is sorted in
 * `LADDER_EQUIPMENT_ITEMS` order and duplicate-free, which
 * `requireLadderState` enforces so that two states with the same holdings are
 * byte-identical. `collectedAt` is the wall-clock elapsed second the money
 * was last brought up to date at, in whole ticks.
 */
export interface LadderState {
  readonly rung: LadderRung;
  readonly gymBucks: number;
  readonly equipment: readonly LadderEquipmentItem[];
  readonly collectedAt: number;
}

/** What one gap paid, and what the cap did to it. Reported, not silent. */
export interface LadderAccrual {
  readonly gymBucks: number;
  /** Whole ticks between the mark and the check-in. */
  readonly secondsElapsed: number;
  /** How much of that paid. */
  readonly secondsBanked: number;
  /** How much the cap discarded. Zero inside the horizon. */
  readonly secondsDiscarded: number;
}

/** A check-in: the state brought up to date, and the accrual that did it. */
export interface LadderCheckIn {
  readonly state: LadderState;
  readonly accrual: LadderAccrual;
}

/** Buying an item: it lands, or the refusal says why and the state is unchanged. */
export type LadderBuyResult =
  | {
      readonly kind: 'bought';
      readonly state: LadderState;
      readonly item: LadderEquipmentItem;
      readonly cost: number;
    }
  | {
      readonly kind: 'refused';
      readonly state: LadderState;
      readonly item: LadderEquipmentItem;
      readonly cost: number;
      readonly reason: 'already-owned' | 'rung-too-low' | 'not-enough-gym-bucks';
    };

/** Relocating one rung up: it happens, or the refusal says why. */
export type LadderMoveResult =
  | {
      readonly kind: 'moved';
      readonly state: LadderState;
      readonly from: LadderRung;
      readonly to: LadderDestination;
      readonly cost: number;
    }
  | {
      readonly kind: 'refused';
      readonly state: LadderState;
      readonly reason: 'at-the-top';
    }
  | {
      readonly kind: 'refused';
      readonly state: LadderState;
      readonly reason: 'not-enough-gym-bucks';
      readonly to: LadderDestination;
      readonly cost: number;
    };

/** One composed run: the end state and the totals the sweeps compare. */
export interface LadderRun {
  readonly state: LadderState;
  readonly checkIns: number;
  readonly accruedGymBucks: number;
  readonly secondsBanked: number;
  readonly secondsDiscarded: number;
  readonly bought: readonly LadderEquipmentItem[];
  readonly movedTo: readonly LadderDestination[];
}

// ---------------------------------------------------------------------------
// Lookups
//
// Refusals throw through `empireCore.ts`'s `refuseWith`, the directory's one
// throw gate, so the channel census stays a two-site list and every thrown
// message passes the forbidden-name containment check on the way out.
// ---------------------------------------------------------------------------

/** A rung's position on the ladder, bottom rung 0. Loud off the ladder. */
export function ladderRungIndex(rung: LadderRung): number {
  const index = EMPIRE_TUNING.LADDER_RUNGS.indexOf(rung);
  if (index < 0) refuseWith(`${String(rung)} is not a rung of the ladder`);
  return index;
}

/** The rung above `rung`, or null at the top. The only way "up" is spelled. */
export function nextLadderRung(rung: LadderRung): LadderDestination | null {
  const above = EMPIRE_TUNING.LADDER_RUNGS[ladderRungIndex(rung) + 1];
  return above === undefined ? null : (above as LadderDestination);
}

/** Gym Bucks per hour the location produces at `rung`, undiscounted. */
export function ladderIncomeRatePerHour(rung: LadderRung): number {
  const rate = EMPIRE_TUNING.LADDER_INCOME_GYM_BUCKS_PER_HOUR[rung];
  if (!Number.isFinite(rate) || rate < 0) {
    refuseWith(`${String(rung)} has no income rate on the ladder`);
  }
  return rate;
}

/** The shown cost of relocating to `to`. Quote this before charging it. */
export function ladderMoveCost(to: LadderDestination): number {
  const cost = EMPIRE_TUNING.LADDER_MOVE_COST_GYM_BUCKS[to];
  if (!Number.isFinite(cost) || cost < 0) {
    refuseWith(`${String(to)} has no relocation cost on the ladder`);
  }
  return cost;
}

/** An item's flat published price. */
export function ladderEquipmentCost(item: LadderEquipmentItem): number {
  const cost = EMPIRE_TUNING.LADDER_EQUIPMENT_COST_GYM_BUCKS[item];
  if (!Number.isFinite(cost) || cost < 0) {
    refuseWith(`${String(item)} has no price on the equipment list`);
  }
  return cost;
}

/** The lowest rung whose space fits `item`. */
export function ladderEquipmentMinRung(item: LadderEquipmentItem): LadderRung {
  // Widened before the read, because the honest key type cannot miss and the
  // route this refusal exists for is a cast-in item the table has no row for.
  const rung: LadderRung | undefined = EMPIRE_TUNING.LADDER_EQUIPMENT_MIN_RUNG[item];
  if (rung === undefined) refuseWith(`${String(item)} has no minimum rung`);
  return rung;
}

/**
 * The competition lifts `equipment` makes available, in meet order.
 *
 * A lift is available exactly when every item on its requirement list is
 * held. Stage 1's capability is this flag and nothing finer; grades arrive
 * with the sessions model (stage 2).
 */
export function unlockedLifts(
  equipment: readonly LadderEquipmentItem[],
): readonly CompetitionLift[] {
  const held = new Set<string>(equipment);
  return Object.freeze(
    EMPIRE_TUNING.LADDER_LIFTS.filter((lift) =>
      EMPIRE_TUNING.LADDER_LIFT_REQUIREMENTS[lift].every((item) => held.has(item)),
    ),
  );
}

// ---------------------------------------------------------------------------
// State construction and validation
// ---------------------------------------------------------------------------

/** Sort items into `LADDER_EQUIPMENT_ITEMS` order, so equal holdings are equal bytes. */
function canonicalEquipment(
  equipment: readonly LadderEquipmentItem[],
): readonly LadderEquipmentItem[] {
  return Object.freeze(
    [...equipment].sort(
      (left, right) =>
        EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.indexOf(left) -
        EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.indexOf(right),
    ),
  );
}

/**
 * Refuse a malformed state, and hand a well-formed one back unchanged.
 *
 * Every transition runs this on its input. The type closes the honest route
 * to a malformed state; this closes the cast route at the moment the value is
 * actually used, naming what is wrong with it.
 */
export function requireLadderState(state: LadderState): LadderState {
  ladderRungIndex(state.rung);
  if (!Number.isFinite(state.gymBucks) || state.gymBucks < 0) {
    refuseWith(`gym bucks must be finite and at or above zero, received ${state.gymBucks}`);
  }
  if (
    !Number.isFinite(state.collectedAt) ||
    state.collectedAt < 0 ||
    state.collectedAt % EMPIRE_TUNING.TICK_SECONDS !== 0
  ) {
    refuseWith(
      `the collection mark must be a whole non-negative tick, received ${state.collectedAt}`,
    );
  }
  const seen = new Set<string>();
  for (const item of state.equipment) {
    if (!EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS.includes(item)) {
      refuseWith(`${String(item)} is not a Barbell-group item`);
    }
    if (seen.has(item)) refuseWith(`${String(item)} is held twice`);
    seen.add(item);
  }
  const canonical = canonicalEquipment(state.equipment);
  for (const [at, item] of canonical.entries()) {
    if (state.equipment[at] !== item) {
      refuseWith(`equipment must be listed in the fixed item order: ${canonical.join(', ')}`);
    }
  }
  return state;
}

/** The opening state: a garage, no money, §5.1's starting kit, the clock at zero. */
export function createLadderState(): LadderState {
  return Object.freeze({
    rung: EMPIRE_TUNING.LADDER_RUNGS[0],
    gymBucks: 0,
    equipment: canonicalEquipment([...EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT]),
    collectedAt: 0,
  });
}

// ---------------------------------------------------------------------------
// Accrual — the aggregate offline cap over a summed rate (§5.10)
// ---------------------------------------------------------------------------

/**
 * What a gap pays at a summed rate, under the shipped offline model.
 *
 * The rate is a SUM input on purpose: stage 1 passes one rung's rate, stage 4
 * passes the portfolio's total, and the mechanism — quantise, bank up to the
 * horizon, discount by the offline fraction — is `production.ts`'s and is not
 * restated here.
 */
export function accrueLadderGymBucks(
  ratePerHourSum: number,
  gapSeconds: number,
  policy: OfflineBankingPolicy = SHIPPED_OFFLINE_BANKING_POLICY,
): LadderAccrual {
  if (!Number.isFinite(ratePerHourSum) || ratePerHourSum < 0) {
    refuseWith(`a summed income rate must be finite and at or above zero, received ${ratePerHourSum}`);
  }
  const secondsElapsed = quantiseElapsedSeconds(gapSeconds);
  const secondsBanked = bankableOfflineSeconds(gapSeconds, policy);
  const gymBucks = scrubPrecision(
    ratePerHourSum *
      EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
      (secondsBanked / EMPIRE_TUNING.SECONDS_PER_HOUR),
  );
  return Object.freeze({
    gymBucks,
    secondsElapsed,
    secondsBanked,
    secondsDiscarded: secondsElapsed - secondsBanked,
  });
}

/**
 * A check-in at `atSeconds`: accrue the gap since the last mark and advance
 * the mark. Refuses a mark that runs backwards and an off-tick time (§4 of
 * the header says why the tick contract is load-bearing).
 */
export function ladderCheckIn(state: LadderState, atSeconds: number): LadderCheckIn {
  requireLadderState(state);
  if (
    !Number.isFinite(atSeconds) ||
    atSeconds < 0 ||
    atSeconds % EMPIRE_TUNING.TICK_SECONDS !== 0
  ) {
    refuseWith(`a check-in time must be a whole non-negative tick, received ${atSeconds}`);
  }
  if (atSeconds < state.collectedAt) {
    refuseWith(
      `the check-in at ${atSeconds} is ${state.collectedAt - atSeconds} seconds behind the mark`,
    );
  }
  const accrual = accrueLadderGymBucks(
    ladderIncomeRatePerHour(state.rung),
    atSeconds - state.collectedAt,
  );
  return Object.freeze({
    state: Object.freeze({
      ...state,
      gymBucks: scrubPrecision(state.gymBucks + accrual.gymBucks),
      collectedAt: atSeconds,
    }),
    accrual,
  });
}

/**
 * A check-in `gapSeconds` after the last mark — the shape the stage-gate view
 * dispatches, where the player advances a dev clock by a step rather than
 * naming an absolute second. Delegates wholly to `ladderCheckIn`, so the tick
 * contract and the backwards-mark refusal are one implementation; the one
 * refusal added here is a gap that is not a finite non-negative number, named
 * in the gap's own terms before it is folded into an absolute time.
 */
export function ladderCheckInAfter(state: LadderState, gapSeconds: number): LadderCheckIn {
  requireLadderState(state);
  if (!Number.isFinite(gapSeconds) || gapSeconds < 0) {
    refuseWith(`a clock advance must be finite and at or above zero, received ${gapSeconds}`);
  }
  return ladderCheckIn(state, state.collectedAt + gapSeconds);
}

// ---------------------------------------------------------------------------
// Decisions — the two spends, each with a shown cost and loud refusals
// ---------------------------------------------------------------------------

/** Buy `item` if the space fits it and the money covers it. */
export function buyLadderEquipment(
  state: LadderState,
  item: LadderEquipmentItem,
): LadderBuyResult {
  requireLadderState(state);
  const cost = ladderEquipmentCost(item);
  if (state.equipment.includes(item)) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'already-owned' });
  }
  if (ladderRungIndex(state.rung) < ladderRungIndex(ladderEquipmentMinRung(item))) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'rung-too-low' });
  }
  if (state.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, item, cost, reason: 'not-enough-gym-bucks' });
  }
  return Object.freeze({
    kind: 'bought',
    state: Object.freeze({
      ...state,
      gymBucks: scrubPrecision(state.gymBucks - cost),
      equipment: canonicalEquipment([...state.equipment, item]),
    }),
    item,
    cost,
  });
}

/**
 * Relocate one rung up. The one writer of `rung`, and it only writes upward;
 * the old space is left behind and the equipment travels — §2 of the header
 * is the reading and the flag.
 */
export function moveUpLadder(state: LadderState): LadderMoveResult {
  requireLadderState(state);
  const to = nextLadderRung(state.rung);
  if (to === null) {
    return Object.freeze({ kind: 'refused', state, reason: 'at-the-top' });
  }
  const cost = ladderMoveCost(to);
  if (state.gymBucks < cost) {
    return Object.freeze({ kind: 'refused', state, reason: 'not-enough-gym-bucks', to, cost });
  }
  return Object.freeze({
    kind: 'moved',
    state: Object.freeze({
      ...state,
      rung: to,
      gymBucks: scrubPrecision(state.gymBucks - cost),
    }),
    from: state.rung,
    to,
    cost,
  });
}

// ---------------------------------------------------------------------------
// The composed run — what the sweeps drive
// ---------------------------------------------------------------------------

/** The cheapest affordable action under the eager policy, or null. */
function cheapestAffordable(
  state: LadderState,
): { readonly action: 'buy'; readonly item: LadderEquipmentItem } | { readonly action: 'move' } | null {
  let best: { cost: number; pick: { action: 'buy'; item: LadderEquipmentItem } | { action: 'move' } } | null = null;
  const held = new Set<string>(state.equipment);
  for (const item of EMPIRE_TUNING.LADDER_EQUIPMENT_ITEMS) {
    if (held.has(item)) continue;
    if (ladderRungIndex(state.rung) < ladderRungIndex(ladderEquipmentMinRung(item))) continue;
    const cost = ladderEquipmentCost(item);
    if (state.gymBucks < cost) continue;
    if (best === null || cost < best.cost) best = { cost, pick: { action: 'buy', item } };
  }
  const to = nextLadderRung(state.rung);
  if (to !== null) {
    const cost = ladderMoveCost(to);
    if (state.gymBucks >= cost && (best === null || cost < best.cost)) {
      best = { cost, pick: { action: 'move' } };
    }
  }
  return best === null ? null : best.pick;
}

/**
 * Fold a whole check-in schedule through the ladder under a named policy.
 *
 * Deterministic by construction — no draw, no clock read, no tie left to
 * object order: equipment candidates are scanned in the fixed item order and
 * a tie on cost keeps the earlier candidate, so identical inputs give
 * byte-identical runs, which `ladder.test.ts` pins across its whole domain.
 *
 * The schedule must be strictly ascending whole ticks. `hoard` spends
 * nothing; `cheapest-affordable-first` buys the cheapest affordable action
 * after each check-in until nothing is affordable. Both exist so the
 * never-punish sweeps can compare engagement under a spending rule and under
 * none — the pair the v1 engagement measurement used.
 */
export function runLadder(
  checkInsSeconds: readonly number[],
  policy: LadderPolicy,
): LadderRun {
  if (!LADDER_POLICIES.includes(policy)) {
    refuseWith(`${String(policy)} is not a ladder policy`);
  }
  let state = createLadderState();
  let accruedGymBucks = 0;
  let secondsBanked = 0;
  let secondsDiscarded = 0;
  const bought: LadderEquipmentItem[] = [];
  const movedTo: LadderDestination[] = [];
  let previous = -1;
  for (const at of checkInsSeconds) {
    if (at <= previous) {
      refuseWith(`check-ins must be strictly ascending, received ${at} after ${previous}`);
    }
    previous = at;
    const checkedIn = ladderCheckIn(state, at);
    state = checkedIn.state;
    accruedGymBucks = scrubPrecision(accruedGymBucks + checkedIn.accrual.gymBucks);
    secondsBanked += checkedIn.accrual.secondsBanked;
    secondsDiscarded += checkedIn.accrual.secondsDiscarded;
    if (policy === 'hoard') continue;
    for (;;) {
      const pick = cheapestAffordable(state);
      if (pick === null) break;
      if (pick.action === 'buy') {
        const outcome = buyLadderEquipment(state, pick.item);
        if (outcome.kind !== 'bought') refuseWith(`the affordable ${pick.item} was refused`);
        state = outcome.state;
        bought.push(outcome.item);
        continue;
      }
      const outcome = moveUpLadder(state);
      if (outcome.kind !== 'moved') refuseWith('the affordable move up was refused');
      state = outcome.state;
      movedTo.push(outcome.to);
    }
  }
  return Object.freeze({
    state,
    checkIns: checkInsSeconds.length,
    accruedGymBucks,
    secondsBanked,
    secondsDiscarded,
    bought: Object.freeze(bought),
    movedTo: Object.freeze(movedTo),
  });
}

// ---------------------------------------------------------------------------
// View-facing helpers — §6 of the header: the view renders, this file computes
// ---------------------------------------------------------------------------

/**
 * A dev step's label: a sign, a magnitude, a unit. A pattern type rather than
 * a bare string, so the position census in `empireForbiddenOutput.test.ts`
 * can read exactly what this field admits — nothing shaped like a vocabulary
 * word fits it.
 */
export type LadderDevStepLabel = `+${number}d` | `+${number}h` | `+${number}s`;

/** One labelled dev-control step: how far a tap advances the clock. */
export interface LadderDevTimeStep {
  readonly seconds: number;
  /** Derived from the seconds, in the largest whole unit they fill. */
  readonly label: LadderDevStepLabel;
}

/**
 * The dev control's steps, read from `LADDER_DEV_TIME_STEPS_SECONDS` and
 * labelled in the largest whole unit each fills — days, then hours, then bare
 * seconds. Refuses a step that is not a positive whole multiple of the tick,
 * because feeding one to `ladderCheckInAfter` would surface as a confusing
 * check-in refusal two calls away from the value that caused it.
 */
export function ladderDevTimeSteps(): readonly LadderDevTimeStep[] {
  return Object.freeze(
    EMPIRE_TUNING.LADDER_DEV_TIME_STEPS_SECONDS.map((seconds) => {
      if (
        !Number.isInteger(seconds) ||
        seconds <= 0 ||
        seconds % EMPIRE_TUNING.TICK_SECONDS !== 0
      ) {
        refuseWith(`${seconds} is not a positive whole-tick dev step`);
      }
      const label: LadderDevStepLabel =
        seconds % EMPIRE_TUNING.SECONDS_PER_DAY === 0
          ? `+${seconds / EMPIRE_TUNING.SECONDS_PER_DAY}d`
          : seconds % EMPIRE_TUNING.SECONDS_PER_HOUR === 0
            ? `+${seconds / EMPIRE_TUNING.SECONDS_PER_HOUR}h`
            : `+${seconds}s`;
      return Object.freeze({ seconds, label });
    }),
  );
}

/**
 * HOW FAR ONE PLAYER-TAKEN OPENING ADVANCES THE GYM, in seconds.
 *
 * WHY THIS EXISTS AT ALL. Until this function shipped, the ONLY thing in the
 * repository that could raise `ManagedGym.checkInsTaken` was the dev
 * clock-skip row — a control the screen itself labels "not part of the game".
 * The standing maintenance review is raised on the check-in ordinal
 * (`MAINTENANCE_ORDER_FIRST_CHECK_IN`, then every `MAINTENANCE_ORDER_STRIDE`),
 * so a player who never pressed a debug control could not reach a review, a
 * strike, dormancy or a recovery at all. `GymScreen.tsx`'s "open up" control
 * dispatches `'open-up'`, `ladderView.tsx`'s reducer feeds this span to the
 * same `managedCheckIn` the dev row already fed, and the loop is reachable.
 *
 * WHY IT IS THE OFFLINE CAP AND NOT A NEW KNOB. GDD §5.1's offline window is
 * how much operation one absence may bank; `bankableOfflineSeconds` discards
 * everything past `OFFLINE_EARNINGS_CAP_HOURS`. Opening up for exactly that
 * window is the largest span a player can take without the accrual throwing
 * part of it away, so nothing this control earns is silently discarded — the
 * quantity a second knob would have to be kept in step with by hand is read
 * from the knob itself instead. A designer who retunes the cap retunes this
 * with it, which is the relation `ladder.test.ts`'s
 * `an opening banks its whole span` asserts rather than assumes.
 *
 * WHAT THIS IS NOT: it is not a claim that real wall-clock time passed. This
 * build has no background clock and no persistence, so "the gym ran for a
 * shift" is the mode's fiction and the copy at the control says so in the
 * player's own words. What is real is that the span goes through the shipped
 * accrual whole — the same call, the same cap, the same wear.
 */
export function playerCheckInGapSeconds(): number {
  return EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS * EMPIRE_TUNING.SECONDS_PER_HOUR;
}

/** The clock readout's shape: whole days, hours, leftover seconds. */
export type LadderClockText = `${number}d ${number}h ${number}s`;

/**
 * A clock reading as days, hours and leftover seconds — display arithmetic
 * for the view, kept here so the view divides nothing. Uses the tuning
 * block's own day and hour lengths rather than restating them. Returns the
 * pattern type rather than a bare string, for the same census reason as
 * `LadderDevStepLabel`.
 */
export function describeLadderClock(atSeconds: number): LadderClockText {
  if (!Number.isFinite(atSeconds) || atSeconds < 0) {
    refuseWith(`a clock reading must be finite and at or above zero, received ${atSeconds}`);
  }
  const days = Math.floor(atSeconds / EMPIRE_TUNING.SECONDS_PER_DAY);
  const hours = Math.floor(
    (atSeconds % EMPIRE_TUNING.SECONDS_PER_DAY) / EMPIRE_TUNING.SECONDS_PER_HOUR,
  );
  const seconds = atSeconds % EMPIRE_TUNING.SECONDS_PER_HOUR;
  return `${days}d ${hours}h ${seconds}s`;
}
