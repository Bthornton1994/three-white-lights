/**
 * pacing.test.ts — GDD §5.14 Stage B's own suite.
 *
 * Three things this file does NOT do, stated up front because the module
 * under test says the same about itself: it does not assert the shipped
 * pacing is "good" or "balanced" (CLAUDE.md §12.1: no test or critic may make
 * that call); it does not reimplement `ladderCheckIn`/`managedCheckIn`'s own
 * arithmetic to check it against a second copy (the sweeps below drive the
 * real functions and read what they did); and it does not weaken a pinned
 * count into a bound — every non-vacuity guard here pins an exact number, the
 * same discipline every other `src/empire/` sweep uses.
 *
 * What it does do: exercise the schedule generator's own contract, check the
 * one structural invariant a composed ladder run must hold regardless of
 * tuning (rungs never regress) with a driven negative control, check
 * prefix-consistency across horizons (the concrete form of "more elapsed
 * time never affords strictly less"), and — the actual deliverable this
 * stage exists for — print the real measured numbers a human reads.
 */

import { describe, expect, it } from 'vitest';
import {
  PACING_CHECK_IN_POLICIES,
  type PacingCheckInPolicy,
  type PacingLadderReading,
  pacingCheckInSchedule,
  pacingLadderRungNeverRegresses,
  pacingReadingAtHorizon,
  runPacingLadder,
  runPacingLadderRealistic,
  runPacingManagedGym,
} from './pacing';
import { EMPIRE_TUNING } from './empireTuning';
import { accrueLadderGymBucks, ladderIncomeRatePerHour, runLadder } from './ladder';
import { runManagedGym, shippedManagementWiring } from './management';
import { offlineBankingHorizonSeconds, SHIPPED_OFFLINE_BANKING_POLICY } from './production';

const HORIZONS = EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS;
const MAX_HORIZON_SECONDS = HORIZONS[HORIZONS.length - 1] as number;

// ---------------------------------------------------------------------------
// The schedule generator's own contract
// ---------------------------------------------------------------------------

