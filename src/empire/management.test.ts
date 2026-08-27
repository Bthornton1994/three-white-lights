/**
 * management.test.ts — unit tests for §5.11 stage 4's pure logic, and the
 * never-punish sweep the §5.13 wear-basis ruling names as the round's spine.
 *
 * The sweep parameters live here, as a named block, for the reason
 * `src/game/streakSweep.ts` exists (a measurement whose inputs are not
 * written down is an anecdote) and with the file suffix `src/tuning/audit.ts`
 * forces — `empireSweep.test.ts`'s header records the convention.
 *
 * The property under test, from `docs/GDD.md` §5.13's stage-4 stanza: two
 * histories identical except that one has more absence must never differ in
 * condition, in income deducted, or in failure progression. Three DOMAINS
 * measure it, and on each domain the shipped wiring runs beside the controls
 * that are controls for THAT domain — thirteen families in all, each over all six
 * `MANAGEMENT_POLICIES`, each carrying every counter twice: once for the
 * family and once per policy.
 *
 *   - PURE ABSENCE: the same action sequence with a BEYOND-horizon gap
 *     enlarged, compared per index — byte-identical everything, pinned at zero
 *     mismatches, against a wall-clock-wear control and an absence-strike
 *     control both pinned non-zero. This is the family the stanza's sentence
 *     is literally about, and the only one where byte-identity is possible.
 *   - ABSENCE INSIDE THE CATCH-UP HORIZON: the offline cap pays for that time,
 *     so the gym operated through it and banked seconds genuinely move.
 *     Nothing here is byte-identical and every counter is pinned exactly,
 *     against the removed per-refusal strike ledger and the removed dormancy
 *     slump, both kept runnable.
 *   - ENGAGEMENT: the same fixed grid with one extra check-in — CLAUDE.md's
 *     §12.3 rule — compared at shared times, against the same two removed
 *     mechanisms plus a per-visit-fee control.
 *
 * WHAT THIS ROUND CHANGED. The §5.13 wear-basis ruling split §5.7's two
 * sentences: condition and income stay operation-keyed, and failure breaks its
 * chain to condition. The previous round broke half of that chain — a strike
 * is charged once per STANDING REPAIR ORDER rather than once per refusal — and
 * left WHEN a refusal is possible keyed to equipment condition, which still
 * carried wear into the ledger and read 310 / 186 / 124.
 *
 * The standing repair order is raised on the CHECK-IN ORDINAL now
 * (`management.ts` header §3a), and within-horizon failure progression reads
 * 0 / 0 / 0 on the family and on every one of the six policies. The removed
 * condition gate is kept runnable as `condition-gated-prompt-control` and
 * reproduces 310 / 186 / 124 exactly — the number the zeros are zeros
 * against. `EXPECTED_SWEEP.review` is the split that says why, measured off a
 * REPORTED field of `ManagedReading` rather than off a recomputation of the
 * cadence.
 *
 * WHAT IT DID NOT REACH, AND WHAT A RULING THEN DELETED. §5.7's clarification
 * used to carry a second sentence — the same strikes on the same calendar for
 * two histories differing only in check-in frequency — and the engagement
 * family measures it at 909 / 524. Those numbers FELL from the old gate's
 * 1187 / 730, which was not the predicted direction. The conflict was routed
 * to a human and the human WITHDREW THE SENTENCE rather than asking for the
 * code to meet it: a strike needs a check-in, so more visits means more
 * chances to refuse, and forcing the totals equal costs either strikes during
 * absence or shown refusals that do not count. `management.ts` header §3b has
 * the ruling. So 909 / 524 are kept here as what the withdrawn sentence WOULD
 * have measured, and are not a shipped violation; §12.3's actual bar — the
 * player who shows up more must not end WORSE — is carried by
 * `engagementEagerTurnaroundControl` at 36 / 21.
 *
 * Counts are pinned exactly, never bounded, and the non-zero controls stay
 * runnable — the house standard from `src/game/streak.test.ts`. Two of the
 * controls are mechanisms this build took OUT of the shipped model, so the
 * zeros are zeros against something that was really tried.
 *
 * WHAT THIS ROUND ADDED, since the sentence above is about the round before
 * it. Three checks on the knob relation the zeros above rest on:
 * `STRIKE_PATH_MARGIN` derives, from five knobs and the offline horizon, that
 * the display predicate's worn disjunct cannot fire before the ledger's phase
 * disjunct; a directed drive on the fastest-wearing schedule reads WHICH
 * disjunct fired and pins the strike ledger it built; and the domain census
 * gained `autoRepairsReopeningRefusedOrders`, the second condition read on the
 * countability path. `management.ts` header §3e has both derivations and both
 * limits, and §1 has the wear-rate table the first one is a bound on.
 *
 * WHAT THIS FILE DOES NOT COVER. The sweep's domain is three seeds, a
 * five-entry gap menu straddling the horizon, and a 24-day two-slot grid at
 * 0.6 attendance. It says nothing about gap sizes off that menu, about
 * schedules longer than 200 check-ins, or about policies other than the six
 * `MANAGEMENT_POLICIES` — those are models of a player, not of §5, and a
 * seventh could behave differently. Every run in the battery is a GARAGE run,
 * which the visit-fee control's derivation depends on and which
 * `keeps the non-zero controls non-zero` measures rather than assumes. Where a
 * claim depends on the domain rather than on the arithmetic, it says so at the
 * pin.
 */

import { describe, expect, it } from 'vitest';

import {
  COUNTED_DECISIONS,
  FAILURE_PHASES,
  MANAGED_DECISION_KINDS,
  MANAGEMENT_POLICIES,
  MANAGEMENT_WIRINGS,
  SHIPPED_MANAGEMENT_WIRING,
  chargesVisitFee,
  conditionIncomeMultiplier,
  createManagedGym,
  declineRepair,
  dismissManager,
  failurePhase,
  fullRepairCostGymBucks,
  hireManager,
  itemCondition,
  maintenancePrompt,
  managedCheckIn,
  managementWiring,
  managerAssetValueGymBucks,
  managerAutoRepairCondition,
  managerHireCostGymBucks,
  managerWageRatePerBankedHour,
  meanCondition,
  memberConditionInput,
  ownedItemsOf,
  recoverGym,
  recoveryRepairCostGymBucks,
  recoveryRequirement,
  repairCostGymBucks,
  repairEquipment,
  requireManagedGym,
  respondToPrompt,
  runManagedGym,
  shippedManagementWiring,
  slumpsOnFailure,
  countedWarningVisible,
  isNeglected,
  fabricatesAbsenceStrikes,
  gatesReviewOnCondition,
  orderOpensAt,
  repeatsStrikes,
  shedsAnyManager,
  unansweredItems,
  warningSigns,
  wearsOnWallClock,
  warningSignsVisible,
  withUpdatedGym,
  wornItems,
  type ManagedEquipmentItem,
  type ManagedGym,
  type ManagedRun,
  type ManagementPolicy,
  type ManagementWiringKey,
  type ManagerTier,
} from './management';
import { buySessionEquipment, withLadder } from './sessions';
import { offlineBankingHorizonSeconds, scrubPrecision } from './production';
import { EMPIRE_TUNING } from './empireTuning';

// ---------------------------------------------------------------------------
// The sweep's parameters, written down
// ---------------------------------------------------------------------------

const HORIZON_SECONDS = offlineBankingHorizonSeconds();

export const MANAGEMENT_SWEEP = Object.freeze({
  /** One seed per sampled population. Arbitrary, fixed, written down. */
  SEEDS: Object.freeze([11119, 24680, 90001] as const),

  /** Action schedules drawn per seed for the gap families. */
  SCHEDULES_PER_SEED: 8,

  /** Check-ins per action schedule. */
  CHECK_INS_PER_SCHEDULE: 40,

  /**
   * Check-ins in the directed cheapskate drive that reads WHICH disjunct of
   * `warningSignsVisible` fired. Long enough to pass the review that takes a
   * refusing garage dormant, with room after it, so the drive shows what
   * happens once wear stops as well as before.
   */
  CHEAPSKATE_DRIVE_CHECK_INS: 16,

  /**
   * The gap menu a schedule's gaps are drawn from, in seconds: 4 h and 8 h
   * (inside the no-punish floor), 12 h (exactly the banking horizon), 24 h
   * and 72 h (beyond it, so the cap discards time). The menu straddles the
   * horizon on purpose — a menu entirely inside it would make the pure-
   * absence family an empty domain, and one entirely beyond it would make
   * the within-horizon family one.
   */
  GAP_MENU_SECONDS: Object.freeze([14400, 28800, 43200, 86400, 259200] as const),

  /** Extra absence inserted into an eligible gap for the pure family. */
  PURE_ABSENCE_EXTRA_SECONDS: Object.freeze([86400, 604800] as const),

  /** Eligible (at-or-beyond-horizon) gap indices used per schedule. */
  PURE_ABSENCE_PAIRS_PER_SCHEDULE: 3,

  /** The sub-horizon gap the within-horizon family enlarges. */
  WITHIN_HORIZON_GAP_SECONDS: 14400,

  /**
   * Extra absence for the within-horizon family: +1 h and +6 h, both keeping
   * the enlarged gap at or under the banking horizon, so the difference is
   * paid catch-up time rather than discarded time.
   */
  WITHIN_HORIZON_EXTRA_SECONDS: Object.freeze([3600, 21600] as const),

  /** Sub-horizon gap indices used per schedule. */
  WITHIN_HORIZON_PAIRS_PER_SCHEDULE: 3,

  /**
   * The policies the within-horizon ATTRIBUTION walks. It is the whole policy
   * vocabulary and it is held as its own name so a future narrowing is a
   * visible edit here rather than a quietly halved axis — which is exactly
   * what happened once, when this family ran under a three-entry list named
   * for what was asserted about it. Every FAMILY in the battery now runs all
   * six by construction (`perIndexFamily` and `sharedTimeFamily` loop
   * `MANAGEMENT_POLICIES` directly); this name is what the attribution walk
   * and its per-policy buckets read.
   */
  WITHIN_HORIZON_POLICIES: MANAGEMENT_POLICIES,

  /** The engagement family's fixed grid: days, and check-in slots per day. */
  GRID_DAYS: 24,
  GRID_SLOTS_PER_DAY: 2,

  /** Grids drawn per seed for the engagement family. */
  GRID_SCHEDULES_PER_SEED: 6,

  /** The share of slots a drawn grid attends. */
  GRID_ATTENDANCE: 0.6,

  /** Every how-many-th unattended slot is flipped into the extra check-in. */
  GRID_FLIP_STRIDE: 2,

  /**
   * The visit-fee control's dial's MARGIN over the income an extra check-in
   * earns. The dial itself is derived from the tuning below rather than
   * written as a literal — see `VISIT_FEE_GYM_BUCKS`. A margin at or below 1
   * makes the control vacuous by construction and the sweep asserts against
   * it.
   */
  VISIT_FEE_MARGIN: 2,

  /**
   * The visit-fee control's dial, in Gym Bucks per check-in, DERIVED.
   *
   * It has to clear the income the extra check-in itself earns, or the control
   * does not control for anything: on this grid the slots are exactly one
   * banking horizon apart, so one extra check-in banks one extra horizon and a
   * fee below that leaves the more-engaged run ahead on money and the control
   * silently vacuous. It was a bare `40` for one round and read zero; the run
   * that caught it is `keeps the non-zero controls non-zero`, doing its job.
   *
   * It was then a bare `400` against a threshold of 360 — an 11% margin over a
   * number that is not a constant of the design at all. The threshold is
   * `LADDER_INCOME_GYM_BUCKS_PER_HOUR[rung] x OFFLINE_EARNINGS_FRACTION x
   * OFFLINE_EARNINGS_CAP_HOURS`, which is 360 at the garage and 1440 at the
   * storage unit, so a tuner who raised the garage rate past 800/hour made
   * this control vacuous without touching this number and nothing would have
   * said so. The dial is derived from those three values now, so it moves with
   * them, and the sweep asserts BOTH the derivation and the rung assumption it
   * rests on — that every run in this battery is a garage run.
   *
   * The rung assumption is real and is not widened here: the derivation is
   * about the garage, not about the ladder. A battery that ever relocated
   * would need this keyed to the rung the runs reach, and the assertion that
   * every run ends at `LADDER_RUNGS[0]` is what would redden first.
   */
  VISIT_FEE_GYM_BUCKS: 720,

  /**
   * The failure-slump control's dial: the condition every item lost on entry
   * to dormancy in the round this mechanism shipped in. It is this exact
   * value the sweep measured non-zero, which is why the control carries it
   * rather than a fresh number — see `management.ts` header §4.
   */
  FAILURE_SLUMP_CONTROL_CONDITION: 0.25,

  /**
   * The policy the failure-slump control runs under. It has to be one that
   * fails: 'hands-off' takes no decisions, so it never reaches the crossing
   * the control fires on, and a control that never fires is the empty domain
   * this file's own census exists to refuse.
   */
  FAILURE_SLUMP_CONTROL_POLICY: 'negligent',

  /**
   * A directed long run, folded into the sweep so the arm census sees it and
   * the domain census counts it.
   *
   * WHAT IT WAS ADDED FOR, AND THE FACT THAT IT STOPPED DOING IT. It was added
   * for one declared arm the seeded schedules did not reach —
   * `dismiss-manager`, which needed a gym that fails, recovers, takes on the
   * manager the comeback hires, and then fails a SECOND time while still
   * staffed. Under the shipped `'redemptive'` model that stopped happening:
   * the model sheds exactly the manager `recoveryRequirement` blocks on, the
   * comeback hires `MANAGER_TIERS[1]`, and `hireManager` counts a hire as a
   * strike at `MANAGER_TIERS[0]` and no other tier — so a redemptive run never
   * holds a manager with `hiredUnderWarning`, and this run reaches
   * `dismiss-manager` zero times. Measured, not inferred: driving the whole
   * battery with this run removed leaves every `run:` and `run-phase:` arm
   * non-zero, and every one of the 41 `dismiss-manager` events comes from the
   * `'eager-turnaround-control'` wiring on the `'redemptive'` policy.
   *
   * WHAT IT COVERS NOW, so it is kept for a reason that is true rather than
   * for the one it was written for. It is the battery's only 200-check-in
   * schedule against 40 for the seeded ones and ~29 for the grids, so it is
   * what makes the header's "says nothing about schedules longer than 200
   * check-ins" a statement with a number in it. Its measured contribution is
   * to counts and not to coverage: removing it moves `run-phase:sound` by 140,
   * `run:prompt-dismiss` by 50, `run-phase:warned` by 48, `run:repair` by 36,
   * `run-phase:failed` and `run:recover` by 12 each, `run:hire-steady` by 1,
   * and every other arm by nothing.
   */
  DIRECTED_RUN_CHECK_INS: 200,
  DIRECTED_RUN_GAP_SECONDS: 86400,
  DIRECTED_RUN_POLICY: 'redemptive',

  /**
   * The hiring policies — the three whose spends are money-timed. They are not
   * a narrowing of any family: EVERY family runs all six policies. This list
   * exists only for the extra `hiringNet` measurement, which asks a question
   * that only makes sense where a manager is hired at all, and it is read
   * beside a split on whether the two runs' manager states match.
   *
   * There used to be a sibling list here called `NET_MONOTONE_POLICIES`,
   * naming the other three, and it was DELETED rather than kept: a list named
   * for what is asserted ABOUT a set was twice read as if it were a list of
   * SUBJECTS, and the second time it silently halved the within-horizon
   * family's policy axis for a round. There is nothing left to misread.
   */

  /** The hiring policies, measured with the split described above. */
  HIRING_POLICIES: Object.freeze(['cheapskate', 'delegating', 'redemptive'] as const),

  /**
   * The seeded generator's constants — the same exact-integer 32-bit LCG
   * `engagement.test.ts` documents, kept inside safe-integer range by its
   * multiplier.
   */
  LCG_MULTIPLIER: 1664525,
  LCG_INCREMENT: 1013904223,
  LCG_MODULUS: 4294967296,

  /**
   * Two net positions closer than this compare equal. One millionth of a
   * Gym Buck — the same grain `scrubPrecision` keeps — so the monotonicity
   * pins cannot be tripped by float dust nor hide a real deficit.
   */
  NET_TOLERANCE: 0.000001,

  /**
   * The grain the attribution block's Gym Buck magnitudes are pinned at. The
   * whole battery is deterministic, so a magnitude could be pinned to the
   * last bit; it is rounded to a hundredth of a Gym Buck instead so the
   * pinned number is a quantity a reader can weigh against a repair cost
   * (400 per condition point) rather than a float nobody can compare to
   * anything.
   */
  MAGNITUDE_GRAIN: 100,
});

/**
 * The income one extra banked horizon earns at the garage — the number the
 * visit-fee control's dial has to clear. Derived from the three tuning values
 * it is a product of, so it cannot go stale against them.
 */
function garageHorizonIncomeGymBucks(): number {
  return (
    EMPIRE_TUNING.LADDER_INCOME_GYM_BUCKS_PER_HOUR[EMPIRE_TUNING.LADDER_RUNGS[0]] *
    EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
    (HORIZON_SECONDS / EMPIRE_TUNING.SECONDS_PER_HOUR)
  );
}

/**
 * The player models whose failure progression the chain break takes to EXACT
 * zero on both absence domains and on the engagement domain: the ones that
 * never refuse a repair order (`hands-off` and `diligent` never reach a
 * counted decision at all; `delegating` answers every prompt by repairing).
 * Named rather than derived, so a policy that stops being clean is a visible
 * edit here instead of a smaller number nobody reads.
 */
const FAILURE_CLEAN_POLICIES: readonly ManagementPolicy[] = Object.freeze([
  'hands-off',
  'diligent',
  'delegating',
]);

/*
 * `FAILURE_CHAIN_BEFORE` USED TO SIT HERE AND HAS BEEN DELETED, which is
 * worth a note rather than a silent removal. It held the pre-ruling failure
 * counters as literals, and by the round that removed it nothing read it: the
 * mitigation compared against the live control instead, so the constant was a
 * dead number inviting exactly the stale comparison it was written to prevent.
 *
 * The live replacement is `families.withinHorizonConditionGatedControl` and
 * `families.engagementConditionGatedControl` — the removed condition-gated
 * review run over the same domains, the same six policies and the same
 * comparators on THIS tree. They read 310 / 186 / 124 and 1187 / 730 / 447,
 * which are the previous round's shipped within-horizon and engagement rows
 * exactly; that agreement is what says the control reproduces the mechanism
 * rather than approximating it, and it is asserted rather than admired.
 */

// ---------------------------------------------------------------------------
// The knob margin the strike path's last condition read rests on
// ---------------------------------------------------------------------------

/**
 * The value of `ManagedGym.checkInsTaken` at which the `n`th standing repair
 * order is raised, read off the two ordinal knobs.
 *
 * `orderOpensAt`'s cadence is `MAINTENANCE_ORDER_FIRST_CHECK_IN`, then every
 * `MAINTENANCE_ORDER_STRIDE` check-ins, so review `n` lands at
 * `first + (n - 1) * stride`. This is a second expression of that arithmetic
 * and would be worth nothing on its own — a sweep grading the engine against a
 * copy of itself is the shape this file already refuses — so
 * `the cadence this margin is derived from is the cadence orderOpensAt
 * implements` drives the real function over a whole range of `checkInsTaken`
 * and asserts the two agree as SETS before any margin below is believed.
 */
function reviewCheckInCount(nth: number): number {
  return (
    EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN +
    (nth - 1) * EMPIRE_TUNING.MAINTENANCE_ORDER_STRIDE
  );
}

