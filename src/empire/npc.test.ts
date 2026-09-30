/**
 * npc.test.ts — the tests for GDD §5.2/§5.3 NPC output.
 *
 * ===========================================================================
 * What is graded by what
 * ===========================================================================
 *
 * Three `@ts-expect-error` directives in this file are graded by
 * `npx tsc --noEmit` and not by vitest, which strips types without checking
 * them. Their vitest-reddenable companion is the test directly above them,
 * 'declares each wrapper against its own tenure brand', because
 * `empireCore.test.ts` records what happens when a directive ships without one:
 * a brand is erased at runtime, so no value this module produces can tell
 * whether a parameter was declared `SettledTenureDays` or `number`. The line
 * vitest can read is the DECLARATION, so the declaration is what is pinned.
 * Both were driven together: rewiring `npcTrainingIqPerDay` onto
 * `idleTenureDays(lifter, elapsedFor(clock, 'gym-bucks'))` is TS2345 in `tsc`
 * and reddens that test's `tenure: SettledTenureDays` count in the same edit.
 *
 * ===========================================================================
 * The sweep's parameters are written down
 * ===========================================================================
 *
 * `NPC_SWEEP` below holds the horizons, the skip sizes and the tiers, as a
 * named frozen block, for the reason `src/game/streakSweep.ts` exists: the
 * first version of a measurement in this repository was reported with its
 * inputs unstated and could not afterwards be reproduced, and six plausible
 * parameterisations gave six different numbers. "A measurement whose inputs are
 * not written down is an anecdote."
 *
 * It lives here rather than in `empireTuning.ts` because a sweep parameter is
 * not a game-feel value a playtester turns, and because `src/tuning/audit.ts`
 * classifies every unregistered file under `src/empire/` as a `renderer` — so a
 * bare number in `npc.ts` fails the suite by name, line and literal, while a
 * test file is deliberately not scanned.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  asAcceleratedSeconds,
  asIdleTenureDays,
  asUnacceleratedSeconds,
  createEmpireClock,
  createNpcLifter,
  idleTenureDays,
  settledTenureDays,
  type EmpireClock,
  type NpcLifter,
  type NpcTier,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import {
  idleLoyaltyMultiplier,
  npcGymBucksPerHour,
  npcOutputRates,
  npcTierOutputMultiplier,
  npcTrainingIqPerDay,
  rosterGymBucksPerHour,
  rosterOutputRates,
  rosterTrainingIqPerDay,
  settledLoyaltyMultiplier,
} from './npc';

// ---------------------------------------------------------------------------
// The sweep's parameters, in one named block
// ---------------------------------------------------------------------------

const NPC_SWEEP = Object.freeze({
  /** Wall-clock days the readings are taken at. Straddles the loyalty ramp. */
  HORIZON_DAYS: Object.freeze([0, 1, 2, 5, 10, 20, 29, 30, 31, 60, 365] as const),
  /**
   * Seconds a purchasable accelerant has pushed the idle clock forward by. The
   * zero row is the baseline every other row is compared against element-wise.
   */
  SKIP_SECONDS: Object.freeze([0, 3600, 43200, 86400, 432000, 2592000] as const),
  /** Wall-clock seconds at which the lifter's recruitment settled. */
  SETTLED_AT_SECONDS: Object.freeze([0, 3600, 86400] as const),
  /** A grid fine enough to see the loyalty curve's shape, in days. */
  LOYALTY_GRID_DAYS: Object.freeze(
    Array.from({ length: 121 }, (_, step) => step * 0.5),
  ),
});