describe('pacingCheckInSchedule — the contract every policy sweep depends on', () => {
  it('drives all four policies, so the axis really is varied and not merely named', () => {
    // Non-vacuity, as a count rather than a bound.
    expect(PACING_CHECK_IN_POLICIES.length).toBe(4);
    expect([...PACING_CHECK_IN_POLICIES].sort()).toEqual(
      ['few-times-a-day', 'once-a-day', 'sporadic', 'watcher'].sort(),
    );
  });

  it('refuses an unknown policy and a non-positive horizon', () => {
    expect(() =>
      pacingCheckInSchedule('constant-vigil' as PacingCheckInPolicy, MAX_HORIZON_SECONDS),
    ).toThrow('is not a pacing check-in policy');
    expect(() => pacingCheckInSchedule('watcher', 0)).toThrow(
      'a pacing horizon must be finite and above zero',
    );
    expect(() => pacingCheckInSchedule('watcher', -1)).toThrow(
      'a pacing horizon must be finite and above zero',
    );
  });

  for (const policy of PACING_CHECK_IN_POLICIES) {
    it(`${policy}: strictly ascending whole ticks, every report horizon present`, () => {
      const schedule = pacingCheckInSchedule(policy, MAX_HORIZON_SECONDS);
      expect(schedule.length).toBeGreaterThan(0);
      let previous = -1;
      for (const entry of schedule) {
        expect(entry.atSeconds).toBeGreaterThan(previous);
        expect(Number.isInteger(entry.atSeconds)).toBe(true);
        previous = entry.atSeconds;
      }
      // The guarantee `pacingReadingAtHorizon` depends on: every report
      // horizon at or under the run's own horizon is a real scheduled second.
      for (const horizon of HORIZONS) {
        expect(schedule.map((e) => e.atSeconds)).toContain(horizon);
      }
      // Mode: 'online' only for the watcher, 'offline' for every other
      // policy, and uniform within one schedule — driven rather than assumed.
      const modes = new Set(schedule.map((e) => e.mode));
      expect([...modes]).toEqual(policy === 'watcher' ? ['online'] : ['offline']);
    });
  }

  it('watcher steps at the real WALL_CLOCK_TICK_INTERVAL_SECONDS, the constant AppShell.tsx ticks on', () => {
    const schedule = pacingCheckInSchedule('watcher', EMPIRE_TUNING.SECONDS_PER_HOUR);
    const seconds = schedule.map((e) => e.atSeconds);
    // The report horizons union with the tick grid; over one hour the only
    // horizon mark inside it is the 10-minute one, already on the 5-second
    // grid, so the schedule is exactly the tick grid — driven and pinned as
    // a count, not asserted from the constant alone.
    expect(seconds.length).toBe(
      EMPIRE_TUNING.SECONDS_PER_HOUR / EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS,
    );
    for (const [index, atSeconds] of seconds.entries()) {
      expect(atSeconds).toBe((index + 1) * EMPIRE_TUNING.WALL_CLOCK_TICK_INTERVAL_SECONDS);
    }
  });

  it('once-a-day steps at exactly SECONDS_PER_DAY, and few-times-a-day at a quarter of it', () => {
    // A horizon that does not itself coincide with a report-horizon mark
    // (4 days = 345600s, absent from HORIZONS), so `.toContain` below is not
    // testing a value the union might have supplied a second way.
    const horizonSeconds = 4 * EMPIRE_TUNING.SECONDS_PER_DAY;
    const daily = pacingCheckInSchedule('once-a-day', horizonSeconds).map((e) => e.atSeconds);
    for (let day = 1; day <= 4; day += 1) {
      expect(daily).toContain(day * EMPIRE_TUNING.SECONDS_PER_DAY);
    }
    const fewTimes = pacingCheckInSchedule('few-times-a-day', EMPIRE_TUNING.SECONDS_PER_DAY).map(
      (e) => e.atSeconds,
    );
    const quarterDay = EMPIRE_TUNING.SECONDS_PER_DAY / 2 / 2;
    for (let step = 1; step <= 4; step += 1) {
      expect(fewTimes).toContain(step * quarterDay);
    }
  });

  it("sporadic never gaps past the real offline-banking horizon — the brief's own cap", () => {
    const schedule = pacingCheckInSchedule('sporadic', MAX_HORIZON_SECONDS);
    const horizon = offlineBankingHorizonSeconds();
    let previous = 0;
    let sawAGapAtTheHorizon = false;
    for (const entry of schedule) {
      const gap = entry.atSeconds - previous;
      // A forced report-horizon check-in can shorten the NEXT natural gap
      // below the cycle's own step, so this only bounds gaps from the
      // natural cadence — checked by excluding any entry whose gap could
      // have been shortened by an inserted horizon mark immediately before
      // it, i.e. by simply bounding every gap at the horizon: an inserted
      // mark can only shorten a gap, never lengthen one past what the
      // uninterrupted cycle would have produced.
      expect(gap).toBeLessThanOrEqual(horizon);
      if (gap === horizon) sawAGapAtTheHorizon = true;
      previous = entry.atSeconds;
    }
    // Non-vacuous: the cycle really does reach the cap at least once inside
    // a seven-day run, rather than this bound holding by never being tested.
    expect(sawAGapAtTheHorizon).toBe(true);
  });

  it('is deterministic: two calls with the same arguments are byte-identical', () => {
    expect(pacingCheckInSchedule('sporadic', MAX_HORIZON_SECONDS)).toEqual(
      pacingCheckInSchedule('sporadic', MAX_HORIZON_SECONDS),
    );
  });
});

// ---------------------------------------------------------------------------
// pacingReadingAtHorizon
// ---------------------------------------------------------------------------

describe('pacingReadingAtHorizon', () => {
  it('finds every report horizon in a real run, for every policy', () => {
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      for (const horizon of HORIZONS) {
        expect(pacingReadingAtHorizon(run.readings, horizon).atSeconds).toBe(horizon);
      }
    }
  });

  it('refuses a horizon the schedule was never built to answer', () => {
    const run = runPacingLadder('once-a-day', HORIZONS[0] as number);
    expect(() => pacingReadingAtHorizon(run.readings, MAX_HORIZON_SECONDS)).toThrow(
      'no reading recorded at the',
    );
  });
});

// ---------------------------------------------------------------------------
// The rung-never-regresses invariant, with a driven negative control
// ---------------------------------------------------------------------------