/** Round to a millionth, the grain `scrubPrecision` keeps. Float dust only. */
function atMillionth(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * The arithmetic behind `management.ts` header §3e's first half, derived from
 * the five knobs it is a function of and from `offlineBankingHorizonSeconds`.
 *
 * WHAT IT IS FOR. `'cheapskate'`'s strike-producing hire is gated on
 * `warningSignsVisible`, which is `failurePhase(state) !== 'sound' ||
 * wornItems(state).length > 0`. The second disjunct is a CONDITION read, and it
 * sits on the path to a counted decision — the thing §5.7's clarification and
 * the §5.13 wear-basis ruling take off that path. It is inert at the shipped
 * tuning because the first disjunct fires first, and "fires first" is an
 * inequality between knobs that nothing asserted until this block.
 *
 * THE TERMS.
 *
 *   - `wearPerCheckIn` is the MOST an item can lose at one check-in:
 *     `withWear` charges `EQUIPMENT_WEAR_PER_BANKED_HOUR` per banked hour and
 *     `bankableOfflineSeconds` caps a gap's banked seconds at the offline
 *     horizon, so no schedule wears faster than this per check-in. Note the
 *     horizon is `Math.max(OFFLINE_EARNINGS_CAP_HOURS,
 *     OFFLINE_EARNINGS_NO_PUNISH_HOURS)` rather than the cap alone — read from
 *     `offlineBankingHorizonSeconds` so a tuner who drops the cap below the
 *     floor gets the term the code actually uses.
 *   - `checkInsBeforeWarningIsReadable` is `reviewCheckInCount(
 *     FAILURE_WARNING_STRIKES) + 1`. A counted refusal is possible at a review
 *     and nowhere else (`declineRepair` and `respondToPrompt` both refuse away
 *     from the cadence), so the earliest a run reaches the warning phase by
 *     answering one review at a time is the review numbered
 *     `FAILURE_WARNING_STRIKES`. The `+ 1` is `runManagedGym`'s fixed order
 *     within a check-in: the hire block reads the predicate BEFORE the prompt
 *     block takes that check-in's refusal, so the first hire read that can see
 *     the new phase is the following check-in.
 *   - `floorCondition` is the least any item can be at that check-in, and the
 *     margin is its distance above `MAINTENANCE_PROMPT_CONDITION`.
 *
 * WHAT IT IS NOT, stated because the bound is one-directional. This is a
 * SUFFICIENT condition for the disjunct ordering on the strike-producing path,
 * not a proof that the sweep's failure counters stay at zero for every knob
 * setting. Other wear-sensitive routes into the ledger exist and are named
 * where they live: the purse route (header §3d) and the manager's autonomous
 * repair re-arming a refused order (header §3e's second half). A knob move can
 * redden the sweep with this inequality still comfortably satisfied.
 */
const STRIKE_PATH_MARGIN = (() => {
  const horizonHours = offlineBankingHorizonSeconds() / EMPIRE_TUNING.SECONDS_PER_HOUR;
  const wearPerCheckIn = EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR * horizonHours;
  const checkInsBeforeWarningIsReadable =
    reviewCheckInCount(EMPIRE_TUNING.FAILURE_WARNING_STRIKES) + 1;
  const floorCondition = 1 - checkInsBeforeWarningIsReadable * wearPerCheckIn;
  return Object.freeze({
    horizonHours,
    wearPerCheckIn: atMillionth(wearPerCheckIn),
    checkInsBeforeWarningIsReadable,
    floorCondition: atMillionth(floorCondition),
    marginOverPromptCondition: atMillionth(
      floorCondition - EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION,
    ),
    /**
     * The wear rate at which the margin closes, holding every other knob: the
     * largest `EQUIPMENT_WEAR_PER_BANKED_HOUR` for which the worn disjunct
     * still cannot fire first. Reported so a playtester reading this block
     * knows how far the knob may travel before the check reddens.
     */
    crossingWearRatePerBankedHour: atMillionth(
      (1 - EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION) /
        (checkInsBeforeWarningIsReadable * horizonHours),
    ),
  });
})();

/** Round a Gym Buck magnitude to `MAGNITUDE_GRAIN`. Deterministic. */
function atGrain(value: number): number {
  return Math.round(value * MANAGEMENT_SWEEP.MAGNITUDE_GRAIN) / MANAGEMENT_SWEEP.MAGNITUDE_GRAIN;
}

/** A 32-bit LCG. Exact integer arithmetic; see the constants above. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * MANAGEMENT_SWEEP.LCG_MULTIPLIER + MANAGEMENT_SWEEP.LCG_INCREMENT) >>> 0;
    return state / MANAGEMENT_SWEEP.LCG_MODULUS;
  };
}

// ---------------------------------------------------------------------------
// Schedule generators
// ---------------------------------------------------------------------------

/** One seeded action schedule, as a list of gaps drawn from the menu. */
function gapScheduleAt(seed: number, index: number): readonly number[] {
  const next = lcg(seed + index * 7919);
  const gaps: number[] = [];
  for (let at = 0; at < MANAGEMENT_SWEEP.CHECK_INS_PER_SCHEDULE; at += 1) {
    const menuAt = Math.floor(next() * MANAGEMENT_SWEEP.GAP_MENU_SECONDS.length);
    gaps.push(MANAGEMENT_SWEEP.GAP_MENU_SECONDS[menuAt] as number);
  }
  return gaps;
}

/** Absolute check-in times from a gap list. */
function timesOf(gaps: readonly number[]): readonly number[] {
  const times: number[] = [];
  let clock = 0;
  for (const gap of gaps) {
    clock += gap;
    times.push(clock);
  }
  return times;
}

/** The same gaps with gap `at` enlarged by `extraSeconds`. */
function moreAbsentBy(
  gaps: readonly number[],
  at: number,
  extraSeconds: number,
): readonly number[] {
  const gap = gaps[at];
  if (gap === undefined) throw new Error(`gap ${at} is off a schedule of ${gaps.length}`);
  if (extraSeconds <= 0) throw new Error('an absence enlargement must be above zero');
  return gaps.map((current, index) => (index === at ? current + extraSeconds : current));
}

/**
 * The within-horizon family's (seed, schedule, gap index, extra) keys, in the
 * order the sweep walks them. One generator, read by both the sweep and the
 * attribution test, so the residual is attributed over exactly the pairs it
 * was counted over rather than over a second hand-written enumeration.
 */
function* withinHorizonPairKeys(): Generator<readonly [number, number, number, number]> {
  for (const seed of MANAGEMENT_SWEEP.SEEDS) {
    for (let index = 0; index < MANAGEMENT_SWEEP.SCHEDULES_PER_SEED; index += 1) {
      const gaps = gapScheduleAt(seed, index);
      const subHorizon = gaps
        .map((gap, at) => (gap === MANAGEMENT_SWEEP.WITHIN_HORIZON_GAP_SECONDS ? at : -1))
        .filter((at) => at >= 0)
        .slice(0, MANAGEMENT_SWEEP.WITHIN_HORIZON_PAIRS_PER_SCHEDULE);
      for (const gapAt of subHorizon) {
        for (const extra of MANAGEMENT_SWEEP.WITHIN_HORIZON_EXTRA_SECONDS) {
          yield [seed, index, gapAt, extra] as const;
        }
      }
    }
  }
}

/** The directed long run's check-in times: a fixed daily cadence. */
function directedRunTimes(): readonly number[] {
  const times: number[] = [];
  for (let at = 1; at <= MANAGEMENT_SWEEP.DIRECTED_RUN_CHECK_INS; at += 1) {
    times.push(at * MANAGEMENT_SWEEP.DIRECTED_RUN_GAP_SECONDS);
  }
  return times;
}

/** One seeded engagement grid: attended flags over days x slots. */
function gridAt(seed: number, index: number): readonly boolean[] {
  const next = lcg(seed + index * 104729);
  const slots = MANAGEMENT_SWEEP.GRID_DAYS * MANAGEMENT_SWEEP.GRID_SLOTS_PER_DAY;
  const attended: boolean[] = [];
  for (let slot = 0; slot < slots; slot += 1) {
    attended.push(next() < MANAGEMENT_SWEEP.GRID_ATTENDANCE);
  }
  return attended;
}

/** The wall second a grid slot's check-in lands on. */
function slotSeconds(slot: number): number {
  return (slot + 1) * (EMPIRE_TUNING.SECONDS_PER_DAY / MANAGEMENT_SWEEP.GRID_SLOTS_PER_DAY);
}

/** A grid's check-in times: the attended slots' seconds, ascending. */
function gridTimes(attended: readonly boolean[]): readonly number[] {
  const times: number[] = [];
  for (const [slot, present] of attended.entries()) {
    if (present) times.push(slotSeconds(slot));
  }
  return times;
}

// ---------------------------------------------------------------------------
// Comparators
// ---------------------------------------------------------------------------

/** A run's decision trace: what was decided, in order, with counted flags. */
function traceOf(run: ManagedRun): string {
  return run.decisions.map((event) => `${event.kind}${event.counted ? '!' : ''}`).join(',');
}

const PHASE_RANK: Readonly<Record<string, number>> = Object.freeze({
  sound: 0,
  warned: 1,
  failed: 2,
});

interface PairDivergence {
  readonly comparedReadings: number;
  readonly bankedMismatches: number;
  readonly conditionMismatches: number;
  readonly moneyMismatches: number;
  readonly failureMismatches: number;
  /**
   * Readings where the two runs' RUNNING TOTAL of maintenance reviews offered
   * differs. Cumulative for the same reason `variantDeductedMore` is: on the
   * engagement domain the runs have different check-in counts, so a per-
   * reading boolean would be comparing different populations.
   *
   * This is the counter the ordinal review cadence is ABOUT. Within the
   * horizon it is pinned at zero — enlarging a gap changes gap lengths and
   * never the number of check-ins, so the cadence lands on the same indices —
   * and on the engagement domain it is pinned non-zero, because an extra
   * check-in is an extra step along the cadence.
   */
  readonly reviewsOfferedMismatches: number;
  /** Readings where the variant's condition is lower than the base's. */
  readonly variantConditionLower: number;
  /** Readings where the variant deducted more income than the base. */
  readonly variantDeductedMore: number;
  /** Readings where the variant's failure phase ranks worse. */
  readonly variantPhaseWorse: number;
  /** Readings where the variant's net position is below the base's. */
  readonly variantNetLower: number;
  readonly tracesMatch: boolean;
}

/** Compare two runs of the same check-in count, index by index. */
function comparePerIndex(base: ManagedRun, variant: ManagedRun): PairDivergence {
  if (base.readings.length !== variant.readings.length) {
    throw new Error('an index comparison needs runs of one shape');
  }
  let bankedMismatches = 0;
  let conditionMismatches = 0;
  let moneyMismatches = 0;
  let failureMismatches = 0;
  let variantConditionLower = 0;
  let variantDeductedMore = 0;
  let variantPhaseWorse = 0;
  let variantNetLower = 0;
  let deductedBase = 0;
  let deductedVariant = 0;
  let reviewsBase = 0;
  let reviewsVariant = 0;
  let reviewsOfferedMismatches = 0;
  for (const [at, left] of base.readings.entries()) {
    const right = variant.readings[at];
    if (right === undefined) throw new Error('reading lengths diverged mid-walk');
    if (left.reviewOffered) reviewsBase += 1;
    if (right.reviewOffered) reviewsVariant += 1;
    if (reviewsBase !== reviewsVariant) reviewsOfferedMismatches += 1;
    if (left.secondsBanked !== right.secondsBanked) bankedMismatches += 1;
    if (left.meanCondition !== right.meanCondition) conditionMismatches += 1;
    if (
      left.incomePaid !== right.incomePaid ||
      left.incomeDeducted !== right.incomeDeducted ||
      left.wagePaid !== right.wagePaid ||
      left.netPosition !== right.netPosition
    ) {
      moneyMismatches += 1;
    }
    if (left.phase !== right.phase || left.strikeCount !== right.strikeCount) {
      failureMismatches += 1;
    }
    if (right.meanCondition < left.meanCondition) variantConditionLower += 1;
    deductedBase += left.incomeDeducted;
    deductedVariant += right.incomeDeducted;
    if (deductedVariant > deductedBase + MANAGEMENT_SWEEP.NET_TOLERANCE) {
      variantDeductedMore += 1;
    }
    if ((PHASE_RANK[right.phase] ?? 0) > (PHASE_RANK[left.phase] ?? 0)) variantPhaseWorse += 1;
    if (right.netPosition < left.netPosition - MANAGEMENT_SWEEP.NET_TOLERANCE) {
      variantNetLower += 1;
    }
  }
  return Object.freeze({
    comparedReadings: base.readings.length,
    bankedMismatches,
    conditionMismatches,
    moneyMismatches,
    failureMismatches,
    reviewsOfferedMismatches,
    variantConditionLower,
    variantDeductedMore,
    variantPhaseWorse,
    variantNetLower,
    tracesMatch: traceOf(base) === traceOf(variant),
  });
}

/**
 * Compare a base run against a variant that attended everything the base
 * attended plus one extra check-in, at the base's own check-in times.
 *
 * Every counter `comparePerIndex` keeps is kept here too, and measured. For
 * one round this function returned literal zeros for `bankedMismatches`,
 * `conditionMismatches` and `moneyMismatches` — quantities it had both
 * readings in hand for and simply did not compare — which put three
 * unmeasured zeros into a pinned tally beside eleven measured ones with
 * nothing distinguishing them. They are measured now, and they are NOT
 * expected to be zero: an extra check-in changes banked seconds at the
 * following shared reading by construction.
 */
function compareAtSharedTimes(base: ManagedRun, variant: ManagedRun): PairDivergence {
  const variantAt = new Map(variant.readings.map((reading) => [reading.atSeconds, reading]));
  let comparedReadings = 0;
  let bankedMismatches = 0;
  let conditionMismatches = 0;
  let moneyMismatches = 0;
  let variantPhaseWorse = 0;
  let variantNetLower = 0;
  let failureMismatches = 0;
  let deductedBase = 0;
  let deductedVariant = 0;
  let variantDeductedMore = 0;
  let variantConditionLower = 0;
  let reviewsOfferedMismatches = 0;
  // The variant's reviews are counted over ITS OWN readings up to the shared
  // second, not over the shared ones: the extra check-in is exactly what this
  // counter is about, so skipping it would define the difference away.
  const variantReviewsBySecond = new Map<number, number>();
  {
    let running = 0;
    for (const reading of variant.readings) {
      if (reading.reviewOffered) running += 1;
      variantReviewsBySecond.set(reading.atSeconds, running);
    }
  }
  let reviewsBase = 0;
  for (const left of base.readings) {
    const right = variantAt.get(left.atSeconds);
    if (right === undefined) {
      throw new Error(`the more engaged run has no reading at ${left.atSeconds}`);
    }
    comparedReadings += 1;
    if (left.reviewOffered) reviewsBase += 1;
    if ((variantReviewsBySecond.get(left.atSeconds) ?? 0) !== reviewsBase) {
      reviewsOfferedMismatches += 1;
    }
    if (left.secondsBanked !== right.secondsBanked) bankedMismatches += 1;
    if (left.meanCondition !== right.meanCondition) conditionMismatches += 1;
    if (
      left.incomePaid !== right.incomePaid ||
      left.incomeDeducted !== right.incomeDeducted ||
      left.wagePaid !== right.wagePaid ||
      left.netPosition !== right.netPosition
    ) {
      moneyMismatches += 1;
    }
    if ((PHASE_RANK[right.phase] ?? 0) > (PHASE_RANK[left.phase] ?? 0)) variantPhaseWorse += 1;
    if (left.phase !== right.phase || left.strikeCount !== right.strikeCount) {
      failureMismatches += 1;
    }
    if (right.netPosition < left.netPosition - MANAGEMENT_SWEEP.NET_TOLERANCE) {
      variantNetLower += 1;
    }
    if (right.meanCondition < left.meanCondition) variantConditionLower += 1;
    deductedBase += left.incomeDeducted;
    deductedVariant += right.incomeDeducted;
    if (deductedVariant > deductedBase + MANAGEMENT_SWEEP.NET_TOLERANCE) {
      variantDeductedMore += 1;
    }
  }
  return Object.freeze({
    comparedReadings,
    bankedMismatches,
    conditionMismatches,
    moneyMismatches,
    failureMismatches,
    reviewsOfferedMismatches,
    variantConditionLower,
    variantDeductedMore,
    variantPhaseWorse,
    variantNetLower,
    tracesMatch: traceOf(base) === traceOf(variant),
  });
}

/**
 * Net-lower readings between two runs at their shared times, measured on the
 * position WITHOUT `netPosition`'s manager asset term. Every reading reports
 * that term, so this is a read of the shipped numbers rather than a second
 * model of them.
 */
function untermedNetLowerReadings(base: ManagedRun, variant: ManagedRun): number {
  const variantAt = new Map(variant.readings.map((reading) => [reading.atSeconds, reading]));
  let lower = 0;
  for (const left of base.readings) {
    const right = variantAt.get(left.atSeconds);
    if (right === undefined) continue;
    const leftUntermed = left.netPosition - left.managerAssetValue;
    const rightUntermed = right.netPosition - right.managerAssetValue;
    if (rightUntermed < leftUntermed - MANAGEMENT_SWEEP.NET_TOLERANCE) lower += 1;
  }
  return lower;
}

// ---------------------------------------------------------------------------
// The battery, computed once
// ---------------------------------------------------------------------------

/**
 * The thirteen families the battery keeps. Three DOMAINS — pure absence beyond the
 * horizon, absence inside it, one extra check-in — and on each domain the
 * shipped wiring plus the controls that are controls FOR that domain. A
 * control mixed across two domains cannot say which of them it bit on, which
 * is why the slump and repeat-strike controls appear once per domain rather
 * than once in total.
 */
const FAMILY_KEYS = Object.freeze([
  'pureAbsence',
  'pureAbsenceWallClockControl',
  'pureAbsenceStrikeControl',
  'withinHorizon',
  'withinHorizonRepeatStrikeControl',
  'withinHorizonSlumpControl',
  'withinHorizonConditionGatedControl',
  'engagement',
  'engagementRepeatStrikeControl',
  'engagementVisitFeeControl',
  'engagementSlumpControl',
  'engagementConditionGatedControl',
  'engagementEagerTurnaroundControl',
] as const);

type FamilyKey = (typeof FAMILY_KEYS)[number];

/**
 * The wiring each family is driven under. One row, no inference.
 *
 * THREE OF THESE ROWS MUST NOT BE DELETED, and the reason is written here
 * rather than left to be rediscovered. The §5.13 chain break moved coverage
 * off the shipped path and onto controls, so three of them are now the sole
 * carriers of something the pins depend on. A tidy-up round that reads a
 * control as redundant because its row agrees with the shipped row would be
 * deleting exactly the thing that agreement is evidence of.
 *
 *   - `engagementEagerTurnaroundControl` is the SOLE producer of the
 *     `dismiss-manager` decision kind. Measured: 41 of 41 events come from
 *     this wiring on the `'redemptive'` policy, and no other pair produces
 *     the arm. Deleting it takes `EXPECTED_RUN_ARMS['run:dismiss-manager']`
 *     to zero and reddens the arm census's set equality.
 *   - `withinHorizonRepeatStrikeControl` and `withinHorizonSlumpControl` each
 *     read IDENTICAL to `withinHorizon` on every counter on this domain, and
 *     that equality is the measurement rather than a redundancy —
 *     `management.ts` header §4 has the derivation of why both removed
 *     mechanisms stopped biting here once the crossing moved. The rows are
 *     asserted as equalities on purpose, so a change that revives either
 *     mechanism within the horizon is read instead of silently absorbed.
 *     Delete them and there is nothing left to notice the revival.
 */
const FAMILY_WIRING: Readonly<Record<FamilyKey, ManagementWiringKey>> = Object.freeze({
  pureAbsence: 'shipped',
  pureAbsenceWallClockControl: 'wall-clock-wear-control',
  pureAbsenceStrikeControl: 'absence-strike-control',
  withinHorizon: 'shipped',
  // MUST NOT DELETE — see the equality argument above.
  withinHorizonRepeatStrikeControl: 'repeat-strike-control',
  // MUST NOT DELETE — see the equality argument above.
  withinHorizonSlumpControl: 'failure-slump-control',
  withinHorizonConditionGatedControl: 'condition-gated-prompt-control',
  engagement: 'shipped',
  engagementRepeatStrikeControl: 'repeat-strike-control',
  engagementVisitFeeControl: 'visit-fee-control',
  engagementSlumpControl: 'failure-slump-control',
  engagementConditionGatedControl: 'condition-gated-prompt-control',
  // MUST NOT DELETE — sole producer of the `dismiss-manager` decision kind.
  engagementEagerTurnaroundControl: 'eager-turnaround-control',
});

interface FamilyTally {
  pairs: number;
  comparedReadings: number;
  bankedMismatches: number;
  conditionMismatches: number;
  moneyMismatches: number;
  failureMismatches: number;
  reviewsOfferedMismatches: number;
  variantConditionLower: number;
  variantDeductedMore: number;
  variantPhaseWorse: number;
  variantNetLower: number;
  matchedTraceFailureMismatches: number;
  /** Net-lower readings on pairs whose realized decision traces are equal. */
  matchedTraceNetLower: number;
  matchedTracePairs: number;
  divergentTracePairs: number;
}

/**
 * The per-policy row: GDD §5.13's three quantities in both their symmetric and
 * their directional form, plus the money reading the never-punish rule is
 * actually about. Seven numbers per policy per family, so a residual that
 * lives in one model of a player reads as that rather than as a property of
 * the design — the split `engagement.ts` uses for its own sixth policy.
 */
interface PolicyRow {
  /** CONDITION, symmetric. */
  conditionMismatches: number;
  /** CONDITION, directional: the variant's mean condition strictly lower. */
  variantConditionLower: number;
  /** INCOME DEDUCTED, directional: the variant's running deduction ahead. */
  variantDeductedMore: number;
  /** FAILURE PROGRESSION, symmetric. */
  failureMismatches: number;
  /** FAILURE PROGRESSION, directional: the variant's phase ranks worse. */
  variantPhaseWorse: number;
  /** FAILURE PROGRESSION on pairs whose decision traces are identical. */
  matchedTraceFailureMismatches: number;
  /** REVIEW ARRIVAL: readings where the running review counts differ. */
  reviewsOfferedMismatches: number;
  /** MONEY: readings where the variant's net position is below the base's. */
  variantNetLower: number;
}

interface FamilySplit {
  all: FamilyTally;
  byPolicy: Record<ManagementPolicy, PolicyRow>;
}

function emptyFamily(): FamilyTally {
  return {
    pairs: 0,
    comparedReadings: 0,
    bankedMismatches: 0,
    conditionMismatches: 0,
    moneyMismatches: 0,
    failureMismatches: 0,
    reviewsOfferedMismatches: 0,
    variantConditionLower: 0,
    variantDeductedMore: 0,
    variantPhaseWorse: 0,
    variantNetLower: 0,
    matchedTraceFailureMismatches: 0,
    matchedTraceNetLower: 0,
    matchedTracePairs: 0,
    divergentTracePairs: 0,
  };
}

function emptyPolicyRow(): PolicyRow {
  return {
    conditionMismatches: 0,
    variantConditionLower: 0,
    variantDeductedMore: 0,
    failureMismatches: 0,
    variantPhaseWorse: 0,
    matchedTraceFailureMismatches: 0,
    reviewsOfferedMismatches: 0,
    variantNetLower: 0,
  };
}

function emptySplit(): FamilySplit {
  const byPolicy = {} as Record<ManagementPolicy, PolicyRow>;
  for (const policy of MANAGEMENT_POLICIES) byPolicy[policy] = emptyPolicyRow();
  return { all: emptyFamily(), byPolicy };
}

function addPair(split: FamilySplit, policy: ManagementPolicy, divergence: PairDivergence): void {
  const tally = split.all;
  tally.pairs += 1;
  tally.comparedReadings += divergence.comparedReadings;
  tally.bankedMismatches += divergence.bankedMismatches;
  tally.conditionMismatches += divergence.conditionMismatches;
  tally.moneyMismatches += divergence.moneyMismatches;
  tally.failureMismatches += divergence.failureMismatches;
  tally.reviewsOfferedMismatches += divergence.reviewsOfferedMismatches;
  tally.variantConditionLower += divergence.variantConditionLower;
  tally.variantDeductedMore += divergence.variantDeductedMore;
  tally.variantPhaseWorse += divergence.variantPhaseWorse;
  tally.variantNetLower += divergence.variantNetLower;
  if (divergence.tracesMatch) {
    tally.matchedTraceFailureMismatches += divergence.failureMismatches;
    tally.matchedTraceNetLower += divergence.variantNetLower;
    tally.matchedTracePairs += 1;
  } else {
    tally.divergentTracePairs += 1;
  }

  const row = split.byPolicy[policy];
  row.conditionMismatches += divergence.conditionMismatches;
  row.variantConditionLower += divergence.variantConditionLower;
  row.variantDeductedMore += divergence.variantDeductedMore;
  row.failureMismatches += divergence.failureMismatches;
  row.variantPhaseWorse += divergence.variantPhaseWorse;
  row.reviewsOfferedMismatches += divergence.reviewsOfferedMismatches;
  row.variantNetLower += divergence.variantNetLower;
  if (divergence.tracesMatch) row.matchedTraceFailureMismatches += divergence.failureMismatches;
}

interface SweepMeasurement {
  readonly families: Record<FamilyKey, FamilySplit>;
  readonly hiringNet: {
    pairs: number;
    netLowerWithMatchingManagers: number;
    netLowerWithDivergentManagers: number;
  };
  readonly hiringNetWithoutAssetTerm: {
    pairs: number;
    netLowerWithMatchingManagers: number;
    netLowerWithDivergentManagers: number;
    /**
     * The same measurement counted in READINGS rather than in pairs. Both
     * units are kept because the shipped `hiringNet` counts pairs and a
     * reader comparing this control against it needs the same unit, while a
     * reader asking how big the effect is needs the other — and a number
     * quoted without its unit is how two rounds end up disagreeing about a
     * measurement neither of them re-took.
     */
    readingsLower: number;
  };
  readonly domain: {
    runs: number;
    checkIns: number;
    promptsOffered: number;
    promptsAlreadyRefused: number;
    strikesRecorded: number;
    runsThatFailed: number;
    runsThatRecovered: number;
    autoRepairs: number;
    autoRepairsReopeningRefusedOrders: number;
    autoRepairsReopeningRefusedOrdersOnShipped: number;
    hires: number;
    declines: number;
    uncountedDeclines: number;
    countedDismissals: number;
    controlStrikes: number;
    controlCharges: number;
    controlSlumps: number;
    controlRepeatStrikes: number;
  };
  readonly safety: {
    negativePurses: number;
    acceleratedTouched: number;
    wageShortfalls: number;
  };
}

const runMemo = new Map<string, ManagedRun>();
let memoMeasurement: SweepMeasurement | null = null;
let memoArms: Map<string, number> | null = null;

function recordRun(run: ManagedRun, measurement: SweepMeasurement): void {
  measurement.domain.runs += 1;
  measurement.domain.checkIns += run.census.checkIns;
  measurement.domain.promptsOffered += run.census.promptsOffered;
  measurement.domain.promptsAlreadyRefused += run.census.promptsAlreadyRefused;
  measurement.domain.strikesRecorded += run.state.strikes.length;
  if (run.census.failedAtCheckIn !== null) measurement.domain.runsThatFailed += 1;
  if (run.census.recoveries > 0) measurement.domain.runsThatRecovered += 1;
  measurement.domain.autoRepairs += run.census.autoRepairs;
  measurement.domain.autoRepairsReopeningRefusedOrders +=
    run.census.autoRepairsReopeningRefusedOrders;
  if (run.wiring.key === SHIPPED_MANAGEMENT_WIRING) {
    measurement.domain.autoRepairsReopeningRefusedOrdersOnShipped +=
      run.census.autoRepairsReopeningRefusedOrders;
  }
  measurement.domain.hires += run.census.hires;
  measurement.domain.declines += run.census.declines;
  measurement.domain.uncountedDeclines += run.census.uncountedDeclines;
  measurement.domain.countedDismissals += run.census.countedDismissals;
  measurement.domain.controlStrikes += run.census.controlStrikes;
  measurement.domain.controlCharges += run.census.controlCharges;
  measurement.domain.controlSlumps += run.census.controlSlumps;
  measurement.domain.controlRepeatStrikes += run.census.controlRepeatStrikes;
  measurement.safety.wageShortfalls += run.census.wageShortfalls;
  if (run.state.gym.ladder.gymBucks < 0) measurement.safety.negativePurses += 1;
  if (run.state.gym.acceleratedGymBucks !== 0) measurement.safety.acceleratedTouched += 1;
}

function runOf(
  times: readonly number[],
  policy: ManagementPolicy,
  wiringKey: ManagementWiringKey,
  measurement: SweepMeasurement,
): ManagedRun {
  const key = `${policy}/${wiringKey}/${times.join('.')}`;
  const held = runMemo.get(key);
  if (held !== undefined) return held;
  const wiring = chargesVisitFee(wiringKey)
    ? managementWiring(wiringKey, MANAGEMENT_SWEEP.VISIT_FEE_GYM_BUCKS)
    : slumpsOnFailure(wiringKey)
      ? managementWiring(wiringKey, 0, MANAGEMENT_SWEEP.FAILURE_SLUMP_CONTROL_CONDITION)
      : managementWiring(wiringKey, 0);
  const run = runManagedGym(times, policy, wiring);
  runMemo.set(key, run);
  recordRun(run, measurement);
  return run;
}

function measureSweep(): SweepMeasurement {
  if (memoMeasurement !== null) return memoMeasurement;
  const families = {} as Record<FamilyKey, FamilySplit>;
  for (const key of FAMILY_KEYS) families[key] = emptySplit();
  const measurement: SweepMeasurement = {
    families,
    hiringNet: { pairs: 0, netLowerWithMatchingManagers: 0, netLowerWithDivergentManagers: 0 },
    hiringNetWithoutAssetTerm: {
      pairs: 0,
      netLowerWithMatchingManagers: 0,
      netLowerWithDivergentManagers: 0,
      readingsLower: 0,
    },
    domain: {
      runs: 0,
      checkIns: 0,
      promptsOffered: 0,
      promptsAlreadyRefused: 0,
      strikesRecorded: 0,
      runsThatFailed: 0,
      runsThatRecovered: 0,
      autoRepairs: 0,
      autoRepairsReopeningRefusedOrders: 0,
      autoRepairsReopeningRefusedOrdersOnShipped: 0,
      hires: 0,
      declines: 0,
      uncountedDeclines: 0,
      countedDismissals: 0,
      controlStrikes: 0,
      controlCharges: 0,
      controlSlumps: 0,
      controlRepeatStrikes: 0,
    },
    safety: { negativePurses: 0, acceleratedTouched: 0, wageShortfalls: 0 },
  };

  /** Drive one pair into one family under every policy. Per-index comparator. */
  const perIndexFamily = (
    key: FamilyKey,
    baseTimes: readonly number[],
    variantTimes: readonly number[],
  ): void => {
    for (const policy of MANAGEMENT_POLICIES) {
      addPair(
        measurement.families[key],
        policy,
        comparePerIndex(
          runOf(baseTimes, policy, FAMILY_WIRING[key], measurement),
          runOf(variantTimes, policy, FAMILY_WIRING[key], measurement),
        ),
      );
    }
  };

  /** The same, at shared times — the engagement domain's comparator. */
  const sharedTimeFamily = (
    key: FamilyKey,
    baseTimes: readonly number[],
    variantTimes: readonly number[],
  ): void => {
    for (const policy of MANAGEMENT_POLICIES) {
      addPair(
        measurement.families[key],
        policy,
        compareAtSharedTimes(
          runOf(baseTimes, policy, FAMILY_WIRING[key], measurement),
          runOf(variantTimes, policy, FAMILY_WIRING[key], measurement),
        ),
      );
    }
  };

  for (const seed of MANAGEMENT_SWEEP.SEEDS) {
    for (let index = 0; index < MANAGEMENT_SWEEP.SCHEDULES_PER_SEED; index += 1) {
      const gaps = gapScheduleAt(seed, index);

      // Pure absence: enlarge gaps that are already at or beyond the horizon.
      const eligible = gaps
        .map((gap, at) => (gap >= HORIZON_SECONDS ? at : -1))
        .filter((at) => at >= 0)
        .slice(0, MANAGEMENT_SWEEP.PURE_ABSENCE_PAIRS_PER_SCHEDULE);
      for (const gapAt of eligible) {
        for (const extra of MANAGEMENT_SWEEP.PURE_ABSENCE_EXTRA_SECONDS) {
          const moreAbsent = timesOf(moreAbsentBy(gaps, gapAt, extra));
          const baseTimes = timesOf(gaps);
          perIndexFamily('pureAbsence', baseTimes, moreAbsent);
          perIndexFamily('pureAbsenceWallClockControl', baseTimes, moreAbsent);
          perIndexFamily('pureAbsenceStrikeControl', baseTimes, moreAbsent);
        }
      }
    }

    // Engagement: fixed grids, one extra check-in.
    for (let index = 0; index < MANAGEMENT_SWEEP.GRID_SCHEDULES_PER_SEED; index += 1) {
      const attended = gridAt(seed, index);
      const baseTimes = gridTimes(attended);
      const unattended = attended
        .map((present, slot) => (present ? -1 : slot))
        .filter((slot) => slot >= 0)
        .filter((_, position) => position % MANAGEMENT_SWEEP.GRID_FLIP_STRIDE === 0);
      for (const slot of unattended) {
        const flipped = attended.map((present, at) => (at === slot ? true : present));
        const moreEngaged = gridTimes(flipped);
        sharedTimeFamily('engagement', baseTimes, moreEngaged);
        sharedTimeFamily('engagementRepeatStrikeControl', baseTimes, moreEngaged);
        sharedTimeFamily('engagementVisitFeeControl', baseTimes, moreEngaged);
        sharedTimeFamily('engagementSlumpControl', baseTimes, moreEngaged);
        sharedTimeFamily('engagementConditionGatedControl', baseTimes, moreEngaged);
        sharedTimeFamily('engagementEagerTurnaroundControl', baseTimes, moreEngaged);

        for (const policy of MANAGEMENT_SWEEP.HIRING_POLICIES) {
          const base = runOf(baseTimes, policy as ManagementPolicy, 'shipped', measurement);
          const variant = runOf(moreEngaged, policy as ManagementPolicy, 'shipped', measurement);
          const divergence = compareAtSharedTimes(base, variant);
          measurement.hiringNet.pairs += 1;
          measurement.hiringNetWithoutAssetTerm.pairs += 1;
          const managersMatch =
            base.state.manager?.tier === variant.state.manager?.tier &&
            base.census.hires === variant.census.hires;
          if (divergence.variantNetLower > 0) {
            if (managersMatch) measurement.hiringNet.netLowerWithMatchingManagers += 1;
            else measurement.hiringNet.netLowerWithDivergentManagers += 1;
          }
          // The same comparison with `netPosition`'s manager term taken back
          // out — the position the readings would carry if that term had
          // never been added. Pinned beside the zeros above so the zeros have
          // a number to be zero against, which they did not until now: the
          // term was argued for in a docstring and measured by nobody.
          const untermedLower = untermedNetLowerReadings(base, variant);
          measurement.hiringNetWithoutAssetTerm.readingsLower += untermedLower;
          if (untermedLower > 0) {
            if (managersMatch) {
              measurement.hiringNetWithoutAssetTerm.netLowerWithMatchingManagers += 1;
            } else {
              measurement.hiringNetWithoutAssetTerm.netLowerWithDivergentManagers += 1;
            }
          }
        }
      }
    }
  }

  // Absence inside the catch-up horizon: enlarge a sub-horizon gap so it stays
  // at or under the horizon. Walked through the shared key generator, which is
  // also what the residual's attribution test walks.
  for (const [seed, index, gapAt, extra] of withinHorizonPairKeys()) {
    const gaps = gapScheduleAt(seed, index);
    const baseTimes = timesOf(gaps);
    const moreAbsent = timesOf(moreAbsentBy(gaps, gapAt, extra));
    perIndexFamily('withinHorizon', baseTimes, moreAbsent);
    perIndexFamily('withinHorizonRepeatStrikeControl', baseTimes, moreAbsent);
    perIndexFamily('withinHorizonSlumpControl', baseTimes, moreAbsent);
    perIndexFamily('withinHorizonConditionGatedControl', baseTimes, moreAbsent);
  }

  // The directed long run — see `DIRECTED_RUN_CHECK_INS` for why it is here
  // and not in the arm census: folding it in keeps the domain census a count
  // of everything the battery drove, in one place and in one order.
  runOf(
    directedRunTimes(),
    MANAGEMENT_SWEEP.DIRECTED_RUN_POLICY as ManagementPolicy,
    'shipped',
    measurement,
  );

  memoMeasurement = measurement;
  return measurement;
}

/**
 * The pinned outcome of the whole sweep. Zeros are the property; the non-zero
 * rows are the controls the zeros are zeros against, and the domain block is
 * the non-vacuity census — counts of what the sweep actually produced, pinned
 * exactly so an empty domain reports itself.
 *
 * ===========================================================================
 * WHAT THE THREE GDD QUANTITIES ARE, AND WHERE EACH ONE IS PINNED
 * ===========================================================================
 *
 * `docs/GDD.md` §5.13's stage-4 stanza states the check in three quantities:
 * two histories identical except that one has MORE absence must never differ
 * *in condition, in income deducted, or in failure progression*. Those three
 * map onto `PairDivergence` exactly, and every family carries all of them
 * twice over — once for the family as a whole and once per policy:
 *
 *   - CONDITION. `conditionMismatches` counts readings where the two runs'
 *     mean condition differs at all, in either direction.
 *     `variantConditionLower` counts the directional half.
 *   - INCOME DEDUCTED. `variantDeductedMore` counts readings at which the
 *     variant's RUNNING TOTAL of income deducted has passed the base's. It is
 *     cumulative rather than per-reading on purpose — §5.7's auto-deduction
 *     is a running charge, and a single reading deducting more says nothing
 *     if an earlier one deducted less.
 *   - FAILURE PROGRESSION. `failureMismatches` counts readings where the
 *     phase or the strike count differs; `variantPhaseWorse` counts the
 *     directional half; `matchedTraceFailureMismatches` is the same count
 *     restricted to pairs whose realized decision traces are identical.
 *
 * `variantNetLower` is a fourth quantity the GDD does not name, kept because
 * it is the one the never-punish rule is actually about — a player is
 * punished in money, not in a condition reading.
 *
 * `reviewsOfferedMismatches` is a fifth, and it is the MECHANISM rather than
 * an outcome: it counts readings at which the two runs' running totals of
 * maintenance reviews offered differ. It is here because the round that keyed
 * the review to the check-in ordinal needs its claim stated in the
 * mechanism's own terms, not as an outcome that happens to be zero.
 *
 * ===========================================================================
 * WHAT THIS ROUND MOVED, AND THE ONE PRICE IT PAID
 * ===========================================================================
 *
 * The §5.13 wear-basis ruling asked for within-horizon failure progression to
 * read ZERO on all six policies, matched-trace included. IT NOW DOES:
 * `withinHorizon.all` reads 0 / 0 / 0 on `failureMismatches`,
 * `variantPhaseWorse` and `matchedTraceFailureMismatches`, and every one of
 * the six `byPolicy` rows reads 0 on all three.
 *
 * The number those zeros are zeros against is `withinHorizonConditionGatedControl`,
 * the removed condition-gated review run over the same 864 pairs and the same
 * six policies on this tree: 310 / 186 / 124, with `variantNetLower` 923.
 *
 * WHAT IT COST, stated at the pin rather than in a summary. Three things
 * moved and none of them is hidden:
 *
 *   - `withinHorizon.variantNetLower` fell 923 -> 421, and all 421 are
 *     `delegating` — the manager wage, charged per banked hour, which
 *     `withinHorizonAttribution` decomposes.
 *   - `engagement`'s failure counters FELL rather than rose: 1187 -> 909 and
 *     730 -> 524, read against `engagementConditionGatedControl`, which is
 *     the old gate on the same grids. That was not the predicted direction
 *     and it is recorded because it was not.
 *   - `engagement.variantNetLower` would have gone 0 -> 36 had the
 *     `'redemptive'` model kept shedding a manager the engine never asked it
 *     to shed. It reads 0, and the old model is kept runnable as
 *     `engagementEagerTurnaroundControl`, pinned at 36. `management.ts`
 *     header §3d has the whole measurement.
 *
 * `review` below is the split that says WHY the within-horizon zero is zero,
 * and it is measured off a reported field rather than off a recomputation of
 * the cadence.
 */
const EXPECTED_SWEEP = Object.freeze({
  families: Object.freeze({
    pureAbsence: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 0,
        conditionMismatches: 0,
        moneyMismatches: 0,
        failureMismatches: 0,
        reviewsOfferedMismatches: 0,
        variantConditionLower: 0,
        variantDeductedMore: 0,
        variantPhaseWorse: 0,
        variantNetLower: 0,
        matchedTraceFailureMismatches: 0,
        matchedTraceNetLower: 0,
        matchedTracePairs: 864,
        divergentTracePairs: 0,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 0,
          variantConditionLower: 0,
          variantDeductedMore: 0,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 0,
          variantConditionLower: 0,
          variantDeductedMore: 0,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 0,
          variantConditionLower: 0,
          variantDeductedMore: 0,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 0,
          variantConditionLower: 0,
          variantDeductedMore: 0,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
        delegating: Object.freeze({
          conditionMismatches: 0,
          variantConditionLower: 0,
          variantDeductedMore: 0,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 0,
          variantConditionLower: 0,
          variantDeductedMore: 0,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
      }),
    }),
    pureAbsenceWallClockControl: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 0,
        conditionMismatches: 19031,
        moneyMismatches: 32556,
        failureMismatches: 1623,
        reviewsOfferedMismatches: 0,
        variantConditionLower: 17668,
        variantDeductedMore: 30364,
        variantPhaseWorse: 0,
        variantNetLower: 32217,
        matchedTraceFailureMismatches: 0,
        matchedTraceNetLower: 23185,
        matchedTracePairs: 617,
        divergentTracePairs: 247,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2696,
          variantConditionLower: 2696,
          variantDeductedMore: 5426,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 5426,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2152,
          variantConditionLower: 1340,
          variantDeductedMore: 4477,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 5403,
        }),
        negligent: Object.freeze({
          conditionMismatches: 4676,
          variantConditionLower: 4676,
          variantDeductedMore: 5426,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 5426,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 5246,
          variantConditionLower: 5246,
          variantDeductedMore: 4226,
          failureMismatches: 1623,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 5174,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2261,
          variantConditionLower: 1710,
          variantDeductedMore: 5383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 5362,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2000,
          variantConditionLower: 2000,
          variantDeductedMore: 5426,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 5426,
        }),
      }),
    }),
    pureAbsenceStrikeControl: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 0,
        conditionMismatches: 16499,
        moneyMismatches: 23013,
        failureMismatches: 29384,
        reviewsOfferedMismatches: 0,
        variantConditionLower: 1062,
        variantDeductedMore: 19572,
        variantPhaseWorse: 3923,
        variantNetLower: 20896,
        matchedTraceFailureMismatches: 18848,
        matchedTraceNetLower: 10908,
        matchedTracePairs: 525,
        divergentTracePairs: 339,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 4283,
          variantConditionLower: 0,
          variantDeductedMore: 4283,
          failureMismatches: 5426,
          variantPhaseWorse: 779,
          matchedTraceFailureMismatches: 5426,
          reviewsOfferedMismatches: 0,
          variantNetLower: 4283,
        }),
        diligent: Object.freeze({
          conditionMismatches: 1815,
          variantConditionLower: 0,
          variantDeductedMore: 4283,
          failureMismatches: 5426,
          variantPhaseWorse: 779,
          matchedTraceFailureMismatches: 2109,
          reviewsOfferedMismatches: 0,
          variantNetLower: 4283,
        }),
        negligent: Object.freeze({
          conditionMismatches: 3973,
          variantConditionLower: 0,
          variantDeductedMore: 3973,
          failureMismatches: 5426,
          variantPhaseWorse: 580,
          matchedTraceFailureMismatches: 5426,
          reviewsOfferedMismatches: 0,
          variantNetLower: 3973,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 2002,
          variantConditionLower: 0,
          variantDeductedMore: 2002,
          failureMismatches: 5426,
          variantPhaseWorse: 225,
          matchedTraceFailureMismatches: 4092,
          reviewsOfferedMismatches: 0,
          variantNetLower: 2002,
        }),
        delegating: Object.freeze({
          conditionMismatches: 1801,
          variantConditionLower: 44,
          variantDeductedMore: 4283,
          failureMismatches: 5426,
          variantPhaseWorse: 779,
          matchedTraceFailureMismatches: 1715,
          reviewsOfferedMismatches: 0,
          variantNetLower: 4283,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2625,
          variantConditionLower: 1018,
          variantDeductedMore: 748,
          failureMismatches: 2254,
          variantPhaseWorse: 781,
          matchedTraceFailureMismatches: 80,
          reviewsOfferedMismatches: 0,
          variantNetLower: 2072,
        }),
      }),
    }),
    withinHorizon: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 864,
        conditionMismatches: 18756,
        moneyMismatches: 26028,
        failureMismatches: 1401,
        reviewsOfferedMismatches: 7662,
        variantConditionLower: 15946,
        variantDeductedMore: 23745,
        variantPhaseWorse: 582,
        variantNetLower: 1301,
        matchedTraceFailureMismatches: 224,
        matchedTraceNetLower: 175,
        matchedTracePairs: 598,
        divergentTracePairs: 266,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 4338,
          variantConditionLower: 4338,
          variantDeductedMore: 4338,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2714,
          variantConditionLower: 2060,
          variantDeductedMore: 3683,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 3766,
          variantConditionLower: 3188,
          variantDeductedMore: 4002,
          failureMismatches: 228,
          variantPhaseWorse: 124,
          matchedTraceFailureMismatches: 32,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 578,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 2662,
          variantConditionLower: 2197,
          variantDeductedMore: 4240,
          failureMismatches: 127,
          variantPhaseWorse: 55,
          matchedTraceFailureMismatches: 14,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 465,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2605,
          variantConditionLower: 1940,
          variantDeductedMore: 3749,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 2,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2671,
          variantConditionLower: 2223,
          variantDeductedMore: 3733,
          failureMismatches: 1046,
          variantPhaseWorse: 403,
          matchedTraceFailureMismatches: 178,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 256,
        }),
      }),
    }),
    withinHorizonRepeatStrikeControl: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 864,
        conditionMismatches: 18756,
        moneyMismatches: 26028,
        failureMismatches: 3600,
        reviewsOfferedMismatches: 7662,
        variantConditionLower: 15946,
        variantDeductedMore: 23745,
        variantPhaseWorse: 582,
        variantNetLower: 1301,
        matchedTraceFailureMismatches: 633,
        matchedTraceNetLower: 175,
        matchedTracePairs: 598,
        divergentTracePairs: 266,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 4338,
          variantConditionLower: 4338,
          variantDeductedMore: 4338,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2714,
          variantConditionLower: 2060,
          variantDeductedMore: 3683,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 3766,
          variantConditionLower: 3188,
          variantDeductedMore: 4002,
          failureMismatches: 1268,
          variantPhaseWorse: 124,
          matchedTraceFailureMismatches: 226,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 578,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 2662,
          variantConditionLower: 2197,
          variantDeductedMore: 4240,
          failureMismatches: 1286,
          variantPhaseWorse: 55,
          matchedTraceFailureMismatches: 229,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 465,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2605,
          variantConditionLower: 1940,
          variantDeductedMore: 3749,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 2,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2671,
          variantConditionLower: 2223,
          variantDeductedMore: 3733,
          failureMismatches: 1046,
          variantPhaseWorse: 403,
          matchedTraceFailureMismatches: 178,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 256,
        }),
      }),
    }),
    withinHorizonSlumpControl: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 864,
        conditionMismatches: 18767,
        moneyMismatches: 26028,
        failureMismatches: 1401,
        reviewsOfferedMismatches: 7662,
        variantConditionLower: 15937,
        variantDeductedMore: 23745,
        variantPhaseWorse: 582,
        variantNetLower: 1460,
        matchedTraceFailureMismatches: 224,
        matchedTraceNetLower: 196,
        matchedTracePairs: 598,
        divergentTracePairs: 266,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 4338,
          variantConditionLower: 4338,
          variantDeductedMore: 4338,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2714,
          variantConditionLower: 2060,
          variantDeductedMore: 3683,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 3766,
          variantConditionLower: 3187,
          variantDeductedMore: 4002,
          failureMismatches: 228,
          variantPhaseWorse: 124,
          matchedTraceFailureMismatches: 32,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 609,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 2662,
          variantConditionLower: 2196,
          variantDeductedMore: 4240,
          failureMismatches: 127,
          variantPhaseWorse: 55,
          matchedTraceFailureMismatches: 14,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 488,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2605,
          variantConditionLower: 1940,
          variantDeductedMore: 3749,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 2,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2682,
          variantConditionLower: 2216,
          variantDeductedMore: 3733,
          failureMismatches: 1046,
          variantPhaseWorse: 403,
          matchedTraceFailureMismatches: 178,
          reviewsOfferedMismatches: 1277,
          variantNetLower: 361,
        }),
      }),
    }),
    withinHorizonConditionGatedControl: Object.freeze({
      all: Object.freeze({
        pairs: 864,
        comparedReadings: 34560,
        bankedMismatches: 864,
        conditionMismatches: 21501,
        moneyMismatches: 26028,
        failureMismatches: 310,
        reviewsOfferedMismatches: 1595,
        variantConditionLower: 20692,
        variantDeductedMore: 25121,
        variantPhaseWorse: 186,
        variantNetLower: 923,
        matchedTraceFailureMismatches: 124,
        matchedTraceNetLower: 353,
        matchedTracePairs: 802,
        divergentTracePairs: 62,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 4338,
          variantConditionLower: 4338,
          variantDeductedMore: 4338,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 449,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 3086,
          variantConditionLower: 2993,
          variantDeductedMore: 4066,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 93,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 4284,
          variantConditionLower: 4003,
          variantDeductedMore: 4338,
          failureMismatches: 93,
          variantPhaseWorse: 62,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 449,
          variantNetLower: 281,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 4284,
          variantConditionLower: 3995,
          variantDeductedMore: 4338,
          failureMismatches: 93,
          variantPhaseWorse: 62,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 449,
          variantNetLower: 289,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2297,
          variantConditionLower: 2182,
          variantDeductedMore: 3868,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 297,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 3212,
          variantConditionLower: 3181,
          variantDeductedMore: 4173,
          failureMismatches: 124,
          variantPhaseWorse: 62,
          matchedTraceFailureMismatches: 124,
          reviewsOfferedMismatches: 155,
          variantNetLower: 56,
        }),
      }),
    }),
    engagement: Object.freeze({
      all: Object.freeze({
        pairs: 996,
        comparedReadings: 29520,
        bankedMismatches: 0,
        conditionMismatches: 10337,
        moneyMismatches: 14298,
        failureMismatches: 909,
        reviewsOfferedMismatches: 3588,
        variantConditionLower: 8843,
        variantDeductedMore: 9981,
        variantPhaseWorse: 524,
        variantNetLower: 0,
        matchedTraceFailureMismatches: 507,
        matchedTraceNetLower: 0,
        matchedTracePairs: 710,
        divergentTracePairs: 286,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1785,
          variantDeductedMore: 1547,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 617,
          variantConditionLower: 617,
          variantDeductedMore: 1802,
          failureMismatches: 166,
          variantPhaseWorse: 134,
          matchedTraceFailureMismatches: 110,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 188,
          variantConditionLower: 188,
          variantDeductedMore: 1234,
          failureMismatches: 150,
          variantPhaseWorse: 73,
          matchedTraceFailureMismatches: 101,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1605,
          variantDeductedMore: 1381,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2265,
          variantDeductedMore: 1634,
          failureMismatches: 593,
          variantPhaseWorse: 317,
          matchedTraceFailureMismatches: 296,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
      }),
    }),
    engagementRepeatStrikeControl: Object.freeze({
      all: Object.freeze({
        pairs: 996,
        comparedReadings: 29520,
        bankedMismatches: 0,
        conditionMismatches: 10337,
        moneyMismatches: 14298,
        failureMismatches: 1811,
        reviewsOfferedMismatches: 3588,
        variantConditionLower: 8843,
        variantDeductedMore: 9981,
        variantPhaseWorse: 524,
        variantNetLower: 0,
        matchedTraceFailureMismatches: 1045,
        matchedTraceNetLower: 0,
        matchedTracePairs: 710,
        divergentTracePairs: 286,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1785,
          variantDeductedMore: 1547,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 617,
          variantConditionLower: 617,
          variantDeductedMore: 1802,
          failureMismatches: 579,
          variantPhaseWorse: 134,
          matchedTraceFailureMismatches: 354,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 188,
          variantConditionLower: 188,
          variantDeductedMore: 1234,
          failureMismatches: 639,
          variantPhaseWorse: 73,
          matchedTraceFailureMismatches: 395,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1605,
          variantDeductedMore: 1381,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2265,
          variantDeductedMore: 1634,
          failureMismatches: 593,
          variantPhaseWorse: 317,
          matchedTraceFailureMismatches: 296,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
      }),
    }),
    engagementVisitFeeControl: Object.freeze({
      all: Object.freeze({
        pairs: 996,
        comparedReadings: 29520,
        bankedMismatches: 0,
        conditionMismatches: 8731,
        moneyMismatches: 8956,
        failureMismatches: 441,
        reviewsOfferedMismatches: 3588,
        variantConditionLower: 8731,
        variantDeductedMore: 12232,
        variantPhaseWorse: 358,
        variantNetLower: 8731,
        matchedTraceFailureMismatches: 349,
        matchedTraceNetLower: 8413,
        matchedTracePairs: 888,
        divergentTracePairs: 108,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 2383,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 2383,
        }),
        negligent: Object.freeze({
          conditionMismatches: 617,
          variantConditionLower: 617,
          variantDeductedMore: 1802,
          failureMismatches: 166,
          variantPhaseWorse: 134,
          matchedTraceFailureMismatches: 110,
          reviewsOfferedMismatches: 598,
          variantNetLower: 617,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 348,
          variantConditionLower: 348,
          variantDeductedMore: 1479,
          failureMismatches: 109,
          variantPhaseWorse: 90,
          matchedTraceFailureMismatches: 73,
          reviewsOfferedMismatches: 598,
          variantNetLower: 348,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 2383,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 617,
          variantConditionLower: 617,
          variantDeductedMore: 1802,
          failureMismatches: 166,
          variantPhaseWorse: 134,
          matchedTraceFailureMismatches: 166,
          reviewsOfferedMismatches: 598,
          variantNetLower: 617,
        }),
      }),
    }),
    engagementSlumpControl: Object.freeze({
      all: Object.freeze({
        pairs: 996,
        comparedReadings: 29520,
        bankedMismatches: 0,
        conditionMismatches: 10337,
        moneyMismatches: 14298,
        failureMismatches: 909,
        reviewsOfferedMismatches: 3588,
        variantConditionLower: 8843,
        variantDeductedMore: 9981,
        variantPhaseWorse: 524,
        variantNetLower: 238,
        matchedTraceFailureMismatches: 507,
        matchedTraceNetLower: 112,
        matchedTracePairs: 710,
        divergentTracePairs: 286,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1785,
          variantDeductedMore: 1547,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 617,
          variantConditionLower: 617,
          variantDeductedMore: 1802,
          failureMismatches: 166,
          variantPhaseWorse: 134,
          matchedTraceFailureMismatches: 110,
          reviewsOfferedMismatches: 598,
          variantNetLower: 76,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 188,
          variantConditionLower: 188,
          variantDeductedMore: 1234,
          failureMismatches: 150,
          variantPhaseWorse: 73,
          matchedTraceFailureMismatches: 101,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1605,
          variantDeductedMore: 1381,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2265,
          variantDeductedMore: 1634,
          failureMismatches: 593,
          variantPhaseWorse: 317,
          matchedTraceFailureMismatches: 296,
          reviewsOfferedMismatches: 598,
          variantNetLower: 162,
        }),
      }),
    }),
    engagementConditionGatedControl: Object.freeze({
      all: Object.freeze({
        pairs: 996,
        comparedReadings: 29520,
        bankedMismatches: 0,
        conditionMismatches: 12300,
        moneyMismatches: 14298,
        failureMismatches: 1187,
        reviewsOfferedMismatches: 5127,
        variantConditionLower: 11632,
        variantDeductedMore: 11552,
        variantPhaseWorse: 730,
        variantNetLower: 0,
        matchedTraceFailureMismatches: 447,
        matchedTraceNetLower: 0,
        matchedTracePairs: 652,
        divergentTracePairs: 344,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1399,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2046,
          variantDeductedMore: 1546,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 337,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 1447,
          variantConditionLower: 1447,
          variantDeductedMore: 2261,
          failureMismatches: 360,
          variantPhaseWorse: 248,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1399,
          variantNetLower: 0,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 1321,
          variantConditionLower: 1321,
          variantDeductedMore: 2238,
          failureMismatches: 337,
          variantPhaseWorse: 234,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 1399,
          variantNetLower: 0,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2182,
          variantDeductedMore: 1361,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 0,
          variantNetLower: 0,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2253,
          variantDeductedMore: 1763,
          failureMismatches: 490,
          variantPhaseWorse: 248,
          matchedTraceFailureMismatches: 447,
          reviewsOfferedMismatches: 593,
          variantNetLower: 0,
        }),
      }),
    }),
    engagementEagerTurnaroundControl: Object.freeze({
      all: Object.freeze({
        pairs: 996,
        comparedReadings: 29520,
        bankedMismatches: 0,
        conditionMismatches: 10337,
        moneyMismatches: 14298,
        failureMismatches: 909,
        reviewsOfferedMismatches: 3588,
        variantConditionLower: 8843,
        variantDeductedMore: 9981,
        variantPhaseWorse: 524,
        variantNetLower: 36,
        matchedTraceFailureMismatches: 507,
        matchedTraceNetLower: 21,
        matchedTracePairs: 710,
        divergentTracePairs: 286,
      }),
      byPolicy: Object.freeze({
        'hands-off': Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2383,
          variantDeductedMore: 2383,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        diligent: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1785,
          variantDeductedMore: 1547,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        negligent: Object.freeze({
          conditionMismatches: 617,
          variantConditionLower: 617,
          variantDeductedMore: 1802,
          failureMismatches: 166,
          variantPhaseWorse: 134,
          matchedTraceFailureMismatches: 110,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        cheapskate: Object.freeze({
          conditionMismatches: 188,
          variantConditionLower: 188,
          variantDeductedMore: 1234,
          failureMismatches: 150,
          variantPhaseWorse: 73,
          matchedTraceFailureMismatches: 101,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        delegating: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 1605,
          variantDeductedMore: 1381,
          failureMismatches: 0,
          variantPhaseWorse: 0,
          matchedTraceFailureMismatches: 0,
          reviewsOfferedMismatches: 598,
          variantNetLower: 0,
        }),
        redemptive: Object.freeze({
          conditionMismatches: 2383,
          variantConditionLower: 2265,
          variantDeductedMore: 1634,
          failureMismatches: 593,
          variantPhaseWorse: 317,
          matchedTraceFailureMismatches: 296,
          reviewsOfferedMismatches: 598,
          variantNetLower: 36,
        }),
      }),
    }),
  }),
  hiringNet: Object.freeze({
    pairs: 498,
    netLowerWithMatchingManagers: 0,
    netLowerWithDivergentManagers: 0,
  }),
  hiringNetWithoutAssetTerm: Object.freeze({
    pairs: 498,
    netLowerWithMatchingManagers: 106,
    netLowerWithDivergentManagers: 0,
    readingsLower: 106,
  }),
  /**
   * THE WITHIN-HORIZON MONEY RESIDUAL, decomposed into the six reported terms
   * it is algebraically made of, with the identity's closing error pinned at
   * zero so nothing is absorbed.
   *
   * RE-DERIVED RATHER THAN RE-PINNED BY GUESS, AND IT GREW — 421 -> 1301 —
   * BECAUSE THE ORDINAL IS NO LONGER BLIND TO WHICH RUN BANKED MORE.
   * `management.ts` header §3a's "RE-KEYED, BY HUMAN RULING" replaced a
   * dispatch-count ordinal with a real-banked-seconds one, so a within-horizon
   * gap enlargement (this whole family's domain — see `withinHorizonPairKeys`)
   * now genuinely can move the review onto a different check-in index, not
   * only the money the review's ANSWER spends. `largestTermIncome` carrying
   * 1049 of the 1301 readings — a term that used to read zero here — is that
   * channel showing up directly: a review opening on a different index changes
   * which check-ins are even OFFERED a repair to accept, which moves paid
   * income before any decision is taken. The remaining carriers are
   * `decisionSpend` (183, `'redemptive'`) and `wage` (69, `'delegating'`),
   * both still real but each now a minority of the total rather than the
   * whole of it, and `autoRepair`/`repairBill`/`managerAsset` all now read
   * zero — this residual moved to a different shape of carrier along with
   * the different size.
   */
  withinHorizonAttribution: Object.freeze({
    netLowerReadings: 1301,
    netLowerPairs: 86,
    largestTermIncome: 1049,
    largestTermWage: 69,
    largestTermAutoRepair: 0,
    largestTermDecisionSpend: 183,
    largestTermRepairBill: 0,
    largestTermManagerAsset: 0,
    maxDeficitGymBucks: 1139.82,
    identityErrorGymBucks: 0,
    byPolicy: Object.freeze({
      'hands-off': 0,
      diligent: 0,
      negligent: 578,
      cheapskate: 465,
      delegating: 2,
      redemptive: 256,
    }),
    carriersByPolicy: Object.freeze({
      'hands-off': Object.freeze({
        income: 0,
        wage: 0,
        autoRepair: 0,
        decisionSpend: 0,
        repairBill: 0,
        managerAsset: 0,
      }),
      diligent: Object.freeze({
        income: 0,
        wage: 0,
        autoRepair: 0,
        decisionSpend: 0,
        repairBill: 0,
        managerAsset: 0,
      }),
      negligent: Object.freeze({
        income: 578,
        wage: 0,
        autoRepair: 0,
        decisionSpend: 0,
        repairBill: 0,
        managerAsset: 0,
      }),
      cheapskate: Object.freeze({
        income: 465,
        wage: 0,
        autoRepair: 0,
        decisionSpend: 0,
        repairBill: 0,
        managerAsset: 0,
      }),
      delegating: Object.freeze({
        income: 0,
        wage: 2,
        autoRepair: 0,
        decisionSpend: 0,
        repairBill: 0,
        managerAsset: 0,
      }),
      redemptive: Object.freeze({
        income: 6,
        wage: 67,
        autoRepair: 0,
        decisionSpend: 183,
        repairBill: 0,
        managerAsset: 0,
      }),
    }),
  }),
  /**
   * THE SPLIT THAT USED TO SAY WHY THE WITHIN-HORIZON ZERO WAS ZERO. It no
   * longer is zero — see `management.ts` header §3a's retraction and
   * §3f-equivalent note below. RE-DERIVED, NOT RE-PINNED BY GUESS: every
   * number here was regenerated by re-running this exact walk after the
   * ordinal's re-keying, not adjusted to make a stale claim read true.
   *
   * `withinHorizonShiftedPairs` is now 420 of 864 (up from 0): a within-
   * horizon gap enlargement can now move the review onto a different index,
   * because the ordinal reads genuinely accumulated real banked seconds
   * rather than a dispatch count, and enlarging a within-horizon gap adds to
   * that total in full. `controlPairs`/`controlShiftedPairs` — the removed
   * `condition-gated-prompt-control` comparison — are UNCHANGED at 864/155,
   * because that gate never read `checkInsTaken` and this round did not touch
   * it. So the shipped gate no longer empties the shifted bucket the way it
   * used to; it now sits closer to the control's own shape than to zero.
   */
  review: Object.freeze({
    withinHorizonPairs: 864,
    withinHorizonMatchedPairs: 444,
    withinHorizonShiftedPairs: 420,
    withinHorizonFailureMismatchesOnMatched: 0,
    withinHorizonFailureMismatchesOnShifted: 1401,
    withinHorizonPhaseWorseOnMatched: 0,
    withinHorizonPhaseWorseOnShifted: 582,
    withinHorizonMatchedTracePairs: 598,
    controlPairs: 864,
    controlMatchedPairs: 709,
    controlShiftedPairs: 155,
    controlFailureMismatchesOnMatched: 0,
    controlFailureMismatchesOnShifted: 310,
    controlPhaseWorseOnMatched: 0,
    controlPhaseWorseOnShifted: 186,
    engagementPairs: 996,
    engagementMatchedPairs: 84,
    engagementShiftedPairs: 912,
    engagementFailureMismatchesOnMatched: 1,
    engagementFailureMismatchesOnShifted: 908,
    engagementPhaseWorseOnMatched: 0,
    engagementPhaseWorseOnShifted: 524,
  }),
  // RE-DERIVED, NOT RE-PINNED BY GUESS, after `checkInsTaken` was re-keyed to
  // real banked seconds (`management.ts` header §3a) — regenerated by
  // re-running the sweep, not adjusted by hand. `runs` and `hires` are
  // unchanged (neither reads the ordinal); `controlStrikes`/`controlCharges`
  // are also unchanged (the visit-fee and repeat-strike CONTROL wirings they
  // measure do not gate on `checkInsTaken` either); `controlSlumps` and
  // `controlRepeatStrikes` moved slightly because those two controls still
  // wrap the shipped ordinal-gated review underneath their own added
  // mechanism, so a shift in when a review opens shifts them a little too.
  domain: Object.freeze({
    runs: 13537,
    checkIns: 479324,
    promptsOffered: 90014,
    promptsAlreadyRefused: 24900,
    strikesRecorded: 38067,
    runsThatFailed: 7240,
    runsThatRecovered: 2072,
    autoRepairs: 7470,
    autoRepairsReopeningRefusedOrders: 161,
    autoRepairsReopeningRefusedOrdersOnShipped: 0,
    hires: 6184,
    declines: 20346,
    uncountedDeclines: 11695,
    countedDismissals: 19565,
    controlStrikes: 20424,
    controlCharges: 33774,
    controlSlumps: 1323,
    controlRepeatStrikes: 3414,
  }),
  safety: Object.freeze({
    negativePurses: 0,
    acceleratedTouched: 0,
    wageShortfalls: 0,
  }),
});

