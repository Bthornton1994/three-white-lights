/**
 * expansion.test.ts — GDD §5.4's four axes.
 *
 * What this file is arranged around, in the order the checks appear:
 *
 *   1. The vocabulary: five axes, each declaring the `EmpireOutput` it feeds,
 *      with the physio row the only one that reaches Sim progression.
 *   2. The ladders: costs strictly increasing, ceilings reachable and paying,
 *      `null` past the top rather than a wrong number, timers monotone.
 *   3. The gate: reputation requirements monotone and reachable, and the physio
 *      ladder ungated at every level — checked ABOVE the shipped ceiling,
 *      because at the shipped ceiling of 1 the exemption is invisible.
 *   4. Buying: refusals, their order, the price actually leaving the balance,
 *      and a full climb of every axis from zero to its ceiling.
 *   5. `rosterCapacity` never falling when an axis rises.
 *   6. The clock split: no accelerant of any kind moves a build's settled
 *      completion, and therefore none moves the physio series — each with a
 *      deliberately-wired negative control beside it whose non-zero count is
 *      pinned, because a zero with nothing beside it is an empty domain.
 *   7. The physio hook driven through the REAL `recordSession` in
 *      `src/game/fatigue.ts`, against the real `FATIGUE_TUNING` floor rather
 *      than a copy of it.
 *
 * Every sweep pins the number of comparisons it actually made. Sweep parameters
 * live in `EXPANSION_SWEEP` below rather than at the call sites, for the reason
 * `src/game/streakSweep.ts` exists: a measurement whose inputs are not written
 * down is an anecdote.
 *
 * What is deliberately NOT swept here, and why it is an assertion instead. A
 * purchasable accelerant cannot be paired with `'physio-days-saved'` at all —
 * `applyAccelerant` throws and the compiler refuses the literal — so a sweep of
 * "purchasable skips applied to a physio build" has an EMPTY DOMAIN and would
 * be green for the wrong reason. That closure is asserted directly, with an
 * earned accelerant beside it as the contrast that shows the answer is not
 * universally `false`. The physio sweep is then run with the earned accelerants,
 * which are the ones that CAN reach the build.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EARNED_ACCELERANTS,
  EMPIRE_ACCELERANTS,
  PURCHASABLE_ACCELERANTS,
  applyAccelerant,
  asAcceleratedSeconds,
  asGymBucks,
  asReputation,
  asUnacceleratedSeconds,
  buildSeconds,
  createEmpireClock,
  createEmpireState,
  mayAccelerate,
  outputReach,
  physioDaysSavedFor,
  rosterCapacity,
  settledLevel,
  spaceLevelCost,
  staffLevelCost,
  type AccelerableOutput,
  type AppliedAccelerant,
  type EmpireAccelerant,
  type EmpireOutput,
  type EquipmentTier,
  type GymAxes,
  type StaffRole,
  type UnacceleratedSeconds,
} from './empireCore';
import { EMPIRE_TUNING as T } from './empireTuning';
import {
  AXIS_FUNDINGS,
  AXIS_OUTPUT,
  EXPANSION_AXES,
  EXPANSION_REFUSALS,
  axisBuildSeconds,
  axisCeiling,
  axisFunding,
  axisLevel,
  axisLevelCost,
  axisOutput,
  axisReputationRequirement,
  axisReputationRule,
  buildInFlight,
  expansionContext,
  expansionVerdict,
  expansionVocabularyFaults,
  idleAxesAt,
  isExpansionAxis,
  isStaffAxis,
  physioDaysSavedAt,
  quoteExpansion,
  settledAxesAt,
  settledAxisLevel,
  settledBuildInFlight,
  skipExpansion,
  startExpansion,
  type ExpansionAxis,
  type ExpansionBuild,
  type ExpansionContext,
  type ExpansionStart,
} from './expansion';
import { EMPTY_FATIGUE_STATE, FATIGUE_TUNING, recordSession } from '../game/fatigue';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every parameter of every sweep below, in one block.
 *
 * `SKIP_SECONDS` deliberately straddles the shipped `buildSeconds(1)` of 120 s:
 * values under it leave a build's completion inside the same sampled day and
 * values over it do not, so the negative controls have both outcomes in their
 * domain rather than only the loud one.
 */
const EXPANSION_SWEEP = Object.freeze({
  /** Skip magnitudes applied to a running build. */
  SKIP_SECONDS: Object.freeze([0, 1, 59, 60, 120, 3600, 86400, 1000000] as const),
  /** How many wall-clock days the physio series is sampled over, one per day. */
  PHYSIO_SERIES_DAYS: 40,
  /** Wall-clock second the physio build is started at. Day 3, so both the
   *  before and after values appear in the sampled series. */
  PHYSIO_BUILD_START_SECONDS: 3 * 86400,
  /** Seconds already skipped on the clock a build is started from. */
  CLOCK_SKIPPED_SECONDS: Object.freeze([0, 3600, 86400] as const),
  /** How far past a ladder's ceiling the `null` checks probe. */
  LEVELS_PAST_CEILING: 4,
  /** A balance large enough to buy every level of every axis. */
  PURSE_GYM_BUCKS: 1000000,
});

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/**
 * An `AppliedAccelerant` for an accelerant known only at runtime.
 *
 * `applyAccelerant` refuses an accelerant whose type has widened to the union —
 * that is the fence `OneAccelerant` puts there on purpose — so a loop cannot
 * call it directly. The switch re-narrows to a literal per arm. The output cast
 * is confined to this harness and is not a way past the rule: `applyAccelerant`
 * asks `mayAccelerate` at runtime and throws, so an illegal pairing raises here
 * rather than being built.
 */
function appliedFor(
  accelerant: EmpireAccelerant,
  output: EmpireOutput,
  at: UnacceleratedSeconds,
  seconds: number,
): AppliedAccelerant {
  switch (accelerant) {
    case 'gym-empire-timer-skip':
      return applyAccelerant(
        'gym-empire-timer-skip',
        output as AccelerableOutput<'gym-empire-timer-skip'>,
        at,
        seconds,
      );
    case 'rewarded-ad-timer-skip':
      return applyAccelerant(
        'rewarded-ad-timer-skip',
        output as AccelerableOutput<'rewarded-ad-timer-skip'>,
        at,
        seconds,
      );
    case 'coach-staff-level':
      return applyAccelerant(
        'coach-staff-level',
        output as AccelerableOutput<'coach-staff-level'>,
        at,
        seconds,
      );
    case 'space-level':
      return applyAccelerant('space-level', output as AccelerableOutput<'space-level'>, at, seconds);
    case 'reputation-tier':
      return applyAccelerant(
        'reputation-tier',
        output as AccelerableOutput<'reputation-tier'>,
        at,
        seconds,
      );
  }
}

const ZERO_SECONDS: UnacceleratedSeconds = asUnacceleratedSeconds(0);

function contextAt(options: {
  readonly elapsed?: number;
  readonly skipped?: number;
  readonly gymBucks?: number;
  /** The wall-clock book. Mirrors the accelerated one unless a case parts them. */
  readonly settledGymBucks?: number;
  readonly reputation?: number;
  readonly builds?: readonly ExpansionBuild[];
}): ExpansionContext {
  const gymBucks = options.gymBucks ?? EXPANSION_SWEEP.PURSE_GYM_BUCKS;
  return Object.freeze({
    clock: createEmpireClock(options.elapsed ?? 0, options.skipped ?? 0),
    gymBucks: asGymBucks(gymBucks),
    settledGymBucks: asGymBucks(options.settledGymBucks ?? gymBucks),
    reputation: asReputation(options.reputation ?? T.REPUTATION_MAX),
    builds: options.builds ?? [],
  });
}

/** The book this axis is bought from, after a start. See `axisFunding`. */
function fundedBalance(result: ExpansionStart, axis: ExpansionAxis): number {
  if (!result.started) throw new Error('a refused start has no balance');
  return axisFunding(axis) === 'wall-clock' ? result.settledGymBucks : result.gymBucks;
}