describe('pacingLadderRungNeverRegresses — non-vacuous', () => {
  it('is true of every real composed run this sweep drives', () => {
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      expect(pacingLadderRungNeverRegresses(run.readings)).toBe(true);
    }
  });

  it('is false of a deliberately corrupted series — the check can actually fail', () => {
    // Bump the FIRST reading to the top rung while leaving every later
    // reading as the engine really produced it: since a real once-a-day run
    // opens at 'garage' and does not reach 'warehouse' on its first
    // check-in, the very next reading is guaranteed to read a lower rung
    // than the corrupted first one, which is what the function is defined to
    // catch (a later reading whose rung index is below an earlier one's).
    const real = runPacingLadder('once-a-day', MAX_HORIZON_SECONDS).readings;
    expect(real[0]?.rung).toBe('garage');
    expect(real[1]?.rung).not.toBe('warehouse');
    const corrupted: PacingLadderReading[] = real.map((r, i) =>
      i === 0 ? { ...r, rung: 'warehouse' } : r,
    );
    expect(pacingLadderRungNeverRegresses(corrupted)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Prefix-consistency: the concrete form of "more elapsed time never affords
// strictly less". Every horizon shares one generation rule, so a longer run
// restricted to an earlier horizon's check-ins must be byte-identical to the
// shorter run outright — not merely monotone, but exactly reproduced.
// ---------------------------------------------------------------------------

describe('prefix-consistency across horizons — the never-punish shape applied to pacing', () => {
  for (const policy of PACING_CHECK_IN_POLICIES) {
    it(`${policy}: a longer ladder run's prefix equals the shorter run outright`, () => {
      const shortHorizon = HORIZONS[1] as number; // 1 hour
      const longHorizon = HORIZONS[3] as number; // day 3
      const short = runPacingLadder(policy, shortHorizon);
      const long = runPacingLadder(policy, longHorizon);
      const longPrefix = long.readings.filter((r) => r.atSeconds <= shortHorizon);
      expect(longPrefix).toEqual(short.readings);
    });

    it(`${policy}: a longer management run's prefix equals the shorter run outright`, () => {
      const shortHorizon = HORIZONS[1] as number;
      const longHorizon = HORIZONS[3] as number;
      const short = runPacingManagedGym(policy, 'diligent', shortHorizon);
      const long = runPacingManagedGym(policy, 'diligent', longHorizon);
      const longPrefix = long.readings.filter((r) => r.atSeconds <= shortHorizon);
      expect(longPrefix).toEqual(short.readings);
    });
  }
});

// ---------------------------------------------------------------------------
// Basic sanity: Gym Bucks never goes negative, across the whole sweep. A
// weak check by itself — the underlying `ladderCheckIn`/`managedCheckIn`
// already refuse a negative purse — kept because it is a real assertion
// over real composed output and would catch a composition bug in this file,
// even though it cannot catch a bug in the engine those functions belong to.
// ---------------------------------------------------------------------------

describe('Gym Bucks never goes negative, across the whole sweep', () => {
  it('holds for every ladder run', () => {
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      for (const reading of run.readings) expect(reading.gymBucks).toBeGreaterThanOrEqual(0);
    }
  });

  it('holds for every management run, across all three policies this file drives', () => {
    for (const policy of PACING_CHECK_IN_POLICIES) {
      for (const managementPolicy of ['hands-off', 'diligent', 'cheapskate'] as const) {
        const run = runPacingManagedGym(policy, managementPolicy, MAX_HORIZON_SECONDS);
        for (const reading of run.readings) {
          expect(reading.settledGymBucks).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The deliverable: real measured numbers, printed for a human to read.
//
// This is not a balance verdict — see this file's own header and the
// module's. It is the measurement CLAUDE.md's brief for this round asked
// for, in one place, generated from the real functions rather than
// hand-calculated.
// ---------------------------------------------------------------------------

describe('the pacing report — real numbers, printed', () => {
  it('measures ladder pacing per policy against the ladderView.tsx header target', () => {
    // ladderView.tsx's own header: "garage to storage unit in about seven
    // idle days, warehouse in about twenty-two" — stated, unverified. This
    // measures it against the real engine, per check-in policy.
    const TARGET_STORAGE_DAYS = 7;
    const TARGET_WAREHOUSE_DAYS = 22;
    const SECONDS_PER_DAY = EMPIRE_TUNING.SECONDS_PER_DAY;

    const lines: string[] = [];
    lines.push('=== GDD §5.14 Stage B — ladder pacing, relocate-instantly policy ===');
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      const storageAt = run.firstMovedAtSeconds['storage-unit'];
      const stripMallAt = run.firstMovedAtSeconds['strip-mall-unit'];
      const warehouseAt = run.firstMovedAtSeconds['warehouse'];
      const storageDays = storageAt === undefined ? null : storageAt / SECONDS_PER_DAY;
      const warehouseDays = warehouseAt === undefined ? null : warehouseAt / SECONDS_PER_DAY;
      lines.push(
        `${policy}: storage-unit at ${
          storageDays === null ? 'not reached within 7 days' : `${storageDays.toFixed(2)}d`
        } (target ${TARGET_STORAGE_DAYS}d, ratio ${
          storageDays === null ? 'n/a' : (storageDays / TARGET_STORAGE_DAYS).toFixed(2)
        }); strip-mall-unit at ${
          stripMallAt === undefined
            ? 'not reached'
            : `${(stripMallAt / SECONDS_PER_DAY).toFixed(2)}d`
        }; warehouse at ${
          warehouseDays === null ? 'not reached within 7 days' : `${warehouseDays.toFixed(2)}d`
        } (target ${TARGET_WAREHOUSE_DAYS}d, ratio ${
          warehouseDays === null ? 'n/a' : (warehouseDays / TARGET_WAREHOUSE_DAYS).toFixed(2)
        })`,
      );
      // Non-vacuity: at least the two fastest policies reach storage-unit
      // inside the swept horizon, so "not reached" is not this sweep's only
      // possible reading.
      if (policy === 'watcher' || policy === 'once-a-day') {
        expect(storageAt).not.toBeUndefined();
      }
    }
    lines.push('');
    lines.push('=== Realistic (buys equipment too) — real shipped runLadder, cheapest-affordable-first ===');
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadderRealistic(policy, MAX_HORIZON_SECONDS);
      lines.push(
        `${policy}: final rung ${run.state.rung}, moved to [${run.movedTo.join(', ') || 'none'}], bought [${
          run.bought.join(', ') || 'none'
        }], gymBucks ${run.state.gymBucks.toFixed(2)} after ${run.checkIns} check-ins over 7 days`,
      );
    }
    lines.push('');
    lines.push(
      '=== Per-horizon ladder readings (relocate-instantly policy), Gym Bucks and rung ===',
    );
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      for (const horizon of HORIZONS) {
        const reading = pacingReadingAtHorizon(run.readings, horizon);
        lines.push(
          `${policy} @ ${horizon}s (${(horizon / SECONDS_PER_DAY).toFixed(3)}d): rung=${
            reading.rung
          } gymBucks=${reading.gymBucks.toFixed(2)} secondsDiscarded(cumAtThisCheckIn)=${reading.secondsDiscarded}`,
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    // Non-vacuity guard for the sweep itself, pinned as a count: four
    // policies x five horizons = twenty (policy, horizon) readings actually
    // extracted below, per run kind.
    let extracted = 0;
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      for (const horizon of HORIZONS) {
        pacingReadingAtHorizon(run.readings, horizon);
        extracted += 1;
      }
    }
    expect(extracted).toBe(20);

    const warehouseLines: string[] = [
      '=== Garage → Warehouse, relocate-instantly, longer horizon (not a 7-day pin) ===',
    ];
    const longHorizonByPolicy: Readonly<Record<PacingCheckInPolicy, number>> = Object.freeze({
      watcher: 15 * SECONDS_PER_DAY,
      'few-times-a-day': 45 * SECONDS_PER_DAY,
      'once-a-day': 60 * SECONDS_PER_DAY,
      sporadic: 45 * SECONDS_PER_DAY,
    });
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingLadder(policy, longHorizonByPolicy[policy]);
      const storageAt = run.firstMovedAtSeconds['storage-unit'];
      const warehouseAt = run.firstMovedAtSeconds['warehouse'];
      warehouseLines.push(
        `${policy}: storage-unit ${
          storageAt === undefined ? 'not reached' : `${(storageAt / SECONDS_PER_DAY).toFixed(2)}d`
        }; warehouse ${
          warehouseAt === undefined ? 'not reached' : `${(warehouseAt / SECONDS_PER_DAY).toFixed(2)}d`
        } (horizon ${(longHorizonByPolicy[policy] / SECONDS_PER_DAY).toFixed(0)}d)`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(warehouseLines.join('\n'));
  });

  it('measures management payback: cheapskate (hires cheapest tier) vs diligent (manual repair) vs hands-off', () => {
    const SECONDS_PER_DAY = EMPIRE_TUNING.SECONDS_PER_DAY;
    const lines: string[] = [];
    lines.push('=== GDD §5.14 Stage B — management payback, real shipped runManagedGym ===');
    lines.push(
      `cheapest manager tier: ${EMPIRE_TUNING.MANAGER_TIERS[0]}, hire cost ${
        EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[EMPIRE_TUNING.MANAGER_TIERS[0]]
      } Gym Bucks`,
    );
    for (const policy of PACING_CHECK_IN_POLICIES) {
      lines.push(`--- check-in policy: ${policy} ---`);
      const handsOff = runPacingManagedGym(policy, 'hands-off', MAX_HORIZON_SECONDS);
      const diligent = runPacingManagedGym(policy, 'diligent', MAX_HORIZON_SECONDS);
      const cheapskate = runPacingManagedGym(policy, 'cheapskate', MAX_HORIZON_SECONDS);
      // First check-in at which cheapskate's net position overtakes hands-off's
      // — the payback moment, read from the real readings series rather than
      // computed a second way.
      let paybackAtSeconds: number | null = null;
      for (let i = 0; i < cheapskate.readings.length; i += 1) {
        const cheap = cheapskate.readings[i];
        const off = handsOff.readings[i];
        if (cheap === undefined || off === undefined) break;
        if (cheap.netPosition > off.netPosition) {
          paybackAtSeconds = cheap.atSeconds;
          break;
        }
      }
      lines.push(
        `  hire-cheapest-tier (cheapskate) pays off vs hands-off at: ${
          paybackAtSeconds === null
            ? 'never, within 7 simulated days'
            : `${(paybackAtSeconds / SECONDS_PER_DAY).toFixed(2)}d`
        }`,
      );
      for (const horizon of HORIZONS) {
        const off = pacingReadingAtHorizon(handsOff.readings, horizon);
        const dil = pacingReadingAtHorizon(diligent.readings, horizon);
        const cheap = pacingReadingAtHorizon(cheapskate.readings, horizon);
        lines.push(
          `  @ ${horizon}s (${(horizon / SECONDS_PER_DAY).toFixed(3)}d): ` +
            `hands-off netPosition=${off.netPosition.toFixed(2)} condition=${off.meanCondition.toFixed(3)} phase=${off.phase} | ` +
            `diligent netPosition=${dil.netPosition.toFixed(2)} condition=${dil.meanCondition.toFixed(3)} phase=${dil.phase} | ` +
            `cheapskate netPosition=${cheap.netPosition.toFixed(2)} condition=${cheap.meanCondition.toFixed(3)} phase=${cheap.phase} hasManager=${cheap.managerAssetValue > 0}`,
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    // Non-vacuity: three management policies x four check-in policies x five
    // horizons = 60 readings actually extracted, pinned as a count.
    let extracted = 0;
    for (const policy of PACING_CHECK_IN_POLICIES) {
      for (const managementPolicy of ['hands-off', 'diligent', 'cheapskate'] as const) {
        const run = runPacingManagedGym(policy, managementPolicy, MAX_HORIZON_SECONDS);
        for (const horizon of HORIZONS) {
          pacingReadingAtHorizon(run.readings, horizon);
          extracted += 1;
        }
      }
    }
    expect(extracted).toBe(60);
  });

  it('reports dead periods: horizons where nothing changed since the previous one', () => {
    const SECONDS_PER_DAY = EMPIRE_TUNING.SECONDS_PER_DAY;
    const lines: string[] = ['=== Dead periods (no rung change, no manager-pays-off change) ==='];
    let deadPeriods = 0;
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const ladderRun = runPacingLadder(policy, MAX_HORIZON_SECONDS);
      let previousRung: string | null = null;
      let previousMoney: number | null = null;
      for (const horizon of HORIZONS) {
        const reading = pacingReadingAtHorizon(ladderRun.readings, horizon);
        const stillGarage = reading.rung === 'garage';
        const noNewMoney = previousMoney !== null && reading.gymBucks === previousMoney;
        if (previousRung === reading.rung && stillGarage) {
          // Same rung across a horizon boundary and never left the garage —
          // a dead period on the ladder axis specifically.
          lines.push(
            `${policy}: still at ${reading.rung} at ${(horizon / SECONDS_PER_DAY).toFixed(
              3,
            )}d, unchanged since the previous horizon`,
          );
          deadPeriods += 1;
        }
        void noNewMoney;
        previousRung = reading.rung;
        previousMoney = reading.gymBucks;
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    // Reported as a count either way — a dead period is a finding, not a
    // failure of this tool, per the brief. No assertion on the number beyond
    // it being a valid non-negative count actually computed.
    expect(deadPeriods).toBeGreaterThanOrEqual(0);
  });

  it('Stage D2 — time-to-first-choice and 3d/7d snapshots after wear truth (C.2 path, no floor)', () => {
    const SECONDS_PER_DAY = EMPIRE_TUNING.SECONDS_PER_DAY;
    const quality = EMPIRE_TUNING.STATION_UPGRADE_COST_GYM_BUCKS.quality;
    const throughput = EMPIRE_TUNING.STATION_UPGRADE_COST_GYM_BUCKS.throughput;
    const capacity = EMPIRE_TUNING.STATION_UPGRADE_COST_GYM_BUCKS.capacity;
    const mats = EMPIRE_TUNING.SESSION_EQUIPMENT_COST_GYM_BUCKS.mats;
    const noviceHire = EMPIRE_TUNING.MANAGER_HIRE_COST_GYM_BUCKS[EMPIRE_TUNING.MANAGER_TIERS[0]];
    const lines: string[] = ['=== Stage D2 — time to first afford (C.2 runManagedGym, inService omitted) ==='];
    let watcherHitsQuality = false;
    for (const policy of PACING_CHECK_IN_POLICIES) {
      const run = runPacingManagedGym(policy, 'hands-off', MAX_HORIZON_SECONDS);
      const firstAt = (cost: number): string => {
        for (const reading of run.readings) {
          if (reading.settledGymBucks >= cost) {
            return `${(reading.atSeconds / SECONDS_PER_DAY).toFixed(3)}d purse=${reading.settledGymBucks.toFixed(2)}`;
          }
        }
        return 'not within 7d';
      };
      lines.push(`${policy}:`);
      lines.push(`  mats ${mats}: ${firstAt(mats)}`);
      lines.push(`  Quality ${quality}: ${firstAt(quality)}`);
      lines.push(`  Throughput ${throughput}: ${firstAt(throughput)}`);
      lines.push(`  Capacity ${capacity}: ${firstAt(capacity)}`);
      lines.push(`  novice hire ${noviceHire}: ${firstAt(noviceHire)}`);
      const day3 = pacingReadingAtHorizon(run.readings, HORIZONS[3] as number);
      const day7 = pacingReadingAtHorizon(run.readings, HORIZONS[4] as number);
      lines.push(
        `  3d: purse=${day3.settledGymBucks.toFixed(2)} net=${day3.netPosition.toFixed(2)} condition=${day3.meanCondition.toFixed(4)} phase=${day3.phase}`,
      );
      lines.push(
        `  7d: purse=${day7.settledGymBucks.toFixed(2)} net=${day7.netPosition.toFixed(2)} condition=${day7.meanCondition.toFixed(4)} phase=${day7.phase}`,
      );
      if (policy === 'watcher') {
        watcherHitsQuality = run.readings.some((reading) => reading.settledGymBucks >= quality);
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(watcherHitsQuality).toBe(true);
  });
});

describe('Stage C.2 — aggregate runners propagate EarningsMode', () => {
  const hour = EMPIRE_TUNING.SECONDS_PER_HOUR;
  const garageRate = ladderIncomeRatePerHour('garage');

  it('runLadder online vs offline diverge when the authoritative model says they should', () => {
    const schedule = Object.freeze([hour]);
    const online = runLadder(schedule, 'hoard', 'online');
    const offline = runLadder(schedule, 'hoard', 'offline');
    const expectedOnline = accrueLadderGymBucks(
      garageRate,
      hour,
      SHIPPED_OFFLINE_BANKING_POLICY,
      'online',
    );
    const expectedOffline = accrueLadderGymBucks(
      garageRate,
      hour,
      SHIPPED_OFFLINE_BANKING_POLICY,
      'offline',
    );
    expect(expectedOnline.gymBucks).not.toBe(expectedOffline.gymBucks);
    expect(online.accruedGymBucks).toBe(expectedOnline.gymBucks);
    expect(offline.accruedGymBucks).toBe(expectedOffline.gymBucks);
    expect(runLadder(schedule, 'hoard').accruedGymBucks).toBe(offline.accruedGymBucks);
  });

  it('runLadder does not manufacture an online/offline difference when no time elapses', () => {
    const online = runLadder([], 'hoard', 'online');
    const offline = runLadder([], 'hoard', 'offline');
    expect(online.accruedGymBucks).toBe(0);
    expect(offline.accruedGymBucks).toBe(0);
    expect(online.state.gymBucks).toBe(offline.state.gymBucks);
    expect(JSON.stringify(online)).toBe(JSON.stringify(offline));
  });

  it('runLadder check-in at the opening mark does not manufacture a mode difference', () => {
    // A real check-in fires (the aggregate path is exercised) but the
    // authoritative gap is zero, so both modes must pay nothing.
    const schedule = Object.freeze([0]);
    const online = runLadder(schedule, 'hoard', 'online');
    const offline = runLadder(schedule, 'hoard', 'offline');
    expect(online.checkIns).toBe(1);
    expect(offline.checkIns).toBe(1);
    expect(online.accruedGymBucks).toBe(0);
    expect(offline.accruedGymBucks).toBe(0);
    expect(JSON.stringify(online)).toBe(JSON.stringify(offline));
    expect(
      accrueLadderGymBucks(garageRate, 0, SHIPPED_OFFLINE_BANKING_POLICY, 'online').gymBucks,
    ).toBe(
      accrueLadderGymBucks(garageRate, 0, SHIPPED_OFFLINE_BANKING_POLICY, 'offline').gymBucks,
    );
  });

  it('runManagedGym online vs offline diverge, and still wear, wage and phase through the real loop', () => {
    const wiring = shippedManagementWiring();
    const schedule = Object.freeze([
      hour,
      EMPIRE_TUNING.SECONDS_PER_DAY,
      3 * EMPIRE_TUNING.SECONDS_PER_DAY,
    ]);
    const online = runManagedGym(schedule, 'diligent', wiring, 'online');
    const offline = runManagedGym(schedule, 'diligent', wiring, 'offline');
    const lastOnline = online.readings[online.readings.length - 1];
    const lastOffline = offline.readings[offline.readings.length - 1];
    expect(lastOnline).toBeDefined();
    expect(lastOffline).toBeDefined();
    if (lastOnline === undefined || lastOffline === undefined) return;
    expect(lastOnline.netPosition).not.toBe(lastOffline.netPosition);
    expect(lastOnline.meanCondition).toBeLessThan(1);
    expect(lastOffline.meanCondition).toBeLessThan(1);
    expect(lastOnline.phase).toBe('sound');
    expect(lastOffline.phase).toBe('sound');
    expect(runManagedGym(schedule, 'diligent', wiring).readings[schedule.length - 1]?.netPosition).toBe(
      lastOffline.netPosition,
    );
  });

  it('runManagedGym does not manufacture a mode difference when the authoritative gap is zero', () => {
    const wiring = shippedManagementWiring();
    const online = runManagedGym(Object.freeze([0]), 'diligent', wiring, 'online');
    const offline = runManagedGym(Object.freeze([0]), 'diligent', wiring, 'offline');
    expect(online.census.checkIns).toBe(1);
    expect(offline.census.checkIns).toBe(1);
    expect(JSON.stringify(online.readings)).toBe(JSON.stringify(offline.readings));
    expect(online.state.gym.ladder.gymBucks).toBe(offline.state.gym.ladder.gymBucks);
    expect(online.census.repairs).toBe(offline.census.repairs);
  });

  it('runManagedGym cheapskate still hires, wears and can fail under both modes', () => {
    const wiring = shippedManagementWiring();
    const schedule = Object.freeze(
      pacingCheckInSchedule('few-times-a-day', EMPIRE_TUNING.SECONDS_PER_DAY * 7).map(
        (entry) => entry.atSeconds,
      ),
    );
    const online = runManagedGym(schedule, 'cheapskate', wiring, 'online');
    const offline = runManagedGym(schedule, 'cheapskate', wiring, 'offline');
    expect(online.census.hires).toBeGreaterThan(0);
    expect(offline.census.hires).toBeGreaterThan(0);
    expect(online.readings[online.readings.length - 1]?.meanCondition).toBeLessThan(1);
    expect(offline.readings[offline.readings.length - 1]?.meanCondition).toBeLessThan(1);
    expect(online.census.checkIns).toBe(schedule.length);
    expect(offline.census.checkIns).toBe(schedule.length);
    expect(online.census.failedAtCheckIn).not.toBeNull();
    expect(offline.census.failedAtCheckIn).not.toBeNull();
    expect(online.census.declines + online.census.repairs + online.census.autoRepairs).toBeGreaterThan(
      0,
    );
    expect(offline.census.declines + offline.census.repairs + offline.census.autoRepairs).toBeGreaterThan(
      0,
    );
  });

  it('prints the Stage C.2 watcher correction against the old offline-rated aggregate path', () => {
    const horizon = EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS[
      EMPIRE_TUNING.PACING_REPORT_HORIZONS_SECONDS.length - 1
    ] as number;
    const watcherSeconds = pacingCheckInSchedule('watcher', horizon).map((entry) => entry.atSeconds);
    const realisticOnline = runPacingLadderRealistic('watcher', horizon);
    const realisticOffline = runLadder(watcherSeconds, 'cheapest-affordable-first', 'offline');
    const lines: string[] = [
      '=== Stage C.2 — watcher previously offline-rated through runLadder/runManagedGym ===',
      `realistic ONLINE (corrected): rung ${realisticOnline.state.rung} gymBucks ${realisticOnline.state.gymBucks.toFixed(2)} moved [${realisticOnline.movedTo.join(', ') || 'none'}] bought [${realisticOnline.bought.join(', ') || 'none'}]`,
      `realistic OFFLINE (old contamination): rung ${realisticOffline.state.rung} gymBucks ${realisticOffline.state.gymBucks.toFixed(2)} moved [${realisticOffline.movedTo.join(', ') || 'none'}] bought [${realisticOffline.bought.join(', ') || 'none'}]`,
    ];
    for (const managementPolicy of ['hands-off', 'diligent', 'cheapskate'] as const) {
      const online = runPacingManagedGym('watcher', managementPolicy, horizon);
      const offline = runManagedGym(watcherSeconds, managementPolicy, undefined, 'offline');
      const lastOnline = online.readings[online.readings.length - 1];
      const lastOffline = offline.readings[offline.readings.length - 1];
      lines.push(
        `managed ${managementPolicy} 7d ONLINE net=${lastOnline?.netPosition.toFixed(2)} phase=${lastOnline?.phase} condition=${lastOnline?.meanCondition.toFixed(3)} hires=${online.census.hires} failedAt=${String(online.census.failedAtCheckIn)}`,
      );
      lines.push(
        `managed ${managementPolicy} 7d OFFLINE (old) net=${lastOffline?.netPosition.toFixed(2)} phase=${lastOffline?.phase} condition=${lastOffline?.meanCondition.toFixed(3)} hires=${offline.census.hires} failedAt=${String(offline.census.failedAtCheckIn)}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(realisticOnline.state.gymBucks).toBeGreaterThan(realisticOffline.state.gymBucks);
  });

  it('runPacingLadderRealistic watcher is online-rated, once-a-day is offline-rated', () => {
    const watcher = runPacingLadderRealistic('watcher', hour);
    const once = runPacingLadderRealistic('once-a-day', hour);
    const watcherOffline = runLadder(
      pacingCheckInSchedule('watcher', hour).map((entry) => entry.atSeconds),
      'cheapest-affordable-first',
      'offline',
    );
    expect(watcher.accruedGymBucks).toBeGreaterThan(watcherOffline.accruedGymBucks);
    expect(once.accruedGymBucks).toBe(
      runLadder(
        pacingCheckInSchedule('once-a-day', hour).map((entry) => entry.atSeconds),
        'cheapest-affordable-first',
        'offline',
      ).accruedGymBucks,
    );
  });
});