// ---------------------------------------------------------------------------
// Fixture builders for the directed arms
// ---------------------------------------------------------------------------

const ITEM_ZERO = EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT[0] as ManagedEquipmentItem;
const ITEM_ONE = EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT[1] as ManagedEquipmentItem;

/**
 * A state with every item at `condition`, the purse at `gymBucks`, and a
 * standing repair order OPEN unless `checkInsTaken` says otherwise.
 */
function gymAt(
  condition: number,
  gymBucks: number,
  checkInsTaken: number = EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN,
): ManagedGym {
  const base = createManagedGym();
  const worn: Record<string, number> = {};
  for (const item of ownedItemsOf(base.gym)) worn[item] = condition;
  return Object.freeze({
    ...base,
    gym: withLadder(base.gym, Object.freeze({ ...base.gym.ladder, gymBucks })),
    condition: Object.freeze(worn) as ManagedGym['condition'],
    // A standing repair order is OPEN on this fixture by default, because the
    // review cadence is an ordinal now and a hand-built state that never
    // checked in has no order raised. `createManagedGym()` is kept as the
    // fixture with the order SHUT, which is what the two `not-offered` /
    // `no-prompt` arms below are driven from, and the third argument is for a
    // fixture that wants the order to open on its OWN next check-in.
    checkInsTaken,
    // Kept consistent with `checkInsTaken`, at the exact window boundary that
    // ordinal represents — `checkInWithWearBasis` now derives `checkInsTaken`
    // FROM this field (`management.ts` header §3a), so a fixture that set one
    // without the other would desync the instant a check-in was fed to it: a
    // hand-set `checkInsTaken` of N with `bankedOperationSeconds` left at the
    // `createManagedGym()` default of 0 would make the NEXT check-in compute
    // its ordinal from 0 banked seconds, not from N windows' worth.
    bankedOperationSeconds: checkInsTaken * HORIZON_SECONDS,
  });
}