/** The other book — the one this axis does not touch. */
function otherBalance(result: ExpansionStart, axis: ExpansionAxis): number {
  if (!result.started) throw new Error('a refused start has no balance');
  return axisFunding(axis) === 'wall-clock' ? result.gymBucks : result.settledGymBucks;
}

/** A finished build on `axis` at `toLevel`, completed on both clocks at zero. */
function completedBuild(axis: ExpansionAxis, toLevel: number): ExpansionBuild {
  return Object.freeze({
    axis,
    toLevel,
    paid: asGymBucks(0),
    startedAt: ZERO_SECONDS,
    settledCompletion: ZERO_SECONDS,
    idleCompletion: asAcceleratedSeconds(0),
  });
}

/** Axes built by hand, for the `rosterCapacity` sweep. */
function axesAt(equipment: EquipmentTier, spaceLevel: number, staff: Record<StaffRole, number>): GymAxes {
  return Object.freeze({ equipment, spaceLevel, staffLevel: Object.freeze({ ...staff }) });
}

// ---------------------------------------------------------------------------
// 1. Vocabulary
// ---------------------------------------------------------------------------

describe('§5.4 the axis vocabulary', () => {
  it('names five axes, derived from the staff roles rather than restated', () => {
    // Counts before contents. Every sweep below walks this list, and a list
    // that had gone empty would make all of them pass.
    expect([...EXPANSION_AXES]).toEqual(['equipment', 'space', 'coach', 'spotter', 'physio']);
    expect(EXPANSION_AXES.length).toBe(2 + T.STAFF_ROLES.length);
    expect(new Set(EXPANSION_AXES).size).toBe(EXPANSION_AXES.length);

    // Reddens if a staff role is renamed without the axis list following, which
    // is the drift the derivation exists to stop.
    expect(EXPANSION_AXES.filter(isStaffAxis)).toEqual([...T.STAFF_ROLES]);
    expect(EXPANSION_AXES.filter((axis) => !isStaffAxis(axis))).toEqual(['equipment', 'space']);
  });

  it('narrows a wire value to an axis and refuses everything else', () => {
    let accepted = 0;
    for (const axis of EXPANSION_AXES) {
      expect(isExpansionAxis(axis)).toBe(true);
      accepted += 1;
    }
    expect(accepted).toBe(5);
    const rejects = ['', 'equipments', 'staff', 'reputation', 'physio ', 0, null, undefined, {}];
    for (const value of rejects) expect(isExpansionAxis(value)).toBe(false);
    expect(rejects.length).toBe(9);
  });

  it('gives the physio axis the only progression-reaching output', () => {
    // The single edit this reddens on: re-pointing `AXIS_OUTPUT.physio` at
    // `'gym-bucks'`, which is how a purchasable timer skip would acquire a
    // route to Sim injury duration.
    const reaches = EXPANSION_AXES.map((axis) => [axis, outputReach(axisOutput(axis))] as const);
    expect(Object.fromEntries(reaches)).toEqual({
      equipment: 'idle-only',
      space: 'idle-only',
      coach: 'idle-only',
      spotter: 'idle-only',
      physio: 'progression-reaching',
    });
    expect(reaches.filter(([, reach]) => reach === 'progression-reaching').length).toBe(1);
    expect(AXIS_OUTPUT.physio).toBe('physio-days-saved');
  });

  it('reports no vocabulary fault, and the walker has a domain', () => {
    // What reddens this, named before it was written: re-pointing
    // `AXIS_OUTPUT.physio` at `'gym-bucks'` (two faults — the reach check and
    // the purchasable-accelerant check), lowering `SPACE_LEVEL_MAX` to 0 (the
    // ceiling check), or shortening `SPACE_LEVEL_COST_GYM_BUCKS` (the price-at-
    // ceiling check). All four were run by hand against this line.
    expect(expansionVocabularyFaults()).toEqual([]);
    // The walker's domain, pinned so an emptied table cannot make it vacuous.
    expect(EXPANSION_AXES.length).toBe(5);
    expect(PURCHASABLE_ACCELERANTS.length).toBe(2);
    expect(EARNED_ACCELERANTS.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 2. Ladders — costs, ceilings, timers
// ---------------------------------------------------------------------------

describe('§5.4 the cost ladders', () => {
  it('prices every level of every axis, strictly increasing to the ceiling', () => {
    // Strictly increasing, not merely non-decreasing: a level that costs the
    // same as the one below it is a level nobody has to think about, which is
    // the degeneracy `empireTuning.ts` claims the ladders do not have.
    let comparisons = 0;
    let pricedLevels = 0;
    const perAxis = new Map<ExpansionAxis, number>();
    for (const axis of EXPANSION_AXES) {
      const ceiling = axisCeiling(axis);
      let previous: number | null = null;
      for (let level = 1; level <= ceiling; level += 1) {
        const cost = axisLevelCost(axis, level);
        expect(cost, `${axis} level ${level} is on the ladder and prices nothing`).not.toBeNull();
        const price = cost as number;
        expect(price, `${axis} level ${level} is free`).toBeGreaterThan(0);
        if (previous !== null) {
          expect(price, `${axis} level ${level} is not dearer than ${level - 1}`).toBeGreaterThan(
            previous,
          );
          comparisons += 1;
        }
        previous = price;
        pricedLevels += 1;
      }
      perAxis.set(axis, ceiling);
    }
    // Counts, not bounds. 3 + 5 + 4 + 4 + 1 priced levels; one comparison fewer
    // per axis than it has levels.
    expect(Object.fromEntries(perAxis)).toEqual({
      equipment: 3,
      space: 5,
      coach: 4,
      spotter: 4,
      physio: 1,
    });
    expect(pricedLevels).toBe(17);
    expect(comparisons).toBe(12);
  });

  it('returns null off the ladder in both directions, and never a wrong number', () => {
    // The bug this is against is a cost table read one index out: an off-ladder
    // level that quietly prices at the top level's cost, or at `undefined`
    // coerced to a number. Both directions are probed, and so are the
    // non-integers.
    let nulls = 0;
    for (const axis of EXPANSION_AXES) {
      const ceiling = axisCeiling(axis);
      const offLadder = [
        -1,
        0,
        ceiling + 0.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        ...Array.from({ length: EXPANSION_SWEEP.LEVELS_PAST_CEILING }, (_, i) => ceiling + 1 + i),
      ];
      for (const level of offLadder) {
        expect(axisLevelCost(axis, level), `${axis} priced level ${level}`).toBeNull();
        expect(axisBuildSeconds(axis, level), `${axis} timed level ${level}`).toBeNull();
        expect(
          axisReputationRequirement(axis, level),
          `${axis} gated level ${level}`,
        ).toBeNull();
        nulls += 3;
      }
      // And the ceiling itself is on the ladder and pays: the sibling of the
      // check above, and the one that would go quiet if `axisLevelCost` started
      // refusing everything.
      expect(axisLevelCost(axis, ceiling)).not.toBeNull();
      expect(axisBuildSeconds(axis, ceiling)).not.toBeNull();
    }
    expect(nulls).toBe(5 * 9 * 3);
    expect(nulls).toBe(135);
  });

  it('leans on empireCore for the two ladders that already refuse off-ladder levels', () => {
    // The task's own bar, stated against `empireCore.ts` directly rather than
    // only through this module's wrapper, so a wrapper that started swallowing
    // a wrong number would not be the only witness.
    expect(spaceLevelCost(T.SPACE_LEVEL_MAX)).not.toBeNull();
    expect(spaceLevelCost(T.SPACE_LEVEL_MAX + 1)).toBeNull();
    expect(spaceLevelCost(0)).toBeNull();
    let roles = 0;
    for (const role of T.STAFF_ROLES) {
      expect(staffLevelCost(role, T.STAFF_LEVEL_MAX[role])).not.toBeNull();
      expect(staffLevelCost(role, T.STAFF_LEVEL_MAX[role] + 1)).toBeNull();
      expect(staffLevelCost(role, 0)).toBeNull();
      roles += 1;
    }
    expect(roles).toBe(3);
  });

  it('grows every build timer with the level and never lets the cap truncate one', () => {
    // Two claims. The timers rise, and `BUILD_SECONDS_MAX` is a guard rather
    // than a truncation — if the cap ever bound, the top of a ladder would
    // stop rising and the first assertion would redden, so `capped` being zero
    // is the reason the first one is meaningful rather than a second bound.
    let comparisons = 0;
    let capped = 0;
    let timed = 0;
    for (const axis of EXPANSION_AXES) {
      let previous: number | null = null;
      for (let level = 1; level <= axisCeiling(axis); level += 1) {
        const seconds = axisBuildSeconds(axis, level) as number;
        expect(seconds, `${axis} level ${level} builds instantly`).toBeGreaterThan(0);
        expect(seconds).toBeLessThanOrEqual(T.BUILD_SECONDS_MAX);
        if (seconds === T.BUILD_SECONDS_MAX) capped += 1;
        if (previous !== null) {
          expect(seconds, `${axis} level ${level} builds no slower than ${level - 1}`).toBeGreaterThan(
            previous,
          );
          comparisons += 1;
        }
        previous = seconds;
        timed += 1;
      }
    }
    expect(timed).toBe(17);
    expect(comparisons).toBe(12);
    expect(capped).toBe(0);
    // The timer is the shared curve rather than a per-axis one, so a tuner
    // turning `BUILD_SECONDS_BASE` moves every axis together.
    expect(axisBuildSeconds('space', 1)).toBe(buildSeconds(1));
    expect(axisBuildSeconds('coach', 3)).toBe(buildSeconds(3));
  });
});

// ---------------------------------------------------------------------------
// 3. The reputation gate
// ---------------------------------------------------------------------------

describe('§5.4 the reputation gate', () => {
  it('rises with the level, stays reachable, and never gates the first step', () => {
    let comparisons = 0;
    let gated = 0;
    for (const axis of EXPANSION_AXES) {
      let previous: number | null = null;
      for (let level = 1; level <= axisCeiling(axis); level += 1) {
        const required = axisReputationRequirement(axis, level) as number;
        expect(required, `${axis} level ${level} is gated off the scale`).toBeLessThanOrEqual(
          T.REPUTATION_MAX,
        );
        expect(required).toBeGreaterThanOrEqual(0);
        if (previous !== null) {
          expect(required, `${axis} level ${level} is gated below ${level - 1}`).toBeGreaterThanOrEqual(
            previous,
          );
          comparisons += 1;
        }
        previous = required;
        gated += 1;
      }
      // A brand-new gym can start somewhere on every axis.
      expect(axisReputationRequirement(axis, 1), `${axis} level 1 is gated`).toBe(0);
    }
    expect(gated).toBe(17);
    expect(comparisons).toBe(12);
  });

  it('gates the non-physio axes at more than zero somewhere, so zero means something', () => {
    // Without this, "the physio ladder is always 0" is a claim about a function
    // that might return 0 for everything. Counts, not presence.
    const nonZero: string[] = [];
    for (const axis of EXPANSION_AXES) {
      for (let level = 1; level <= axisCeiling(axis); level += 1) {
        if ((axisReputationRequirement(axis, level) as number) > 0) nonZero.push(`${axis}/${level}`);
      }
    }
    expect(nonZero).toEqual([
      'equipment/2',
      'equipment/3',
      'space/2',
      'space/3',
      'space/4',
      'space/5',
      'coach/2',
      'coach/3',
      'coach/4',
      'spotter/2',
      'spotter/3',
      'spotter/4',
    ]);
    expect(nonZero.length).toBe(12);
    // The rule the list is produced by, pinned once so the list above is not
    // the only statement of it.
    expect(axisReputationRule('space', 2)).toBe(T.REPUTATION_TIER_THRESHOLDS[1]);
    expect(axisReputationRule('space', T.REPUTATION_TIER_THRESHOLDS.length + 3)).toBe(
      T.REPUTATION_MAX,
    );
  });

  it('never gates the physio ladder, at any level, including above its ceiling', () => {
    // THE VACUITY THIS AVOIDS, stated because it is the trap this exact check
    // walks into. `STAFF_LEVEL_MAX.physio` is 1 today and the ungated answer
    // for level 1 is `REPUTATION_TIER_THRESHOLDS[0]`, which is 0 — so a check
    // confined to the shipped ladder passes identically with the exemption in
    // `axisReputationRule` deleted. That is "a bound the unfixed behaviour
    // already satisfies", verbatim.
    //
    // `axisReputationRule` is total for this reason, and this walks it well
    // past the ceiling. Deleting the `axis === 'physio'` arm makes level 2
    // answer 250 and this line redden — which was run, and did.
    let levels = 0;
    const probe = T.REPUTATION_TIER_THRESHOLDS.length + EXPANSION_SWEEP.LEVELS_PAST_CEILING;
    for (let level = 1; level <= probe; level += 1) {
      expect(axisReputationRule('physio', level), `physio level ${level} acquired a gate`).toBe(0);
      levels += 1;
    }
    expect(levels).toBe(9);
    // And the domain really does contain levels where a gate would show: the
    // same levels on another axis are not all zero.
    const elsewhere: number[] = [];
    for (let level = 1; level <= probe; level += 1) elsewhere.push(axisReputationRule('coach', level));
    expect(elsewhere.filter((required) => required > 0).length).toBe(8);
    expect(elsewhere).toEqual([0, 250, 1000, 2500, 5000, 5000, 5000, 5000, 5000]);
  });
});

// ---------------------------------------------------------------------------
// 4. Buying a level
// ---------------------------------------------------------------------------

describe('§5.4 starting a build', () => {
  it('quotes the next level and stops quoting at the ceiling', () => {
    const opening = idleAxesAt([], asAcceleratedSeconds(0));
    let quoted = 0;
    for (const axis of EXPANSION_AXES) {
      const quote = quoteExpansion(opening, axis);
      expect(quote, `${axis} quotes nothing from a fresh gym`).not.toBeNull();
      expect(quote?.fromLevel).toBe(0);
      expect(quote?.toLevel).toBe(1);
      expect(quote?.cost).toBe(axisLevelCost(axis, 1));
      expect(quote?.seconds).toBe(axisBuildSeconds(axis, 1));
      quoted += 1;

      const topped = idleAxesAt(
        [completedBuild(axis, axisCeiling(axis))],
        asAcceleratedSeconds(0),
      );
      expect(quoteExpansion(topped, axis), `${axis} quotes past its ceiling`).toBeNull();
    }
    expect(quoted).toBe(5);
  });

  it('reaches every declared refusal, in a fixed order', () => {
    // Every refusal in `EXPANSION_REFUSALS` is produced by a real context, so
    // the list cannot hold a case nothing can reach.
    const seen = new Set<string>();

    const atCeiling = contextAt({ builds: [completedBuild('physio', 1)] });
    expect(expansionVerdict(atCeiling, 'physio')).toEqual({
      allowed: false,
      refusal: 'at-ceiling',
    });
    seen.add('at-ceiling');

    const running = contextAt({
      builds: [
        Object.freeze({
          ...completedBuild('coach', 1),
          idleCompletion: asAcceleratedSeconds(600),
        }),
      ],
    });
    expect(expansionVerdict(running, 'coach')).toEqual({
      allowed: false,
      refusal: 'already-building',
    });
    seen.add('already-building');

    const poorInReputation = contextAt({
      reputation: 0,
      builds: [completedBuild('equipment', 1)],
    });
    expect(expansionVerdict(poorInReputation, 'equipment')).toEqual({
      allowed: false,
      refusal: 'not-enough-reputation',
    });
    seen.add('not-enough-reputation');

    const broke = contextAt({ gymBucks: 0 });
    expect(expansionVerdict(broke, 'equipment')).toEqual({
      allowed: false,
      refusal: 'not-enough-gym-bucks',
    });
    seen.add('not-enough-gym-bucks');

    // The fifth refusal, and the context that reaches it is the one the split
    // exists for: a gym holding the price ten times over in the ACCELERATED
    // book and nothing in the wall-clock one. The same context started an
    // equipment build two lines below, so this is the split rather than an
    // empty purse.
    const richButNotOnTheWallClock = contextAt({
      gymBucks: EXPANSION_SWEEP.PURSE_GYM_BUCKS,
      settledGymBucks: 0,
    });
    expect(expansionVerdict(richButNotOnTheWallClock, 'physio')).toEqual({
      allowed: false,
      refusal: 'not-enough-wall-clock-earnings',
    });
    expect(expansionVerdict(richButNotOnTheWallClock, 'space')).toEqual({
      allowed: false,
      refusal: 'not-enough-wall-clock-earnings',
    });
    expect(expansionVerdict(richButNotOnTheWallClock, 'equipment').allowed).toBe(true);
    seen.add('not-enough-wall-clock-earnings');

    expect([...seen].sort()).toEqual([...EXPANSION_REFUSALS].sort());
    expect(seen.size).toBe(5);

    // The order, checked where two refusals compete. Each of these three
    // contexts satisfies a later refusal as well as the one it reports, so a
    // reordering of the branches in `expansionVerdict` reddens a line here.
    expect(
      expansionVerdict(
        contextAt({ gymBucks: 0, reputation: 0, builds: [completedBuild('physio', 1)] }),
        'physio',
      ),
    ).toEqual({ allowed: false, refusal: 'at-ceiling' });
    expect(
      expansionVerdict(
        contextAt({
          gymBucks: 0,
          reputation: 0,
          builds: [
            Object.freeze({
              ...completedBuild('coach', 1),
              idleCompletion: asAcceleratedSeconds(600),
            }),
          ],
        }),
        'coach',
      ),
    ).toEqual({ allowed: false, refusal: 'already-building' });
    expect(
      expansionVerdict(
        contextAt({ gymBucks: 0, reputation: 0, builds: [completedBuild('equipment', 1)] }),
        'equipment',
      ),
    ).toEqual({ allowed: false, refusal: 'not-enough-reputation' });
  });

  it('takes exactly the quoted price out of the balance and stamps both clocks', () => {
    let started = 0;
    for (const axis of EXPANSION_AXES) {
      for (const skipped of EXPANSION_SWEEP.CLOCK_SKIPPED_SECONDS) {
        const context = contextAt({ elapsed: 7200, skipped });
        const result = startExpansion(context, axis);
        expect(result.started, `${axis} refused a fully funded gym`).toBe(true);
        if (!result.started) continue;
        const price = axisLevelCost(axis, 1) as number;
        // The consumption. Not a bound: the balance moves by the price and by
        // nothing else, so a rounding or a double charge reddens. Which of the
        // two books moves is `axisFunding`'s answer, and the OTHER one is
        // asserted untouched — a price taken out of both would be the split
        // charging twice, and a price taken out of neither would make the gate
        // ornamental.
        expect(fundedBalance(result, axis)).toBe(EXPANSION_SWEEP.PURSE_GYM_BUCKS - price);
        expect(otherBalance(result, axis)).toBe(EXPANSION_SWEEP.PURSE_GYM_BUCKS);
        expect(result.build.paid).toBe(price);
        expect(result.build.toLevel).toBe(1);
        // The two stamps come off the two readings of the same clock. The
        // settled one carries no skip; the idle one carries all of it.
        const seconds = axisBuildSeconds(axis, 1) as number;
        expect(result.build.startedAt).toBe(7200);
        expect(result.build.settledCompletion).toBe(7200 + seconds);
        expect(result.build.idleCompletion).toBe(7200 + skipped + seconds);
        expect(result.build.idleCompletion - result.build.settledCompletion).toBe(skipped);
        started += 1;
      }
    }
    expect(started).toBe(15);
  });

  it('refuses to start when the balance is one buck short, and starts when it is exact', () => {
    // The boundary, in both directions, because an off-by-one on `<` versus
    // `<=` here is a level that is free or a level that cannot be bought.
    for (const axis of EXPANSION_AXES) {
      const price = axisLevelCost(axis, 1) as number;
      expect(startExpansion(contextAt({ gymBucks: price - 1 }), axis).started).toBe(false);
      const exact = startExpansion(contextAt({ gymBucks: price }), axis);
      expect(exact.started, `${axis} refused an exact balance`).toBe(true);
      if (exact.started) expect(fundedBalance(exact, axis)).toBe(0);
    }
  });

  it('climbs every axis from zero to its ceiling and then refuses', () => {
    // The whole ladder driven the way a player would: quote, pay, wait out the
    // timer, quote again. Nothing here is hand-levelled — `idleAxesAt` derives
    // the level from the builds each step produced.
    let steps = 0;
    const reached = new Map<ExpansionAxis, number>();
    for (const axis of EXPANSION_AXES) {
      let builds: ExpansionBuild[] = [];
      let purse: number = EXPANSION_SWEEP.PURSE_GYM_BUCKS;
      let elapsed = 0;
      let spent = 0;
      for (let level = 1; level <= axisCeiling(axis); level += 1) {
        const context = contextAt({ elapsed, gymBucks: purse, builds });
        const result = startExpansion(context, axis);
        expect(result.started, `${axis} refused level ${level}`).toBe(true);
        if (!result.started) break;
        expect(result.build.toLevel, `${axis} skipped a level`).toBe(level);
        spent += result.build.paid;
        purse = fundedBalance(result, axis);
        builds = [...builds, result.build];
        // Wait the build out on the wall clock, which with no skip applied is
        // also the idle clock.
        elapsed = result.build.settledCompletion;
        expect(axisLevel(idleAxesAt(builds, asAcceleratedSeconds(elapsed)), axis)).toBe(level);
        steps += 1;
      }
      const top = contextAt({ elapsed, gymBucks: purse, builds });
      expect(expansionVerdict(top, axis)).toEqual({ allowed: false, refusal: 'at-ceiling' });
      expect(startExpansion(top, axis)).toEqual({ started: false, refusal: 'at-ceiling' });
      expect(EXPANSION_SWEEP.PURSE_GYM_BUCKS - purse).toBe(spent);
      reached.set(axis, axisLevel(idleAxesAt(builds, asAcceleratedSeconds(elapsed)), axis));
    }
    expect(steps).toBe(17);
    expect(Object.fromEntries(reached)).toEqual({
      equipment: 3,
      space: 5,
      coach: 4,
      spotter: 4,
      physio: 1,
    });
  });

  it('funds each axis from the book the tables put it on, and reads it there', () => {
    // `axisFunding` is derived from `AXIS_OUTPUT` and
    // `WALL_CLOCK_FUNDED_OUTPUTS`, so this pins the DERIVATION's result rather
    // than restating it: physio because it feeds a progression-reaching output,
    // space and spotter because they feed one `GATE_TARGET` says gates
    // Training IQ, and the other two because they feed neither.
    //
    // Reddening edits: re-point `AXIS_OUTPUT.physio` at `'gym-bucks'`; drop
    // `'roster-slot'` from `GATING_OUTPUTS`; re-tag `'training-pace'` in
    // `SINK_REACH`.
    expect(Object.fromEntries(EXPANSION_AXES.map((axis) => [axis, axisFunding(axis)]))).toEqual({
      equipment: 'idle-clock',
      space: 'wall-clock',
      coach: 'idle-clock',
      spotter: 'wall-clock',
      physio: 'wall-clock',
    });
    // Both sides are populated, so the split separates something. Counts, not
    // bounds, and derived from the same call rather than from the table above.
    const wallClock = EXPANSION_AXES.filter((axis) => axisFunding(axis) === 'wall-clock');
    expect(wallClock.length).toBe(3);
    expect(EXPANSION_AXES.length - wallClock.length).toBe(2);
    expect([...AXIS_FUNDINGS].sort()).toEqual(['idle-clock', 'wall-clock']);
    expect(expansionVocabularyFaults()).toEqual([]);
  });

  it('reads the ladders on both clocks, and the wall clock is never ahead', () => {
    // `settledAxesAt` is `idleAxesAt`'s twin through one shared body. The state
    // that tells them apart is the one a purchased skip produces: an idle
    // completion that has passed and a settled one that has not.
    //
    // Reddening edit: have `settledAxesAt` read `idleCompletion`.
    const skipped: ExpansionBuild = Object.freeze({
      axis: 'space',
      toLevel: 2,
      paid: asGymBucks(T.SPACE_LEVEL_COST_GYM_BUCKS[1]),
      startedAt: asUnacceleratedSeconds(0),
      settledCompletion: asUnacceleratedSeconds(900),
      idleCompletion: asAcceleratedSeconds(100),
    });
    const builds = [completedBuild('space', 1), skipped];
    const now = 300;
    expect(idleAxesAt(builds, asAcceleratedSeconds(now)).spaceLevel).toBe(2);
    expect(settledAxesAt(builds, asUnacceleratedSeconds(now)).spaceLevel).toBe(1);
    // The capacity the two views hand `rosterCapacity` differs, which is the
    // whole reason the wall-clock view exists.
    expect(rosterCapacity(idleAxesAt(builds, asAcceleratedSeconds(now)))).toBeGreaterThan(
      rosterCapacity(settledAxesAt(builds, asUnacceleratedSeconds(now))),
    );
    // And once the wall clock has passed the build the two agree, so the line
    // above is a clock and not a permanent gap.
    expect(settledAxesAt(builds, asUnacceleratedSeconds(900)).spaceLevel).toBe(2);
    // The same clamps hold on both, because there is one body: a build above
    // the ceiling does not push either view off its ladder.
    expect(settledAxesAt([completedBuild('space', 99)], asUnacceleratedSeconds(0)).spaceLevel).toBe(
      T.SPACE_LEVEL_MAX,
    );
  });

  it('holds a wall-clock-funded ladder to the wall clock while it is building', () => {
    // The state a purchased skip produces: a space build that has finished on
    // the player's idle clock and has not finished on the wall clock. Space is
    // a wall-clock-funded axis, so the rung above it is not startable until the
    // WALL clock has passed the build — otherwise a skip that cleared level N
    // early would let level N+1 start early, and the day a roster slot opens
    // is the day a Training IQ payer can start arriving.
    //
    // Reddening edit: read `buildInFlight` rather than `settledBuildInFlight`
    // for a wall-clock-funded axis in `expansionVerdict`.
    const skippedFlat: ExpansionBuild = Object.freeze({
      axis: 'space',
      toLevel: 1,
      paid: asGymBucks(T.SPACE_LEVEL_COST_GYM_BUCKS[0]),
      startedAt: asUnacceleratedSeconds(0),
      settledCompletion: asUnacceleratedSeconds(600),
      idleCompletion: asAcceleratedSeconds(100),
    });
    // The two clocks really disagree at this moment, or the verdict below is
    // about a build both readings call finished.
    expect(buildInFlight([skippedFlat], 'space', asAcceleratedSeconds(300))).toBeNull();
    expect(settledBuildInFlight([skippedFlat], 'space', asUnacceleratedSeconds(300))).toEqual(
      skippedFlat,
    );
    expect(expansionVerdict(contextAt({ elapsed: 300, builds: [skippedFlat] }), 'space')).toEqual({
      allowed: false,
      refusal: 'already-building',
    });
    // And once the wall clock has passed it, the next rung is startable — so
    // the refusal above is the clock and not a permanent block.
    expect(
      expansionVerdict(contextAt({ elapsed: 600, builds: [skippedFlat] }), 'space').allowed,
    ).toBe(true);
    // The idle-funded sibling is read on the idle clock, which is the other
    // half of the same decision.
    const idleFunded: ExpansionBuild = Object.freeze({ ...skippedFlat, axis: 'coach' });
    expect(expansionVerdict(contextAt({ elapsed: 300, builds: [idleFunded] }), 'coach').allowed).toBe(
      true,
    );
  });

  it('reads a level off the highest completed build, not off a count of them', () => {
    // A duplicated or out-of-order build must not inflate an axis, and a build
    // above the ceiling must not push it off its ladder.
    const now = asAcceleratedSeconds(0);
    expect(axisLevel(idleAxesAt([completedBuild('space', 2), completedBuild('space', 1)], now), 'space')).toBe(2);
    expect(axisLevel(idleAxesAt([completedBuild('space', 2), completedBuild('space', 2)], now), 'space')).toBe(2);
    expect(axisLevel(idleAxesAt([completedBuild('space', 99)], now), 'space')).toBe(T.SPACE_LEVEL_MAX);
    expect(idleAxesAt([completedBuild('equipment', 99)], now).equipment).toBe(
      T.EQUIPMENT_TIERS[T.EQUIPMENT_TIERS.length - 1],
    );
    // An unfinished build counts for nothing on the idle clock.
    const running = Object.freeze({
      ...completedBuild('space', 1),
      idleCompletion: asAcceleratedSeconds(600),
    });
    expect(idleAxesAt([running], now).spaceLevel).toBe(0);
    expect(idleAxesAt([running], asAcceleratedSeconds(600)).spaceLevel).toBe(1);
    expect(buildInFlight([running], 'space', now)).toEqual(running);
    expect(buildInFlight([running], 'space', asAcceleratedSeconds(600))).toBeNull();
    expect(buildInFlight([running], 'coach', now)).toBeNull();
  });

  it('builds a context from an EmpireState without inventing one', () => {
    const state = createEmpireState();
    const context = expansionContext(state, [completedBuild('coach', 1)]);
    expect(context.clock).toBe(state.clock);
    expect(context.gymBucks).toBe(state.gymBucks);
    expect(context.settledGymBucks).toBe(state.settledGymBucks);
    expect(context.reputation).toBe(state.reputation);
    expect(context.builds.length).toBe(1);
    // A gym on the day it opens cannot afford anything, which is what a zero
    // balance means and is worth one line rather than an assumption. Which
    // refusal it gets is which book the axis is bought from.
    expect(expansionVerdict(context, 'space')).toEqual({
      allowed: false,
      refusal: 'not-enough-wall-clock-earnings',
    });
    expect(expansionVerdict(context, 'equipment')).toEqual({
      allowed: false,
      refusal: 'not-enough-gym-bucks',
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Roster capacity
// ---------------------------------------------------------------------------

describe('§5.4 space and spotters raise the roster ceiling', () => {
  it('never lowers capacity when any axis level rises, and reaches the cap', () => {
    // The sweep is the whole product of the four axes, and the comparison is
    // made on a SINGLE axis rising with the rest held, which is the claim —
    // "raising a level never costs a slot" — rather than the weaker "the maxed
    // gym has more slots than the empty one".
    const equipmentTiers = [...T.EQUIPMENT_TIERS];
    let comparisons = 0;
    let configurations = 0;
    let strictRises = 0;
    const values = new Set<number>();
    for (const equipment of equipmentTiers) {
      for (let space = 0; space <= T.SPACE_LEVEL_MAX; space += 1) {
        for (let spotter = 0; spotter <= T.STAFF_LEVEL_MAX.spotter; spotter += 1) {
          for (let coach = 0; coach <= T.STAFF_LEVEL_MAX.coach; coach += 1) {
            const staff = { coach, spotter, physio: 0 };
            const here = rosterCapacity(axesAt(equipment, space, staff));
            values.add(here);
            configurations += 1;
            if (space < T.SPACE_LEVEL_MAX) {
              const up = rosterCapacity(axesAt(equipment, space + 1, staff));
              expect(up, `space ${space} -> ${space + 1} cost a slot`).toBeGreaterThanOrEqual(here);
              if (up > here) strictRises += 1;
              comparisons += 1;
            }
            if (spotter < T.STAFF_LEVEL_MAX.spotter) {
              const up = rosterCapacity(axesAt(equipment, space, { ...staff, spotter: spotter + 1 }));
              expect(up, `spotter ${spotter} -> ${spotter + 1} cost a slot`).toBeGreaterThanOrEqual(
                here,
              );
              if (up > here) strictRises += 1;
              comparisons += 1;
            }
          }
        }
      }
    }
    // Counts, not bounds. 4 tiers x 6 space x 5 spotter x 5 coach.
    expect(configurations).toBe(600);
    expect(comparisons).toBe(980);
    // Not a constant function: if `rosterCapacity` returned one number for
    // everything, every comparison above would pass and mean nothing.
    expect(values.size).toBe(15);
    expect(Math.min(...values)).toBe(T.ROSTER_SLOTS_BASE);
    expect(Math.max(...values)).toBe(T.ROSTER_SLOTS_MAX);
    // And every one of those comparisons rose STRICTLY, which is more than the
    // `>=` above says and is a measurement rather than a restatement of it:
    // `ROSTER_SLOTS_MAX` is exactly reachable at the top of both ladders, so
    // the cap never truncates a rise inside the sweep. Lowering
    // `ROSTER_SLOTS_MAX` to 10 makes the top of the sweep plateau and drops
    // this number well below `comparisons`, while leaving every `>=` green.
    expect(strictRises).toBe(980);
    expect(strictRises).toBe(comparisons);
  });

  it('reaches the roster cap only with both axes built out', () => {
    const maxed = axesAt(T.EQUIPMENT_TIERS[T.EQUIPMENT_TIERS.length - 1] as EquipmentTier, T.SPACE_LEVEL_MAX, {
      coach: T.STAFF_LEVEL_MAX.coach,
      spotter: T.STAFF_LEVEL_MAX.spotter,
      physio: T.STAFF_LEVEL_MAX.physio,
    });
    expect(rosterCapacity(maxed)).toBe(T.ROSTER_SLOTS_MAX);
    expect(rosterCapacity(idleAxesAt([], asAcceleratedSeconds(0)))).toBe(T.ROSTER_SLOTS_BASE);
  });
});

// ---------------------------------------------------------------------------
// 6. The clock split — the §12.3 surface
// ---------------------------------------------------------------------------

describe('§8.1 no accelerant moves a build on the wall clock', () => {
  /** One started build per axis, from a clock with nothing skipped. */
  const builtAxes = (): ReadonlyMap<ExpansionAxis, ExpansionBuild> => {
    const map = new Map<ExpansionAxis, ExpansionBuild>();
    for (const axis of EXPANSION_AXES) {
      const result = startExpansion(contextAt({ elapsed: 7200 }), axis);
      if (result.started) map.set(axis, result.build);
    }
    return map;
  };

  it('refuses a purchasable accelerant against the physio axis, by construction', () => {
    // The compile-time half. Both calls are the §12.3 refusal condition
    // written out, and `tsc --noEmit` grades the directives.
    //
    // WHAT ACTUALLY REDDENS THEM, measured rather than assumed. A first draft
    // of this comment said re-pointing `AXIS_OUTPUT.physio` at an idle-only
    // output would make these unused directives. That is FALSE and was caught
    // by running it: `tsc` stayed green, because these two calls name
    // `'physio-days-saved'` literally and are refused by `empireCore.ts`'s
    // licence tables, which `AXIS_OUTPUT` does not feed into. The edit that
    // does redden them is the §12.3 one — adding `'progression-reaching'` to
    // `ARRIVAL_LICENCE['store-purchase']` — which was run and produced
    // `error TS2578: Unused '@ts-expect-error' directive` on both lines below.
    // The `AXIS_OUTPUT` edit is covered instead by the runtime half of this
    // test and by `expansionVocabularyFaults`.
    //
    // The `toThrow` around each is the vitest half — the same call is refused
    // a second time at runtime, which is what covers a caller who reaches this
    // module from JSON rather than from TypeScript.
    expect(() => {
      // @ts-expect-error a bought timer skip may not touch a progression-reaching output
      applyAccelerant('gym-empire-timer-skip', 'physio-days-saved', ZERO_SECONDS, 60);
    }).toThrow(RangeError);
    expect(() => {
      // @ts-expect-error an opt-in ad skip arrives by the same route and is the same row
      applyAccelerant('rewarded-ad-timer-skip', 'physio-days-saved', ZERO_SECONDS, 60);
    }).toThrow(RangeError);

    // The runtime half, for the callers TypeScript never sees.
    const physioOutput = axisOutput('physio');
    let refused = 0;
    for (const accelerant of PURCHASABLE_ACCELERANTS) {
      expect(mayAccelerate(accelerant, physioOutput), `${accelerant} may reach physio`).toBe(false);
      expect(() => appliedFor(accelerant, physioOutput, ZERO_SECONDS, 60)).toThrow(RangeError);
      refused += 1;
    }
    expect(refused).toBe(2);

    // The contrast, so `false` is not simply what `mayAccelerate` says to
    // everything. An earned accelerant is licensed against the same output.
    let licensed = 0;
    for (const accelerant of EARNED_ACCELERANTS) {
      expect(mayAccelerate(accelerant, physioOutput), `${accelerant} may not reach physio`).toBe(
        true,
      );
      licensed += 1;
    }
    expect(licensed).toBe(3);
    expect(refused + licensed).toBe(EMPIRE_ACCELERANTS.length);
  });

  it('refuses an accelerant aimed at an output the axis does not feed', () => {
    // The skip bought for the coach queue that would otherwise land on the
    // physio build. `'gym-bucks'` is what the coach axis feeds and
    // `'physio-days-saved'` is what physio feeds, so this is the real crossing
    // rather than a made-up one.
    const build = builtAxes().get('physio') as ExpansionBuild;
    const wrong = appliedFor('gym-empire-timer-skip', 'gym-bucks', ZERO_SECONDS, 3600);
    expect(() => skipExpansion(build, wrong)).toThrow(/may not be applied to the physio axis/);

    // And the second fence, for a payload the compiler never saw: a pairing
    // forged past the type system, the way a decoded Edge Function response
    // arrives. `skipExpansion` asks `mayAccelerate` itself rather than trusting
    // that the value came from `applyAccelerant`.
    const forged = Object.freeze({
      accelerant: 'gym-empire-timer-skip',
      output: 'physio-days-saved',
      at: ZERO_SECONDS,
      seconds: 3600,
    }) as unknown as AppliedAccelerant;
    expect(() => skipExpansion(build, forged)).toThrow(/may not accelerate/);
    // The build itself is untouched by either refusal.
    expect(build.settledCompletion).toBe(7200 + buildSeconds(1));
  });

  it('moves the idle completion and leaves the settled one byte-identical', () => {
    // The element-wise claim, over every axis, every accelerant that axis's
    // output licenses, and every skip magnitude. Not an aggregate: each
    // settled completion is compared to the one it came from.
    const builds = builtAxes();
    let applications = 0;
    let idleMoved = 0;
    let settledMoved = 0;
    const controlMoved: string[] = [];
    for (const [axis, build] of builds) {
      const output = axisOutput(axis);
      for (const accelerant of EMPIRE_ACCELERANTS) {
        if (!mayAccelerate(accelerant, output)) continue;
        for (const seconds of EXPANSION_SWEEP.SKIP_SECONDS) {
          const applied = appliedFor(accelerant, output, ZERO_SECONDS, seconds);
          const after = skipExpansion(build, applied);
          if (after.settledCompletion !== build.settledCompletion) settledMoved += 1;
          if (after.idleCompletion !== build.idleCompletion) idleMoved += 1;
          expect(after.settledCompletion, `${axis}/${accelerant}/${seconds}s`).toBe(
            build.settledCompletion,
          );
          expect(after.idleCompletion).toBe(Math.max(0, build.idleCompletion - seconds));
          // Everything else is carried across too, so "only the idle clock
          // moved" is a statement about the whole record.
          expect({ ...after, idleCompletion: build.idleCompletion }).toEqual({ ...build });

          // The negative control: the same call with the skip deliberately
          // wired into the settled clock as well. Without this, the zero above
          // is a zero against nothing.
          const wired: ExpansionBuild = Object.freeze({
            ...after,
            settledCompletion: asUnacceleratedSeconds(
              Math.max(0, build.settledCompletion - seconds),
            ),
          });
          if (wired.settledCompletion !== build.settledCompletion) {
            controlMoved.push(`${axis}/${accelerant}/${seconds}`);
          }
          applications += 1;
        }
      }
    }
    // Counts, not bounds. 4 idle-only axes x 5 accelerants x 8 magnitudes,
    // plus the physio axis x 3 earned accelerants x 8 magnitudes.
    expect(applications).toBe(4 * 5 * 8 + 1 * 3 * 8);
    expect(applications).toBe(184);
    expect(settledMoved).toBe(0);
    // The idle clock really did move, on every magnitude but zero, so the
    // comparison above is not being made against a no-op.
    expect(idleMoved).toBe(applications - 23);
    expect(idleMoved).toBe(161);
    // And the control moved where the subject did not. A zero beside a zero
    // would mean the sweep could not have detected the defect either way.
    expect(controlMoved.length).toBe(161);
  });

  it('leaves the physio series byte-identical under every accelerant that can reach it', () => {
    // GDD §5.4's hook, sampled once per wall-clock day and compared element by
    // element — not by a sum, not by a bound. §4.4 records a legal input that
    // moved 2362 of 34338 purchase-day lists and left every aggregate
    // identical, which is why the comparison is on the list.
    //
    // The purchasable arm of this sweep is EMPTY BY CONSTRUCTION — no
    // purchasable accelerant can be paired with `'physio-days-saved'` at all —
    // and that closure is asserted in its own test above rather than swept
    // over here, where an empty loop would read as a pass.
    const started = startExpansion(
      contextAt({ elapsed: EXPANSION_SWEEP.PHYSIO_BUILD_START_SECONDS }),
      'physio',
    );
    expect(started.started).toBe(true);
    if (!started.started) return;
    const build = started.build;

    const series = (builds: readonly ExpansionBuild[]): readonly number[] =>
      Array.from({ length: EXPANSION_SWEEP.PHYSIO_SERIES_DAYS }, (_, day) =>
        physioDaysSavedAt(builds, asUnacceleratedSeconds(day * T.SECONDS_PER_DAY)),
      );

    const baseline = series([build]);
    // The baseline is not a constant list: it holds both the before and the
    // after value, so a comparison against it can actually disagree.
    expect(new Set(baseline).size).toBe(2);
    expect(baseline[0]).toBe(0);
    expect(baseline[EXPANSION_SWEEP.PHYSIO_SERIES_DAYS - 1]).toBe(T.PHYSIO_MAX_DAYS_SAVED);
    expect(baseline.indexOf(T.PHYSIO_MAX_DAYS_SAVED)).toBe(4);
    expect(baseline.length).toBe(40);

    let sweeps = 0;
    let daysCompared = 0;
    let differed = 0;
    const controlDiffered: string[] = [];
    for (const accelerant of EARNED_ACCELERANTS) {
      for (const seconds of EXPANSION_SWEEP.SKIP_SECONDS) {
        const applied = appliedFor(accelerant, axisOutput('physio'), ZERO_SECONDS, seconds);
        const after = series([skipExpansion(build, applied)]);
        expect(after.length).toBe(baseline.length);
        for (let day = 0; day < baseline.length; day += 1) {
          if (after[day] !== baseline[day]) differed += 1;
          expect(after[day], `${accelerant} / ${seconds}s / day ${day}`).toBe(baseline[day]);
          daysCompared += 1;
        }

        // The negative control, wired so the skip DOES move the settled clock.
        const wired: ExpansionBuild = Object.freeze({
          ...build,
          settledCompletion: asUnacceleratedSeconds(
            Math.max(0, build.settledCompletion - seconds),
          ),
        });
        const control = series([wired]);
        if (control.some((value, day) => value !== baseline[day])) {
          controlDiffered.push(`${accelerant}/${seconds}`);
        }
        sweeps += 1;
      }
    }
    expect(sweeps).toBe(3 * 8);
    expect(sweeps).toBe(24);
    expect(daysCompared).toBe(24 * 40);
    expect(daysCompared).toBe(960);
    expect(differed).toBe(0);
    // The control's non-zero count, pinned. Four of the eight magnitudes are
    // large enough to pull the completion into an earlier sampled day; the
    // other four are not, which is why the magnitudes straddle `buildSeconds(1)`.
    expect(controlDiffered.length).toBe(12);
    expect(controlDiffered.length).toBe(EARNED_ACCELERANTS.length * 4);
  });

  it('reads the physio level off the wall clock and the gym off the idle one', () => {
    // The two views of one build, and the moment they disagree. With a skip
    // applied, the gym shows the physio level and the hook does not yet.
    const started = startExpansion(contextAt({ elapsed: 0 }), 'physio');
    expect(started.started).toBe(true);
    if (!started.started) return;
    const seconds = buildSeconds(1);
    const skipped = skipExpansion(
      started.build,
      appliedFor('coach-staff-level', axisOutput('physio'), ZERO_SECONDS, seconds),
    );
    // Idle clock at zero: the build is done, because the skip covered it.
    expect(idleAxesAt([skipped], asAcceleratedSeconds(0)).staffLevel.physio).toBe(1);
    // Wall clock at zero: it is not, and the hook pays nothing.
    expect(settledAxisLevel([skipped], 'physio', ZERO_SECONDS)).toBe(0);
    expect(physioDaysSavedAt([skipped], ZERO_SECONDS)).toBe(0);
    // And at the moment the build would have finished unaided, it pays.
    expect(physioDaysSavedAt([skipped], asUnacceleratedSeconds(seconds))).toBe(
      T.PHYSIO_MAX_DAYS_SAVED,
    );
    // `settledAxisLevel` is `settledLevel` over that axis's settled
    // completions and nothing else — the same answer, computed the other way.
    expect(settledAxisLevel([skipped], 'physio', asUnacceleratedSeconds(seconds))).toBe(
      settledLevel([skipped.settledCompletion], asUnacceleratedSeconds(seconds)),
    );
    // Another axis's builds do not count toward it.
    expect(settledAxisLevel([completedBuild('coach', 4)], 'physio', ZERO_SECONDS)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. The physio hook against the real fatigue model
// ---------------------------------------------------------------------------

describe('§5.4 physio shortens a setback and never erases it', () => {
  /** Every days-saved value the module can produce, from no physio to full. */
  const reachableSavings = (): readonly number[] => {
    const values: number[] = [];
    for (let level = 0; level <= T.STAFF_LEVEL_MAX.physio; level += 1) {
      const builds = level === 0 ? [] : [completedBuild('physio', level)];
      values.push(physioDaysSavedAt(builds, asUnacceleratedSeconds(T.SECONDS_PER_DAY)));
    }
    return values;
  };

  it('produces whole days at or above zero, and a saving the ladder can reach', () => {
    const savings = reachableSavings();
    expect(savings).toEqual([0, T.PHYSIO_MAX_DAYS_SAVED]);
    expect(savings.length).toBe(2);
    let checked = 0;
    for (const saved of savings) {
      expect(Number.isInteger(saved), `${saved} is not a whole number of days`).toBe(true);
      expect(saved).toBeGreaterThanOrEqual(0);
      checked += 1;
    }
    expect(checked).toBe(2);
    // A hook that saves nothing at full build is dead content dressed as a
    // cross-mode feature.
    expect(Math.max(...savings)).toBeGreaterThan(0);
    // And it is capped: no arrangement of builds pays more.
    expect(physioDaysSavedAt([completedBuild('physio', 99)], ZERO_SECONDS)).toBe(
      T.PHYSIO_MAX_DAYS_SAVED,
    );
    expect(physioDaysSavedFor(settledLevel([ZERO_SECONDS, ZERO_SECONDS], ZERO_SECONDS))).toBe(
      T.PHYSIO_MAX_DAYS_SAVED,
    );
  });

  it('leaves the shortest setback the real model can roll above the real floor', () => {
    // Reads `FATIGUE_TUNING` from `src/game/fatigue.ts` directly. A copy of the
    // floor here could not detect the original moving, which is the point of
    // importing it: raising `PHYSIO_MAX_DAYS_SAVED` to 2, or lowering
    // `INJURY_DURATION_DAYS_MIN` to 1, reddens this.
    const floor = FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO;
    const shortest = FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN;
    expect(floor).toBeGreaterThan(0);
    let rolls = 0;
    for (const saved of reachableSavings()) {
      for (
        let roll = FATIGUE_TUNING.INJURY_DURATION_DAYS_MIN;
        roll <= FATIGUE_TUNING.INJURY_DURATION_DAYS_MAX;
        roll += 1
      ) {
        // The model's own arithmetic, clamp included.
        const shortened = Math.max(floor, roll - saved);
        // The clamp never has to fire: the saving lands whole. This is the
        // assertion that is NOT a restatement of `Math.max` — it says the
        // clamp was not the thing that produced the answer.
        expect(shortened, `roll ${roll}, saved ${saved}: the clamp absorbed the saving`).toBe(
          roll - saved,
        );
        expect(roll - shortened).toBe(saved);
        expect(shortened, `roll ${roll}, saved ${saved}`).toBeGreaterThanOrEqual(floor);
        expect(shortened).toBeGreaterThan(0);
        rolls += 1;
      }
    }
    expect(rolls).toBe(4);
    expect(shortest - Math.max(...reachableSavings())).toBeGreaterThanOrEqual(floor);
  });

  it('drives the real recordSession and shortens a real setback', () => {
    // The end-to-end statement: the value this module produces, handed to the
    // real `recordSession` as `physioDaysSaved`, on the model's unluckiest
    // rolls. `UNLUCKIEST_ROLLS` is not used directly because `duration: 1`
    // picks the longest band; the shortest band is the one the floor is
    // closest to, so both ends are driven.
    const session = Object.freeze({
      day: 1,
      lift: 'squat' as const,
      topRpe: 10,
      workSets: 10,
      repsPerSet: 5,
    });
    const saved = physioDaysSavedAt(
      [completedBuild('physio', T.STAFF_LEVEL_MAX.physio)],
      asUnacceleratedSeconds(T.SECONDS_PER_DAY),
    );
    expect(saved).toBe(T.PHYSIO_MAX_DAYS_SAVED);

    let bands = 0;
    for (const duration of [0, 1]) {
      const withoutPhysio = recordSession(EMPTY_FATIGUE_STATE, session, { onset: 0, duration });
      const withPhysio = recordSession(EMPTY_FATIGUE_STATE, session, { onset: 0, duration }, {
        physioDaysSaved: saved,
      });
      // The session really did start a setback, in both runs. Without this the
      // comparison below would be two nulls.
      expect(withoutPhysio.injuryOnset, `duration roll ${duration}`).not.toBeNull();
      expect(withPhysio.injuryOnset).not.toBeNull();
      const plain = withoutPhysio.injuryOnset?.daysRemaining as number;
      const treated = withPhysio.injuryOnset?.daysRemaining as number;
      // It shortens...
      expect(treated, `duration roll ${duration}: physio saved nothing`).toBe(plain - saved);
      expect(treated).toBeLessThan(plain);
      // ...and it does not erase. GDD §3.5: a setback stays a setback.
      expect(treated).toBeGreaterThanOrEqual(
        FATIGUE_TUNING.INJURY_MIN_DURATION_DAYS_AFTER_PHYSIO,
      );
      expect(treated).toBeGreaterThan(0);
      bands += 1;
    }
    expect(bands).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 8. The module's own shape
// ---------------------------------------------------------------------------

describe('expansion.ts is pure and keeps the clock brands on its arguments', () => {
  const source = readFileSync(path.join(HERE, 'expansion.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('strips to something, so the scans below are not over an empty string', () => {
    expect(code.length).toBeGreaterThan(0);
    expect(code).toMatch(/export function /);
  });

  it('imports nothing outside this directory', () => {
    // The sibling of the check `empireCore.test.ts` runs over the two modules
    // it knows about. That one names its files, so it could not have covered
    // this one; this is the same claim applied to the file it was written for.
    const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);
    expect(imports.sort()).toEqual(['./empireCore', './empireTuning']);
    expect(imports.length).toBe(2);
  });

  it('exports exactly these functions', () => {
    const names = [...code.matchAll(/export function (\w+)/g)].map((match) => match[1] as string);
    expect(names.length).toBe(new Set(names).size);
    expect([...names].sort()).toEqual([
      'axisBuildSeconds',
      'axisCeiling',
      'axisFunding',
      'axisLevel',
      'axisLevelCost',
      'axisOutput',
      'axisReputationRequirement',
      'axisReputationRule',
      'buildInFlight',
      'expansionContext',
      'expansionVerdict',
      'expansionVocabularyFaults',
      'idleAxesAt',
      'isExpansionAxis',
      'isStaffAxis',
      'physioDaysSavedAt',
      'quoteExpansion',
      'settledAxesAt',
      'settledAxisLevel',
      'settledBuildInFlight',
      'skipExpansion',
      'startExpansion',
    ]);
    expect(names.length).toBe(22);
  });

  it('takes no bare number on any function that produces a clock quantity', () => {
    // `empireCore.ts` guards this with `Unbranded<N>`, which it does not
    // export, so the guard cannot be written in this file — see its header.
    // What CAN be checked is the property the guard exists for: nothing that
    // produces or returns a wall-clock quantity, an idle-clock quantity or a
    // build accepts a raw `number` it could mint one from.
    //
    // The edit that reddens this, named before it was written: adding
    // `export function settledCompletionAt(seconds: number): UnacceleratedSeconds`.
    const declarations = new Map<string, string>();
    for (const match of code.matchAll(/export function (\w+)/g)) {
      const at = match.index as number;
      declarations.set(match[1] as string, code.slice(at, code.indexOf('{', at)));
    }
    expect(declarations.size).toBe(22);

    const producesAClockQuantity =
      /:\s*(UnacceleratedSeconds|AcceleratedSeconds|SettledLevel|InjuryDaysSaved|ExpansionBuild|ExpansionStart)\b/;
    const takesABareNumber = /\(\s*[\s\S]*?\)\s*:/;
    const producers: string[] = [];
    const bareNumberTakers: string[] = [];
    for (const [name, declaration] of declarations) {
      const parameters = declaration.slice(
        declaration.indexOf('('),
        declaration.lastIndexOf(')') + 1,
      );
      const returns = declaration.slice(declaration.lastIndexOf(')') + 1);
      expect(takesABareNumber.test(declaration), `${name} has no parseable signature`).toBe(true);
      if (producesAClockQuantity.test(returns)) producers.push(name);
      if (/:\s*number\b/.test(parameters)) bareNumberTakers.push(name);
    }
    // Both sets pinned exactly, so neither can go quiet by emptying.
    expect(producers.sort()).toEqual([
      'buildInFlight',
      'physioDaysSavedAt',
      'settledAxisLevel',
      'settledBuildInFlight',
      'skipExpansion',
      'startExpansion',
    ]);
    expect(bareNumberTakers.sort()).toEqual([
      'axisBuildSeconds',
      'axisLevelCost',
      'axisReputationRequirement',
      'axisReputationRule',
    ]);
    expect(producers.length).toBe(6);
    expect(bareNumberTakers.length).toBe(4);
    // The claim itself: the two sets are disjoint.
    expect(producers.filter((name) => bareNumberTakers.includes(name))).toEqual([]);
  });
});