const SECONDS_PER_DAY = EMPIRE_TUNING.SECONDS_PER_DAY;
const TIERS: readonly NpcTier[] = EMPIRE_TUNING.NPC_TIERS;
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** A module's source with its comments removed, so a scan reads code only. */
function readModule(name: string): string {
  const source = readFileSync(path.join(HERE, name), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (code.trim().length === 0) throw new Error(`${name} stripped to nothing`);
  return code;
}

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function round6(value: number): number {
  const scale = 10 ** EMPIRE_TUNING.PRECISION_DECIMALS;
  return Math.round(value * scale) / scale;
}

function lifterAt(tier: NpcTier, joinedAt: number, settledAt: number, id = 'a'): NpcLifter {
  return createNpcLifter(id, tier, 'Placeholder', joinedAt, settledAt);
}

function clockAt(day: number, skipSeconds: number): EmpireClock {
  return createEmpireClock(day * SECONDS_PER_DAY, skipSeconds);
}

/**
 * The negative control: the same engine with one clock swapped.
 *
 * GDD §4.4's bar is that a zero be zero against something, because a sweep with
 * an empty domain reports nothing and reads as a pass. This is
 * `npcTrainingIqPerDay` wired so a purchased skip does move it — the accelerated
 * reading against the settled origin — and the count of readings it moves is
 * pinned beside the shipped engine's zero.
 */
function mutantTrainingIqPerDay(lifter: NpcLifter, clock: EmpireClock): number {
  const days = Math.max(0, clock.accelerated - lifter.settledAt) / SECONDS_PER_DAY;
  return round6(
    EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE *
      npcTierOutputMultiplier(lifter.tier) *
      idleLoyaltyMultiplier(asIdleTenureDays(days)),
  );
}

describe('the tier multiplier is a table read by the tier the caller named', () => {
  it('returns the published multiplier for every tier', () => {
    let read = 0;
    for (const tier of TIERS) {
      expect(npcTierOutputMultiplier(tier)).toBe(EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[tier]);
      read += 1;
    }
    expect(read).toBe(5);
    expect(read).toBe(TIERS.length);
  });

  it('gives a different multiplier to every tier, so no lookup is a constant', () => {
    // Reddens on `NPC_TIER_OUTPUT_MULTIPLIER[NPC_TIERS[0]]` — a lookup keyed to
    // something other than the argument collapses this set to one member.
    const seen = new Set(TIERS.map((tier) => npcTierOutputMultiplier(tier)));
    expect(seen.size).toBe(TIERS.length);
    expect(seen.size).toBe(5);
  });

  it('rises along the ladder, so no tier is dominated by the one below it', () => {
    let compared = 0;
    for (let at = 1; at < TIERS.length; at += 1) {
      const lower = npcTierOutputMultiplier(TIERS[at - 1] as NpcTier);
      const upper = npcTierOutputMultiplier(TIERS[at] as NpcTier);
      expect(upper, `${String(TIERS[at])} pays no more than ${String(TIERS[at - 1])}`).toBeGreaterThan(lower);
      compared += 1;
    }
    expect(compared).toBe(4);
  });
});

describe('the tenure/loyalty curve', () => {
  const idleAt = (days: number): number => {
    const lifter = lifterAt('novice', 0, 0);
    return idleLoyaltyMultiplier(idleTenureDays(lifter, asAcceleratedSeconds(days * SECONDS_PER_DAY)));
  };
  const settledAt = (days: number): number => {
    const lifter = lifterAt('novice', 0, 0);
    return settledLoyaltyMultiplier(
      settledTenureDays(lifter, asUnacceleratedSeconds(days * SECONDS_PER_DAY)),
    );
  };

  it('starts at the floor and reaches the ceiling exactly at the full-loyalty day', () => {
    expect(idleAt(0)).toBe(EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER);
    expect(idleAt(EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY)).toBe(
      EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER,
    );
    // The ceiling holds past the ramp: a lifter recruited a year ago and one
    // recruited a month ago are worth the same, which is what keeps the roster
    // a live decision rather than an archive.
    expect(idleAt(EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY * 12)).toBe(
      EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER,
    );
  });

  it('is monotone non-decreasing and stays inside its two multipliers', () => {
    // Reddens on a curve exponent applied to the wrong side, on a floor above
    // the ceiling, and on any unclamped normalisation — at 60 days an
    // unclamped `(d / 30) ** 0.6` is 1.51, which is outside the bound below.
    let previous = Number.NEGATIVE_INFINITY;
    let sampled = 0;
    let strictRises = 0;
    for (const days of NPC_SWEEP.LOYALTY_GRID_DAYS) {
      const value = idleAt(days);
      expect(value).toBeGreaterThanOrEqual(EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER);
      expect(value).toBeLessThanOrEqual(EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER);
      expect(value, `loyalty fell at ${days} days`).toBeGreaterThanOrEqual(previous);
      if (value > previous && previous > Number.NEGATIVE_INFINITY) strictRises += 1;
      previous = value;
      sampled += 1;
    }
    // Counts, not bounds. A grid that had gone empty would make every line
    // above pass, and a curve flattened to a constant would leave the rises at
    // zero while the monotonicity check stayed green.
    expect(sampled).toBe(121);
    expect(sampled).toBe(NPC_SWEEP.LOYALTY_GRID_DAYS.length);
    expect(strictRises).toBe(60);
  });

  it('front-loads the payoff, which is what the sub-1 exponent is for', () => {
    // At half the ramp a curve with exponent 1 would sit halfway between the
    // two multipliers. The shipped exponent is below 1, so it sits above that.
    const half = EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY / 2;
    const midpoint =
      (EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER + EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER) / 2;
    expect(EMPIRE_TUNING.NPC_LOYALTY_CURVE_EXPONENT).toBeLessThan(1);
    expect(idleAt(half)).toBeGreaterThan(midpoint);
  });

  it('gives the two clock brands the same curve on the same day count', () => {
    // One curve, two brands. Reddens if the wrappers stop sharing
    // `loyaltyFromDays` and drift.
    let compared = 0;
    for (const days of NPC_SWEEP.HORIZON_DAYS) {
      expect(settledAt(days)).toBe(idleAt(days));
      compared += 1;
    }
    expect(compared).toBe(11);
    expect(compared).toBe(NPC_SWEEP.HORIZON_DAYS.length);
  });

  it('declares each wrapper against its own tenure brand', () => {
    // The vitest half of the three directives below. A brand is erased at
    // runtime, so the reddenable line is the declaration. Match COUNTS are
    // pinned rather than presence, because a pattern with more than one witness
    // in a file is a textual pin this codebase has been bitten by.
    const source = readModule('npc.ts');
    expect(count(source, /tenure:\s*IdleTenureDays/g)).toBe(1);
    expect(count(source, /tenure:\s*SettledTenureDays/g)).toBe(1);
    expect(count(source, /elapsedFor\(clock,\s*'gym-bucks'\)/g)).toBe(1);
    expect(count(source, /elapsedFor\(clock,\s*'training-iq'\)/g)).toBe(1);
    expect(count(source, /function loyaltyFromDays/g)).toBe(1);
    expect(count(source, /export /g)).toBeGreaterThan(0);
    // And `loyaltyFromDays` is not exported, which is what stops a caller
    // holding an accelerated tenure reaching the Training IQ half in one call.
    expect(count(source, /export function loyaltyFromDays/g)).toBe(0);
  });

  it('refuses each tenure brand where the other is required', () => {
    const lifter = lifterAt('novice', 0, 0);
    const idle = idleTenureDays(lifter, asAcceleratedSeconds(SECONDS_PER_DAY));
    const settled = settledTenureDays(lifter, asUnacceleratedSeconds(SECONDS_PER_DAY));

    // @ts-expect-error an idle tenure carries a purchased skip; the Training IQ
    // half may not read one. Graded by `tsc --noEmit`.
    settledLoyaltyMultiplier(idle);
    // @ts-expect-error and the branch immediately below it, in the other
    // direction, so the fence is not one-sided.
    idleLoyaltyMultiplier(settled);
    // @ts-expect-error the accelerated reading cannot reach the settled tenure
    // constructor at all.
    settledTenureDays(lifter, asAcceleratedSeconds(SECONDS_PER_DAY));

    // The runtime companion: both wrappers are live and neither throws, so the
    // directives above sit over code that would otherwise run.
    expect(idleLoyaltyMultiplier(idle)).toBeGreaterThan(0);
    expect(settledLoyaltyMultiplier(settled)).toBeGreaterThan(0);
  });
});

describe('per-lifter output', () => {
  it('pays the published product at the two ends of the curve', () => {
    let checked = 0;
    for (const tier of TIERS) {
      const lifter = lifterAt(tier, 0, 0);
      const fresh = clockAt(0, 0);
      const veteran = clockAt(EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY, 0);
      expect(npcGymBucksPerHour(lifter, fresh)).toBe(
        round6(
          EMPIRE_TUNING.NPC_GYM_BUCKS_PER_HOUR_BASE *
            EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[tier] *
            EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER,
        ),
      );
      expect(npcTrainingIqPerDay(lifter, veteran)).toBe(
        round6(
          EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE *
            EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER[tier] *
            EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER,
        ),
      );
      checked += 1;
    }
    expect(checked).toBe(5);
  });

  it('rises with tenure on both halves, and stops rising at the ceiling', () => {
    const lifter = lifterAt('regional', 0, 0);
    let bucksRises = 0;
    let iqRises = 0;
    let bucksFlat = 0;
    for (let day = 1; day <= 40; day += 1) {
      const before = clockAt(day - 1, 0);
      const after = clockAt(day, 0);
      const grew = npcGymBucksPerHour(lifter, after) - npcGymBucksPerHour(lifter, before);
      expect(grew, `Gym Bucks fell between day ${day - 1} and ${day}`).toBeGreaterThanOrEqual(0);
      if (grew > 0) bucksRises += 1;
      else bucksFlat += 1;
      if (npcTrainingIqPerDay(lifter, after) > npcTrainingIqPerDay(lifter, before)) iqRises += 1;
    }
    // Counts, not bounds: the ramp is 30 days long, so exactly 30 of the 40
    // steps rise and the last 10 are at the ceiling. A curve that never
    // saturated, or one flattened to a constant, moves these numbers.
    expect(bucksRises).toBe(30);
    expect(bucksFlat).toBe(10);
    expect(iqRises).toBe(30);
  });

  it('reads the two rates off one lifter without disagreeing with itself', () => {
    const lifter = lifterAt('club', 0, 0);
    const clock = clockAt(7, 3600);
    const rates = npcOutputRates(lifter, clock);
    expect(rates.gymBucksPerHour).toBe(npcGymBucksPerHour(lifter, clock));
    expect(rates.trainingIqPerDay).toBe(npcTrainingIqPerDay(lifter, clock));
    // The two are not the same number, so a pair that had been wired to one
    // source would be red rather than green by coincidence.
    expect(rates.gymBucksPerHour).not.toBe(rates.trainingIqPerDay);
  });

  it('gives a lifter with no tenure the floor rather than nothing', () => {
    const lifter = lifterAt('novice', 0, 0);
    const rates = npcOutputRates(lifter, clockAt(0, 0));
    expect(rates.gymBucksPerHour).toBeGreaterThan(0);
    expect(rates.trainingIqPerDay).toBeGreaterThan(0);
  });

  it('treats a clock behind the lifter as zero tenure rather than negative pay', () => {
    const lifter = lifterAt('national', 10 * SECONDS_PER_DAY, 10 * SECONDS_PER_DAY);
    const rates = npcOutputRates(lifter, clockAt(0, 0));
    expect(rates.gymBucksPerHour).toBe(
      round6(
        EMPIRE_TUNING.NPC_GYM_BUCKS_PER_HOUR_BASE *
          EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER.national *
          EMPIRE_TUNING.NPC_LOYALTY_MIN_MULTIPLIER,
      ),
    );
  });
});

describe('roster subtotals', () => {
  const clock = clockAt(9, 7200);

  it('adds one lifter at a time and never loses one', () => {
    const roster: NpcLifter[] = [];
    let expectedBucks = 0;
    let expectedIq = 0;
    let added = 0;
    for (const [at, tier] of TIERS.entries()) {
      const lifter = lifterAt(tier, at * SECONDS_PER_DAY, at * SECONDS_PER_DAY, `id-${at}`);
      roster.push(lifter);
      expectedBucks += npcGymBucksPerHour(lifter, clock);
      expectedIq += npcTrainingIqPerDay(lifter, clock);
      expect(rosterGymBucksPerHour(roster, clock)).toBe(round6(expectedBucks));
      expect(rosterTrainingIqPerDay(roster, clock)).toBe(round6(expectedIq));
      added += 1;
    }
    expect(added).toBe(5);
    expect(roster.length).toBe(5);
    // The subtotal really grew, so the equality above is not two zeroes.
    expect(rosterGymBucksPerHour(roster, clock)).toBeGreaterThan(0);
    expect(rosterTrainingIqPerDay(roster, clock)).toBeGreaterThan(0);
  });

  it('pays nothing for an empty roster and says that is what it measured', () => {
    expect(rosterGymBucksPerHour([], clock)).toBe(0);
    expect(rosterTrainingIqPerDay([], clock)).toBe(0);
    // The lines above are the only ones in this file whose domain is empty on
    // purpose, and they are stated as such rather than left to look like
    // coverage of the loop.
    expect(rosterOutputRates([], clock)).toEqual({ gymBucksPerHour: 0, trainingIqPerDay: 0 });
  });

  it('never decreases when a lifter joins', () => {
    let steps = 0;
    for (const tier of TIERS) {
      const roster: NpcLifter[] = [lifterAt('novice', 0, 0, 'base')];
      const before = rosterTrainingIqPerDay(roster, clock);
      roster.push(lifterAt(tier, 0, 0, `joined-${tier}`));
      expect(rosterTrainingIqPerDay(roster, clock)).toBeGreaterThan(before);
      steps += 1;
    }
    expect(steps).toBe(5);
  });

  it('leaves the daily ceiling to the piece that adds the base trickle', () => {
    // Stated as a measurement rather than as a comment, because the header
    // claims this subtotal is uncapped and a claim with nothing behind it is
    // what CLAUDE.md's guarantee rule is about. A full roster of the top tier
    // at full loyalty is above `TRAINING_IQ_DAILY_CEILING`, and this function
    // returns that number rather than the ceiling.
    const veteran = clockAt(EMPIRE_TUNING.NPC_TENURE_DAYS_TO_FULL_LOYALTY, 0);
    const roster = Array.from({ length: EMPIRE_TUNING.ROSTER_SLOTS_MAX }, (_, at) =>
      lifterAt('legendary', 0, 0, `full-${at}`),
    );
    const subtotal = rosterTrainingIqPerDay(roster, veteran);
    expect(subtotal).toBeGreaterThan(EMPIRE_TUNING.TRAINING_IQ_DAILY_CEILING);
    expect(subtotal).toBe(
      round6(
        EMPIRE_TUNING.ROSTER_SLOTS_MAX *
          EMPIRE_TUNING.NPC_TRAINING_IQ_PER_DAY_BASE *
          EMPIRE_TUNING.NPC_TIER_OUTPUT_MULTIPLIER.legendary *
          EMPIRE_TUNING.NPC_LOYALTY_MAX_MULTIPLIER,
      ),
    );
  });
});

describe('a purchasable accelerant moves the Gym Bucks half and not the Training IQ half', () => {
  /**
   * The element-wise comparison GDD §4.4 asks for, on this module's half of the
   * chain. An aggregate will not do: §4.4 records a legal input that moved 2362
   * of 34338 purchase-day lists and left every aggregate identical.
   */
  const seriesFor = (
    read: (lifter: NpcLifter, clock: EmpireClock) => number,
    tier: NpcTier,
    settledAt: number,
    skipSeconds: number,
  ): readonly number[] =>
    NPC_SWEEP.HORIZON_DAYS.map((day) =>
      read(lifterAt(tier, settledAt, settledAt), clockAt(day, skipSeconds)),
    );

  it('leaves the Training IQ series byte-identical under every skip', () => {
    let comparisons = 0;
    let elements = 0;
    for (const tier of TIERS) {
      for (const settledAt of NPC_SWEEP.SETTLED_AT_SECONDS) {
        const baseline = seriesFor(npcTrainingIqPerDay, tier, settledAt, 0);
        for (const skip of NPC_SWEEP.SKIP_SECONDS) {
          const moved = seriesFor(npcTrainingIqPerDay, tier, settledAt, skip);
          expect(moved, `${tier} at settledAt=${settledAt} moved under a ${skip}s skip`).toEqual(
            baseline,
          );
          comparisons += 1;
          elements += moved.length;
        }
      }
    }
    // Counts, not bounds. An empty tier list, an empty horizon list or a
    // one-row skip grid would each make the loop above pass while measuring
    // nothing.
    expect(comparisons).toBe(90);
    expect(comparisons).toBe(TIERS.length * NPC_SWEEP.SETTLED_AT_SECONDS.length * NPC_SWEEP.SKIP_SECONDS.length);
    expect(elements).toBe(990);
  });

  it('moves the negative control, so the zero above is zero against something', () => {
    // The same engine with one clock swapped. If this count is ever zero the
    // sweep's domain has gone empty and the test above is measuring nothing.
    let movedElements = 0;
    let comparisons = 0;
    for (const tier of TIERS) {
      for (const settledAt of NPC_SWEEP.SETTLED_AT_SECONDS) {
        const baseline = seriesFor(mutantTrainingIqPerDay, tier, settledAt, 0);
        for (const skip of NPC_SWEEP.SKIP_SECONDS) {
          const moved = seriesFor(mutantTrainingIqPerDay, tier, settledAt, skip);
          moved.forEach((value, at) => {
            if (value !== baseline[at]) movedElements += 1;
          });
          comparisons += 1;
        }
      }
    }
    expect(comparisons).toBe(90);
    expect(movedElements).toBe(555);
    // And the control agrees with the shipped engine where there is no skip, so
    // the difference above is the skip and not two unrelated curves.
    const tier: NpcTier = 'club';
    expect(seriesFor(mutantTrainingIqPerDay, tier, 0, 0)).toEqual(
      seriesFor(npcTrainingIqPerDay, tier, 0, 0),
    );
  });

  it('does move the Gym Bucks series, because that is what GDD §8.3B sells', () => {
    // The legal half, asserted legal rather than merely permitted. A build that
    // put both halves on the wall clock would leave a bought skip buying
    // nothing at all, and this is the line that says so.
    let movedElements = 0;
    for (const tier of TIERS) {
      const baseline = seriesFor(npcGymBucksPerHour, tier, 0, 0);
      for (const skip of NPC_SWEEP.SKIP_SECONDS) {
        seriesFor(npcGymBucksPerHour, tier, 0, skip).forEach((value, at) => {
          if (value !== baseline[at]) movedElements += 1;
        });
      }
    }
    expect(movedElements).toBe(175);
  });
});