/**
 * A dormant state, built by refusing every owned item's standing repair order
 * on a worn gym. One per ITEM and not four on one item, which is the per-order
 * ledger showing up in a fixture: declining the same item again restates the
 * same standing decision and appends nothing. `refusedAllOrders` below is the
 * shared walk, so the two fixtures that need a dormant gym cannot drift apart.
 */
function refusedAllOrders(state: ManagedGym): ManagedGym {
  let refused = state;
  for (const [at, item] of ownedItemsOf(state.gym).entries()) {
    const declined = declineRepair(refused, item, at);
    if (declined.kind !== 'declined') throw new Error(`the fixture could not refuse ${item}`);
    refused = declined.state;
  }
  return refused;
}

/** Read the state off any of this module's discriminated returns. */
function asState(result: { readonly state: ManagedGym }): ManagedGym {
  return result.state;
}

/** Repair every item up to the recovery minimum, so a comeback is affordable. */
function repairedToRecovery(state: ManagedGym): ManagedGym {
  let repaired = state;
  for (const item of ownedItemsOf(repaired.gym)) {
    const outcome = repairEquipment(repaired, item);
    if (outcome.kind === 'repaired') repaired = outcome.state;
  }
  return repaired;
}

function dormantGym(gymBucks: number): ManagedGym {
  const state = refusedAllOrders(gymAt(0.3, gymBucks));
  if (failurePhase(state) !== 'failed') throw new Error('the dormant fixture is not dormant');
  return state;
}

// ---------------------------------------------------------------------------
// The arm census — declared against reached, both directions, counts pinned
// ---------------------------------------------------------------------------

function tally(arms: Map<string, number>, arm: string): void {
  arms.set(arm, (arms.get(arm) ?? 0) + 1);
}

/**
 * Drive the directed battery — every declared arm of every discriminated
 * return, including the ones no simulated policy produces (refusals need a
 * hand-built state) — and fold in the arms the sweep's runs produced.
 */
function armCensus(): Map<string, number> {
  if (memoArms !== null) return memoArms;
  const arms = new Map<string, number>();
  const measurement = measureSweep();

  // Arms the composed runs produced.
  for (const run of runMemo.values()) {
    for (const event of run.decisions) tally(arms, `run:${event.kind}`);
    for (const reading of run.readings) tally(arms, `run-phase:${reading.phase}`);
  }
  // Read the measurement so the census cannot run on an unbuilt sweep.
  if (measurement.domain.runs === 0) throw new Error('the arm census ran before the sweep');

  // repairEquipment.
  const fresh = createManagedGym();
  tally(arms, `repair:${repairEquipment(gymAt(0.5, 10000), ITEM_ZERO).kind}`);
  const repairUnowned = repairEquipment(fresh, 'bike');
  tally(arms, `repair:refused:${repairUnowned.kind === 'refused' ? repairUnowned.reason : ''}`);
  const repairSound = repairEquipment(fresh, ITEM_ZERO);
  tally(arms, `repair:refused:${repairSound.kind === 'refused' ? repairSound.reason : ''}`);
  const repairBroke = repairEquipment(gymAt(0.5, 0), ITEM_ZERO);
  tally(arms, `repair:refused:${repairBroke.kind === 'refused' ? repairBroke.reason : ''}`);

  // declineRepair — both the counted arm and the restated arm the per-order
  // ledger introduces, which no composed policy reaches by a path that would
  // show `counted: false` on a FIRST refusal.
  const declinedOnce = declineRepair(gymAt(0.3, 0), ITEM_ZERO, 0);
  tally(arms, `decline:${declinedOnce.kind}`);
  if (declinedOnce.kind === 'declined') {
    tally(arms, `decline:declined:${declinedOnce.counted ? 'counted' : 'restated'}`);
    const declinedAgain = declineRepair(declinedOnce.state, ITEM_ZERO, 1);
    if (declinedAgain.kind === 'declined') {
      tally(arms, `decline:declined:${declinedAgain.counted ? 'counted' : 'restated'}`);
      expect(declinedAgain.state.strikes.length).toBe(declinedOnce.state.strikes.length);
    }
  }
  const declineUnowned = declineRepair(fresh, 'bike', 0);
  tally(arms, `decline:refused:${declineUnowned.kind === 'refused' ? declineUnowned.reason : ''}`);
  const declineSound = declineRepair(fresh, ITEM_ZERO, 0);
  tally(arms, `decline:refused:${declineSound.kind === 'refused' ? declineSound.reason : ''}`);

  // respondToPrompt.
  tally(arms, `prompt:${respondToPrompt(fresh, 'dismiss', 0).kind}`);
  tally(arms, `prompt:${respondToPrompt(gymAt(0.3, 10000), 'repair', 0).kind}`);
  const promptBroke = respondToPrompt(gymAt(0.3, 0), 'repair', 0);
  tally(arms, `prompt:${promptBroke.kind}`);
  if (promptBroke.kind === 'repair-refused') {
    tally(arms, `prompt:repair-refused:${promptBroke.reason}`);
  }
  // The arm the ORDINAL review gate introduced: a review raised on a gym whose
  // named item is at full condition has nothing to buy, so answering it with
  // `'repair'` refuses as `already-sound` rather than pretending the purse was
  // short. Unreachable from any composed run — every one of them banks
  // operation before its first review — so it is driven from a hand-built
  // state, which is what `MAINTENANCE_ORDER_FIRST_CHECK_IN`'s floor of 1
  // keeps true of the shipped path.
  const promptSound = respondToPrompt(gymAt(1, 10000), 'repair', 0);
  tally(arms, `prompt:${promptSound.kind}`);
  if (promptSound.kind === 'repair-refused') {
    tally(arms, `prompt:repair-refused:${promptSound.reason}`);
    expect(promptSound.cost).toBe(0);
  }
  const freeDismiss = respondToPrompt(gymAt(0.3, 0), 'dismiss', 0);
  if (freeDismiss.kind === 'dismissed') {
    tally(arms, `prompt:dismissed:${freeDismiss.counted ? 'counted' : 'free'}`);
    const again = respondToPrompt(freeDismiss.state, 'dismiss', 1);
    if (again.kind === 'dismissed') {
      tally(arms, `prompt:dismissed:${again.counted ? 'counted' : 'free'}`);
    }
  }

  // maintenancePrompt.
  tally(arms, `prompt-read:${maintenancePrompt(fresh).kind}`);
  const offered = maintenancePrompt(gymAt(0.3, 0));
  if (offered.kind === 'offered') {
    tally(arms, `prompt-read:offered:${offered.dismissalWouldCount ? 'counts' : 'free'}`);
  }
  const offeredCounting = maintenancePrompt(
    Object.freeze({
      ...gymAt(0.3, 0),
      promptDismissals: EMPIRE_TUNING.MAINTENANCE_PROMPT_FREE_DISMISSALS,
    }),
  );
  if (offeredCounting.kind === 'offered') {
    tally(arms, `prompt-read:offered:${offeredCounting.dismissalWouldCount ? 'counts' : 'free'}`);
    tally(arms, `prompt-read:refused:${offeredCounting.alreadyRefused ? 'again' : 'fresh'}`);
  }
  // The prompt on a gym whose every standing order has been refused: still
  // SHOWN — §5.7's clarification allows exactly that — and countable by
  // nothing. Reached by no composed run's first prompt, so it is directed.
  const allRefused = refusedAllOrders(gymAt(0.3, 0));
  expect(unansweredItems(allRefused)).toEqual([]);
  expect(isNeglected(allRefused, ITEM_ZERO)).toBe(true);
  const promptAllRefused = maintenancePrompt(allRefused);
  if (promptAllRefused.kind === 'offered') {
    tally(arms, `prompt-read:refused:${promptAllRefused.alreadyRefused ? 'again' : 'fresh'}`);
    expect(promptAllRefused.dismissalWouldCount).toBe(false);
  }

  // hireManager.
  const hiredClean = hireManager(gymAt(1, 10000), 'novice', 0);
  if (hiredClean.kind === 'hired') {
    tally(arms, `hire:hired:${hiredClean.countedAsStrike ? 'counted' : 'clean'}`);
    const doubled = hireManager(hiredClean.state, 'steady', 0);
    tally(arms, `hire:refused:${doubled.kind === 'refused' ? doubled.reason : ''}`);
  }
  // The counted hire needs the LEDGER's warning, not a worn gym: a state that
  // has already refused its standing orders.
  const hiredCounted = hireManager(refusedAllOrders(gymAt(0.3, 10000)), 'novice', 9);
  if (hiredCounted.kind === 'hired') {
    tally(arms, `hire:hired:${hiredCounted.countedAsStrike ? 'counted' : 'clean'}`);
  }
  for (const tier of EMPIRE_TUNING.MANAGER_TIERS) {
    const hired = hireManager(gymAt(1, 10000), tier, 0);
    if (hired.kind === 'hired') tally(arms, `hire:tier:${tier}`);
  }
  const hireBroke = hireManager(gymAt(1, 0), 'veteran', 0);
  tally(arms, `hire:refused:${hireBroke.kind === 'refused' ? hireBroke.reason : ''}`);

  // dismissManager.
  if (hiredClean.kind === 'hired') {
    tally(arms, `dismiss:${dismissManager(hiredClean.state).kind}`);
  }
  const dismissNobody = dismissManager(fresh);
  tally(arms, `dismiss:refused:${dismissNobody.kind === 'refused' ? dismissNobody.reason : ''}`);

  // recoverGym and recoveryRequirement.
  const recoverFresh = recoverGym(fresh);
  tally(arms, `recover:${recoverFresh.kind === 'refused' ? recoverFresh.reason : recoverFresh.kind}`);
  tally(arms, `recovery-need:${recoveryRequirement(fresh).kind}`);
  const dormantWorn = dormantGym(100000);
  const needWorn = recoveryRequirement(dormantWorn);
  tally(
    arms,
    `recovery-need:blocked:${needWorn.kind === 'blocked' ? (needWorn.equipmentBelowMinimum ? 'equipment' : '') + (needWorn.managerHiredUnderWarning ? '+manager' : '') : ''}`,
  );
  const recoverWorn = recoverGym(dormantWorn);
  tally(arms, `recover:${recoverWorn.kind === 'refused' ? recoverWorn.reason : recoverWorn.kind}`);
  let repairedUp: ManagedGym = dormantWorn;
  for (const item of ownedItemsOf(repairedUp.gym)) {
    const repaired = repairEquipment(repairedUp, item);
    if (repaired.kind === 'repaired') repairedUp = repaired.state;
  }
  tally(arms, `recovery-need:${recoveryRequirement(repairedUp).kind}`);
  const recovered = recoverGym(repairedUp);
  tally(arms, `recover:${recovered.kind}`);
  // The manager half: a cheap hire under warning, then dormancy.
  const cheapHire = hireManager(refusedAllOrders(gymAt(0.3, 10000)), 'novice', 9);
  if (cheapHire.kind === 'hired' && cheapHire.countedAsStrike) {
    const struck = cheapHire.state;
    if (failurePhase(struck) !== 'failed') throw new Error('the manager fixture is not dormant');
    const needBoth = recoveryRequirement(struck);
    tally(
      arms,
      `recovery-need:blocked:${needBoth.kind === 'blocked' ? (needBoth.equipmentBelowMinimum ? 'equipment' : '') + (needBoth.managerHiredUnderWarning ? '+manager' : '') : ''}`,
    );
    let struckRepaired = struck;
    for (const item of ownedItemsOf(struckRepaired.gym)) {
      const repaired = repairEquipment(struckRepaired, item);
      if (repaired.kind === 'repaired') struckRepaired = repaired.state;
    }
    const needManager = recoveryRequirement(struckRepaired);
    tally(
      arms,
      `recovery-need:blocked:${needManager.kind === 'blocked' ? (needManager.equipmentBelowMinimum ? 'equipment' : '') + (needManager.managerHiredUnderWarning ? '+manager' : '') : ''}`,
    );
    const recoverManager = recoverGym(struckRepaired);
    tally(
      arms,
      `recover:${recoverManager.kind === 'refused' ? recoverManager.reason : recoverManager.kind}`,
    );
  }

  memoArms = arms;
  return arms;
}

/**
 * Every arm the battery must reach, with its exact count — set-equal in both
 * directions against what `armCensus` actually tallied, so a fixture change
 * that stops reaching an arm reddens instead of quietly shrinking coverage,
 * and a new arm cannot arrive uncounted.
 */
const EXPECTED_ARMS: Readonly<Record<string, number>> = Object.freeze({
  'repair:repaired': 1,
  'repair:refused:not-owned': 1,
  'repair:refused:already-sound': 1,
  'repair:refused:not-enough-gym-bucks': 1,
  'decline:declined': 1,
  // The two arms the per-order ledger introduces: a first refusal counts, and
  // a restatement of the same standing order does not.
  'decline:declined:counted': 1,
  'decline:declined:restated': 1,
  'decline:refused:not-owned': 1,
  'decline:refused:not-offered': 1,
  'prompt:no-prompt': 1,
  'prompt:repaired': 1,
  'prompt:repair-refused': 2,
  // The two reasons a review answered with `'repair'` can refuse. The second
  // is new with the ORDINAL review gate: a review raised on a check-in index
  // can name an item with nothing to buy, and saying `already-sound` rather
  // than blaming the purse is the difference between a report and a guess.
  'prompt:repair-refused:not-enough-gym-bucks': 1,
  'prompt:repair-refused:already-sound': 1,
  'prompt:dismissed:free': 1,
  'prompt:dismissed:counted': 1,
  'prompt-read:quiet': 1,
  'prompt-read:offered:free': 1,
  'prompt-read:offered:counts': 1,
  // The prompt is SHOWN on a fresh order and on one already refused; only the
  // first is countable. §5.7's clarification, as two census rows.
  'prompt-read:refused:fresh': 1,
  'prompt-read:refused:again': 1,
  'hire:hired:clean': 1,
  'hire:hired:counted': 1,
  'hire:tier:novice': 1,
  'hire:tier:steady': 1,
  'hire:tier:veteran': 1,
  'hire:refused:already-staffed': 1,
  'hire:refused:not-enough-gym-bucks': 1,
  'dismiss:dismissed': 1,
  'dismiss:refused:no-manager': 1,
  'recover:not-dormant': 1,
  'recover:equipment-below-recovery-minimum': 1,
  'recover:recovered': 1,
  'recover:manager-hired-under-warning': 1,
  'recovery-need:not-dormant': 1,
  'recovery-need:ready': 1,
  'recovery-need:blocked:equipment': 1,
  'recovery-need:blocked:equipment+manager': 1,
  'recovery-need:blocked:+manager': 1,
});

/**
 * The arms the composed runs produced, with their exact counts across the
 * whole battery — measured off the sweep and pinned, so a policy change
 * moves a number a reader signs rather than a coverage nobody re-reads.
 */
