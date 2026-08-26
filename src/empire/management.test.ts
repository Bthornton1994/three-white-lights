/**
 * management.test.ts — unit tests for §5.11 stage 4's pure logic, and the
 * never-punish sweep the §5.13 unpause ruling names as the round's spine.
 *
 * The sweep parameters live here, as a named block, for the reason
 * `src/game/streakSweep.ts` exists (a measurement whose inputs are not
 * written down is an anecdote) and with the file suffix `src/tuning/audit.ts`
 * forces — `empireSweep.test.ts`'s header records the convention.
 *
 * The property under test, from `docs/GDD.md` §5.13's stage-4 stanza: two
 * histories identical except that one has more absence must never differ in
 * condition, in income deducted, or in failure progression. Three pair
 * families measure it, each with the scope its arithmetic actually supports
 * and a control its zeros are zeros against:
 *
 *   - pure absence: the same action sequence with a BEYOND-horizon gap
 *     enlarged — byte-identical everything, pinned at zero mismatches, with
 *     the wall-clock-wear and absence-strike controls pinned non-zero. This
 *     is the family the stanza's sentence is literally about, and it is the
 *     only one where byte-identity is even possible.
 *   - absence INSIDE the catch-up horizon: the offline cap pays for that
 *     time, so the gym operated through it and banked seconds genuinely
 *     move. Nothing in this family is zero, and every counter is pinned
 *     exactly — see `EXPECTED_SWEEP.withinHorizon`, which carries the
 *     numbers and what each one is, and `EXPECTED_SWEEP
 *     .withinHorizonAttribution`, which prices the money residual reading by
 *     reading against the mechanism the module header says causes it.
 *   - engagement: the same fixed grid with one extra check-in — CLAUDE.md's
 *     §12.3 rule. Zero net-lower readings including divergent traces,
 *     against a per-visit-fee control and the removed-slump control.
 *
 * ALL THREE FAMILIES CARRY GDD §5.13's THREE QUANTITIES — condition, income
 * deducted, failure progression — as exact counts. For one round the
 * within-horizon family carried none of them and pinned a money figure in
 * their place; `EXPECTED_SWEEP`'s own header says what was substituted for
 * what. Where one of the three is non-zero it is reported non-zero. This
 * file measures; whether a non-zero is acceptable is a design ruling.
 *
 * Counts are pinned exactly, never bounded, and the non-zero controls stay
 * runnable — the house standard from `src/game/streak.test.ts`. Two of the
 * controls are mechanisms this round took OUT of the shipped model
 * ('failure-slump-control') or never had in it, so the zeros are zeros
 * against something that was really tried.
 *
 * WHAT THIS FILE DOES NOT COVER. The sweep's domain is three seeds, a
 * five-entry gap menu straddling the horizon, and a 24-day two-slot grid at
 * 0.6 attendance. It says nothing about gap sizes off that menu, about
 * schedules longer than 200 check-ins, or about policies other than the six
 * `MANAGEMENT_POLICIES` — those are models of a player, not of §5, and a
 * seventh could behave differently. Where a claim depends on the domain
 * rather than on the arithmetic, it says so at the pin.
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
  warningSigns,
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
   * The policies the within-horizon family runs under: ALL SIX, and the
   * reason is a correction rather than a preference. It ran under
   * `NET_MONOTONE_POLICIES` — three of the six — for one round, which
   * excluded exactly `cheapskate`, `delegating` and `redemptive`: the three
   * whose spends are money-timed, and the three `netPosition`'s manager term
   * was added for. That is CLAUDE.md's "richness on one axis" tell with the
   * axis halved precisely where the family's residual lives, so the family
   * is driven over the whole policy vocabulary and whatever comes out is
   * pinned. Held as its own name rather than written inline so a future
   * narrowing is a visible edit here.
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
   * The visit-fee control's dial, in Gym Bucks per check-in. It has to clear
   * the income the extra check-in itself earns, or the control does not
   * control for anything: on this grid the slots are exactly one banking
   * horizon apart, so one extra check-in banks one extra horizon — 12 h at
   * the garage rate under the offline fraction, 360 raw Gym Bucks — and a fee
   * below that leaves the more-engaged run ahead on money and the control
   * silently vacuous. It was 40 for one round and read zero; the run that
   * caught it is `keeps the non-zero controls non-zero`, doing its job.
   *
   * What this dial actually measures, stated because 400 against 360 reads
   * stronger than it is. The margin is 40 Gym Bucks, 11% of the threshold,
   * and the threshold is not a constant of the design — it is
   * `LADDER_INCOME_GYM_BUCKS_PER_HOUR[rung] x OFFLINE_EARNINGS_FRACTION x
   * OFFLINE_EARNINGS_CAP_HOURS`, which is 360 at the garage and 1440 at the
   * storage unit. So this control demonstrates that a flat per-visit charge
   * punishes engagement AT THE GARAGE RATE, on a sweep whose runs never leave
   * the garage: `runManagedGym` folds `gymCheckIn`, which accrues and does
   * not relocate, so every run in this battery is a garage run and the
   * storage-unit case is outside the domain rather than covered by it. A
   * tuner who raises the garage rate past 800/hour makes this control
   * vacuous without touching this number, and the assertion that would catch
   * that is the pinned effect size below, not this comment.
   */
  VISIT_FEE_GYM_BUCKS: 400,

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
   * the domain census counts it. It exists for one declared arm the seeded
   * schedules do not reach: `dismiss-manager`, which needs a gym that fails,
   * recovers, takes on the manager the comeback hires, and then fails a
   * SECOND time while still staffed. The seeded schedules are 40 and ~29
   * check-ins long and the second failure lands past the end of both — an arm
   * that is reachable and unreached, which is a fixture gap and not a
   * modelling one, so the fixture is what changes.
   */
  DIRECTED_RUN_CHECK_INS: 200,
  DIRECTED_RUN_GAP_SECONDS: 86400,
  DIRECTED_RUN_POLICY: 'redemptive',

  /**
   * The policies the ENGAGEMENT family's net-position pin runs under: the
   * ones whose spends are position-neutral (repairs remove exactly the bill
   * they pay off) or absent. Hiring policies are measured separately in the
   * same loop, because a hire is a timed lump spend and a richer run hires
   * earlier — the phasing class `engagement.ts` measured and attributed to
   * the player model rather than the design. Their pin is conditional on
   * matching manager states. So the engagement family covers all six between
   * the two blocks; the split is a difference in what is asserted, not a
   * narrowing of the domain.
   *
   * It is NOT the within-horizon family's policy list any more, and that is
   * the whole of this round's FIX 2. That family read this constant for one
   * round, which silently narrowed it to three; it reads
   * `WITHIN_HORIZON_POLICIES` now. A list named for what it is asserted
   * ABOUT ('net monotone') read as if it were a list of subjects, which is
   * the kind of reuse that halves an axis without anybody choosing to.
   */
  NET_MONOTONE_POLICIES: Object.freeze(['hands-off', 'diligent', 'negligent'] as const),

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
  for (const [at, left] of base.readings.entries()) {
    const right = variant.readings[at];
    if (right === undefined) throw new Error('reading lengths diverged mid-walk');
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
  for (const left of base.readings) {
    const right = variantAt.get(left.atSeconds);
    if (right === undefined) {
      throw new Error(`the more engaged run has no reading at ${left.atSeconds}`);
    }
    comparedReadings += 1;
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

interface FamilyTally {
  pairs: number;
  comparedReadings: number;
  bankedMismatches: number;
  conditionMismatches: number;
  moneyMismatches: number;
  failureMismatches: number;
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

function emptyFamily(): FamilyTally {
  return {
    pairs: 0,
    comparedReadings: 0,
    bankedMismatches: 0,
    conditionMismatches: 0,
    moneyMismatches: 0,
    failureMismatches: 0,
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

function addPair(tally: FamilyTally, divergence: PairDivergence): void {
  tally.pairs += 1;
  tally.comparedReadings += divergence.comparedReadings;
  tally.bankedMismatches += divergence.bankedMismatches;
  tally.conditionMismatches += divergence.conditionMismatches;
  tally.moneyMismatches += divergence.moneyMismatches;
  tally.failureMismatches += divergence.failureMismatches;
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
}

interface SweepMeasurement {
  readonly pureAbsence: FamilyTally;
  readonly wallClockControl: FamilyTally;
  readonly absenceStrikeControl: FamilyTally;
  readonly withinHorizon: FamilyTally;
  readonly engagement: FamilyTally;
  readonly visitFeeControl: FamilyTally;
  readonly failureSlumpControl: FamilyTally;
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
    strikesRecorded: number;
    runsThatFailed: number;
    runsThatRecovered: number;
    autoRepairs: number;
    hires: number;
    declines: number;
    countedDismissals: number;
    controlStrikes: number;
    controlCharges: number;
    controlSlumps: number;
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
  measurement.domain.strikesRecorded += run.state.strikes.length;
  if (run.census.failedAtCheckIn !== null) measurement.domain.runsThatFailed += 1;
  if (run.census.recoveries > 0) measurement.domain.runsThatRecovered += 1;
  measurement.domain.autoRepairs += run.census.autoRepairs;
  measurement.domain.hires += run.census.hires;
  measurement.domain.declines += run.census.declines;
  measurement.domain.countedDismissals += run.census.countedDismissals;
  measurement.domain.controlStrikes += run.census.controlStrikes;
  measurement.domain.controlCharges += run.census.controlCharges;
  measurement.domain.controlSlumps += run.census.controlSlumps;
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
  const measurement: SweepMeasurement = {
    pureAbsence: emptyFamily(),
    wallClockControl: emptyFamily(),
    absenceStrikeControl: emptyFamily(),
    withinHorizon: emptyFamily(),
    engagement: emptyFamily(),
    visitFeeControl: emptyFamily(),
    failureSlumpControl: emptyFamily(),
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
      strikesRecorded: 0,
      runsThatFailed: 0,
      runsThatRecovered: 0,
      autoRepairs: 0,
      hires: 0,
      declines: 0,
      countedDismissals: 0,
      controlStrikes: 0,
      controlCharges: 0,
      controlSlumps: 0,
    },
    safety: { negativePurses: 0, acceleratedTouched: 0, wageShortfalls: 0 },
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
          for (const policy of MANAGEMENT_POLICIES) {
            addPair(
              measurement.pureAbsence,
              comparePerIndex(
                runOf(baseTimes, policy, 'shipped', measurement),
                runOf(moreAbsent, policy, 'shipped', measurement),
              ),
            );
          }
          addPair(
            measurement.wallClockControl,
            comparePerIndex(
              runOf(baseTimes, 'hands-off', 'wall-clock-wear-control', measurement),
              runOf(moreAbsent, 'hands-off', 'wall-clock-wear-control', measurement),
            ),
          );
          addPair(
            measurement.absenceStrikeControl,
            comparePerIndex(
              runOf(baseTimes, 'hands-off', 'absence-strike-control', measurement),
              runOf(moreAbsent, 'hands-off', 'absence-strike-control', measurement),
            ),
          );
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
        for (const policy of MANAGEMENT_SWEEP.NET_MONOTONE_POLICIES) {
          addPair(
            measurement.engagement,
            compareAtSharedTimes(
              runOf(baseTimes, policy, 'shipped', measurement),
              runOf(moreEngaged, policy, 'shipped', measurement),
            ),
          );
        }
        for (const policy of MANAGEMENT_SWEEP.HIRING_POLICIES) {
          const base = runOf(baseTimes, policy, 'shipped', measurement);
          const variant = runOf(moreEngaged, policy, 'shipped', measurement);
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
        addPair(
          measurement.visitFeeControl,
          compareAtSharedTimes(
            runOf(baseTimes, 'hands-off', 'visit-fee-control', measurement),
            runOf(moreEngaged, 'hands-off', 'visit-fee-control', measurement),
          ),
        );
        {
          // The removed dormancy entry slump, run as a control on the family
          // it was measured non-zero on. Same policy, same grids, same
          // comparator as the shipped 'negligent' rows above — the only thing
          // that differs is the mechanism.
          const slumpPolicy = MANAGEMENT_SWEEP.FAILURE_SLUMP_CONTROL_POLICY as ManagementPolicy;
          addPair(
            measurement.failureSlumpControl,
            compareAtSharedTimes(
              runOf(baseTimes, slumpPolicy, 'failure-slump-control', measurement),
              runOf(moreEngaged, slumpPolicy, 'failure-slump-control', measurement),
            ),
          );
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
    for (const policy of MANAGEMENT_SWEEP.WITHIN_HORIZON_POLICIES) {
      addPair(
        measurement.withinHorizon,
        comparePerIndex(
          runOf(baseTimes, policy, 'shipped', measurement),
          runOf(moreAbsent, policy, 'shipped', measurement),
        ),
      );
    }
    const slumpPolicy = MANAGEMENT_SWEEP.FAILURE_SLUMP_CONTROL_POLICY as ManagementPolicy;
    addPair(
      measurement.failureSlumpControl,
      comparePerIndex(
        runOf(baseTimes, slumpPolicy, 'failure-slump-control', measurement),
        runOf(moreAbsent, slumpPolicy, 'failure-slump-control', measurement),
      ),
    );
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
 * The pinned outcome of the whole sweep. Zeros are the property; the
 * non-zero rows are the controls the zeros are zeros against, and the
 * domain block is the non-vacuity census — counts of what the sweep
 * actually produced, pinned exactly so an empty domain reports itself.
 *
 * ===========================================================================
 * WHAT THE THREE GDD QUANTITIES ARE, AND WHAT WAS PINNED IN THEIR PLACE
 * ===========================================================================
 *
 * `docs/GDD.md` §5.13's stage-4 stanza states the check in three quantities:
 * two histories identical except that one has MORE absence must never differ
 * *in condition, in income deducted, or in failure progression*. Those three
 * map onto `PairDivergence` exactly, and every family below now carries all
 * of them:
 *
 *   - CONDITION. `conditionMismatches` counts readings where the two runs'
 *     mean condition differs at all, in either direction.
 *     `variantConditionLower` counts the directional half: readings where the
 *     more-absent (or more-engaged) run's condition is strictly the lower of
 *     the two. A family can differ in condition without the difference being
 *     a punishment, which is why both are kept.
 *   - INCOME DEDUCTED. `variantDeductedMore` counts readings at which the
 *     variant's RUNNING TOTAL of income deducted has passed the base's. It is
 *     cumulative rather than per-reading on purpose — §5.7's auto-deduction
 *     is a running charge, and a single reading deducting more says nothing
 *     if an earlier one deducted less.
 *   - FAILURE PROGRESSION. `failureMismatches` counts readings where the
 *     phase or the strike count differs; `variantPhaseWorse` counts the
 *     directional half, readings where the variant's phase ranks worse.
 *
 * For one round the `withinHorizon` family pinned no exact count of any of
 * the three, and the exact shape of that is worth stating rather than
 * rounding to "none". It pinned `matchedTraceFailureMismatches` at 0 —
 * failure progression, but only on pairs whose decision traces were equal.
 * It pinned condition as a BOUND, `conditionMismatchesAbove: 0`, which says
 * the family differs somewhere and not by how much. Income deducted had
 * nothing at all. `comparePerIndex` computed all six numbers on every reading
 * and the family discarded five of them; what was pinned in their place was
 * `variantNetLower`, a fourth quantity the GDD does not name, split under
 * trace equality, a fifth condition the GDD does not name either. That is
 * stated plainly rather than quietly repaired because the substitution is the
 * kind that reads like coverage: the pin was exact, the count was honest, and
 * the quantity was not the one the document asks about.
 *
 * This round makes all six visible on every family and pins whatever they
 * measure. It does NOT change the wear basis, the comparator, or any tuning
 * value to move one of them — where a number is non-zero it is left non-zero
 * and reported, and what to do about it is a human's ruling. `netPosition`
 * stays pinned too, because it is the quantity the never-punish rule is
 * actually about (a player is punished in money, not in a condition reading),
 * and dropping it would be the same substitution running the other way.
 */
const EXPECTED_SWEEP = Object.freeze({
  pureAbsence: Object.freeze({
    pairs: 864,
    comparedReadings: 34560,
    bankedMismatches: 0,
    conditionMismatches: 0,
    moneyMismatches: 0,
    failureMismatches: 0,
    variantConditionLower: 0,
    variantDeductedMore: 0,
    variantPhaseWorse: 0,
    variantNetLower: 0,
    matchedTraceFailureMismatches: 0,
    matchedTraceNetLower: 0,
    matchedTracePairs: 864,
    divergentTracePairs: 0,
  }),
  /**
   * The decay-while-away model the §5.13 ruling forbids, run on the
   * pure-absence family. Its whole tally is pinned, not a floor under the
   * two counters that happen to move: an exact tally is what says which of
   * the three GDD quantities this control moves and which it leaves alone.
   */
  wallClockControl: Object.freeze({
    pairs: 144,
    comparedReadings: 5760,
    bankedMismatches: 0,
    conditionMismatches: 2696,
    moneyMismatches: 5426,
    failureMismatches: 0,
    variantConditionLower: 2696,
    variantDeductedMore: 5426,
    variantPhaseWorse: 0,
    variantNetLower: 5426,
    matchedTraceFailureMismatches: 0,
    matchedTraceNetLower: 5426,
    matchedTracePairs: 144,
    divergentTracePairs: 0,
  }),
  /**
   * Elapsed time fabricating counted records — §5.7 broken by construction.
   * Read the two exact tallies against each other: this control moves FAILURE
   * PROGRESSION (5426 failure mismatches, 489 readings phase-worse) and moves
   * CONDITION not at all in the punishing direction (`variantConditionLower`
   * 0), while the wall-clock control above is its mirror image — condition
   * moves, failure progression does not. Two controls, two of the GDD's three
   * quantities, one each. Neither is a control for the third on its own, and
   * that is only legible because both tallies are complete.
   */
  absenceStrikeControl: Object.freeze({
    pairs: 144,
    comparedReadings: 5760,
    bankedMismatches: 0,
    conditionMismatches: 2241,
    moneyMismatches: 2241,
    failureMismatches: 5426,
    variantConditionLower: 0,
    variantDeductedMore: 2241,
    variantPhaseWorse: 489,
    variantNetLower: 2241,
    matchedTraceFailureMismatches: 5426,
    matchedTraceNetLower: 2241,
    matchedTracePairs: 144,
    divergentTracePairs: 0,
  }),
  /**
   * Absence INSIDE the catch-up horizon, where the offline cap pays for the
   * time, so the gym operated through it and banked seconds genuinely move.
   *
   * ==========================================================================
   * THE PREVIOUS ROUND'S TWO ZEROS HERE WERE ARTEFACTS OF A HALVED AXIS
   * ==========================================================================
   *
   * This family ran under three of the six policies. The two claims it
   * carried — where the traces match, more within-horizon absence is never
   * net-worse (`matchedTraceNetLower: 0`), and failure progression on matched
   * traces is identical (`matchedTraceFailureMismatches: 0`) — held on those
   * three and were written as properties of the model. Driven over all six,
   * they read 337 and 155. The three that were missing are `cheapskate`,
   * `delegating` and `redemptive`: the three whose spends are money-timed.
   * Both numbers are pinned as measured. Neither is repaired, because
   * repairing either means changing the wear basis or the comparator and that
   * is a design ruling, not a builder's.
   *
   * What the numbers say, kept separate from what they mean:
   *
   *   - CONDITION. 21614 of 34560 readings differ in mean condition, 20822 of
   *     them with the more-absent run LOWER. Inside the horizon a longer gap
   *     banks more seconds, wear is keyed to banked seconds, so the run that
   *     was away longer operated longer and wore more. That is the wear basis
   *     working as `management.ts` header §1 describes it and it is also,
   *     read against GDD §5.13's sentence, a difference in condition between
   *     two histories that differ only in absence.
   *   - INCOME DEDUCTED. 25132 readings where the more-absent run's running
   *     deduction total has passed the base's — the direct consequence of the
   *     condition column, since the deduction is `1 - multiplier` and the
   *     multiplier is condition-scaled.
   *   - FAILURE PROGRESSION. 1022 readings differ, 186 of them with the
   *     more-absent run's phase strictly worse, and 155 of the 1022 are on
   *     pairs whose counted decision traces are IDENTICAL — so on those the
   *     difference is not a different decision arriving, it is the same
   *     decisions landing at different condition levels.
   *   - MONEY. 890 net-lower readings, priced one by one in
   *     `withinHorizonAttribution` below.
   *
   * Note the direction: this family's variant is the MORE ABSENT run, so it
   * is §5.7's "never punish being away" and not §12.3's engagement rule. The
   * engagement family below is §12.3's, and its `variantNetLower` is zero
   * including divergent traces.
   */
  withinHorizon: Object.freeze({
    pairs: 864,
    comparedReadings: 34560,
    bankedMismatches: 864,
    conditionMismatches: 21614,
    moneyMismatches: 26028,
    failureMismatches: 1022,
    variantConditionLower: 20822,
    variantDeductedMore: 25132,
    variantPhaseWorse: 186,
    variantNetLower: 890,
    matchedTraceFailureMismatches: 155,
    matchedTraceNetLower: 337,
    matchedTracePairs: 802,
    divergentTracePairs: 62,
  }),
  /**
   * §12.3's rule, transposed: the same fixed grid with ONE extra check-in.
   * Zero including the divergent traces, which is a stronger statement than
   * the within-horizon family's and is measured rather than hoped for — the
   * extra check-in banks up to a whole horizon of income at the same wall
   * clock, which covers every discrete cost it can pull forward on this
   * domain.
   */
  engagement: Object.freeze({
    pairs: 498,
    comparedReadings: 14760,
    bankedMismatches: 0,
    conditionMismatches: 6343,
    moneyMismatches: 7149,
    failureMismatches: 1296,
    variantConditionLower: 6006,
    variantDeductedMore: 6226,
    variantPhaseWorse: 252,
    variantNetLower: 0,
    matchedTraceFailureMismatches: 0,
    matchedTraceNetLower: 0,
    matchedTracePairs: 332,
    divergentTracePairs: 166,
  }),
  /**
   * A flat charge per check-in — the punishing per-event shape. Its tally is
   * the cleanest read of what a punishing model looks like on all three GDD
   * quantities at once: failure progression untouched (0 and 0, the fee
   * appends no strike), condition and deduction moved in the punishing
   * direction on 2383 readings each, and money net-lower on all 2383 — every
   * reading of every pair after the extra check-in lands.
   */
  visitFeeControl: Object.freeze({
    pairs: 166,
    comparedReadings: 4920,
    bankedMismatches: 0,
    conditionMismatches: 2383,
    moneyMismatches: 2383,
    failureMismatches: 0,
    variantConditionLower: 2383,
    variantDeductedMore: 2383,
    variantPhaseWorse: 0,
    variantNetLower: 2383,
    matchedTraceFailureMismatches: 0,
    matchedTraceNetLower: 2383,
    matchedTracePairs: 166,
    divergentTracePairs: 0,
  }),
  /**
   * The removed dormancy entry slump, still runnable. Its `variantNetLower`
   * is the number the shipped families' zeros are zeros against: with the
   * cliff back in, absence punishes. `pairs` and `domain.controlSlumps` are
   * exact counts, so a control that stopped running reports itself; the
   * net-lower reading is a floor rather than an exact count, because the
   * claim it carries is that the mechanism bites and not how hard on this
   * particular domain.
   *
   * The control is a re-implementation of the removed branch, so it is
   * evidence about the SHAPE and not about the shipped code path. The direct
   * evidence that the shipped path is clean of it is a mutation, recorded
   * here rather than left to a reader: putting the slump back inside
   * `countDecision`, at `FAILURE_SLUMP_CONTROL_CONDITION`, moves
   *
   *   - `engagement.variantNetLower` 0 -> 130;
   *   - `withinHorizon.variantNetLower` 890 -> 983 and its
   *     `matchedTraceNetLower` 337 -> 368;
   *   - `absenceStrikeControl.variantNetLower` 2241 -> 2302;
   *   - `withinHorizonAttribution` on nine of its twelve rows, including
   *     `netLowerPairs` 91 -> 102, `unexplained` 297 -> 390,
   *     `largerVariantRepairBill` 67 -> 160 and
   *     `maxRepairBillGapGymBucks` 9.6 -> 314.4;
   *   - and it reddens `the failure crossing moves no condition` at
   *     `expected 0.05 to be close to 0.3`.
   *
   * RE-MEASURED THIS ROUND RATHER THAN CARRIED OVER. The previous list read
   * `engagement 0 -> 130, withinHorizon 264 -> 295, netLowerPairs 28 -> 31`,
   * taken when the within-horizon family ran under three policies. Those two
   * within-horizon figures are still exactly right for `negligent` alone —
   * `byPolicy` below shows negligent 264 -> 295 — which is what made them
   * look current: a stale number that happens to be a true statement about a
   * subset reads identically to a fresh one about the whole.
   */
  failureSlumpControl: Object.freeze({
    pairs: 310,
    comparedReadings: 10680,
    bankedMismatches: 144,
    conditionMismatches: 5889,
    moneyMismatches: 6721,
    failureMismatches: 1714,
    variantConditionLower: 5625,
    variantDeductedMore: 6635,
    variantPhaseWorse: 314,
    variantNetLower: 425,
    matchedTraceFailureMismatches: 0,
    matchedTraceNetLower: 0,
    matchedTracePairs: 113,
    divergentTracePairs: 197,
  }),
  hiringNet: Object.freeze({
    pairs: 498,
    netLowerWithMatchingManagers: 0,
    netLowerWithDivergentManagers: 0,
  }),
  /**
   * The same 498 pairs read on the position WITHOUT `netPosition`'s manager
   * asset term — the number the zeros above are zeros against. `netPosition`'s
   * own docstring argues that without the term a richer run which hires one
   * check-in earlier reads as net-worse; that argument had no measurement
   * behind it until this row, which is the house standard applied to a
   * comparator rather than to a mechanism.
   */
  hiringNetWithoutAssetTerm: Object.freeze({
    pairs: 498,
    netLowerWithMatchingManagers: 125,
    netLowerWithDivergentManagers: 23,
    /**
     * 148 = 125 + 23 exactly, so every affected pair holds exactly one
     * net-lower reading. That is the signature of a one-off phasing gap
     * closing again on the next reading rather than a persistent deficit,
     * and it is why the two units happen to agree here — they will not in
     * general, which is the reason both are pinned.
     */
    readingsLower: 148,
  }),
  /**
   * The within-horizon residual, priced. `management.ts` header §3 names the
   * residual's cause and its magnitude — the dormancy crawl arriving one
   * check-in early, worth `banked hours x rate x (multiplier - crawl)` — and
   * for one round no line computed that magnitude. The attribution test
   * checked three co-occurrence conditions at the FIRST net-lower reading of
   * each pair and stopped, so 28 readings stood in for 264 and the size of
   * the deficit was never compared to the size of the thing said to cause it.
   *
   * Every row here is over EVERY net-lower reading of every within-horizon
   * pair, under all six policies. The three "explained" rows are the header's
   * own arithmetic applied two ways, and the difference between them is the
   * finding:
   *
   *   - `explainedByThisCheckIn` — the deficit at a reading is no larger than
   *     that reading's own crawl loss, `rawAccrual x (baseMultiplier -
   *     variantMultiplier)`. This is the header's sentence taken literally.
   *   - `explainedByCumulativeCrawl` — the deficit is no larger than the SUM
   *     of every crawl loss up to and including that reading. The header's
   *     mechanism, allowed to accumulate, which is what it actually does once
   *     the variant is dormant for more than one check-in.
   *   - `unexplained` — neither. These are the readings the stated cause does
   *     not cover, and they are reported rather than absorbed.
   *
   * `largerVariantRepairBill` is the second cause the header does not name: a
   * run that banked more operation carries more wear, so its full repair bill
   * is larger and `netPosition` subtracts it. Counting it does not decide
   * whether it is acceptable — that is the wear-basis question, and it is a
   * human's.
   */
  withinHorizonAttribution: Object.freeze({
    netLowerReadings: 890,
    netLowerPairs: 91,
    coOccurring: 54,
    notCoOccurring: 836,
    explainedByThisCheckIn: 82,
    explainedByCumulativeCrawl: 511,
    unexplained: 297,
    largerVariantRepairBill: 67,
    /** Rounded to `MAGNITUDE_GRAIN`; the arithmetic is deterministic. */
    maxDeficitGymBucks: 104.22,
    maxUnexplainedGymBucks: 81,
    maxRepairBillGapGymBucks: 9.6,
    /**
     * Net-lower readings by policy, so a residual concentrated in one player
     * model reads as that rather than as a property of the design. This is
     * the row the policy widening was for, and it lands sharply: all 264 of
     * the previously-measured residual were `negligent`, the other two
     * policies the family used to run contribute ZERO, and the three it did
     * not run contribute 626 — more than twice what was being reported as
     * the whole residual. `delegating` alone is larger than the entire
     * previously-pinned number.
     */
    byPolicy: Object.freeze({
      'hands-off': 0,
      diligent: 0,
      negligent: 264,
      cheapskate: 289,
      delegating: 297,
      redemptive: 40,
    }),
  }),
  domain: Object.freeze({
    runs: 3849,
    checkIns: 140272,
    promptsOffered: 21195,
    strikesRecorded: 20304,
    runsThatFailed: 2006,
    runsThatRecovered: 482,
    autoRepairs: 3444,
    hires: 1480,
    declines: 6413,
    countedDismissals: 11943,
    controlStrikes: 3404,
    controlCharges: 5629,
    controlSlumps: 351,
  }),
  /**
   * Three zeros with three different reasons, stated so none reads as a
   * sweep that found nothing:
   *
   *   - `negativePurses` — every spend in this module is refused or clamped
   *     when the settled purse cannot cover it, and `requireLadderState`
   *     refuses a negative balance, so a non-zero here would be a throw
   *     somewhere else first.
   *   - `acceleratedTouched` — nothing in stage 4 reads or writes the
   *     accelerated purse. GDD §8's separation, measured rather than assumed.
   *   - `wageShortfalls` — the wage clamp never bites at the shipped tuning,
   *     and this is a derivation with a named catcher, not luck.
   *     `gymCheckIn` credits the raw accrual before the wage is charged, so
   *     the purse at wage time is at least `incomePaid`; `incomePaid` per
   *     banked hour is at least `rate x fraction x floor` and the wage is at
   *     most the top tier's rate per banked hour, and the test named
   *     `a banked hour at the condition floor out-earns the top wage plus its
   *     own repair bill` pins the inequality that makes the first strictly
   *     larger. Lower the floor or raise a wage past it and that test reddens
   *     first and this count follows — re-measured on the widened domain
   *     rather than carried over: at
   *     `MANAGER_WAGE_GYM_BUCKS_PER_BANKED_HOUR.veteran = 40` the inequality
   *     test fails at `expected 22.5 to be greater than 42.4` and this row
   *     reads 14214, where it read 9705 while the within-horizon family
   *     covered three policies of six. The clamp is therefore
   *     containment, not decoration: it is what keeps the purse non-negative
   *     in the world where a tuner breaks the inequality.
   */
  safety: Object.freeze({ negativePurses: 0, acceleratedTouched: 0, wageShortfalls: 0 }),
});

// ---------------------------------------------------------------------------
// Fixture builders for the directed arms
// ---------------------------------------------------------------------------

const ITEM_ZERO = EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT[0] as ManagedEquipmentItem;
const ITEM_ONE = EMPIRE_TUNING.LADDER_STARTING_EQUIPMENT[1] as ManagedEquipmentItem;

/** A state with every item at `condition` and the purse at `gymBucks`. */
function gymAt(condition: number, gymBucks: number): ManagedGym {
  const base = createManagedGym();
  const worn: Record<string, number> = {};
  for (const item of ownedItemsOf(base.gym)) worn[item] = condition;
  return Object.freeze({
    ...base,
    gym: withLadder(base.gym, Object.freeze({ ...base.gym.ladder, gymBucks })),
    condition: Object.freeze(worn) as ManagedGym['condition'],
  });
}

/** A dormant state, built by four real declined repairs on a worn gym. */
function dormantGym(gymBucks: number): ManagedGym {
  let state = gymAt(0.3, gymBucks);
  for (let strike = 0; strike < EMPIRE_TUNING.FAILURE_STRIKES; strike += 1) {
    const declined = declineRepair(state, ITEM_ZERO, strike);
    if (declined.kind !== 'declined') throw new Error('the dormant fixture could not strike');
    state = declined.state;
  }
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

  // declineRepair.
  tally(arms, `decline:${declineRepair(gymAt(0.3, 0), ITEM_ZERO, 0).kind}`);
  const declineUnowned = declineRepair(fresh, 'bike', 0);
  tally(arms, `decline:refused:${declineUnowned.kind === 'refused' ? declineUnowned.reason : ''}`);
  const declineSound = declineRepair(fresh, ITEM_ZERO, 0);
  tally(arms, `decline:refused:${declineSound.kind === 'refused' ? declineSound.reason : ''}`);

  // respondToPrompt.
  tally(arms, `prompt:${respondToPrompt(fresh, 'dismiss', 0).kind}`);
  tally(arms, `prompt:${respondToPrompt(gymAt(0.3, 10000), 'repair', 0).kind}`);
  const promptBroke = respondToPrompt(gymAt(0.3, 0), 'repair', 0);
  tally(arms, `prompt:${promptBroke.kind}`);
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
  }

  // hireManager.
  const hiredClean = hireManager(gymAt(1, 10000), 'novice', 0);
  if (hiredClean.kind === 'hired') {
    tally(arms, `hire:hired:${hiredClean.countedAsStrike ? 'counted' : 'clean'}`);
    const doubled = hireManager(hiredClean.state, 'steady', 0);
    tally(arms, `hire:refused:${doubled.kind === 'refused' ? doubled.reason : ''}`);
  }
  const hiredCounted = hireManager(gymAt(0.3, 10000), 'novice', 0);
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
  const cheapHire = hireManager(gymAt(0.3, 10000), 'novice', 0);
  if (cheapHire.kind === 'hired' && cheapHire.countedAsStrike) {
    let struck = cheapHire.state;
    while (failurePhase(struck) !== 'failed') {
      const declined = declineRepair(struck, ITEM_ZERO, 1);
      if (declined.kind !== 'declined') throw new Error('the manager fixture could not strike');
      struck = declined.state;
    }
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
  'decline:refused:not-owned': 1,
  'decline:refused:not-offered': 1,
  'prompt:no-prompt': 1,
  'prompt:repaired': 1,
  'prompt:repair-refused': 1,
  'prompt:dismissed:free': 1,
  'prompt:dismissed:counted': 1,
  'prompt-read:quiet': 1,
  'prompt-read:offered:free': 1,
  'prompt-read:offered:counts': 1,
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
const EXPECTED_RUN_ARMS: Readonly<Record<string, number>> = Object.freeze({
  'run:repair': 1464,
  'run:prompt-repair': 1488,
  'run:prompt-dismiss': 13294,
  'run:decline-repair': 6413,
  'run:hire-novice': 496,
  'run:hire-steady': 488,
  'run:hire-veteran': 496,
  // Six, and every one of them from the directed long run — see
  // `DIRECTED_RUN_CHECK_INS`. The seeded schedules produce this arm zero
  // times, which is what the both-directions equality caught.
  'run:dismiss-manager': 6,
  'run:recover': 488,
  'run-phase:sound': 117076,
  'run-phase:warned': 4195,
  'run-phase:failed': 19001,
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
    const counted = hireManager(gymAt(0.3, 10000), 'novice', 0);
    expect(counted.kind).toBe('hired');
    if (counted.kind === 'hired') {
      expect(counted.countedAsStrike).toBe(true);
      expect(counted.state.manager?.hiredUnderWarning).toBe(true);
      expect(counted.state.strikes[0]?.decision).toBe('cheapest-hire-under-warning');
      expect(counted.state.strikes[0]?.shownCostGymBucks).toBe(
        EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS.novice,
      );
    }
    // A better tier under the same warnings is not counted.
    const steady = hireManager(gymAt(0.3, 10000), 'steady', 0);
    expect(steady.kind).toBe('hired');
    if (steady.kind === 'hired') expect(steady.countedAsStrike).toBe(false);
  });

  it('the failure crossing moves no condition — dormancy costs income and the recovery bar', () => {
    // The dormancy entry slump was removed this round, and this is the
    // directed half of that: crossing the failure line changes the ledger and
    // nothing else. The measured half is the sweep, whose shipped zeros the
    // 'failure-slump-control' rows are zeros against.
    let state = gymAt(0.3, 0);
    for (let strike = 0; strike < EMPIRE_TUNING.FAILURE_STRIKES - 1; strike += 1) {
      const declined = declineRepair(state, ITEM_ZERO, strike);
      if (declined.kind !== 'declined') throw new Error('fixture could not strike');
      state = declined.state;
      expect(meanCondition(state)).toBeCloseTo(0.3, 6);
    }
    const crossing = declineRepair(state, ITEM_ZERO, 9);
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
    // A fifth strike past the line moves nothing either.
    const past = declineRepair(crossing.state, ITEM_ZERO, 10);
    if (past.kind === 'declined') {
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
    const early = managedCheckIn(gymAt(0.4, 0), EMPIRE_TUNING.SECONDS_PER_DAY).state;
    const late = managedCheckIn(gymAt(0.4, 0), 30 * EMPIRE_TUNING.SECONDS_PER_DAY).state;
    let left: ManagedGym = early;
    let right: ManagedGym = late;
    const phasesLeft: string[] = [];
    const phasesRight: string[] = [];
    for (let strike = 0; strike < EMPIRE_TUNING.FAILURE_STRIKES + 1; strike += 1) {
      const declinedLeft = declineRepair(left, ITEM_ZERO, strike);
      const declinedRight = declineRepair(right, ITEM_ZERO, strike);
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
    expect(MANAGEMENT_WIRINGS.length).toBe(5);
    expect(MANAGEMENT_POLICIES.length).toBe(6);
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
  });
});

describe('the never-punish sweep', () => {
  it('measures every family on all six PairDivergence counters, including the GDD three, counts pinned exactly', () => {
    // One equality over the whole battery. Every family carries the same
    // fourteen fields, so `condition`, `income deducted` and `failure
    // progression` — GDD §5.13's own three quantities — are pinned wherever
    // the sweep runs and not only where a previous round found them
    // convenient. Whatever they measure is what is pinned; this round makes
    // them visible and changes no behaviour to move one.
    const measured = measureSweep();
    expect({
      pureAbsence: measured.pureAbsence,
      wallClockControl: measured.wallClockControl,
      absenceStrikeControl: measured.absenceStrikeControl,
      withinHorizon: measured.withinHorizon,
      engagement: measured.engagement,
      visitFeeControl: measured.visitFeeControl,
      failureSlumpControl: measured.failureSlumpControl,
      hiringNet: measured.hiringNet,
      hiringNetWithoutAssetTerm: measured.hiringNetWithoutAssetTerm,
      safety: measured.safety,
    }).toEqual({
      pureAbsence: EXPECTED_SWEEP.pureAbsence,
      wallClockControl: EXPECTED_SWEEP.wallClockControl,
      absenceStrikeControl: EXPECTED_SWEEP.absenceStrikeControl,
      withinHorizon: EXPECTED_SWEEP.withinHorizon,
      engagement: EXPECTED_SWEEP.engagement,
      visitFeeControl: EXPECTED_SWEEP.visitFeeControl,
      failureSlumpControl: EXPECTED_SWEEP.failureSlumpControl,
      hiringNet: EXPECTED_SWEEP.hiringNet,
      hiringNetWithoutAssetTerm: EXPECTED_SWEEP.hiringNetWithoutAssetTerm,
      safety: EXPECTED_SWEEP.safety,
    });
  });

  it('keeps the non-zero controls non-zero — the numbers the zeros are zero against', () => {
    // The equality above pins the controls exactly, which is what says a
    // control moved. It does NOT say a control still bites: re-pinning one
    // of these rows at zero would satisfy it perfectly. So the direction is
    // asserted on the PINNED CONSTANT rather than on the measurement, and
    // re-pinning a control to zero reddens here.
    expect(EXPECTED_SWEEP.wallClockControl.conditionMismatches).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.wallClockControl.variantConditionLower).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.wallClockControl.variantDeductedMore).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.absenceStrikeControl.failureMismatches).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.absenceStrikeControl.variantPhaseWorse).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.visitFeeControl.variantNetLower).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.failureSlumpControl.variantNetLower).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.controlStrikes).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.controlCharges).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.domain.controlSlumps).toBeGreaterThan(0);
    // And the visit-fee dial has to clear the income an extra check-in earns
    // at the rung every run in this battery sits on, or the control is
    // vacuous whatever its effect size reads. See `VISIT_FEE_GYM_BUCKS` for
    // why the rung matters and how thin the margin is.
    const garageHorizonIncome =
      EMPIRE_TUNING.LADDER_INCOME_GYM_BUCKS_PER_HOUR.garage *
      EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
      (HORIZON_SECONDS / EMPIRE_TUNING.SECONDS_PER_HOUR);
    expect(MANAGEMENT_SWEEP.VISIT_FEE_GYM_BUCKS).toBeGreaterThan(garageHorizonIncome);
  });

  it('the removed dormancy slump still bites when it is put back', () => {
    // The control is the mechanism this round took out of the shipped path,
    // run over the same grids under the same policy with the same comparator.
    // Its non-zero is what says the shipped zeros are a property of the model
    // rather than of a domain in which nothing could ever have gone wrong.
    const measured = measureSweep();

    expect(measured.domain.controlSlumps).toBeGreaterThan(0);
    expect(measured.failureSlumpControl.variantNetLower).toBeGreaterThan(0);
    // The shipped contrast this control is held up against is the ENGAGEMENT
    // family's zero, and that one still holds on all six policies.
    expect(measured.engagement.variantNetLower).toBe(0);
    // It used to also assert `withinHorizon.matchedTraceNetLower === 0` as
    // the second half of the contrast. That is no longer a zero: driven over
    // all six policies rather than three it reads 337, pinned exactly in
    // `EXPECTED_SWEEP.withinHorizon`. Deleting the assertion rather than
    // narrowing the domain back to where it was zero is the honest move, and
    // the number it used to assert is now a pinned measurement a reader can
    // see instead of an absent line.
  });

  it('prices every within-horizon net-lower reading against the crawl arithmetic the header names, and counts what it does not cover', () => {
    // WHAT THIS ESTABLISHES, and what the previous title claimed it did.
    // It used to be called `the within-horizon residual is the dormancy crawl
    // arriving early, and nothing else`, and it checked three co-occurrence
    // conditions at the FIRST net-lower reading of each pair and then broke
    // out of the walk. Two gaps followed from that, and both are closed here:
    //
    //   - it covered 28 readings while the residual it was written about was
    //     264. Every reading is walked now, under all six policies.
    //   - co-occurrence is not attribution. The three conditions can all hold
    //     while the deficit is mostly something else, because the run that
    //     operated more also carries a strictly larger repair bill from the
    //     extra wear, and `netPosition` subtracts that bill. Nothing computed
    //     the MAGNITUDE the header names — `banked hours x rate x (multiplier
    //     - crawl)` — so nothing could tell the two apart.
    //
    // So this test measures, per net-lower reading: the actual deficit, the
    // crawl loss at that reading, the crawl loss accumulated to that reading,
    // and the repair-bill gap. It pins how many readings each explains and
    // how many it does not. It asserts NO zero on the unexplained count —
    // that number is the round's output, not its pass condition.
    const crawl = EMPIRE_TUNING.DORMANT_INCOME_MULTIPLIER;
    let netLowerReadings = 0;
    let netLowerPairs = 0;
    let coOccurring = 0;
    let notCoOccurring = 0;
    let explainedByThisCheckIn = 0;
    let explainedByCumulativeCrawl = 0;
    let unexplained = 0;
    let largerVariantRepairBill = 0;
    let maxDeficit = 0;
    let maxUnexplained = 0;
    let maxRepairBillGap = 0;
    const byPolicy: Record<string, number> = {};
    for (const policy of MANAGEMENT_SWEEP.WITHIN_HORIZON_POLICIES) byPolicy[policy] = 0;

    for (const [seed, index, gapAt, extra] of withinHorizonPairKeys()) {
      const gaps = gapScheduleAt(seed, index);
      const baseTimes = timesOf(gaps);
      const variantTimes = timesOf(moreAbsentBy(gaps, gapAt, extra));
      for (const policy of MANAGEMENT_SWEEP.WITHIN_HORIZON_POLICIES) {
        const base = runManagedGym(baseTimes, policy as ManagementPolicy);
        const variant = runManagedGym(variantTimes, policy as ManagementPolicy);
        const baseFailedAt = base.census.failedAtCheckIn;
        const variantFailedAt = variant.census.failedAtCheckIn;
        // The pair-level half of the header's story: different traces, and
        // the more-absent run entering the crawl first.
        const pairCoOccurs =
          traceOf(base) !== traceOf(variant) &&
          variantFailedAt !== null &&
          (baseFailedAt === null || variantFailedAt < baseFailedAt);
        let cumulativeCrawlLoss = 0;
        let pairHadLower = false;
        for (const [at, left] of base.readings.entries()) {
          const right = variant.readings[at];
          if (right === undefined) continue;
          // The crawl loss AT this reading, in the header's own terms: the
          // variant's raw accrual for the gap (income paid plus income
          // deducted is the raw figure `gymCheckIn` credited) times the
          // multiplier gap it was paid across.
          const rawVariant = right.incomePaid + right.incomeDeducted;
          const multiplierGap = Math.max(0, left.incomeMultiplier - right.incomeMultiplier);
          const crawlLossHere = rawVariant * multiplierGap;
          cumulativeCrawlLoss += crawlLossHere;
          const deficit = left.netPosition - right.netPosition;
          if (deficit <= MANAGEMENT_SWEEP.NET_TOLERANCE) continue;
          netLowerReadings += 1;
          byPolicy[policy] = (byPolicy[policy] ?? 0) + 1;
          pairHadLower = true;
          if (deficit > maxDeficit) maxDeficit = deficit;
          // The reading-level half: the variant already dormant and paid at
          // the crawl, the base paid above it.
          const readingCoOccurs =
            pairCoOccurs &&
            right.phase === 'failed' &&
            right.incomeMultiplier === crawl &&
            left.incomeMultiplier > crawl;
          if (readingCoOccurs) coOccurring += 1;
          else notCoOccurring += 1;
          const repairBillGap = right.fullRepairCost - left.fullRepairCost;
          if (repairBillGap > MANAGEMENT_SWEEP.NET_TOLERANCE) {
            largerVariantRepairBill += 1;
            if (repairBillGap > maxRepairBillGap) maxRepairBillGap = repairBillGap;
          }
          if (deficit <= crawlLossHere + MANAGEMENT_SWEEP.NET_TOLERANCE) {
            explainedByThisCheckIn += 1;
          } else if (deficit <= cumulativeCrawlLoss + MANAGEMENT_SWEEP.NET_TOLERANCE) {
            explainedByCumulativeCrawl += 1;
          } else {
            unexplained += 1;
            const shortfall = deficit - cumulativeCrawlLoss;
            if (shortfall > maxUnexplained) maxUnexplained = shortfall;
          }
        }
        if (pairHadLower) netLowerPairs += 1;
      }
    }

    expect({
      netLowerReadings,
      netLowerPairs,
      coOccurring,
      notCoOccurring,
      explainedByThisCheckIn,
      explainedByCumulativeCrawl,
      unexplained,
      largerVariantRepairBill,
      maxDeficitGymBucks: atGrain(maxDeficit),
      maxUnexplainedGymBucks: atGrain(maxUnexplained),
      maxRepairBillGapGymBucks: atGrain(maxRepairBillGap),
      byPolicy,
    }).toEqual(EXPECTED_SWEEP.withinHorizonAttribution);

    // The attribution walks exactly the readings the sweep counted, so a
    // divergence between the two would mean one of them is walking a
    // different domain. Read from the sweep rather than restated.
    expect(netLowerReadings).toBe(measureSweep().withinHorizon.variantNetLower);
    // Non-vacuity: the walk found readings to price. Without this the whole
    // block passes on an empty residual and reports eleven honest zeros.
    expect(EXPECTED_SWEEP.withinHorizonAttribution.netLowerReadings).toBeGreaterThan(0);
  });

  it('walked a domain that is not empty, and says exactly what it saw', () => {
    const measured = measureSweep();
    expect(measured.domain).toEqual(EXPECTED_SWEEP.domain);
    // The within-horizon family genuinely differs — its zeros are directional,
    // not byte-identity, and a byte-identical family here would mean the
    // enlargement never changed a banked second. Asserted on the pin, so
    // re-pinning it at zero is red rather than merely a smaller number.
    expect(EXPECTED_SWEEP.withinHorizon.conditionMismatches).toBeGreaterThan(0);
    expect(EXPECTED_SWEEP.withinHorizon.bankedMismatches).toBeGreaterThan(0);
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