// RE-DERIVED, NOT RE-PINNED BY GUESS: every number below (except the two
// noted as unchanged) was regenerated by re-running `armCensus()` over the
// whole battery after `checkInsTaken` was re-keyed to real banked seconds
// (`management.ts` header §3a's "RE-KEYED, BY HUMAN RULING"). The re-keying
// changes WHEN a review opens relative to a run's own check-in count, so it
// moves which decisions a scripted player model takes and when — these
// counts are a direct, expected consequence, not a sign of a broken sweep.
const EXPECTED_RUN_ARMS: Readonly<Record<string, number>> = Object.freeze({
  'run:repair': 11804,
  'run:prompt-repair': 28168,
  'run:prompt-dismiss': 36654,
  'run:decline-repair': 20346,
  // Unchanged by the re-keying: neither hire count reads `checkInsTaken`.
  'run:hire-novice': 2072,
  'run:hire-steady': 2113,
  'run:hire-veteran': 1999,
  // 638 -> 41, and TWO THINGS CHANGED AT ONCE, so the ratio is not an effect
  // size. The first is the model: under the ORDINAL review the `'redemptive'`
  // model sheds only the manager `recoveryRequirement` actually blocks on, so
  // a comeback keeps the steady manager it hired and stops paying for a
  // replacement — the change `management.ts` header §3d measures. On the
  // shipped path that change is total rather than partial: the shipped
  // `'redemptive'` model produces ZERO dismissals over 497 shipped runs.
  //
  // The second is the POPULATION, which the earlier wording of this comment
  // left out. The 638 was the old model running wherever `'redemptive'` runs —
  // every wiring on every family, 2257 runs in this battery. The 41 is one
  // control wiring on one family, 184 of those 2257 runs, so the denominator
  // shrank by a factor of about twelve at the same moment the numerator did.
  // Measured on this tree: every one of the 41 is
  // `'eager-turnaround-control'` x `'redemptive'`, and no other pair of wiring
  // and policy produces the arm at all.
  //
  // MUST NOT DELETE — `engagementEagerTurnaroundControl` is the sole producer
  // of a `ManagedDecisionKind`. Deleting that family, or its wiring, takes
  // this row to zero and reddens the set equality below. That is the coverage
  // the control is carrying on the shipped path's behalf, and it is written
  // here as well as at the family so a tidy-up round reads it from either end.
  // Also unchanged: no wiring or family reads `checkInsTaken` to decide a
  // dismissal, so the re-keying does not touch this one either.
  'run:dismiss-manager': 41,
  'run:recover': 3753,
  'run-phase:sound': 331072,
  'run-phase:warned': 25603,
  'run-phase:failed': 122649,
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('quotes and lookups', () => {
  it('quotes hire costs, wages and auto-repair thresholds off the tuning block', () => {
    for (const tier of EMPIRE_TUNING.MANAGER_TIERS) {
      expect(managerHireCostGymBucks(tier)).toBe(EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[tier]);
      expect(managerWageRatePerBankedHour(tier)).toBe(
        EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR[tier],
      );
      expect(managerAutoRepairCondition(tier)).toBe(
        EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION[tier],
      );
    }
    expect(() => managerHireCostGymBucks('foreman' as ManagerTier)).toThrow(RangeError);
  });

  it('lists owned items in ladder-then-session order', () => {
    const fresh = createManagedGym();
    expect(ownedItemsOf(fresh.gym)).toEqual([...EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT]);
    const rich = withLadder(fresh.gym, Object.freeze({ ...fresh.gym.ladder, gymBucks: 100000 }));
    const bought = buySessionEquipment(rich, 'mats');
    expect(bought.kind).toBe('bought');
    if (bought.kind === 'bought') {
      expect(ownedItemsOf(bought.state)).toEqual([
        ...EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT,
        'mats',
      ]);
    }
  });

  it('reads a condition and refuses an unowned item', () => {
    const fresh = createManagedGym();
    expect(itemCondition(fresh, ITEM_ZERO)).toBe(1);
    expect(() => itemCondition(fresh, 'bike')).toThrow(RangeError);
    expect(meanCondition(fresh)).toBe(1);
    expect(meanCondition(gymAt(0.4, 0))).toBe(0.4);
    expect(memberConditionInput(gymAt(0.4, 0))).toBe(0.4);
  });

  it('derives the failure phase from the strike count alone', () => {
    const fresh = createManagedGym();
    expect(failurePhase(fresh)).toBe('sound');
    const record = Object.freeze({
      decision: COUNTED_DECISIONS[2],
      atSeconds: 0,
      shownCostGymBucks: 10,
    });
    const warned = Object.freeze({
      ...fresh,
      strikes: Object.freeze(
        Array.from({ length: EMPIRE_TUNING.FAILURE_WARNING_STRIKES }, () => record),
      ),
    });
    expect(failurePhase(warned)).toBe('warned');
    const failed = Object.freeze({
      ...fresh,
      strikes: Object.freeze(Array.from({ length: EMPIRE_TUNING.FAILURE_STRIKES }, () => record)),
    });
    expect(failurePhase(failed)).toBe('failed');
    expect(FAILURE_PHASES).toEqual(['sound', 'warned', 'failed']);
  });

  it('maps condition to the income multiplier, with the dormancy crawl below the live floor', () => {
    expect(conditionIncomeMultiplier(createManagedGym())).toBe(1);
    const floor = EMPIRE_TUNING.CONDITION_INCOME_MULTIPLIER_FLOOR;
    expect(conditionIncomeMultiplier(gymAt(0, 0))).toBe(floor);
    expect(conditionIncomeMultiplier(gymAt(0.5, 0))).toBeCloseTo(floor + (1 - floor) * 0.5, 6);
    expect(conditionIncomeMultiplier(dormantGym(0))).toBe(
      EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER,
    );
  });

  it('quotes repair costs from missing condition at the published rate', () => {
    const worn = gymAt(0.75, 0);
    const rate = EMPIRE_TUNING.REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT;
    expect(repairCostGymBucks(worn, ITEM_ZERO)).toBeCloseTo(0.25 * rate, 6);
    expect(fullRepairCostGymBucks(worn)).toBeCloseTo(
      0.25 * rate * ownedItemsOf(worn.gym).length,
      6,
    );
    expect(fullRepairCostGymBucks(createManagedGym())).toBe(0);
  });

  it('quotes the recovery investment as the real cost of the repairs it requires', () => {
    const worn = gymAt(0.3, 0);
    // Every item is below the recovery minimum, and the instrument repairs to
    // full, so the quote is the full-repair figure — not a to-the-minimum
    // number no function charges.
    expect(recoveryRepairCostGymBucks(worn)).toBe(fullRepairCostGymBucks(worn));
    const above = gymAt(EMPIRE_TUNING.RECOVERY_CONDITION_MIN, 0);
    expect(recoveryRepairCostGymBucks(above)).toBe(0);
  });

  it('offers the maintenance prompt below the line, naming the worst item and the shown cost', () => {
    expect(maintenancePrompt(createManagedGym()).kind).toBe('quiet');
    const worn = gymAt(0.3, 0);
    const prompt = maintenancePrompt(worn);
    expect(prompt.kind).toBe('offered');
    if (prompt.kind === 'offered') {
      expect(prompt.item).toBe(ITEM_ZERO);
      expect(prompt.repairCostGymBucks).toBe(repairCostGymBucks(worn, ITEM_ZERO));
      expect(prompt.dismissalWouldCount).toBe(false);
    }
    expect(wornItems(worn)).toEqual([...ownedItemsOf(worn.gym)]);
    expect(wornItems(createManagedGym())).toEqual([]);
  });

  it('shows the warning surface: phase, strikes remaining, worn items', () => {
    const fresh = createManagedGym();
    expect(warningSigns(fresh)).toEqual({
      phase: 'sound',
      strikeCount: 0,
      strikesUntilFailure: EMPIRE_TUNING.FAILURE_STRIKES,
      wornItems: [],
    });
    expect(warningSignsVisible(fresh)).toBe(false);
    expect(warningSignsVisible(gymAt(0.3, 0))).toBe(true);
    expect(warningSignsVisible(dormantGym(0))).toBe(true);
  });
});

describe('state construction and validation', () => {
  it('opens with everything new, nobody hired, no strikes', () => {
    const fresh = createManagedGym();
    expect(fresh.manager).toBeNull();
    expect(fresh.strikes).toEqual([]);
    expect(fresh.promptDismissals).toBe(0);
    expect(fresh.recoveries).toBe(0);
    expect(meanCondition(fresh)).toBe(1);
    expect(requireManagedGym(fresh)).toBe(fresh);
  });

  it('refuses a bent state, naming what is wrong', () => {
    const fresh = createManagedGym();
    expect(() =>
      requireManagedGym(
        Object.freeze({ ...fresh, condition: Object.freeze({ [ITEM_ZERO]: 1 }) }),
      ),
    ).toThrow(RangeError);
    expect(() =>
      requireManagedGym(
        Object.freeze({ ...fresh, condition: Object.freeze({ ...fresh.condition, [ITEM_ZERO]: 2 }) }),
      ),
    ).toThrow(RangeError);
    expect(() =>
      requireManagedGym(Object.freeze({ ...fresh, promptDismissals: -1 })),
    ).toThrow(RangeError);
    expect(() =>
      requireManagedGym(
        Object.freeze({
          ...fresh,
          strikes: Object.freeze([
            Object.freeze({
              decision: 'skipped-leg-day' as (typeof COUNTED_DECISIONS)[number],
              atSeconds: 0,
              shownCostGymBucks: 0,
            }),
          ]),
        }),
      ),
    ).toThrow(RangeError);
  });

  it('re-seats onto an updated gym, new items arriving at full condition', () => {
    const fresh = createManagedGym();
    const rich = withLadder(fresh.gym, Object.freeze({ ...fresh.gym.ladder, gymBucks: 100000 }));
    // 'mats' and not 'bike': `SESSION_EQUIPMENT_MIN_RUNG` puts the bike at the
    // storage unit and a fresh gym is in the garage, so buying one here is
    // refused for 'rung-too-low' and the fixture would never reach the seam
    // it is about. Money is not the only gate on a stage-2 purchase.
    const bought = buySessionEquipment(rich, 'mats');
    expect(bought.kind).toBe('bought');
    if (bought.kind !== 'bought') return;
    const seated = withUpdatedGym(Object.freeze({ ...fresh, gym: rich }), bought.state);
    expect(seated.condition['mats']).toBe(1);
    expect(seated.condition[ITEM_ZERO]).toBe(1);
    // A gym that lost a known item is refused — nothing sells equipment.
    expect(() => withUpdatedGym(seated, fresh.gym)).toThrow(RangeError);
  });
});

describe('the managed check-in', () => {
  const DAY = EMPIRE_TUNING.SECONDS_PER_DAY;

  it('wears by banked seconds, and absence beyond the horizon wears nothing more', () => {
    const wearPerHour = EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR;
    const twelveHours = managedCheckIn(createManagedGym(), HORIZON_SECONDS);
    expect(meanCondition(twelveHours.state)).toBeCloseTo(
      1 - wearPerHour * (HORIZON_SECONDS / EMPIRE_TUNING.SECONDS_PER_HOUR),
      6,
    );
    const oneDay = managedCheckIn(createManagedGym(), DAY);
    const tenDays = managedCheckIn(createManagedGym(), 10 * DAY);
    expect(meanCondition(oneDay.state)).toBe(meanCondition(twelveHours.state));
    expect(meanCondition(tenDays.state)).toBe(meanCondition(twelveHours.state));
    expect(tenDays.meanConditionWear).toBe(oneDay.meanConditionWear);
  });

  it('splitting a sub-horizon gap leaves condition byte-identical and pays at least as much', () => {
    const whole = managedCheckIn(createManagedGym(), HORIZON_SECONDS);
    const firstHalf = managedCheckIn(createManagedGym(), HORIZON_SECONDS / 2);
    const split = managedCheckIn(firstHalf.state, HORIZON_SECONDS);
    expect(meanCondition(split.state)).toBe(meanCondition(whole.state));
    expect(split.state.gym.ladder.gymBucks).toBeGreaterThanOrEqual(
      whole.state.gym.ladder.gymBucks,
    );
  });

  it('deducts income by the post-wear multiplier and reports the deduction', () => {
    const outcome = managedCheckIn(createManagedGym(), DAY);
    expect(outcome.incomeMultiplier).toBe(conditionIncomeMultiplier(outcome.state));
    expect(outcome.incomePaidGymBucks + outcome.incomeDeductedGymBucks).toBeCloseTo(
      outcome.accrual.gymBucks,
      6,
    );
    expect(outcome.state.gym.ladder.gymBucks).toBeCloseTo(outcome.incomePaidGymBucks, 6);
    expect(outcome.incomeDeductedGymBucks).toBeGreaterThan(0);
  });

  it('charges the wage per banked hour, pays it in full from an empty purse, and the novice never auto-repairs', () => {
    const hired = hireManager(gymAt(1, EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS.veteran), 'veteran', 0);
    expect(hired.kind).toBe('hired');
    if (hired.kind !== 'hired') return;
    const outcome = managedCheckIn(hired.state, DAY);
    const wageDue =
      EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR.veteran *
      (HORIZON_SECONDS / EMPIRE_TUNING.SECONDS_PER_HOUR);
    expect(outcome.wagePaidGymBucks).toBeCloseTo(wageDue, 6);
    expect(outcome.wageShortfallGymBucks).toBe(0);

    // The worst case the shipped tuning admits: nothing in the purse, every
    // item worn to the multiplier floor, and the top wage. The wage is still
    // paid whole, because `gymCheckIn` credits the gap's accrual before the
    // wage is charged and the pinned inequality below makes that credit
    // larger than the wage. `EXPECTED_SWEEP.safety.wageShortfalls` carries
    // the same fact over the whole sweep, with the mutation that reddens it.
    const broke = hireManager(gymAt(1, EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS.veteran), 'veteran', 0);
    if (broke.kind !== 'hired') return;
    const brokeWorn = Object.freeze({ ...gymAt(0, 0), manager: broke.state.manager });
    const brokeOutcome = managedCheckIn(brokeWorn, DAY);
    expect(brokeOutcome.wagePaidGymBucks).toBeCloseTo(wageDue, 6);
    expect(brokeOutcome.wageShortfallGymBucks).toBe(0);
    expect(brokeOutcome.state.gym.ladder.gymBucks).toBeGreaterThan(0);

    // The novice repairs nothing, however worn and however rich the gym.
    const cheap = hireManager(gymAt(1, 100000), 'novice', 0);
    if (cheap.kind !== 'hired') return;
    const cheapWorn = Object.freeze({ ...gymAt(0.2, 100000), manager: cheap.state.manager });
    const cheapOutcome = managedCheckIn(cheapWorn, DAY);
    expect(cheapOutcome.autoRepairs).toEqual([]);
    expect(cheapOutcome.wageShortfallGymBucks).toBe(0);
  });

  it('a veteran repairs worn items autonomously, billing the published cost', () => {
    const hired = hireManager(gymAt(1, 100000), 'veteran', 0);
    expect(hired.kind).toBe('hired');
    if (hired.kind !== 'hired') return;
    const worn = Object.freeze({
      ...hired.state,
      condition: Object.freeze(
        Object.fromEntries(ownedItemsOf(hired.state.gym).map((item) => [item, 0.5])),
      ) as ManagedGym['condition'],
    });
    const outcome = managedCheckIn(worn, DAY);
    expect(outcome.autoRepairs.length).toBe(ownedItemsOf(worn.gym).length);
    for (const item of ownedItemsOf(outcome.state.gym)) {
      expect(itemCondition(outcome.state, item)).toBe(1);
    }
  });

  it('dormancy: the crawl multiplier, no wear, no wage, no auto-repair', () => {
    const hired = hireManager(gymAt(1, 100000), 'veteran', 0);
    if (hired.kind !== 'hired') return;
    let dormant = dormantGym(1000);
    dormant = Object.freeze({ ...dormant, manager: hired.state.manager });
    const before = meanCondition(dormant);
    const outcome = managedCheckIn(dormant, DAY);
    expect(outcome.incomeMultiplier).toBe(EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER);
    expect(meanCondition(outcome.state)).toBe(before);
    expect(outcome.meanConditionWear).toBe(0);
    expect(outcome.wagePaidGymBucks).toBe(0);
    expect(outcome.autoRepairs).toEqual([]);
    // The crawl is still income — the recoverability rail.
    expect(outcome.incomePaidGymBucks).toBeGreaterThan(0);
  });
});

describe('the decisions', () => {
  it('repair restores to full at the shown cost, off the settled purse only', () => {
    const worn = gymAt(0.5, 10000);
    const cost = repairCostGymBucks(worn, ITEM_ZERO);
    const repaired = repairEquipment(worn, ITEM_ZERO);
    expect(repaired.kind).toBe('repaired');
    if (repaired.kind !== 'repaired') return;
    expect(repaired.cost).toBe(cost);
    expect(itemCondition(repaired.state, ITEM_ZERO)).toBe(1);
    expect(itemCondition(repaired.state, ITEM_ONE)).toBe(0.5);
    expect(repaired.state.gym.ladder.gymBucks).toBeCloseTo(10000 - cost, 6);
    expect(repaired.state.gym.acceleratedGymBucks).toBe(0);
  });

  it('declining a shown repair is a counted decision carrying the shown cost', () => {
    const worn = gymAt(0.3, 0);
    const declined = declineRepair(worn, ITEM_ZERO, 7);
    expect(declined.kind).toBe('declined');
    if (declined.kind !== 'declined') return;
    expect(declined.state.strikes.length).toBe(1);
    expect(declined.state.strikes[0]).toEqual({
      decision: 'repair-declined',
      atSeconds: 7,
      shownCostGymBucks: repairCostGymBucks(worn, ITEM_ZERO),
    });
  });

  it('the first dismissal is free and the next one counts, per the free allowance', () => {
    const worn = gymAt(0.3, 0);
    const first = respondToPrompt(worn, 'dismiss', 0);
    expect(first.kind).toBe('dismissed');
    if (first.kind !== 'dismissed') return;
    expect(first.counted).toBe(false);
    expect(first.state.strikes.length).toBe(0);
    const second = respondToPrompt(first.state, 'dismiss', 1);
    expect(second.kind).toBe('dismissed');
    if (second.kind !== 'dismissed') return;
    expect(second.counted).toBe(true);
    expect(second.state.strikes.length).toBe(1);
    expect(second.state.strikes[0]?.decision).toBe('prompt-dismissed-again');
  });

  it('hiring the cheapest tier under visible warnings is a counted decision', () => {
    const clean = hireManager(gymAt(1, 10000), 'novice', 0);
    expect(clean.kind).toBe('hired');
    if (clean.kind === 'hired') {
      expect(clean.countedAsStrike).toBe(false);
      expect(clean.state.manager?.hiredUnderWarning).toBe(false);
    }
    // The counted arm needs the LEDGER's warning, not worn equipment: §5.7's
    // clarification says condition may show a prompt and may not advance a
    // strike, so `countedWarningVisible` reads the phase and nothing else.
    // A worn-but-unstruck gym hires the cheapest tier for free.
    const wornButSound = hireManager(gymAt(0.3, 10000), 'novice', 0);
    expect(wornButSound.kind).toBe('hired');
    if (wornButSound.kind === 'hired') expect(wornButSound.countedAsStrike).toBe(false);
    expect(warningSignsVisible(gymAt(0.3, 0))).toBe(true);
    expect(countedWarningVisible(gymAt(0.3, 0))).toBe(false);

    const warnedRich = refusedAllOrders(gymAt(0.3, 10000));
    expect(failurePhase(warnedRich)).not.toBe('sound');
    expect(countedWarningVisible(warnedRich)).toBe(true);
    const counted = hireManager(warnedRich, 'novice', 9);
    expect(counted.kind).toBe('hired');
    if (counted.kind === 'hired') {
      expect(counted.countedAsStrike).toBe(true);
      expect(counted.state.manager?.hiredUnderWarning).toBe(true);
      const last = counted.state.strikes[counted.state.strikes.length - 1];
      expect(last?.decision).toBe('cheapest-hire-under-warning');
      expect(last?.shownCostGymBucks).toBe(EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS.novice);
    }
    // A better tier under the same warnings is not counted.
    const steady = hireManager(warnedRich, 'steady', 9);
    expect(steady.kind).toBe('hired');
    if (steady.kind === 'hired') expect(steady.countedAsStrike).toBe(false);
  });

  it('the failure crossing moves no condition — dormancy costs income and the recovery bar', () => {
    // The dormancy entry slump was removed this round, and this is the
    // directed half of that: crossing the failure line changes the ledger and
    // nothing else. The measured half is the sweep, whose shipped zeros the
    // 'failure-slump-control' rows are zeros against.
    let state = gymAt(0.3, 0);
    const items = ownedItemsOf(state.gym);
    for (const [strike, item] of items.slice(0, EMPIRE_TUNING.FAILURE_STRIKES - 1).entries()) {
      const declined = declineRepair(state, item, strike);
      if (declined.kind !== 'declined') throw new Error('fixture could not strike');
      state = declined.state;
      expect(meanCondition(state)).toBeCloseTo(0.3, 6);
    }
    const crossing = declineRepair(
      state,
      items[EMPIRE_TUNING.FAILURE_STRIKES - 1] as ManagedEquipmentItem,
      9,
    );
    expect(crossing.kind).toBe('declined');
    if (crossing.kind !== 'declined') return;
    expect(failurePhase(crossing.state)).toBe('failed');
    expect(meanCondition(crossing.state)).toBeCloseTo(0.3, 6);
    expect(crossing.state.condition).toEqual(state.condition);
    // Dormancy's teeth are elsewhere: the income crawl, and a recovery bar
    // above the maintenance-prompt line, so the comeback buys repairs the
    // player did not otherwise owe yet.
    expect(conditionIncomeMultiplier(crossing.state)).toBe(
      EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER,
    );
    expect(recoveryRepairCostGymBucks(crossing.state)).toBeGreaterThan(0);
    // A further refusal past the line moves nothing either — and, under the
    // per-order ledger, appends no strike, because every standing order has
    // already been refused.
    const past = declineRepair(crossing.state, ITEM_ZERO, 10);
    expect(past.kind).toBe('declined');
    if (past.kind === 'declined') {
      expect(past.counted).toBe(false);
      expect(past.state.strikes.length).toBe(crossing.state.strikes.length);
      expect(meanCondition(past.state)).toBe(meanCondition(crossing.state));
    }
  });

  it('recovery needs the repairs and the turnaround, then clears the ledger', () => {
    expect(recoverGym(createManagedGym()).kind).toBe('refused');
    let dormant = dormantGym(100000);
    const blocked = recoverGym(dormant);
    expect(blocked.kind).toBe('refused');
    if (blocked.kind === 'refused') {
      expect(blocked.reason).toBe('equipment-below-recovery-minimum');
    }
    for (const item of ownedItemsOf(dormant.gym)) {
      const repaired = repairEquipment(dormant, item);
      if (repaired.kind === 'repaired') dormant = repaired.state;
    }
    const recovered = recoverGym(dormant);
    expect(recovered.kind).toBe('recovered');
    if (recovered.kind !== 'recovered') return;
    expect(recovered.state.strikes).toEqual([]);
    expect(recovered.state.promptDismissals).toBe(0);
    expect(recovered.state.recoveries).toBe(1);
    expect(failurePhase(recovered.state)).toBe('sound');
  });

  it('failure progression is a function of the counted decisions alone', () => {
    // Two states reached by different schedules, offered the same decisions:
    // the phase sequence per decision is identical, whatever the clock did.
    // Both fixtures are one check-in short of the first review, so the
    // check-in below opens the order on both — a day apart and a month apart.
    // That the ORDINAL and not the clock is what opens it is the point of the
    // test, and it is what makes the two sides comparable at all.
    const onCadence = EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN - 1;
    const early = managedCheckIn(gymAt(0.4, 0, onCadence), EMPIRE_TUNING.SECONDS_PER_DAY).state;
    const late = managedCheckIn(
      gymAt(0.4, 0, onCadence),
      30 * EMPIRE_TUNING.SECONDS_PER_DAY,
    ).state;
    expect(maintenancePrompt(early).kind).toBe('offered');
    expect(maintenancePrompt(late).kind).toBe('offered');
    let left: ManagedGym = early;
    let right: ManagedGym = late;
    const phasesLeft: string[] = [];
    const phasesRight: string[] = [];
    // One refusal per ITEM, and one extra: the extra restates an order that is
    // already refused, so it appends nothing on either side. Both facts have to
    // hold for the phase series to be a function of the decisions alone.
    for (const [strike, item] of [...ownedItemsOf(early.gym), ITEM_ZERO].entries()) {
      const declinedLeft = declineRepair(left, item, strike);
      const declinedRight = declineRepair(right, item, strike);
      if (declinedLeft.kind !== 'declined' || declinedRight.kind !== 'declined') {
        throw new Error('the decision-function fixture could not strike');
      }
      left = declinedLeft.state;
      right = declinedRight.state;
      phasesLeft.push(failurePhase(left));
      phasesRight.push(failurePhase(right));
    }
    expect(phasesLeft).toEqual(phasesRight);
    expect(phasesLeft).toContain('warned');
    expect(phasesLeft[phasesLeft.length - 1]).toBe('failed');
  });
});

describe('wirings and the composed run', () => {
  it('builds wirings with the dial discipline, and refuses the rest', () => {
    expect(shippedManagementWiring()).toEqual({
      key: SHIPPED_MANAGEMENT_WIRING,
      controlChargeGymBucks: 0,
      controlSlumpCondition: 0,
    });
    expect(chargesVisitFee('visit-fee-control')).toBe(true);
    expect(chargesVisitFee('shipped')).toBe(false);
    expect(() => managementWiring('shipped', 5)).toThrow(RangeError);
    expect(() => managementWiring('visit-fee-control', 0)).toThrow(RangeError);
    expect(() => managementWiring('overtime-control' as ManagementWiringKey, 0)).toThrow(
      RangeError,
    );
    expect(slumpsOnFailure('failure-slump-control')).toBe(true);
    expect(slumpsOnFailure('shipped')).toBe(false);
    expect(() => managementWiring('shipped', 0, 0.25)).toThrow(RangeError);
    expect(() => managementWiring('failure-slump-control', 0, 0)).toThrow(RangeError);
    expect(() => managementWiring('failure-slump-control', 0, 2)).toThrow(RangeError);
    expect(managementWiring('failure-slump-control', 0, 0.25).controlSlumpCondition).toBe(0.25);
    expect(repeatsStrikes('repeat-strike-control')).toBe(true);
    expect(repeatsStrikes('shipped')).toBe(false);
    expect(() => managementWiring('repeat-strike-control', 5)).toThrow(RangeError);
    expect(() => managementWiring('repeat-strike-control', 0, 0.25)).toThrow(RangeError);
    expect(managementWiring('repeat-strike-control', 0).key).toBe('repeat-strike-control');
    // The two wirings this round added, held to the same dial discipline: both
    // are dial-free, so setting either dial on them is a refusal.
    expect(gatesReviewOnCondition('condition-gated-prompt-control')).toBe(true);
    expect(gatesReviewOnCondition('shipped')).toBe(false);
    expect(() => managementWiring('condition-gated-prompt-control', 5)).toThrow(RangeError);
    expect(() => managementWiring('condition-gated-prompt-control', 0, 0.25)).toThrow(RangeError);
    expect(managementWiring('condition-gated-prompt-control', 0).key).toBe(
      'condition-gated-prompt-control',
    );
    expect(shedsAnyManager('eager-turnaround-control')).toBe(true);
    expect(shedsAnyManager('shipped')).toBe(false);
    expect(() => managementWiring('eager-turnaround-control', 5)).toThrow(RangeError);
    expect(() => managementWiring('eager-turnaround-control', 0, 0.25)).toThrow(RangeError);
    expect(managementWiring('eager-turnaround-control', 0).key).toBe('eager-turnaround-control');
    // Exactly one wiring ships and every other is a control, asserted as a
    // partition rather than as a count that could drift: the five predicates
    // are mutually exclusive and cover every non-shipped key.
    const controls = MANAGEMENT_WIRINGS.filter((key) => key !== SHIPPED_MANAGEMENT_WIRING);
    for (const key of controls) {
      const flags = [
        wearsOnWallClock(key),
        fabricatesAbsenceStrikes(key),
        chargesVisitFee(key),
        slumpsOnFailure(key),
        repeatsStrikes(key),
        gatesReviewOnCondition(key),
        shedsAnyManager(key),
      ].filter(Boolean);
      expect(flags.length, `${key} must be exactly one kind of control`).toBe(1);
    }
    expect(MANAGEMENT_WIRINGS.length).toBe(8);
    expect(controls.length).toBe(7);
    expect(MANAGEMENT_POLICIES.length).toBe(6);
  });

  it('the standing repair order opens on the check-in ORDINAL, and on nothing else', () => {
    // The gate itself, driven directly rather than inferred from the sweep.
    const first = EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN;
    const stride = EMPIRE_TUNING.MAINTENANCE_ORDER_STRIDE;

    // A gym that has never checked in has no order raised, at ANY condition —
    // this is the arm that makes `MAINTENANCE_ORDER_FIRST_CHECK_IN`'s floor of
    // 1 load-bearing rather than decorative.
    expect(maintenancePrompt(createManagedGym()).kind).toBe('quiet');
    expect(maintenancePrompt(gymAt(0.01, 0, 0)).kind).toBe('quiet');
    expect(declineRepair(gymAt(0.01, 0, 0), ITEM_ZERO, 0).kind).toBe('refused');

    // The cadence, over a range that covers several strides in both
    // directions of the first order. `orderOpensAt` is the subject and the
    // predicate is re-derived from the two knobs, not copied from it.
    const open: number[] = [];
    for (let taken = 0; taken <= first + stride * 4; taken += 1) {
      const state = gymAt(0.4, 0, taken);
      const isOpen = maintenancePrompt(state).kind === 'offered';
      expect(isOpen, `checkInsTaken=${taken}`).toBe(taken >= orderOpensAt(state));
      expect(isOpen, `checkInsTaken=${taken}`).toBe(
        taken >= first && (taken - first) % stride === 0,
      );
      if (isOpen) open.push(taken);
    }
    // Non-vacuity: the loop found open check-ins AND shut ones, so neither
    // branch of the equality above is an empty domain.
    expect(open).toEqual([first, first + stride, first + 2 * stride, first + 3 * stride, first + 4 * stride]);
    expect(open.length).toBeLessThan(first + stride * 4 + 1);

    // And it reads NOTHING about condition or purse: the same ordinal with a
    // pristine gym and a ruined one, a broke gym and a rich one, all agree.
    for (const condition of [1, 0.9, 0.5, 0.1, 0]) {
      for (const purse of [0, 100000]) {
        expect(maintenancePrompt(gymAt(condition, purse, first)).kind).toBe('offered');
        expect(maintenancePrompt(gymAt(condition, purse, first + 1)).kind).toBe('quiet');
      }
    }
  });

  it('only a check-in advances the review ordinal', () => {
    // The named catcher for `ManagedGym.checkInsTaken`'s docstring. It drives
    // every export on this module that takes a state and returns one, and
    // reads the ordinal back — so a decision that started advancing the review
    // cadence reddens here rather than showing up as a moved sweep count
    // nobody could attribute.
    const at = EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN;
    const open = gymAt(0.3, 100000, at);
    const after = (state: ManagedGym): number => state.checkInsTaken;

    const decisions: readonly [string, ManagedGym][] = [
      ['repairEquipment', asState(repairEquipment(open, ITEM_ZERO))],
      ['declineRepair', asState(declineRepair(open, ITEM_ZERO, 0))],
      ['respondToPrompt/repair', asState(respondToPrompt(open, 'repair', 0))],
      ['respondToPrompt/dismiss', asState(respondToPrompt(open, 'dismiss', 0))],
      ['hireManager', asState(hireManager(open, 'veteran', 0))],
      ['dismissManager', asState(dismissManager(asState(hireManager(open, 'veteran', 0))))],
      ['recoverGym', asState(recoverGym(dormantGym(100000)))],
      ['withUpdatedGym', withUpdatedGym(open, open.gym)],
    ];
    for (const [name, state] of decisions) {
      expect(after(state), `${name} must not advance the review ordinal`).toBe(at);
    }
    // Non-vacuity in the other direction: the one writer really does write.
    expect(after(managedCheckIn(open, EMPIRE_TUNING.SECONDS_PER_DAY).state)).toBe(at + 1);
    // And `recoverGym` resets `promptDismissals` while leaving this alone,
    // which is the one pair a reader is most likely to assume moves together.
    const dismissedTwice = asState(
      respondToPrompt(asState(respondToPrompt(dormantGym(100000), 'dismiss', 0)), 'dismiss', 1),
    );
    expect(dismissedTwice.promptDismissals).toBeGreaterThan(0);
    const recovered = recoverGym(repairedToRecovery(dismissedTwice));
    expect(recovered.kind).toBe('recovered');
    if (recovered.kind !== 'recovered') return;
    expect(recovered.state.promptDismissals).toBe(0);
    expect(recovered.state.checkInsTaken).toBe(dismissedTwice.checkInsTaken);
  });

  it('RETRACTED CLAIM, KEPT AS A MEASUREMENT: the review series used to be byte-identical under any enlargement of a within-horizon gap, and is not any more', () => {
    // WHAT THIS TEST USED TO ASSERT, AND WHY IT NO LONGER CAN — read this
    // before touching the numbers below. Before the human ruling that keys
    // the review cadence to real banked seconds rather than to a dispatched
    // check-in count (`management.ts` header §3a, "RE-KEYED, BY HUMAN
    // RULING"), `checkInsTaken` was `+1` per call and could not see how long
    // any individual gap was — so enlarging one gap (this test's whole
    // domain: the gap stays under the offline cap, so nothing is quantised
    // away) could never change which check-in INDEX the review opened at,
    // and the reported `reviewOffered` series was provably invariant.
    //
    // That argument no longer holds. `checkInsTaken` is now
    // `Math.floor(bankedOperationSeconds / REVIEW_ORDINAL_WINDOW_SECONDS)`,
    // and `bankedOperationSeconds` accumulates a WITHIN-horizon gap's real
    // seconds in full — the same accrual money and wear were already reading.
    // Enlarging such a gap therefore genuinely can push the ordinal (and so
    // the review) onto a different index, on the SAME calendar with the SAME
    // number of check-ins. This is "one clock" doing exactly what the ruling
    // asked for — the review cadence reading the same real elapsed time money
    // and wear already read — and it reopens a channel a prior round spent
    // real effort closing to zero. That regression is measured here rather
    // than hidden: see `management.ts` header §3a's retraction and the
    // `withinHorizon` family in `EXPECTED_SWEEP` for the size of it across the
    // whole battery, not just this one schedule.
    const gaps = gapScheduleAt(MANAGEMENT_SWEEP.SEEDS[0], 0);
    const baseTimes = timesOf(gaps);
    const control = managementWiring('condition-gated-prompt-control', 0);
    const seriesOf = (run: ManagedRun): string =>
      run.readings.map((reading) => (reading.reviewOffered ? '1' : '0')).join('');
    const shippedBase = seriesOf(runManagedGym(baseTimes, 'negligent'));
    const controlBase = seriesOf(runManagedGym(baseTimes, 'negligent', control));
    let shippedDifferences = 0;
    let controlDifferences = 0;
    let enlargements = 0;
    for (const extra of [
      EMPIRE_TUNING.SECONDS_PER_HOUR,
      EMPIRE_TUNING.SECONDS_PER_DAY,
      7 * EMPIRE_TUNING.SECONDS_PER_DAY,
      365 * EMPIRE_TUNING.SECONDS_PER_DAY,
    ]) {
      for (let gapAt = 0; gapAt < gaps.length; gapAt += 1) {
        enlargements += 1;
        const longer = timesOf(moreAbsentBy(gaps, gapAt, extra));
        if (seriesOf(runManagedGym(longer, 'negligent')) !== shippedBase) {
          shippedDifferences += 1;
        }
        if (seriesOf(runManagedGym(longer, 'negligent', control)) !== controlBase) {
          controlDifferences += 1;
        }
      }
    }
    expect(enlargements).toBe(160);
    // THE SHIPPED EFFECT SIZE, measured rather than assumed zero. Every one
    // of these enlargements is within the offline horizon by construction
    // (`gapScheduleAt`'s own generator — see `MANAGEMENT_SWEEP`), so this is
    // the real-time-keyed ordinal responding to genuinely more elapsed
    // operation between two check-ins, on a calendar where the check-in COUNT
    // never changes.
    expect(shippedDifferences).toBe(39);
    // THE CONTROL'S OWN EFFECT SIZE IS UNCHANGED — `condition-gated-prompt-
    // control` never read `checkInsTaken` at all, so this round's re-keying
    // could not have moved it, and it did not: still 15 of 160.
    expect(controlDifferences).toBe(15);
    // Non-vacuity on the series itself: it is not all zeros or all ones, so
    // "byte-identical" (when it held) was a statement about a series with
    // structure in it, not an empty one.
    expect(shippedBase).toContain('1');
    expect(shippedBase).toContain('0');
  });

  it('refuses a bent schedule and an unknown policy', () => {
    expect(() => runManagedGym([100, 50], 'hands-off')).toThrow(RangeError);
    expect(() => runManagedGym([100], 'tycoon' as ManagementPolicy)).toThrow(RangeError);
  });

  it('is deterministic: the same inputs give byte-identical runs', () => {
    const times = timesOf(gapScheduleAt(MANAGEMENT_SWEEP.SEEDS[0], 0));
    const first = runManagedGym(times, 'redemptive');
    const second = runManagedGym(times, 'redemptive');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('hands-off reproduces a plain managedCheckIn fold, reading for reading', () => {
    const times = timesOf(gapScheduleAt(MANAGEMENT_SWEEP.SEEDS[1], 2));
    const run = runManagedGym(times, 'hands-off');
    let state = createManagedGym();
    for (const [at, seconds] of times.entries()) {
      const outcome = managedCheckIn(state, seconds);
      state = outcome.state;
      const reading = run.readings[at];
      expect(reading?.meanCondition).toBe(meanCondition(state));
      expect(reading?.incomePaid).toBe(outcome.incomePaidGymBucks);
      expect(reading?.incomeDeducted).toBe(outcome.incomeDeductedGymBucks);
    }
    expect(JSON.stringify(run.state.gym)).toBe(JSON.stringify(state.gym));
  });
});

describe('tuning self-consistency, derived rather than restated', () => {
  it('a banked hour at the condition floor out-earns the top wage plus its own repair bill', () => {
    // The engagement side of the never-punish rule, first-order: every banked
    // hour must be worth having even on a floor-worn gym with the priciest
    // manager, or an extra check-in could net negative. The sweep is the
    // proof over its domain; this is the design argument, pinned.
    const floorIncomePerHour =
      EMPIRE_TUNING.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage *
      EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
      EMPIRE_TUNING.CONDITION_INCOME_MULTIPLIER_FLOOR;
    const topWage = Math.max(...Object.values(EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR));
    const wearBillPerHour =
      EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR *
      EMPIRE_TUNING.REPAIR_COST_GYM_BUCKS_PER_CONDITION_POINT *
      ownedItemsOf(createManagedGym().gym).length;
    expect(floorIncomePerHour).toBeGreaterThan(topWage + wearBillPerHour);
  });

  it('the multiplier floor dominates a whole horizon of wear', () => {
    // First-order condition for an extra banked span to pay for the deeper
    // wear it drags behind it: floor >= (1 - floor) * wear * horizonHours / 2.
    const floor = EMPIRE_TUNING.CONDITION_INCOME_MULTIPLIER_FLOOR;
    const horizonHours = HORIZON_SECONDS / EMPIRE_TUNING.SECONDS_PER_HOUR;
    expect(floor).toBeGreaterThanOrEqual(
      ((1 - floor) * EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR * horizonHours) / 2,
    );
  });

  it('orders the ladders: warning before failure, wages and hires by tier, thresholds inside [0, 1]', () => {
    expect(EMPIRE_TUNING.FAILURE_WARNING_STRIKES).toBeGreaterThan(0);
    expect(EMPIRE_TUNING.FAILURE_STRIKES).toBeGreaterThan(EMPIRE_TUNING.FAILURE_WARNING_STRIKES);
    expect(EMPIRE_TUNING.MAINTENANCE_PROMPT_FREE_DISMISSALS).toBeGreaterThanOrEqual(1);
    const tiers = EMPIRE_TUNING.MANAGER_TIERS;
    for (let at = 1; at < tiers.length; at += 1) {
      const below = tiers[at - 1] as ManagerTier;
      const here = tiers[at] as ManagerTier;
      expect(EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[here]).toBeGreaterThan(
        EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[below],
      );
      expect(EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR[here]).toBeGreaterThan(
        EMPIRE_TUNING.MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR[below],
      );
      expect(EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION[here]).toBeGreaterThan(
        EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION[below],
      );
    }
    expect(EMPIRE_TUNING.MANAGER_AUTO_REPAIR_CONDITION.novice).toBe(0);
    expect(EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER).toBeGreaterThan(0);
    expect(EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER).toBeLessThan(
      EMPIRE_TUNING.CONDITION_INCOME_MULTIPLIER_FLOOR,
    );
    expect(EMPIRE_TUNING.REPAIR_POLICY_CONDITION).toBeLessThan(
      EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION,
    );
    expect(EMPIRE_TUNING.RECOVERY_CONDITION_MIN).toBeGreaterThan(
      EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION,
    );
    // The two ordinal knobs' floors, which `empireTuning.ts` states and which
    // nothing checked until now. `MAINTENANCE_ORDER_STRIDE` at 0 makes the
    // cadence's modulo undefined; `MAINTENANCE_ORDER_FIRST_CHECK_IN` at 0
    // raises a review on a gym that has never been used.
    expect(Number.isInteger(EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN)).toBe(true);
    expect(Number.isInteger(EMPIRE_TUNING.MAINTENANCE_ORDER_STRIDE)).toBe(true);
    expect(EMPIRE_TUNING.MAINTENANCE_ORDER_FIRST_CHECK_IN).toBeGreaterThanOrEqual(1);
    expect(EMPIRE_TUNING.MAINTENANCE_ORDER_STRIDE).toBeGreaterThanOrEqual(1);
  });

  it('the cadence this margin is derived from is the cadence orderOpensAt implements', () => {
    // FIRST, so nothing below is a copy grading itself. `reviewCheckInCount`
    // is a second expression of `orderOpensAt`'s arithmetic; this drives the
    // real function over every `checkInsTaken` the drive below reaches and
    // compares the two as SETS, in both directions.
    const fresh = createManagedGym();
    const span = reviewCheckInCount(EMPIRE_TUNING.FAILURE_STRIKES + 2);
    const openFromEngine: number[] = [];
    for (let taken = 0; taken <= span; taken += 1) {
      const at = Object.freeze({ ...fresh, checkInsTaken: taken });
      if (taken >= orderOpensAt(at)) openFromEngine.push(taken);
    }
    const openFromArithmetic: number[] = [];
    for (let nth = 1; reviewCheckInCount(nth) <= span; nth += 1) {
      openFromArithmetic.push(reviewCheckInCount(nth));
    }
    expect(openFromEngine).toEqual(openFromArithmetic);
    // Non-vacuity: the span really contains several reviews, so the equality
    // is not two empty lists agreeing.
    expect(openFromArithmetic.length).toBeGreaterThanOrEqual(
      EMPIRE_TUNING.FAILURE_STRIKES,
    );
  });

  it('keeps the worn disjunct off the strike path by a derived margin, and states its size', () => {
    // THE RELATION NOTHING ASSERTED. `'cheapskate'`'s strike-producing hire is
    // gated on `warningSignsVisible`, whose second disjunct reads condition.
    // `STRIKE_PATH_MARGIN`'s comment has the derivation and its limit; this is
    // the inequality itself, over five knobs and the offline horizon, none of
    // them transcribed.
    expect(STRIKE_PATH_MARGIN.floorCondition).toBeGreaterThan(
      EMPIRE_TUNING.MAINTENANCE_PROMPT_CONDITION,
    );

    // The size, pinned rather than bounded, so a tuning pass that eats the
    // margin without closing it still moves a number somebody signs. At the
    // shipped tuning: the offline horizon is 12 h, a check-in wears at most
    // 0.024, the warning phase is readable at the 9th check-in, and the least
    // any item can be there is 0.784 — 0.284 above the 0.5 prompt line.
    expect(STRIKE_PATH_MARGIN.horizonHours).toBe(12);
    expect(STRIKE_PATH_MARGIN.wearPerCheckIn).toBe(0.024);
    expect(STRIKE_PATH_MARGIN.checkInsBeforeWarningIsReadable).toBe(9);
    expect(STRIKE_PATH_MARGIN.floorCondition).toBe(0.784);
    expect(STRIKE_PATH_MARGIN.marginOverPromptCondition).toBe(0.284);

    // AND THE DISTANCE IN THE KNOB'S OWN UNITS, which is what a playtester
    // turning the dial actually needs: the margin closes at 0.00463 Gym
    // condition per banked hour, so the shipped 0.002 has 2.3x of headroom.
    // Measured beside it rather than argued — the sweep's own
    // `withinHorizon.failureMismatches` is 0 at 0.002, 0.0045 and 0.005, 32 at
    // 0.0055, 128 at 0.006 and 256 at 0.007, all of it `'cheapskate'`, and 0
    // again at 0.01 and 0.02 where both runs of a pair cross on the same
    // index. So this bound is CONSERVATIVE by construction and by measurement:
    // it reddens at 0.00463, below the 0.005-to-0.0055 band where the sweep
    // first moves. A guard that reddens before the behaviour does is the way
    // round this should be wrong.
    expect(STRIKE_PATH_MARGIN.crossingWearRatePerBankedHour).toBe(0.00463);
    expect(EMPIRE_TUNING.EQUIPMENT_WEAR_PER_BANKED_HOUR).toBeLessThan(
      STRIKE_PATH_MARGIN.crossingWearRatePerBankedHour,
    );
  });

  it('drives the cheapskate on the fastest-wearing schedule and reads which disjunct fired', () => {
    // THE ARITHMETIC ABOVE COVERS EVERY SCHEDULE; THIS DRIVES THE EXTREMAL ONE.
    // Every gap here is past the offline horizon, so every check-in banks the
    // full horizon and wears the most a check-in can — the schedule on which
    // the worn disjunct fires at the earliest INDEX it can fire at. Any other
    // schedule wears no faster per check-in and the review cadence is an
    // ordinal, so no other schedule moves the crossing earlier. That is why
    // one schedule is enough here and is not the "domain sampled only at the
    // extremes" shape: the extreme is the worst case, and the general claim is
    // carried by the inequality rather than by this sample.
    //
    // The decision order is `runManagedGym`'s, read off that function: the
    // predicate, then the hire, then the review. Not composed through
    // `runManagedGym` itself because that function reports no predicate
    // reading, and a sweep cannot see which disjunct fired.
    const gap = offlineBankingHorizonSeconds() * 2;
    const rows: {
      readonly checkInsTaken: number;
      readonly display: boolean;
      readonly counted: boolean;
      readonly worn: number;
      readonly minCondition: number;
    }[] = [];
    let state = createManagedGym();
    const cheapest = EMPIRE_TUNING.MANAGER_TIERS[0] as ManagerTier;
    for (let index = 0; index < MANAGEMENT_SWEEP.CHEAPSKATE_DRIVE_CHECK_INS; index += 1) {
      const at = (index + 1) * gap;
      state = managedCheckIn(state, at).state;
      rows.push({
        checkInsTaken: state.checkInsTaken,
        display: warningSignsVisible(state),
        counted: countedWarningVisible(state),
        worn: wornItems(state).length,
        minCondition: Math.min(
          ...ownedItemsOf(state.gym).map((item) => itemCondition(state, item)),
        ),
      });
      if (warningSignsVisible(state) && state.manager === null) {
        const hired = hireManager(state, cheapest, at);
        if (hired.kind === 'hired') state = hired.state;
      }
      const prompt = maintenancePrompt(state);
      if (prompt.kind === 'offered') {
        const declined = declineRepair(state, prompt.item, at);
        if (declined.kind === 'declined') state = declined.state;
      }
    }

    // NON-VACUITY FIRST: the drive really reaches a check-in where the gate
    // opens, so everything below is about a population of one or more rather
    // than about an empty one.
    const firstOpen = rows.findIndex((row) => row.display);
    expect(firstOpen).toBeGreaterThanOrEqual(0);

    // The gate opened on the FAILURE LEDGER and not on condition: at that
    // check-in the phase read is already true and no item is worn.
    expect(rows[firstOpen]?.counted).toBe(true);
    expect(rows[firstOpen]?.worn).toBe(0);
    // ...and up to that point the display read and the counted read agree at
    // every check-in, so swapping `warningSignsVisible` for
    // `countedWarningVisible` in the model changes nothing on this schedule.
    for (const [index, row] of rows.entries()) {
      if (index > firstOpen) break;
      expect(row.display, `check-in ${row.checkInsTaken}`).toBe(row.counted);
    }

    // The index it opened at, pinned, and its agreement with the arithmetic
    // above — this is what joins the drive to the inequality rather than
    // leaving them two separate claims about the same tuning.
    expect(rows[firstOpen]?.checkInsTaken).toBe(
      STRIKE_PATH_MARGIN.checkInsBeforeWarningIsReadable,
    );
    expect(atMillionth(rows[firstOpen]?.minCondition ?? 0)).toBe(
      STRIKE_PATH_MARGIN.floorCondition,
    );

    // And what the rest of the drive did, pinned so a change anywhere in it is
    // read rather than absorbed: this schedule never wears an item below the
    // prompt line at all, because three refusals take the gym dormant at the
    // third review and dormancy applies no wear (header §4).
    expect(rows.filter((row) => row.worn > 0)).toEqual([]);
    expect(rows.filter((row) => row.display).length).toBe(
      MANAGEMENT_SWEEP.CHEAPSKATE_DRIVE_CHECK_INS - STRIKE_PATH_MARGIN.checkInsBeforeWarningIsReadable + 1,
    );
    expect(failurePhase(state)).toBe('failed');
    // The ledger this drive built, pinned by decision and by the check-in it
    // was taken at. The third row is the point of the whole block: the counted
    // CHEAP HIRE is itself a strike, and it is the decision whose gate carries
    // the condition read — so this is not a hypothetical path to a strike, it
    // is a strike, standing on the margin above.
    expect(state.strikes.map((strike) => [strike.decision, strike.atSeconds / gap])).toEqual([
      ['repair-declined', 4],
      ['repair-declined', 8],
      ['cheapest-hire-under-warning', 9],
      ['repair-declined', 12],
    ]);
  });

  it('pure neglect can reach failure: the strike threshold against the orders a garage can refuse', () => {
    // WHAT `empireTuning.ts` SAYS `FAILURE_STRIKES` IS FOR, checked rather
    // than described. Its comment argued that a threshold above
    // `LADDER_STARTING_EQUIPMENT.length` would put pure neglect structurally
    // out of reach of failure, and said this file "pins the relation rather
    // than the number". It did not: the only relation asserted anywhere was
    // `FAILURE_STRIKES > FAILURE_WARNING_STRIKES`, and a threshold of 4 would
    // have reddened only by accident, when `items[FAILURE_STRIKES - 1]` went
    // undefined in some other fixture. That is the shape this codebase has
    // recorded four times as not the check working.
    //
    // Both halves are here now. The arithmetic relation:
    const owned = ownedItemsOf(createManagedGym().gym);
    expect(owned.length).toBe(EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT.length);
    expect(EMPIRE_TUNING.FAILURE_STRIKES).toBeLessThanOrEqual(owned.length);
    expect(EMPIRE_TUNING.FAILURE_STRIKES).toBeGreaterThan(EMPIRE_TUNING.FAILURE_WARNING_STRIKES);

    // And the BEHAVIOUR the relation exists for, which is the half that
    // cannot be satisfied by an inequality between two literals: refusing
    // every owned item's standing order exactly once — the most a gym that
    // never repairs can ever refuse, because a restatement appends nothing —
    // reaches `'failed'`, and it does so having appended exactly one strike
    // per item.
    let neglected = gymAt(0.3, 0);
    for (const [at, item] of owned.entries()) {
      const declined = declineRepair(neglected, item, at);
      expect(declined.kind).toBe('declined');
      if (declined.kind !== 'declined') return;
      expect(declined.counted, `first refusal of ${item}`).toBe(true);
      neglected = declined.state;
    }
    expect(neglected.strikes.length).toBe(owned.length);
    expect(failurePhase(neglected)).toBe('failed');
    // Restating every one of them adds nothing, so `owned.length` really is
    // the ceiling and not merely the count this fixture happened to stop at.
    for (const [at, item] of owned.entries()) {
      const again = declineRepair(neglected, item, owned.length + at);
      expect(again.kind).toBe('declined');
      if (again.kind !== 'declined') return;
      expect(again.counted, `restated refusal of ${item}`).toBe(false);
      neglected = again.state;
    }
    expect(neglected.strikes.length).toBe(owned.length);
  });
});

describe('the never-punish sweep', () => {
  it('measures every family on every PairDivergence counter, the GDD three per policy, counts pinned exactly', () => {
    // One equality over the whole battery. Every family carries the same
    // fifteen fields AND a per-policy row of GDD §5.13's three quantities, so
    // `condition`, `income deducted` and `failure progression` are pinned
    // wherever the sweep runs and split by the model of a player that produced
    // them. Whatever they measure is what is pinned.
    const measured = measureSweep();
    expect({
      families: measured.families,
      hiringNet: measured.hiringNet,
      hiringNetWithoutAssetTerm: measured.hiringNetWithoutAssetTerm,
      safety: measured.safety,
    }).toEqual({
      families: EXPECTED_SWEEP.families,
      hiringNet: EXPECTED_SWEEP.hiringNet,
      hiringNetWithoutAssetTerm: EXPECTED_SWEEP.hiringNetWithoutAssetTerm,
      safety: EXPECTED_SWEEP.safety,
    });
  });

  it('RETRACTED IN PART, BY HUMAN RULING: within-horizon failure progression was ZERO on all six policies, and the re-keyed ordinal reopens it — pure absence stays ZERO', () => {
    // THE ROUND'S ORIGINAL BAR, KEPT VERBATIM SO THE RETRACTION IS LEGIBLE.
    // `docs/GDD.md` §5.13's wear-basis ruling said: "Within-horizon failure
    // progression goes to ZERO on the six-policy sweep, matched-trace
    // included, with the unfixed non-zero kept runnable as the control." A
    // later, more specific human ruling — the one this file's own §3a header
    // calls "RE-KEYED, BY HUMAN RULING" — asked for the review cadence to be
    // driven by the same real banked seconds money and wear already read.
    // Those two rulings are in tension on exactly this family, and the later
    // one wins by construction: `checkInsTaken` now reads real elapsed
    // operation time, and this family's whole domain is gap enlargements that
    // stay under the offline cap — the one case where that reading can move.
    // Measured, not argued: it moved, and the size is pinned below rather
    // than hidden behind a passing test.
    const within = EXPECTED_SWEEP.families.withinHorizon;
    const control = EXPECTED_SWEEP.families.withinHorizonConditionGatedControl;
    const engagement = EXPECTED_SWEEP.families.engagement;
    const pureAbsence = EXPECTED_SWEEP.families.pureAbsence;

    // (0) WHAT DID NOT BREAK, CHECKED FIRST BECAUSE IT IS THE MORE IMPORTANT
    // CLAIM. `pureAbsence` enlarges gaps that are ALREADY at or beyond the
    // offline horizon — genuine, long real absence, the "player simply not
    // opening the app" case §5.7 names by name. Every such gap's banked
    // contribution is capped at exactly one window before AND after the
    // enlargement, so `bankedOperationSeconds` — and therefore the review
    // ordinal — cannot move at all. This is real ZERO, not a narrowed claim:
    // long absence still cannot advance a review, a strike, or a phase, by
    // any amount, on any policy.
    expect(pureAbsence.all.failureMismatches).toBe(0);
    expect(pureAbsence.all.variantPhaseWorse).toBe(0);
    expect(pureAbsence.all.matchedTraceFailureMismatches).toBe(0);
    expect(pureAbsence.all.conditionMismatches).toBe(0);
    expect(pureAbsence.all.moneyMismatches).toBe(0);

    // (1) WHAT DID BREAK: `withinHorizon` enlarges a gap that STAYS under the
    // cap, so its real seconds bank in full both before and after — the same
    // way they already did for money and wear (allowed) and now also for the
    // review ordinal (the newly-opened channel). No longer zero on any of the
    // three failure counters, on the family or on any policy that can strike.
    expect(within.all.failureMismatches).toBe(1401);
    expect(within.all.variantPhaseWorse).toBe(582);
    expect(within.all.matchedTraceFailureMismatches).toBe(224);
    for (const policy of MANAGEMENT_POLICIES) {
      const row = within.byPolicy[policy];
      if (FAILURE_CLEAN_POLICIES.includes(policy)) {
        // The three player models that never refuse a standing order still
        // cannot append a strike, whatever the review's timing does — a
        // review with nothing behind it moves no failure counter.
        expect(row.failureMismatches, `withinHorizon/${policy}`).toBe(0);
        expect(row.variantPhaseWorse, `withinHorizon/${policy}`).toBe(0);
      } else {
        expect(row.failureMismatches, `withinHorizon/${policy}`).toBeGreaterThan(0);
      }
    }

    // (2) MATCHED-TRACE POPULATION, still non-empty and still real, though
    // smaller than before: 598 of 864 pairs (down from 848) realize identical
    // decision traces. The divergence census in the review-arrival test names
    // the wider set of decision kinds now involved.
    expect(within.all.matchedTracePairs).toBeGreaterThan(0);
    expect(within.all.matchedTracePairs + within.all.divergentTracePairs).toBe(within.all.pairs);

    // (3) THE CONTROL IS UNCHANGED, AND THE SHIPPED ROW NO LONGER BEATS IT.
    // `condition-gated-prompt-control` — the review this round originally
    // replaced — still reads exactly 310 / 186 / 124 / 923, because it never
    // read `checkInsTaken` and this re-keying did not touch it. What changed
    // is the comparison: the shipped gate used to strictly beat this control
    // on every failure counter and now strictly LOSES to it. That reversal is
    // the single clearest measurement of what this round cost, and it is
    // asserted directly rather than left to be inferred from two separate
    // pins.
    expect(control.all.failureMismatches).toBe(310);
    expect(control.all.variantPhaseWorse).toBe(186);
    expect(control.all.matchedTraceFailureMismatches).toBe(124);
    expect(control.all.variantNetLower).toBe(923);
    expect(within.all.failureMismatches).toBeGreaterThan(control.all.failureMismatches);
    expect(within.all.variantPhaseWorse).toBeGreaterThan(control.all.variantPhaseWorse);
    expect(within.all.matchedTraceFailureMismatches).toBeGreaterThan(
      control.all.matchedTraceFailureMismatches,
    );

    // THE MONEY READING THE NEVER-PUNISH RULE IS ACTUALLY ABOUT is still zero
    // on the engagement domain for every policy, including the divergent
    // traces — UNCHANGED by this round, because the engagement family's own
    // grid spaces every slot at exactly one offline window, so every event
    // banks exactly one window's worth whether or not the ordinal reads a
    // dispatch count or real seconds — the re-keying is invisible on this one
    // domain by construction, not by luck. `engagementEagerTurnaroundControl`
    // below is the number this zero is a zero against.
    expect(engagement.all.variantNetLower).toBe(0);
    for (const policy of MANAGEMENT_POLICIES) {
      expect(engagement.byPolicy[policy].variantNetLower, `engagement/${policy}`).toBe(0);
    }

    // WHAT THIS DOES NOT CLAIM, pinned rather than written as prose. The
    // engagement domain's FAILURE counters are not zero and are not asserted
    // to be: 909 and 524. They FELL against the old gate on the same grids
    // (1187 and 730), which was not the predicted direction, and the pins say
    // so as inequalities in the measured direction rather than as a summary.
    expect(engagement.all.failureMismatches).toBe(909);
    expect(engagement.all.variantPhaseWorse).toBe(524);
    expect(EXPECTED_SWEEP.families.engagementConditionGatedControl.all.failureMismatches)
      .toBeGreaterThan(engagement.all.failureMismatches);
    expect(EXPECTED_SWEEP.families.engagementConditionGatedControl.all.variantPhaseWorse)
      .toBeGreaterThan(engagement.all.variantPhaseWorse);

    // The three player models that never refuse a standing order are clean on
    // both domains, in both directions. Named rather than summed, because
    // "some policies are zero" is not a measurement.
    for (const policy of FAILURE_CLEAN_POLICIES) {
      expect(engagement.byPolicy[policy].failureMismatches, `engagement/${policy}`).toBe(0);
      expect(engagement.byPolicy[policy].variantPhaseWorse, `engagement/${policy}`).toBe(0);
    }
  });

  it('keeps the non-zero controls non-zero — the numbers the zeros are zero against', () => {
    // The equality above pins the controls exactly, which is what says a
    // control moved. It does NOT say a control still bites: re-pinning one
    // of these rows at zero would satisfy it perfectly. So the direction is
    // asserted on the PINNED CONSTANT rather than on the measurement, and
    // re-pinning a control to zero reddens here.
    const wallClock = EXPECTED_SWEEP.families.pureAbsenceWallClockControl.all;
    const absenceStrike = EXPECTED_SWEEP.families.pureAbsenceStrikeControl.all;
    const visitFee = EXPECTED_SWEEP.families.engagementVisitFeeControl.all;
    const slumpEngagement = EXPECTED_SWEEP.families.engagementSlumpControl.all;
    const slumpWithin = EXPECTED_SWEEP.families.withinHorizonSlumpControl.all;
    const repeatWithin = EXPECTED_SWEEP.families.withinHorizonRepeatStrikeControl.all;
    const repeatEngagement = EXPECTED_SWEEP.families.engagementRepeatStrikeControl.all;
    const conditionGatedWithin = EXPECTED_SWEEP.families.withinHorizonConditionGatedControl.all;
    const eagerTurnaround = EXPECTED_SWEEP.families.engagementEagerTurnaroundControl.all;

    expect(wallClock.conditionMismatches).toBeGreaterThan(0);
    expect(wallClock.variantConditionLower).toBeGreaterThan(0);
    expect(wallClock.variantDeductedMore).toBeGreaterThan(0);
    expect(absenceStrike.failureMismatches).toBeGreaterThan(0);
    expect(absenceStrike.variantPhaseWorse).toBeGreaterThan(0);
    expect(visitFee.variantNetLower).toBeGreaterThan(0);
    expect(slumpEngagement.variantNetLower).toBeGreaterThan(
      EXPECTED_SWEEP.families.engagement.all.variantNetLower,
    );
    // THE SLUMP CONTROL'S WITHIN-HORIZON HALF WAS DEAD UNDER THE OLD ORDINAL
    // AND IS LIVE AGAIN NOW, and that reversal is itself part of what this
    // round cost. It used to read equal to the shipped row (1421 vs 921 —
    // read the git history at that commit if the exact old pair matters)
    // because both runs of a within-horizon pair crossed the failure line at
    // the same INDEX, so the slump fired at the same index on both and
    // cancelled out of a per-index comparison. Under the re-keyed ordinal the
    // two runs of a pair no longer reliably cross at the same index — that is
    // the whole regression this round's other tests measure — so the slump
    // now fires at DIFFERENT indices some of the time and no longer cancels:
    // 1460 against a shipped 1301, greater rather than equal. Asserted as a
    // strict inequality rather than re-pinned as a new equality, because
    // "dead again by coincidence" is exactly the silent failure mode a
    // control exists to catch.
    expect(slumpWithin.variantNetLower).toBeGreaterThan(
      EXPECTED_SWEEP.families.withinHorizon.all.variantNetLower,
    );
    // THE TWO CONTROLS THIS ROUND ADDED, on the counters they are controls FOR.
    //
    // `condition-gated-prompt-control` is the review this round replaced. It
    // has to move FAILURE PROGRESSION on the within-horizon domain, and the
    // whole bar depends on it doing so, which is why it is asserted on three
    // counters rather than one.
    expect(conditionGatedWithin.failureMismatches).toBeGreaterThan(0);
    expect(conditionGatedWithin.variantPhaseWorse).toBeGreaterThan(0);
    expect(conditionGatedWithin.matchedTraceFailureMismatches).toBeGreaterThan(0);
    // And the mechanism it used to differ from the ship BY: under the removed
    // condition gate the review's arrival moved with wear, so the two runs of
    // a pair saw different numbers of reviews. THIS WAS ONCE THE SHIPPED
    // GATE'S WHOLE ADVANTAGE — under the dispatch-count ordinal the two runs
    // never diverged. Under the re-keyed, real-banked-seconds ordinal they now
    // do too, at a similar order of magnitude to the removed gate: 7662
    // mismatches against the control's own reviewsOfferedMismatches, both
    // asserted as measurements rather than the shipped side being pinned back
    // to a zero it no longer reads.
    expect(conditionGatedWithin.reviewsOfferedMismatches).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.families.withinHorizon.all.reviewsOfferedMismatches).toBe(7662);
    expect(EXPECTED_SWEEP.families.withinHorizon.all.reviewsOfferedMismatches).toBeGreaterThan(0);
    //
    // `eager-turnaround-control` is the `'redemptive'` model this round
    // changed: it shed any manager on the way back from dormancy rather than
    // only the one recovery is blocked on. The counter it is a control FOR is
    // MONEY on the engagement domain — the §12.3 reading — and the shipped
    // zero beside it is what it is a control for.
    expect(eagerTurnaround.variantNetLower).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.families.engagement.all.variantNetLower).toBe(0);
    // It varies ONE axis and says so: every other counter in that family is
    // identical to the shipped row, because the only thing that differs is
    // whether an unrequired dismissal happens. A control that also moved the
    // failure counters would leave the money difference attributable to
    // either, so the identity is asserted rather than assumed.
    expect(eagerTurnaround.failureMismatches).toBe(
      EXPECTED_SWEEP.families.engagement.all.failureMismatches,
    );
    expect(eagerTurnaround.reviewsOfferedMismatches).toBe(
      EXPECTED_SWEEP.families.engagement.all.reviewsOfferedMismatches,
    );
    expect(eagerTurnaround.conditionMismatches).toBe(
      EXPECTED_SWEEP.families.engagement.all.conditionMismatches,
    );

    // THE REPEAT-STRIKE CONTROL, AND THE HALF OF IT THAT IS NOW DEAD. It is
    // the pre-ruling per-refusal ledger, and it still bites on the ENGAGEMENT
    // domain, where the two runs of a pair take different numbers of
    // decisions.
    expect(repeatEngagement.failureMismatches).toBeGreaterThan(
      EXPECTED_SWEEP.families.engagement.all.failureMismatches,
    );
    expect(repeatEngagement.matchedTraceFailureMismatches).toBeGreaterThan(
      EXPECTED_SWEEP.families.engagement.all.matchedTraceFailureMismatches,
    );
    //
    // ON THE WITHIN-HORIZON DOMAIN IT USED TO MEASURE NOTHING, AND NOW
    // MEASURES SOMETHING AGAIN — the same reversal the slump control shows,
    // for the same reason: under the OLD ordinal both runs of a within-
    // horizon pair took the same decisions at the same indices, so they
    // carried the same strikes under either ledger and the control could not
    // differ from the ship. Under the RE-KEYED ordinal that is no longer
    // guaranteed, so the per-refusal ledger and the per-order ledger now
    // genuinely disagree on this domain too. Asserted as a strict inequality
    // rather than an equality, so "dead again by coincidence" would redden
    // here exactly as it would for the slump control above.
    expect(repeatWithin.failureMismatches).toBeGreaterThan(
      EXPECTED_SWEEP.families.withinHorizon.all.failureMismatches,
    );
    expect(repeatWithin.matchedTraceFailureMismatches).toBeGreaterThan(
      EXPECTED_SWEEP.families.withinHorizon.all.matchedTraceFailureMismatches,
    );
    // The control is not dead everywhere, which is what says the equality
    // above is a property of THIS domain and not of a broken control: the
    // same wiring, driven on the engagement grids, produces suppressed repeat
    // strikes across the battery.
    expect(EXPECTED_SWEEP.domain.controlRepeatStrikes).toBeGreaterThan(0);
    // AND THE COUNTER THE LEDGER STILL DOES NOT MOVE, ON EITHER DOMAIN,
    // SURVIVES UNCHANGED: `variantPhaseWorse`. The ledger decides what a
    // refusal is WORTH; it does not decide which check-in the refusal
    // happens at, and that stays true whether the ordinal reads a dispatch
    // count or real banked seconds.
    expect(repeatEngagement.variantPhaseWorse).toBe(
      EXPECTED_SWEEP.families.engagement.all.variantPhaseWorse,
    );
    expect(repeatWithin.variantPhaseWorse).toBe(
      EXPECTED_SWEEP.families.withinHorizon.all.variantPhaseWorse,
    );
    expect(EXPECTED_SWEEP.domain.controlStrikes).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.controlCharges).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.controlSlumps).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.controlRepeatStrikes).toBeGreaterThan(0);
    // THE VISIT-FEE DIAL, AND THE HOLE THAT WAS IN IT. It was a bare 400
    // against a garage threshold of 360 — an 11% margin over a number that is
    // not a constant of the design but a product of three tuning values, so a
    // tuner who raised the garage rate made this control vacuous without
    // touching it. It is DERIVED now, from the same three values times a named
    // margin, so it moves with them. Both halves are checked here: the
    // derivation, and the assumption the derivation rests on — that every run
    // in this battery really is at the garage rung, which `runManagedGym`
    // gives by construction (it folds `gymCheckIn`, which accrues and never
    // relocates) and which is measured rather than argued.
    expect(MANAGEMENT_SWEEP.VISIT_FEE_GYM_BUCKS).toBe(
      garageHorizonIncomeGymBucks() * MANAGEMENT_SWEEP.VISIT_FEE_MARGIN,
    );
    expect(MANAGEMENT_SWEEP.VISIT_FEE_MARGIN).toBeGreaterThan(1);
    let garageRuns = 0;
    for (const run of runMemo.values()) {
      expect(run.state.gym.ladder.rung).toBe(EMPIRE_TUNING.LADDER_RUNGS[0]);
      garageRuns += 1;
    }
    expect(garageRuns).toBe(EXPECTED_SWEEP.domain.runs);
  });

  it('the removed dormancy slump and the removed repeat-strike ledger still bite when they are put back', () => {
    // Two controls, two removed mechanisms, run over the same domains under
    // the same policies with the same comparators. Their non-zeros are what
    // say the shipped zeros are properties of the model rather than of a
    // domain in which nothing could ever have gone wrong.
    const measured = measureSweep();

    expect(measured.domain.controlSlumps).toBeGreaterThan(0);
    expect(measured.domain.controlRepeatStrikes).toBeGreaterThan(0);
    expect(measured.families.engagementSlumpControl.all.variantNetLower).toBeGreaterThan(0);
    // The shipped contrast: money never falls for the more engaged player.
    expect(measured.families.engagement.all.variantNetLower).toBe(0);
    // And the repeat-strike control's own contrast, on the counter it is a
    // control FOR and on the DOMAIN it still reaches: with every refusal
    // counted again, an extra check-in lands more strikes by a shared second.
    // Measured rather than read off the pin — this block drives the sweep.
    expect(
      measured.families.engagementRepeatStrikeControl.all.failureMismatches,
    ).toBeGreaterThan(measured.families.engagement.all.failureMismatches);
    // The `engagementEagerTurnaroundControl` half of this pair still bites
    // exactly as before — that control never read `checkInsTaken`.
    expect(
      measured.families.engagementEagerTurnaroundControl.all.variantNetLower,
    ).toBeGreaterThan(measured.families.engagement.all.variantNetLower);
    // THE `withinHorizonConditionGatedControl` HALF IS THE ONE THIS ROUND'S
    // RE-KEYING REVERSED, AND THE REVERSAL IS THE MEASUREMENT NOW. It used to
    // strictly EXCEED the shipped row on this counter — the whole point of a
    // control kept runnable beside a zero — and it no longer does, because the
    // shipped row stopped being smaller. Recorded here as the direct
    // consequence of the re-keying (`management.ts` header §3a's retraction,
    // and the dedicated test above named for exactly this reversal), not
    // silently re-pinned back to a `toBeGreaterThan` that would now be false.
    expect(
      measured.families.withinHorizonConditionGatedControl.all.failureMismatches,
    ).toBeLessThan(measured.families.withinHorizon.all.failureMismatches);
  });

  it("the withdrawn equal-strike sentence's numbers are kept as measurements, and §12.3's actual bar has its catcher", () => {
    // WHY THIS BLOCK EXISTS. §5.7 used to ask for the same strike total on
    // the same calendar for two histories differing only in check-in count.
    // A human WITHDREW that sentence rather than asking the code to meet it:
    // a strike needs a check-in, so more visits means more chances to refuse,
    // and forcing the totals equal buys it only with strikes during absence
    // (which breaks §5.7's surviving sentence) or with shown refusals that do
    // not count (which changes what a review costs). `management.ts` header
    // §3b has the ruling. Two things follow and both are asserted here.
    const measured = measureSweep();

    // ONE: 909 / 524 ARE KEPT AS MEASUREMENTS, NOT AS A BAR. They are what the
    // withdrawn sentence would have read. Pinned exactly rather than bounded,
    // because a number that stops being a bar is still the cheapest way to
    // notice the mechanism underneath it moving.
    expect(measured.families.engagement.all.failureMismatches).toBe(909);
    expect(measured.families.engagement.all.variantPhaseWorse).toBe(524);

    // TWO: THE BAR THAT DID SURVIVE IS §12.3 — the player who shows up more
    // must not end WORSE. The shipped model reads zero on both money
    // counters, and the numbers those zeros are zero against live in
    // `engagementEagerTurnaroundControl`: the player model this build removed,
    // kept runnable, differing from the shipped model on ONE axis.
    const shipped = measured.families.engagement.all;
    const unfixed = measured.families.engagementEagerTurnaroundControl.all;
    expect(shipped.variantNetLower).toBe(0);
    expect(shipped.matchedTraceNetLower).toBe(0);
    expect(unfixed.variantNetLower).toBe(36);
    expect(unfixed.matchedTraceNetLower).toBe(21);

    // AND THE CONTROL DIFFERS ON THE MONEY AXIS ALONE, which is what makes it
    // an attribution rather than a coincidence.
    //
    // A CENSUS DISPOSITION, ROUTED RATHER THAN SETTLED BY REWORDING. The
    // sentence above is a claim about what the code does and it has a
    // mutation-tested check under it: lifting one money field out of
    // `MONEY_FIELDS` reddens `differing` with the other field named. By
    // CLAUDE.md's rule that a claim-with-a-check takes the bump and a method
    // note declines it, the honest disposition is `GUARANTEE_COVERAGE
    // .TREE_WIDE` 236 -> 237. `src/game/guaranteeTags.test.ts` is another
    // session's file and barred to this one, so the bump is NOT taken here.
    // Measured rather than guessed: replacing that sentence's last word with
    // its scanned synonym reads `expected 237 to be 236`, one word changed
    // and nothing else. Recorded at the site per the standing precedent for
    // a builder that cannot take a crossing it believes is owed. Whoever owns
    // that file should take it, or say why this is a method note. Every counter except the two
    // money ones is byte-identical between the shipped model and the removed
    // one, so the 36 and the 21 cannot be a side effect of a gentler
    // adversary. Asserted as an equality over the whole record with the two
    // money fields lifted out, so a control that starts differing anywhere
    // else reddens here instead of quietly widening the attribution.
    // Stated as the LIST OF DIFFERING FIELD NAMES rather than as a deep
    // equality on the two records. A `toEqual` here bites — verified by
    // lifting only one money field out, which reddens — but it reddens with
    // `expected { pairs: 996, ...(13) } to deeply equal { pairs: 996,
    // ...(13) }` and names nothing. A check that bites and fails uselessly is
    // half a check, so the diff is computed and named.
    const MONEY_FIELDS = Object.freeze(['variantNetLower', 'matchedTraceNetLower']);
    const shippedRow = shipped as unknown as Record<string, number>;
    const unfixedRow = unfixed as unknown as Record<string, number>;
    const compared = Object.keys(shippedRow).filter((key) => !MONEY_FIELDS.includes(key));
    const differing = compared.filter((key) => shippedRow[key] !== unfixedRow[key]);
    expect(differing).toEqual([]);
    // Non-vacuity, both ways: the comparison really ran over the whole record
    // minus the two money fields, so the empty diff above is not an empty
    // domain agreeing with itself. 15 counters, 2 lifted, 13 compared.
    expect(Object.keys(shippedRow)).toHaveLength(15);
    expect(compared).toHaveLength(13);
    // And the two lifted fields DO differ, so lifting them out was necessary
    // rather than decorative — the attribution is one axis, not zero.
    expect(MONEY_FIELDS.filter((key) => shippedRow[key] !== unfixedRow[key])).toEqual([
      ...MONEY_FIELDS,
    ]);
  });

  it('the purse identity closes on every reported term, so a spend cannot hide', () => {
    // The attribution below decomposes a deficit into reported terms. That is
    // only worth anything if the terms are ALL of them: a spend nobody
    // reports would be absorbed into `unexplained` and read as a mystery. So
    // the purse is reconstructed from the reported terms alone, reading by
    // reading, over every run the battery drove.
    measureSweep();
    let readings = 0;
    for (const run of runMemo.values()) {
      let purse = 0;
      for (const reading of run.readings) {
        readings += 1;
        purse = scrubPrecision(
          purse +
            reading.incomePaid -
            reading.wagePaid -
            reading.autoRepairSpend -
            reading.decisionSpend -
            reading.controlSpend,
        );
        expect(reading.settledGymBucks).toBeCloseTo(purse, 6);
      }
    }
    expect(readings).toBe(EXPECTED_SWEEP.domain.checkIns);
  });

  it('decomposes every within-horizon net-lower reading into its reported terms, and names what carries it', () => {
    // WHAT THIS ESTABLISHES. The previous round priced the residual against
    // ONE hypothesis — the dormancy crawl arriving early — and reported 297
    // readings that hypothesis did not cover, as `unexplained`. An
    // unexplained count is not a landing state, so this walk does not test a
    // hypothesis at all: it decomposes the deficit into the reported terms it
    // is algebraically made of, and pins which term carries each reading.
    //
    //   netPosition = settledGymBucks - fullRepairCost + managerAssetValue
    //
    // so, cumulatively over the readings up to and including this one,
    //
    //   deficit = (base income paid - variant income paid)
    //           + (variant wage - base wage)
    //           + (variant auto-repair spend - base auto-repair spend)
    //           + (variant decision spend - base decision spend)
    //           + (variant repair bill - base repair bill)
    //           + (base manager asset - variant manager asset)
    //
    // Every term on the right is a REPORTED field of `ManagedReading`, and
    // `the purse identity closes on every reported term` above is what says
    // the list is complete. `residual` is the identity's own closing error and
    // is pinned at zero, so a term added to `netPosition` and left out of this
    // decomposition reddens here rather than inflating a mystery bucket.
    let netLowerReadings = 0;
    let netLowerPairs = 0;
    let largestTermIncome = 0;
    let largestTermWage = 0;
    let largestTermAutoRepair = 0;
    let largestTermDecisionSpend = 0;
    let largestTermRepairBill = 0;
    let largestTermManagerAsset = 0;
    let maxDeficit = 0;
    let maxIdentityError = 0;
    const byPolicy: Record<string, number> = {};
    const carriersByPolicy: Record<string, Record<string, number>> = {};
    for (const policy of MANAGEMENT_SWEEP.WITHIN_HORIZON_POLICIES) {
      byPolicy[policy] = 0;
      carriersByPolicy[policy] = {
        income: 0,
        wage: 0,
        autoRepair: 0,
        decisionSpend: 0,
        repairBill: 0,
        managerAsset: 0,
      };
    }

    for (const [seed, index, gapAt, extra] of withinHorizonPairKeys()) {
      const gaps = gapScheduleAt(seed, index);
      const baseTimes = timesOf(gaps);
      const variantTimes = timesOf(moreAbsentBy(gaps, gapAt, extra));
      for (const policy of MANAGEMENT_SWEEP.WITHIN_HORIZON_POLICIES) {
        const base = runManagedGym(baseTimes, policy as ManagementPolicy);
        const variant = runManagedGym(variantTimes, policy as ManagementPolicy);
        let incomeTerm = 0;
        let wageTerm = 0;
        let autoTerm = 0;
        let decisionTerm = 0;
        let pairHadLower = false;
        for (const [at, left] of base.readings.entries()) {
          const right = variant.readings[at];
          if (right === undefined) continue;
          incomeTerm += left.incomePaid - right.incomePaid;
          wageTerm += right.wagePaid - left.wagePaid;
          autoTerm += right.autoRepairSpend - left.autoRepairSpend;
          decisionTerm += right.decisionSpend - left.decisionSpend;
          const billTerm = right.fullRepairCost - left.fullRepairCost;
          const managerTerm = left.managerAssetValue - right.managerAssetValue;
          const deficit = left.netPosition - right.netPosition;
          if (deficit <= MANAGEMENT_SWEEP.NET_TOLERANCE) continue;
          netLowerReadings += 1;
          byPolicy[policy] = (byPolicy[policy] ?? 0) + 1;
          pairHadLower = true;
          if (deficit > maxDeficit) maxDeficit = deficit;
          const terms: readonly (readonly [string, number])[] = [
            ['income', incomeTerm],
            ['wage', wageTerm],
            ['autoRepair', autoTerm],
            ['decisionSpend', decisionTerm],
            ['repairBill', billTerm],
            ['managerAsset', managerTerm],
          ];
          const sum = terms.reduce((total, [, value]) => total + value, 0);
          const error = Math.abs(sum - deficit);
          if (error > maxIdentityError) maxIdentityError = error;
          let carrier = terms[0] as readonly [string, number];
          for (const term of terms) if (term[1] > carrier[1]) carrier = term;
          const bucket = carriersByPolicy[policy] as Record<string, number>;
          bucket[carrier[0]] = (bucket[carrier[0]] ?? 0) + 1;
          if (carrier[0] === 'income') largestTermIncome += 1;
          else if (carrier[0] === 'wage') largestTermWage += 1;
          else if (carrier[0] === 'autoRepair') largestTermAutoRepair += 1;
          else if (carrier[0] === 'decisionSpend') largestTermDecisionSpend += 1;
          else if (carrier[0] === 'repairBill') largestTermRepairBill += 1;
          else largestTermManagerAsset += 1;
        }
        if (pairHadLower) netLowerPairs += 1;
      }
    }

    expect({
      netLowerReadings,
      netLowerPairs,
      largestTermIncome,
      largestTermWage,
      largestTermAutoRepair,
      largestTermDecisionSpend,
      largestTermRepairBill,
      largestTermManagerAsset,
      maxDeficitGymBucks: atGrain(maxDeficit),
      identityErrorGymBucks: atGrain(maxIdentityError),
      byPolicy,
      carriersByPolicy,
    }).toEqual(EXPECTED_SWEEP.withinHorizonAttribution);

    // The decomposition walks exactly the readings the sweep counted, so a
    // divergence between the two would mean one of them is walking a
    // different domain. Read from the sweep rather than restated.
    expect(netLowerReadings).toBe(measureSweep().families.withinHorizon.all.variantNetLower);
    // Non-vacuity: the walk found readings to price. Without this the whole
    // block passes on an empty residual and reports honest zeros.
    expect(EXPECTED_SWEEP.withinHorizonAttribution.netLowerReadings).toBeGreaterThan(0);
    // And the decomposition is exact, not approximate: every reading's six
    // reported terms sum to its deficit.
    expect(EXPECTED_SWEEP.withinHorizonAttribution.identityErrorGymBucks).toBe(0);
  });

  it("RETRACTED CLAIM, KEPT AS A MEASUREMENT: the review's arrival used to be index-invariant within the horizon, and is not any more", () => {
    // THE MECHANISM, MEASURED RATHER THAN ARGUED — AND WHAT IT NOW MEASURES
    // IS A REGRESSION, DISCLOSED RATHER THAN HIDDEN. The claim this test used
    // to establish rested on one structural fact: a maintenance review was
    // raised on a check-in ORDINAL that only ever counted DISPATCHES, so
    // enlarging a gap changed gap lengths without changing how many
    // check-ins there were, and the review's index could not move. A later,
    // more specific human ruling ("one clock... for money, for wear, and now
    // for review cadence" — `management.ts` header §3a) re-keyed that ordinal
    // to real banked seconds, the same quantity money and wear already read.
    // A within-horizon gap enlargement now adds directly to that total, so it
    // genuinely CAN move the review onto a different index. This test still
    // walks the same three populations it always did — the shipped gate, the
    // removed condition gate over the identical within-horizon pairs, and the
    // engagement grids — and reports what it finds rather than what it used
    // to find.
    //
    // This walk buckets every pair by its own `reviewsOfferedMismatches` — a
    // REPORTED field of `ManagedReading`, written by `runManagedGym` from
    // `maintenancePromptUnder`, not a recomputation of the cadence by the
    // test — and tallies the failure counters on each side.
    //
    // WHAT THE SPLIT NOW SHOWS. The within-horizon shifted bucket holds 420 of
    // 864 pairs (up from 0), carrying every one of the family's 1401 failure
    // mismatches and 582 phase-worse readings — so the regression is
    // concentrated exactly where the mechanism predicts it: pairs whose
    // review opened on a different index. The matched bucket (444 pairs,
    // where the review still landed on the same index in both runs) still
    // reads 0 failure mismatches, which is the part of the original claim
    // that survives: WHEN the review does not move, nothing downstream of it
    // differs either. The condition-gated control is UNCHANGED (155 shifted
    // of 864, 310 failure mismatches, 186 phase-worse) because that gate
    // never read `checkInsTaken` and this round did not touch it — so the
    // shipped gate no longer beats the control the way it used to; the two
    // are now closer in shape than they are apart.
    const rank: Record<string, number> = { sound: 0, warned: 1, failed: 2 };
    void rank;

    interface Bucket {
      pairs: number;
      matchedPairs: number;
      shiftedPairs: number;
      failureOnMatched: number;
      failureOnShifted: number;
      worseOnMatched: number;
      worseOnShifted: number;
      matchedTracePairs: number;
    }
    const empty = (): Bucket => ({
      pairs: 0,
      matchedPairs: 0,
      shiftedPairs: 0,
      failureOnMatched: 0,
      failureOnShifted: 0,
      worseOnMatched: 0,
      worseOnShifted: 0,
      matchedTracePairs: 0,
    });
    const add = (bucket: Bucket, divergence: PairDivergence): void => {
      bucket.pairs += 1;
      if (divergence.reviewsOfferedMismatches === 0) {
        bucket.matchedPairs += 1;
        bucket.failureOnMatched += divergence.failureMismatches;
        bucket.worseOnMatched += divergence.variantPhaseWorse;
      } else {
        bucket.shiftedPairs += 1;
        bucket.failureOnShifted += divergence.failureMismatches;
        bucket.worseOnShifted += divergence.variantPhaseWorse;
      }
      if (divergence.tracesMatch) bucket.matchedTracePairs += 1;
    };

    const shipped = empty();
    const control = empty();
    const engagement = empty();
    // The one pair on the engagement domain that carries a failure mismatch
    // while its review counts match — named rather than folded into a total,
    // because a residual of one is the kind that gets rounded away.
    const engagementMatchedOffenders: string[] = [];
    // Which decision kinds differ on the within-horizon pairs whose traces
    // diverge. The zeros above say no STRIKE moved; this says what did.
    const withinHorizonDivergentKinds = new Set<string>();

    const controlWiring = managementWiring('condition-gated-prompt-control', 0);
    for (const [seed, index, gapAt, extra] of withinHorizonPairKeys()) {
      const gaps = gapScheduleAt(seed, index);
      const baseTimes = timesOf(gaps);
      const variantTimes = timesOf(moreAbsentBy(gaps, gapAt, extra));
      for (const policy of MANAGEMENT_POLICIES) {
        const base = runManagedGym(baseTimes, policy);
        const variant = runManagedGym(variantTimes, policy);
        const divergence = comparePerIndex(base, variant);
        add(shipped, divergence);
        if (!divergence.tracesMatch) {
          const left = base.decisions.map((event) => `${event.kind}${event.counted ? '!' : ''}`);
          const right = variant.decisions.map((event) => `${event.kind}${event.counted ? '!' : ''}`);
          const longest = Math.max(left.length, right.length);
          for (let at = 0; at < longest; at += 1) {
            if (left[at] !== right[at]) {
              for (const kind of [left[at], right[at]]) {
                if (kind !== undefined) withinHorizonDivergentKinds.add(kind);
              }
            }
          }
        }
        add(
          control,
          comparePerIndex(
            runManagedGym(baseTimes, policy, controlWiring),
            runManagedGym(variantTimes, policy, controlWiring),
          ),
        );
      }
    }

    for (const seed of MANAGEMENT_SWEEP.SEEDS) {
      for (let index = 0; index < MANAGEMENT_SWEEP.GRID_SCHEDULES_PER_SEED; index += 1) {
        const attended = gridAt(seed, index);
        const baseTimes = gridTimes(attended);
        const unattended = attended
          .map((present, slot) => (present ? -1 : slot))
          .filter((slot) => slot >= 0)
          .filter((_, position) => position % MANAGEMENT_SWEEP.GRID_FLIP_STRIDE === 0);
        for (const slot of unattended) {
          const variantTimes = gridTimes(
            attended.map((present, at) => (at === slot ? true : present)),
          );
          for (const policy of MANAGEMENT_POLICIES) {
            const divergence = compareAtSharedTimes(
              runManagedGym(baseTimes, policy),
              runManagedGym(variantTimes, policy),
            );
            add(engagement, divergence);
            if (divergence.reviewsOfferedMismatches === 0 && divergence.failureMismatches > 0) {
              engagementMatchedOffenders.push(`${policy}/${seed}/${index}/${slot}`);
            }
          }
        }
      }
    }

    expect({
      withinHorizonPairs: shipped.pairs,
      withinHorizonMatchedPairs: shipped.matchedPairs,
      withinHorizonShiftedPairs: shipped.shiftedPairs,
      withinHorizonFailureMismatchesOnMatched: shipped.failureOnMatched,
      withinHorizonFailureMismatchesOnShifted: shipped.failureOnShifted,
      withinHorizonPhaseWorseOnMatched: shipped.worseOnMatched,
      withinHorizonPhaseWorseOnShifted: shipped.worseOnShifted,
      withinHorizonMatchedTracePairs: shipped.matchedTracePairs,
      controlPairs: control.pairs,
      controlMatchedPairs: control.matchedPairs,
      controlShiftedPairs: control.shiftedPairs,
      controlFailureMismatchesOnMatched: control.failureOnMatched,
      controlFailureMismatchesOnShifted: control.failureOnShifted,
      controlPhaseWorseOnMatched: control.worseOnMatched,
      controlPhaseWorseOnShifted: control.worseOnShifted,
      engagementPairs: engagement.pairs,
      engagementMatchedPairs: engagement.matchedPairs,
      engagementShiftedPairs: engagement.shiftedPairs,
      engagementFailureMismatchesOnMatched: engagement.failureOnMatched,
      engagementFailureMismatchesOnShifted: engagement.failureOnShifted,
      engagementPhaseWorseOnMatched: engagement.worseOnMatched,
      engagementPhaseWorseOnShifted: engagement.worseOnShifted,
    }).toEqual(EXPECTED_SWEEP.review);

    // THE RETRACTED CLAIM WOULD HAVE BEEN: every within-horizon pair is in
    // the matched bucket. It is not — 420 of 864 are now shifted — so this is
    // now a bounded, honest pair of claims instead: the review arrival still
    // decides the whole story (nothing moves on the matched side), and the
    // shifted side carries the whole regression.
    expect(EXPECTED_SWEEP.review.withinHorizonShiftedPairs).toBe(420);
    expect(EXPECTED_SWEEP.review.withinHorizonMatchedPairs).toBe(
      EXPECTED_SWEEP.review.withinHorizonPairs - EXPECTED_SWEEP.review.withinHorizonShiftedPairs,
    );
    // WHAT SURVIVES: on the matched side — where the review still lands on
    // the same index in both runs — failure and phase are still identical.
    // The whole regression sits on the shifted side, not spread evenly.
    expect(EXPECTED_SWEEP.review.withinHorizonFailureMismatchesOnMatched).toBe(0);
    expect(EXPECTED_SWEEP.review.withinHorizonPhaseWorseOnMatched).toBe(0);
    expect(EXPECTED_SWEEP.review.withinHorizonFailureMismatchesOnShifted).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.review.withinHorizonPhaseWorseOnShifted).toBeGreaterThan(0);

    // THE CONTROL IS UNCHANGED, which is what says this round's re-keying —
    // and not some unrelated drift in the sweep — is what moved the shipped
    // numbers above: `condition-gated-prompt-control` never read
    // `checkInsTaken`, so it reads exactly what it read before this round.
    expect(EXPECTED_SWEEP.review.controlPairs).toBe(EXPECTED_SWEEP.review.withinHorizonPairs);
    expect(EXPECTED_SWEEP.review.controlShiftedPairs).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.review.controlFailureMismatchesOnShifted).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.review.controlFailureMismatchesOnMatched).toBe(0);
    expect(EXPECTED_SWEEP.review.controlPhaseWorseOnMatched).toBe(0);
    // The control's split is total in the same way the shipped one is, which
    // is what says the review's arrival — not the ledger, not the wear — is
    // the quantity the failure counters track under BOTH gates.
    expect(
      EXPECTED_SWEEP.review.controlFailureMismatchesOnShifted +
        EXPECTED_SWEEP.review.controlFailureMismatchesOnMatched,
    ).toBe(EXPECTED_SWEEP.families.withinHorizonConditionGatedControl.all.failureMismatches);
    // AND THE SHIPPED GATE NO LONGER BEATS THE CONTROL IT WAS BUILT TO
    // REPLACE — stated as a direct comparison rather than left implicit in
    // two separate pins, because that comparison is exactly what regressed.
    expect(EXPECTED_SWEEP.review.withinHorizonShiftedPairs).toBeGreaterThan(
      EXPECTED_SWEEP.review.controlShiftedPairs,
    );
    expect(EXPECTED_SWEEP.review.withinHorizonFailureMismatchesOnShifted).toBeGreaterThan(
      EXPECTED_SWEEP.review.controlFailureMismatchesOnShifted,
    );

    // THE ENGAGEMENT DOMAIN IS WHERE THE OTHER RESIDUAL ALWAYS LIVED, and the
    // split still says so: both buckets are occupied, and 908 of the 909
    // failure mismatches and every one of the 524 phase-worse readings sit on
    // pairs whose review counts diverged. That part of the design's price is
    // unchanged by this round.
    expect(EXPECTED_SWEEP.review.engagementMatchedPairs).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.review.engagementShiftedPairs).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.review.engagementPhaseWorseOnMatched).toBe(0);
    // The one exception, named rather than absorbed: exactly one pair carries
    // a failure mismatch with matched review counts. It is a `redemptive`
    // pair whose decision traces MATCH, so it is a strike-timing difference
    // downstream of the purse rather than of the review — the money route.
    expect(EXPECTED_SWEEP.review.engagementFailureMismatchesOnMatched).toBe(1);
    expect(engagementMatchedOffenders).toEqual(['redemptive/11119/1/45']);

    // The splits cover exactly the sweep's own counts, so a divergence would
    // mean one of the two walks a different domain.
    expect(
      EXPECTED_SWEEP.review.withinHorizonFailureMismatchesOnMatched +
        EXPECTED_SWEEP.review.withinHorizonFailureMismatchesOnShifted,
    ).toBe(EXPECTED_SWEEP.families.withinHorizon.all.failureMismatches);
    expect(
      EXPECTED_SWEEP.review.engagementFailureMismatchesOnMatched +
        EXPECTED_SWEEP.review.engagementFailureMismatchesOnShifted,
    ).toBe(EXPECTED_SWEEP.families.engagement.all.failureMismatches);

    // WHAT THE DIVERGENT-TRACE PAIRS ACTUALLY DIVERGE ON, enumerated rather
    // than left as a remainder — RE-DERIVED, and both the count and the set
    // grew. `matchedTracePairs` is now 598 of 864 (down from 848), so 266
    // pairs now have a divergent decision trace (up from 16), and the set of
    // decision kinds involved widened from two purse-timed kinds to seven:
    // the review opening on a different index does not just retime a
    // purse-gated decision any more, it can add or remove a decline, a
    // dismiss, a recover or a repair outright, because the review is a
    // different EVENT on a different check-in, not only a different amount of
    // money available at the same one.
    expect(shipped.matchedTracePairs).toBe(EXPECTED_SWEEP.review.withinHorizonMatchedTracePairs);
    expect([...withinHorizonDivergentKinds].sort()).toEqual([
      'decline-repair',
      'hire-veteran',
      'prompt-dismiss',
      'prompt-dismiss!',
      'prompt-repair',
      'recover',
      'repair',
    ]);
  });

  it('walked a domain that is not empty, and says exactly what it saw', () => {
    const measured = measureSweep();
    expect(measured.domain).toEqual(EXPECTED_SWEEP.domain);
    // The within-horizon family genuinely differs — its zeros are directional,
    // not byte-identity, and a byte-identical family here would mean the
    // enlargement never changed a banked second. Asserted on the pin, so
    // re-pinning it at zero is red rather than merely a smaller number.
    expect(EXPECTED_SWEEP.families.withinHorizon.all.conditionMismatches).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.families.withinHorizon.all.bankedMismatches).toBeGreaterThan(0);
    // The per-order ledger is doing work rather than being unreachable: the
    // battery really produced prompts on already-refused orders and declines
    // that appended nothing. Without these two the shipped zeros could be a
    // domain in which the suppression never fired.
    expect(EXPECTED_SWEEP.domain.promptsAlreadyRefused).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.uncountedDeclines).toBeGreaterThan(0);
    // The second condition read header §3e is about, read off the census
    // rather than argued. The whole-battery count is non-zero, so the counter
    // is not measuring an empty domain; the shipped-wiring count is zero, so
    // on this domain no shipped run has a manager's autonomous repair re-arm a
    // refused standing order. Both are pinned above as counts; these two
    // assertions state which way round each is meant to be, so a re-pin that
    // swapped them reddens here.
    expect(EXPECTED_SWEEP.domain.autoRepairsReopeningRefusedOrders).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.autoRepairsReopeningRefusedOrdersOnShipped).toBe(0);
  });

  it('names the only wiring that produces dismiss-manager, so deleting it is red', () => {
    // THE MUST-NOT-DELETE ON `engagementEagerTurnaroundControl`, MADE A CHECK
    // RATHER THAN A COMMENT. `FAMILY_WIRING`'s note says that control is the
    // sole producer of a `ManagedDecisionKind`; prose is not a check, so here
    // is the measurement it claims.
    measureSweep();
    const byWiring = new Map<ManagementWiringKey, number>();
    let total = 0;
    for (const run of runMemo.values()) {
      for (const event of run.decisions) {
        if (event.kind !== 'dismiss-manager') continue;
        byWiring.set(run.wiring.key, (byWiring.get(run.wiring.key) ?? 0) + 1);
        total += 1;
      }
    }
    expect([...byWiring.keys()]).toEqual(['eager-turnaround-control']);
    expect(total).toBe(EXPECTED_RUN_ARMS['run:dismiss-manager']);
    // ...and the shipped wiring contributes none of them, which is the other
    // half of the sentence: the model change is total on the shipped path, not
    // a reduction. Read as a lookup rather than as an absence, so an empty map
    // could not satisfy it on its own — the equality above already refuses
    // that.
    expect(byWiring.get(SHIPPED_MANAGEMENT_WIRING) ?? 0).toBe(0);
  });

  it('names where the re-armed standing orders sit, so header 3e is measured and not described', () => {
    // `management.ts` header §3e's second half says every one of the re-arm
    // events is `'wall-clock-wear-control'` — the wiring that wears on elapsed
    // time and therefore wears fastest — and that the shipped wiring
    // contributes none. Prose is not a check; this is the measurement.
    measureSweep();
    const byWiring = new Map<ManagementWiringKey, number>();
    let total = 0;
    for (const run of runMemo.values()) {
      const reopened = run.census.autoRepairsReopeningRefusedOrders;
      if (reopened === 0) continue;
      byWiring.set(run.wiring.key, (byWiring.get(run.wiring.key) ?? 0) + reopened);
      total += reopened;
    }
    expect([...byWiring.keys()]).toEqual(['wall-clock-wear-control']);
    expect(total).toBe(EXPECTED_SWEEP.domain.autoRepairsReopeningRefusedOrders);
    expect(byWiring.get(SHIPPED_MANAGEMENT_WIRING) ?? 0).toBe(
      EXPECTED_SWEEP.domain.autoRepairsReopeningRefusedOrdersOnShipped,
    );
  });
});

describe('the comparator the sweep grades on', () => {
  /** `netPosition`'s own arithmetic, written once, from a state. */
  function positionOf(state: ManagedGym): number {
    return scrubPrecision(
      state.gym.ladder.gymBucks -
        fullRepairCostGymBucks(state) +
        managerAssetValueGymBucks(state),
    );
  }

  it('netPosition is exactly its three reported terms, and nothing else', () => {
    // Every zero in the sweep above is a statement about `netPosition`, and
    // for one round nothing said what `netPosition` was. A fourth term could
    // have been added to zero the next violation and every pin would have
    // stayed green under a quantity that had quietly changed meaning.
    //
    // The three terms are reported per reading, so the identity is checkable
    // per reading. It bites on exactly the edit it is written about: adding a
    // term to `netPosition`'s expression moves `netPosition` and moves none
    // of the three reported reads, so this goes red.
    measureSweep();
    let readings = 0;
    let runs = 0;
    for (const run of runMemo.values()) {
      runs += 1;
      for (const reading of run.readings) {
        readings += 1;
        expect(reading.netPosition).toBe(
          scrubPrecision(
            reading.settledGymBucks - reading.fullRepairCost + reading.managerAssetValue,
          ),
        );
      }
      // The end-of-run direction, read off the run's own final state rather
      // than off the reading — a second reader of the same identity that does
      // not share the reading's terms.
      const last = run.readings[run.readings.length - 1];
      if (last === undefined) continue;
      expect(last.netPosition).toBe(positionOf(run.state));
      expect(last.settledGymBucks).toBe(run.state.gym.ladder.gymBucks);
      expect(last.fullRepairCost).toBe(fullRepairCostGymBucks(run.state));
      expect(last.managerAssetValue).toBe(managerAssetValueGymBucks(run.state));
    }
    // Non-vacuity: an empty memo would pass every assertion above.
    expect(runs).toBe(EXPECTED_SWEEP.domain.runs);
    expect(readings).toBe(EXPECTED_SWEEP.domain.checkIns);
  });

  it('a repair and a hire are both net-neutral at the moment of the spend', () => {
    // The second half of `netPosition`'s docstring, which claims both
    // adjustments are net-neutral at the spend by construction. Construction
    // is not a check, so both are driven: over four starting conditions for
    // the repair (each one a different bill), and over all three tiers for
    // the hire.
    let repairsChecked = 0;
    for (const condition of [0.1, 0.3, 0.5, 0.9]) {
      const worn = gymAt(condition, 100000);
      const before = positionOf(worn);
      const repaired = repairEquipment(worn, ITEM_ZERO);
      expect(repaired.kind).toBe('repaired');
      if (repaired.kind !== 'repaired') continue;
      repairsChecked += 1;
      expect(positionOf(repaired.state)).toBeCloseTo(before, 6);
      // And it really moved both terms, so the equality is not two halves of
      // nothing: the purse fell by the cost and the bill fell by the cost.
      expect(repaired.state.gym.ladder.gymBucks).toBeCloseTo(
        worn.gym.ladder.gymBucks - repaired.cost,
        6,
      );
      expect(fullRepairCostGymBucks(repaired.state)).toBeCloseTo(
        fullRepairCostGymBucks(worn) - repaired.cost,
        6,
      );
      expect(repaired.cost).toBeGreaterThan(0);
    }
    expect(repairsChecked).toBe(4);

    let hiresChecked = 0;
    for (const tier of EMPIRE_TUNING.MANAGER_TIERS) {
      const staffed = gymAt(1, 100000);
      const before = positionOf(staffed);
      const hired = hireManager(staffed, tier, 0);
      expect(hired.kind).toBe('hired');
      if (hired.kind !== 'hired') continue;
      hiresChecked += 1;
      expect(positionOf(hired.state)).toBeCloseTo(before, 6);
      expect(hired.state.gym.ladder.gymBucks).toBeCloseTo(
        staffed.gym.ladder.gymBucks - hired.cost,
        6,
      );
      expect(managerAssetValueGymBucks(hired.state)).toBeCloseTo(hired.cost, 6);
      expect(hired.cost).toBeGreaterThan(0);
    }
    expect(hiresChecked).toBe(EMPIRE_TUNING.MANAGER_TIERS.length);
  });
});

describe('the arm census', () => {
  it('reaches every declared arm, set-equal in both directions, counts pinned', () => {
    const arms = armCensus();
    const reached = Object.fromEntries(
      [...arms.entries()].sort(([left], [right]) => (left < right ? -1 : 1)),
    );
    expect(reached).toEqual({ ...EXPECTED_ARMS, ...EXPECTED_RUN_ARMS });
    // Every declared decision kind and phase was produced by some composed
    // run — a failure machine whose dormant arm no run reaches is the empty
    // domain this census exists to refuse.
    for (const kind of MANAGED_DECISION_KINDS) {
      expect(arms.get(`run:${kind}`) ?? 0, `run:${kind}`).toBeGreaterThan(0);
    }
    for (const phase of FAILURE_PHASES) {
      expect(arms.get(`run-phase:${phase}`) ?? 0, `run-phase:${phase}`).toBeGreaterThan(0);
    }
  });
});

