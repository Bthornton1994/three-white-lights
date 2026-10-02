/**
 * reputation.test.ts — the tests for GDD §5.4's reputation axis.
 *
 * ===========================================================================
 * What is graded by what
 * ===========================================================================
 *
 * Two `@ts-expect-error` directives in this file are graded by
 * `npx tsc --noEmit` and not by vitest, which strips types without checking
 * them. `empireCore.test.ts` records what happens when a directive ships with no
 * line vitest can also redden, so each of the two sits beside a declaration pin
 * in 'declares the payout table against the empire output union': the two go red
 * on the same edit, one in the compiler and one in the suite.
 *
 * ===========================================================================
 * The sweeps' parameters are written down
 * ===========================================================================
 *
 * `REPUTATION_SWEEP` below holds every horizon, cadence, purse and skip size, as
 * a named frozen block, for the reason `src/game/streakSweep.ts` exists: the
 * first version of a measurement in this repository was reported with its inputs
 * unstated and could not afterwards be reproduced, and six plausible
 * parameterisations gave six different numbers.
 *
 * It lives here rather than in `empireTuning.ts` because a sweep parameter is
 * not a game-feel value a playtester turns, and because `src/tuning/audit.ts`
 * classifies every unregistered file under `src/empire/` as a `renderer` — so a
 * bare number in `reputation.ts` fails the suite by name, line and literal,
 * while a test file is deliberately not scanned.
 *
 * ===========================================================================
 * Chain B was measured open here and is now measured closed, with the reading
 * it used to take kept beside it as the control
 * ===========================================================================
 *
 * This file used to pin a NON-ZERO count under the title 'measures the open
 * chain a purchased skip opens into the tier gate', because reputation accrued
 * on the idle clock — its own sink is `'gym-economy'` — while the thing it gates
 * is a recruit, and a recruit pays Training IQ. §4 of `reputation.ts`'s header
 * has the whole chain.
 *
 * Piece E6 closed it: `empireCore.ts` now asks reach as a GATE rather than as a
 * PAYOUT, `gateElapsedFor(at, 'reputation')` is the wall clock, and the roster
 * filter reads `settledAt` rather than `joinedAt`. So the pin is zero, and the
 * old reading is kept runnable beside it — the same shipped `accrueReputation`,
 * handed a clock whose wall reading is the idle one — with piece E4's numbers
 * pinned on it: 2 of 3 lists and 7 of 15 entries moved. A zero with nothing
 * beside it is the empty-domain vacuity CLAUDE.md names; this is what the zero
 * is zero against.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { auditSource, formatFindings } from '../tuning/audit';
import {
  EMPIRE_FORBIDDEN_OUTPUTS,
  EMPIRE_OUTPUTS,
  WALL_CLOCK_FUNDED_OUTPUTS,
  asGymBucks,
  asReputation,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  outputReach,
  recruitReputationThreshold,
  reputationTierIndex,
  type EmpireClock,
  type EmpireOutput,
  type EmpireState,
  type GymBucks,
  type NpcLifter,
  type WallClockBooks,
  type WallClockFundedOutput,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { axisOutput, axisReputationRule, EXPANSION_AXES } from './expansion';
import { scrubPrecision } from './production';
import { recruitmentRefusals } from './recruitment';
import {
  FORBIDDEN_UNLOCK_KEYS,
  NPC_TIER_UNLOCK,
  NPC_TIER_UNLOCK_KEYS,
  PAYOUT_TAKES_OFFLINE_FRACTION,
  REPUTATION_PAYOUTS,
  REPUTATION_PAYOUT_OUTPUT,
  accrueReputation,
  accrueSponsorship,
  highestReputationTierIndex,
  milestonesReached,
  nextMilestone,
  npcTierUnlockKey,
  npcTierUnlocks,
  reputationCensus,
  reputationMilestones,
  reputationPayoutOutput,
  reputationPayoutReach,
  reputationRates,
  reputationTierCount,
  reputationTierFloor,
  reputationVocabularyFaults,
  sponsorGymBucksPerDay,
  topNpcTier,
  topNpcTierUnlocked,
  unlockedNpcTiers,
  type NpcTierUnlock,
  type ReputationPayout,
} from './reputation';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// The sweeps' parameters, in one named block
// ---------------------------------------------------------------------------

const REPUTATION_SWEEP = Object.freeze({
  /** Gaps between two check-ins, in seconds. Straddles the offline horizon. */
  GAP_SECONDS: Object.freeze([
    0, 1, 60, 600, 3600, 14400, 43200, 43201, 86400, 172800, 604800,
  ] as const),
  /** Check-in counts a gap may carry. */
  CHECK_INS: Object.freeze([0, 1, 2, 5, 20] as const),
  /** Roster sizes, within the opening gym's two slots and past them. */
  ROSTER_SIZES: Object.freeze([0, 1, 2] as const),
  /** Reputation balances the accrual and the ladders are driven at. */
  REPUTATION_POINTS: Object.freeze([
    0, 1, 49, 50, 51, 199, 200, 249, 250, 599, 600, 999, 1000, 1499, 1500, 1501, 2499, 2500, 4999,
    5000,
  ] as const),
  /** Gym Bucks purses the unlock sweep varies while reputation is held fixed. */
  PURSES: Object.freeze([0, 1, 500, 90000, 1000000, 100000000] as const),

  /**
   * The check-in cadence the skip-chain simulation runs at, in seconds. Four
   * hours is six check-ins a day, inside the offline horizon, so the cap does
   * not absorb the skip. A cadence past the horizon would make the chain
   * unmeasurable for a reason that is about the cap rather than about the chain.
   */
  CHAIN_CHECK_IN_GAP_SECONDS: 14400,
  /** Timer-skip grants applied at each check-in. The zero row is the baseline. */
  CHAIN_GRANTS_PER_CHECK_IN: Object.freeze([0, 1, 2] as const),
  /** Roster size the simulated gym runs with. Inside `ROSTER_SLOTS_BASE`. */
  CHAIN_ROSTER: 2,
  /** How many check-ins the simulation runs for before giving up on a tier. */
  CHAIN_MAX_CHECK_INS: 1200,

  /** The negative control's exchange rate: Gym Bucks per point of reputation. */
  BUCKS_PER_REPUTATION: 1000,
} as const);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function lifterAt(id: string, joinedAt: number, settledAt: number): NpcLifter {
  return createNpcLifter(id, 'novice', 'Placeholder', joinedAt, settledAt);
}

function roster(size: number, joinedAt = 0): readonly NpcLifter[] {
  const lifters: NpcLifter[] = [];
  for (let at = 0; at < size; at += 1) lifters.push(lifterAt(`lifter-${at}`, joinedAt, joinedAt));
  return lifters;
}

/** Every wall-clock purse at one balance, the way `recruitment.test.ts` builds them. */
function booksAt(balance: number): WallClockBooks {
  const books: Partial<Record<WallClockFundedOutput, GymBucks>> = {};
  for (const output of WALL_CLOCK_FUNDED_OUTPUTS) books[output] = asGymBucks(balance);
  return Object.freeze(books as Record<WallClockFundedOutput, GymBucks>);
}

interface GymOptions {
  readonly reputation?: number;
  /** The ACCELERATED book. What the sponsor line is paid into. */
  readonly gymBucks?: number;
  /**
   * Every wall-clock purse, which is what a recruit is actually bought with.
   *
   * Separate from `gymBucks`, and it defaults to nothing rather than to it. The
   * fixture used to write `settledGymBucks: asGymBucks(options.gymBucks ?? 0)`
   * — a field `EmpireState` has not had since GDD §5.4's third-book ruling — so
   * `options.gymBucks` was being routed into a property nothing reads, and the
   * gym the "leaves the recruitment gate refusing a RICH gym" check below calls
   * rich was broke in the only purse `recruitmentRefusals` looks at.
   */
  readonly settledBookBalance?: number;
  readonly roster?: readonly NpcLifter[];
  readonly elapsedSeconds?: number;
  readonly skippedSeconds?: number;
}

function gym(options: GymOptions = {}): EmpireState {
  const base = createEmpireState();
  return Object.freeze({
    ...base,
    clock: createEmpireClock(options.elapsedSeconds ?? 0, options.skippedSeconds ?? 0),
    reputation: asReputation(options.reputation ?? 0),
    gymBucks: asGymBucks(options.gymBucks ?? 0),
    settledBooks: booksAt(options.settledBookBalance ?? 0),
    roster: options.roster ?? base.roster,
  });
}

function clockAt(elapsedSeconds: number, skippedSeconds = 0): EmpireClock {
  return createEmpireClock(elapsedSeconds, skippedSeconds);
}

// ---------------------------------------------------------------------------
// The payout table and the reach it inherits
// ---------------------------------------------------------------------------

describe('a payout inherits its reach verdict and does not carry one', () => {
  it('routes every payout through an output the empire is allowed to pay', () => {
    // Reddening edit: re-point `REPUTATION_PAYOUT_OUTPUT.sponsorship` at
    // `'training-iq'`. Both lines below move — the membership pin names an
    // output that is no longer the one, and the reach lookup answers
    // `'progression-reaching'`.
    expect([...REPUTATION_PAYOUTS]).toEqual(['reputation', 'sponsorship']);
    expect(reputationPayoutOutput('reputation')).toBe('reputation');
    expect(reputationPayoutOutput('sponsorship')).toBe('gym-bucks');
    for (const payout of REPUTATION_PAYOUTS) {
      expect(EMPIRE_OUTPUTS as readonly string[]).toContain(reputationPayoutOutput(payout));
      expect(EMPIRE_FORBIDDEN_OUTPUTS as readonly string[]).not.toContain(
        reputationPayoutOutput(payout),
      );
    }
  });

  it('reads the verdict out of the empire tables rather than writing one down', () => {
    // The inheritance, stated as the equality it is: the answer this module
    // gives is the answer `empireCore.ts` gives about the output the row names.
    // Reddening edit: replace `reputationPayoutReach`'s body with a literal
    // `'idle-only'` — the second line survives, the first does not once the row
    // is re-pointed, and the third is what says the two are the same lookup.
    for (const payout of REPUTATION_PAYOUTS) {
      expect(reputationPayoutReach(payout)).toBe(outputReach(reputationPayoutOutput(payout)));
    }
    expect(reputationPayoutReach('sponsorship')).toBe('idle-only');
    expect(reputationPayoutReach('reputation')).toBe('idle-only');
    // GDD §8.1: a sponsor buys visibility, never a stat. The sponsor payout ends
    // up wherever a plain Gym Bucks payout ends up, and nowhere else.
    expect(reputationPayoutReach('sponsorship')).toBe(outputReach('gym-bucks'));
    expect(reputationPayoutReach('sponsorship')).not.toBe(outputReach('training-iq'));
    expect(reputationPayoutReach('sponsorship')).not.toBe(outputReach('physio-days-saved'));
  });

  it('declares the payout table against the empire output union', () => {
    // The vitest half of the two type-only directives below. A `satisfies`
    // clause is erased at runtime, so no value this module produces can tell
    // whether the table was typed at all — what vitest can read is the
    // declaration, so the declaration is what is pinned, by COUNT rather than by
    // presence.
    const source = readFileSync(path.join(HERE, 'reputation.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code.length).toBeGreaterThan(0);
    const declarations = [
      ...code.matchAll(/satisfies Readonly<Record<ReputationPayout, EmpireOutput>>/g),
    ];
    expect(declarations.length).toBe(1);

    // A sponsor may not be paid in Chalk: Chalk buys GDD §8.3E Extra Covered
    // Days, and empire income is check-in-keyed. `EmpireOutput` has no word for
    // Chalk, so this is a compile error rather than a review note. The rows
    // below are spelled with the same type expression the shipped table is
    // declared against, and the legal one comes first as the positive control —
    // without it, a typo in the type expression would make both directives
    // "used" for a reason that is not the one they claim.
    const legalRow: Readonly<Record<ReputationPayout, EmpireOutput>> = { reputation: 'reputation', sponsorship: 'gym-bucks' };
    // @ts-expect-error — 'chalk' is not an EmpireOutput, so a sponsor cannot be paid in it.
    const chalkRow: Readonly<Record<ReputationPayout, EmpireOutput>> = { reputation: 'reputation', sponsorship: 'chalk' };
    // @ts-expect-error — nor is 'covered-day', by the same union.
    const coveredRow: Readonly<Record<ReputationPayout, EmpireOutput>> = { reputation: 'reputation', sponsorship: 'covered-day' };
    expect(Object.keys(legalRow).sort()).toEqual([...REPUTATION_PAYOUTS].sort());
    expect(Object.keys(chalkRow).sort()).toEqual([...REPUTATION_PAYOUTS].sort());
    expect(Object.keys(coveredRow).sort()).toEqual([...REPUTATION_PAYOUTS].sort());
  });

  it('takes the offline fraction on the currency line and not on the reputation line', () => {
    // Reddening edit: flip either row of `PAYOUT_TAKES_OFFLINE_FRACTION`. The
    // arithmetic check is in the accrual sections below; this is the table.
    expect(PAYOUT_TAKES_OFFLINE_FRACTION.sponsorship).toBe(true);
    expect(PAYOUT_TAKES_OFFLINE_FRACTION.reputation).toBe(false);
    expect(Object.keys(PAYOUT_TAKES_OFFLINE_FRACTION).sort()).toEqual([...REPUTATION_PAYOUTS].sort());
  });
});

// ---------------------------------------------------------------------------
// The runtime shadow, and what it walked
// ---------------------------------------------------------------------------

describe('the module states its own invariants at runtime', () => {
  it('reports no fault against the shipped tables', () => {
    // Reddening edits, all of which this list catches: re-point the sponsorship
    // row at a progression-reaching output; delete `axisReputationRule`'s physio
    // exemption in `expansion.ts`; shorten
    // `SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER`; put a milestone above
    // `REPUTATION_MAX`; unsort `NPC_RECRUIT_REPUTATION_THRESHOLD`.
    expect(reputationVocabularyFaults()).toEqual([]);
  });

  it('pins what the fault list actually walked, so an empty domain reports itself', () => {
    // Counts, not bounds. A fault list that examined nothing and one that found
    // nothing are the same green tick without these.
    const census = reputationCensus();
    expect(census.payouts).toBe(2);
    expect(census.milestones).toBe(5);
    expect(census.sponsorRungs).toBe(5);
    expect(census.reputationTiers).toBe(5);
    // Exactly one expansion axis reaches past the idle layer today — physio.
    // A second one appearing is a decision somebody signs.
    expect(census.gatedAxes).toBe(1);
    // Six levels probed on it, which is past the shipped `STAFF_LEVEL_MAX.physio`
    // of one. `axisReputationRule`'s own docstring says why: confined to the
    // ladder the exemption's answer is zero with it and zero without it.
    expect(census.gateProbes).toBe(6);
    expect(census.gateProbes).toBe(census.gatedAxes * (census.reputationTiers + 1));
    expect(EMPIRE_TUNING.STAFF_LEVEL_MAX.physio).toBeLessThan(census.gateProbes);
  });

  it('agrees with the expansion piece about which axis the gate may not touch', () => {
    // The same claim from the other side, driven rather than delegated: the axes
    // whose output is not idle-only are exactly the ones `axisReputationRule`
    // answers zero for at every probed level.
    //
    // Reddening edit: delete `if (axis === 'physio') return asReputation(0);`
    // from `expansion.ts`. `gatedLevels` then holds a non-zero requirement and
    // the second expectation fails; `reputationVocabularyFaults` fails above in
    // the same edit.
    let gated = 0;
    let ungated = 0;
    const gatedLevels: number[] = [];
    for (const axis of EXPANSION_AXES) {
      const idle = outputReach(axisOutput(axis)) === 'idle-only';
      for (let level = 1; level <= reputationTierCount() + 1; level += 1) {
        const rule = axisReputationRule(axis, level);
        if (idle) {
          ungated += 1;
          continue;
        }
        gatedLevels.push(rule);
        gated += 1;
      }
    }
    expect(gated).toBe(6);
    expect(ungated).toBe((EXPANSION_AXES.length - 1) * (reputationTierCount() + 1));
    expect(gatedLevels).toEqual([0, 0, 0, 0, 0, 0]);
    // And the non-idle axis really is gate-bearing in shape: an idle-only axis
    // at the same levels is not all zero, so the list above is a statement about
    // the exemption rather than about the rule answering zero everywhere.
    const idleRule: number[] = [];
    for (let level = 1; level <= reputationTierCount() + 1; level += 1) {
      idleRule.push(axisReputationRule('space', level));
    }
    expect(idleRule.filter((value) => value > 0).length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Accrual
// ---------------------------------------------------------------------------

describe('reputation accrues from check-ins and from roster tenure', () => {
  it('reads the per-check-in and per-lifter-day entries out of the tuning block', () => {
    const rates = reputationRates(gym({ roster: roster(2) }), clockAt(0));
    expect(rates.perCheckIn).toBe(EMPIRE_TUNING.REPUTATION_PER_CHECK_IN);
    expect(rates.contributingLifters).toBe(2);
    expect(rates.perDay).toBe(EMPIRE_TUNING.REPUTATION_PER_NPC_TENURE_DAY * 2);
  });

  it('counts only lifters who are on the roster at the reading', () => {
    // Reddening edit: drop the `if (lifter.settledAt > now) continue;` filter.
    const later = roster(2, EMPIRE_TUNING.SECONDS_PER_DAY);
    expect(reputationRates(gym({ roster: later }), clockAt(0)).contributingLifters).toBe(0);
    expect(
      reputationRates(gym({ roster: later }), clockAt(EMPIRE_TUNING.SECONDS_PER_DAY))
        .contributingLifters,
    ).toBe(2);
  });

  it('counts a lifter from when they SETTLED, not from when they joined', () => {
    // THE SECOND HALF OF CHAIN B, and this assertion is here because mutation
    // testing found the file had no fixture that could redden it. `roster()`
    // builds every lifter with `joinedAt === settledAt`, so swapping
    // `lifter.settledAt` for `lifter.joinedAt` in `reputationRates` left all 37
    // tests in this file green — the empty domain reproduced across every
    // fixture that CLAUDE.md names, in one file rather than three.
    //
    // The fixture that can reach it is the one a purchased skip produces: on the
    // roster now, settled later. Reddening edit: read `joinedAt` here.
    const day = EMPIRE_TUNING.SECONDS_PER_DAY;
    const bought = [lifterAt('lifter-0', 0, day * 2), lifterAt('lifter-1', 0, day * 2)];
    expect(bought[0]?.joinedAt).not.toBe(bought[0]?.settledAt);
    expect(reputationRates(gym({ roster: bought }), clockAt(day)).contributingLifters).toBe(0);
    expect(reputationRates(gym({ roster: bought }), clockAt(day)).perDay).toBe(0);
    // And once the recruitment has settled on the wall clock they do count, so
    // the zero above is not a zero about a roster that never pays.
    expect(reputationRates(gym({ roster: bought }), clockAt(day * 2)).contributingLifters).toBe(2);
    expect(reputationRates(gym({ roster: bought }), clockAt(day * 2)).perDay).toBe(
      EMPIRE_TUNING.REPUTATION_PER_NPC_TENURE_DAY * 2,
    );
    // The same fact through `accrueReputation`, which is what a caller reaches:
    // an unsettled roster earns the check-in term and no tenure term at all.
    const unsettled = accrueReputation(
      gym({ roster: bought, elapsedSeconds: day }),
      clockAt(0),
      1,
    );
    expect(unsettled.fromTenure).toBe(0);
    expect(unsettled.fromCheckIns).toBe(EMPIRE_TUNING.REPUTATION_PER_CHECK_IN);
    const settledRoster = [lifterAt('lifter-0', 0, 0), lifterAt('lifter-1', 0, 0)];
    const settled = accrueReputation(
      gym({ roster: settledRoster, elapsedSeconds: day }),
      clockAt(0),
      1,
    );
    expect(settled.fromTenure).toBeGreaterThan(0);
  });

  it('conserves what it earned against what it paid and what it refused', () => {
    // `fromCheckIns + fromTenure` is what the gap earned; `gained +
    // discardedAtCeiling` is where all of it went. Reddening edit: drop
    // `discardedAtCeiling` to a constant zero, or stop clamping at the ceiling.
    let compared = 0;
    let mismatches = 0;
    let sawACeilingBite = 0;
    for (const startingReputation of REPUTATION_SWEEP.REPUTATION_POINTS) {
      for (const gap of REPUTATION_SWEEP.GAP_SECONDS) {
        for (const checkIns of REPUTATION_SWEEP.CHECK_INS) {
          for (const size of REPUTATION_SWEEP.ROSTER_SIZES) {
            const state = gym({
              reputation: startingReputation,
              roster: roster(size),
              elapsedSeconds: gap,
            });
            const accrual = accrueReputation(state, clockAt(0), checkIns);
            const earned = accrual.fromCheckIns + accrual.fromTenure;
            if (Math.abs(earned - (accrual.gained + accrual.discardedAtCeiling)) > 1e-9) {
              mismatches += 1;
            }
            if (accrual.discardedAtCeiling > 0) {
              sawACeilingBite += 1;
              // Where the ceiling bites, it bites exactly: the accrual lands ON
              // `REPUTATION_MAX` rather than short of it. Written this way
              // rather than as `toBeLessThanOrEqual(REPUTATION_MAX)`, which
              // would restate `asReputation`'s own guard in `empireCore.ts` —
              // that constructor throws above the ceiling, so a bound here
              // could never be the thing that went red.
              expect(accrual.reputation).toBe(EMPIRE_TUNING.REPUTATION_MAX);
            }
            expect(accrual.reputation).toBe(scrubPrecision(startingReputation + accrual.gained));
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(
      REPUTATION_SWEEP.REPUTATION_POINTS.length *
        REPUTATION_SWEEP.GAP_SECONDS.length *
        REPUTATION_SWEEP.CHECK_INS.length *
        REPUTATION_SWEEP.ROSTER_SIZES.length,
    );
    expect(compared).toBe(3300);
    expect(mismatches).toBe(0);
    // The ceiling case is in the domain rather than assumed to be: without this
    // the conservation check could hold on a sweep where nothing was ever
    // refused, which is the empty-domain shape.
    expect(sawACeilingBite).toBe(284);
  });

  it('conserves the seconds it was given, and reports what the cap took', () => {
    // Reddening edit: return `secondsElapsed` in place of `secondsDiscarded`, or
    // stop calling `bankableOfflineSeconds`.
    let compared = 0;
    let sawTheCapBite = 0;
    for (const gap of REPUTATION_SWEEP.GAP_SECONDS) {
      const accrual = accrueReputation(gym({ elapsedSeconds: gap, roster: roster(2) }), clockAt(0), 0);
      expect(accrual.secondsElapsed).toBe(accrual.secondsBanked + accrual.secondsDiscarded);
      expect(accrual.secondsBanked).toBeLessThanOrEqual(accrual.secondsElapsed);
      if (accrual.secondsDiscarded > 0) sawTheCapBite += 1;
      compared += 1;
    }
    expect(compared).toBe(REPUTATION_SWEEP.GAP_SECONDS.length);
    expect(compared).toBe(11);
    expect(sawTheCapBite).toBe(4);
  });

  it('never pays less for a longer absence, and stops paying past the horizon', () => {
    // GDD §5.1's cap, applied to this earner because a second uncapped earner
    // beside a capped one is the cap walked around by a sibling. Reddening edit:
    // subtract the discarded seconds instead of dropping them.
    const horizon =
      Math.max(
        EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
        EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
      ) * EMPIRE_TUNING.SECONDS_PER_HOUR;
    const at = (gap: number): number =>
      accrueReputation(gym({ elapsedSeconds: gap, roster: roster(2) }), clockAt(0), 0).gained;
    let decreases = 0;
    let flatPastHorizon = 0;
    let steps = 0;
    let previous = at(0);
    for (let gap = 0; gap <= horizon * 3; gap += EMPIRE_TUNING.SECONDS_PER_HOUR) {
      const value = at(gap);
      if (value < previous) decreases += 1;
      if (gap > horizon && value !== at(horizon)) flatPastHorizon += 1;
      previous = value;
      steps += 1;
    }
    expect(steps).toBe(37);
    expect(decreases).toBe(0);
    expect(flatPastHorizon).toBe(0);
    // The series is not constant, or the two zeros above are zeros about
    // nothing.
    expect(at(horizon)).toBeGreaterThan(at(0));
  });

  it('never pays a player less for checking in more', () => {
    // CLAUDE.md: never punish daily engagement. Two gyms identical except that
    // one checked in more must not end on less reputation. Counts, not bounds.
    let pairs = 0;
    let violations = 0;
    for (const startingReputation of REPUTATION_SWEEP.REPUTATION_POINTS) {
      for (const gap of REPUTATION_SWEEP.GAP_SECONDS) {
        for (const size of REPUTATION_SWEEP.ROSTER_SIZES) {
          const state = gym({
            reputation: startingReputation,
            roster: roster(size),
            elapsedSeconds: gap,
          });
          for (let checkIns = 0; checkIns < REPUTATION_SWEEP.CHECK_INS.length - 1; checkIns += 1) {
            const fewer = accrueReputation(
              state,
              clockAt(0),
              REPUTATION_SWEEP.CHECK_INS[checkIns] as number,
            );
            const more = accrueReputation(
              state,
              clockAt(0),
              REPUTATION_SWEEP.CHECK_INS[checkIns + 1] as number,
            );
            if (more.reputation < fewer.reputation) violations += 1;
            pairs += 1;
          }
        }
      }
    }
    expect(pairs).toBe(2640);
    expect(violations).toBe(0);
    // The negative control: the same comparison against a variant that charges
    // for a check-in. Without it the zero above is a zero against nothing.
    let controlViolations = 0;
    let controlPairs = 0;
    const charged = (state: EmpireState, checkIns: number): number =>
      accrueReputation(state, clockAt(0), checkIns).gained -
      checkIns * EMPIRE_TUNING.REPUTATION_PER_CHECK_IN * 2;
    for (const size of REPUTATION_SWEEP.ROSTER_SIZES) {
      const state = gym({ roster: roster(size), elapsedSeconds: EMPIRE_TUNING.SECONDS_PER_HOUR });
      for (let checkIns = 0; checkIns < REPUTATION_SWEEP.CHECK_INS.length - 1; checkIns += 1) {
        const fewer = charged(state, REPUTATION_SWEEP.CHECK_INS[checkIns] as number);
        const more = charged(state, REPUTATION_SWEEP.CHECK_INS[checkIns + 1] as number);
        if (more < fewer) controlViolations += 1;
        controlPairs += 1;
      }
    }
    expect(controlPairs).toBe(12);
    expect(controlViolations).toBe(12);
  });

  it('refuses a mark ahead of the gym clock and a check-in count that is not one', () => {
    expect(() => accrueReputation(gym({ elapsedSeconds: 0 }), clockAt(60), 0)).toThrow(RangeError);
    expect(() => accrueReputation(gym(), clockAt(0), -1)).toThrow(RangeError);
    expect(() => accrueReputation(gym(), clockAt(0), 0.5)).toThrow(RangeError);
    expect(() => accrueReputation(gym(), clockAt(0), Number.NaN)).toThrow(RangeError);
  });

  it('stamps its ledger entry on the wall clock and pays the reputation output', () => {
    // Reddening edit: stamp `at` from `elapsedFor(state.clock, 'gym-bucks')`.
    // The clock below is built with a skip, so the two readings differ.
    const state = gym({ elapsedSeconds: EMPIRE_TUNING.SECONDS_PER_DAY, skippedSeconds: 3600, roster: roster(2) });
    const accrual = accrueReputation(state, clockAt(0, 3600), 3);
    expect(accrual.ledger.length).toBe(1);
    const entry = accrual.ledger[0] as { at: number; output: string; amount: number };
    expect(entry.at).toBe(state.clock.unaccelerated);
    expect(entry.at).not.toBe(state.clock.accelerated);
    expect(entry.output).toBe('reputation');
    expect(outputReach('reputation')).toBe('idle-only');
    expect(entry.amount).toBe(accrual.gained);
  });

  it('does not discount the reputation line by the Gym Bucks offline fraction', () => {
    // The arithmetic half of `PAYOUT_TAKES_OFFLINE_FRACTION`. Reddening edit:
    // flip the `reputation` row to `true`.
    const gap = EMPIRE_TUNING.SECONDS_PER_HOUR;
    const accrual = accrueReputation(gym({ elapsedSeconds: gap, roster: roster(2) }), clockAt(0), 0);
    const undiscounted =
      EMPIRE_TUNING.REPUTATION_PER_NPC_TENURE_DAY * 2 * (gap / EMPIRE_TUNING.SECONDS_PER_DAY);
    expect(accrual.fromTenure).toBeCloseTo(undiscounted, 6);
    // And the fraction is not 1, or the line above says nothing.
    expect(EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION).not.toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tiers, milestones and the legendary gate
// ---------------------------------------------------------------------------

describe('the reputation scale and its milestones', () => {
  it('cuts the scale into the tiers the tuning block declares', () => {
    expect(reputationTierCount()).toBe(EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS.length);
    expect(reputationTierCount()).toBe(5);
    expect(highestReputationTierIndex()).toBe(4);
    for (let index = 0; index < reputationTierCount(); index += 1) {
      expect(reputationTierFloor(index)).toBe(
        EMPIRE_TUNING.REPUTATION_TIER_THRESHOLDS[index] as number,
      );
      expect(reputationTierIndex(reputationTierFloor(index))).toBe(index);
    }
    expect(() => reputationTierFloor(reputationTierCount())).toThrow(RangeError);
    expect(() => reputationTierFloor(-1)).toThrow(RangeError);
  });

  it('derives the milestone ladder from the recruitment gate rather than restating it', () => {
    // Reddening edit: hard-code a threshold list here or in `reputation.ts`.
    // Either way the two stop agreeing with `NPC_RECRUIT_REPUTATION_THRESHOLD`.
    const milestones = reputationMilestones();
    expect(milestones.length).toBe(EMPIRE_TUNING.NPC_TIERS.length);
    expect(milestones.map((milestone) => milestone.unlocks)).toEqual([
      ...EMPIRE_TUNING.NPC_TIERS,
    ]);
    let ascending = 0;
    for (const milestone of milestones) {
      expect(milestone.reputation).toBe(recruitReputationThreshold(milestone.unlocks));
      expect(milestone.reputation).toBeLessThanOrEqual(EMPIRE_TUNING.REPUTATION_MAX);
      ascending += 1;
    }
    expect(ascending).toBe(5);
    expect(milestones.map((milestone) => Number(milestone.reputation))).toEqual([
      0, 50, 200, 600, 1500,
    ]);
  });

  it('marks and pays nothing', () => {
    // CLAUDE.md, GDD §4.4: a grant keyed to something the player does is the
    // defect shape, and reputation is check-in-keyed. A milestone carries a
    // threshold and what it opens, and no amount. Reddening edit: add a payout
    // field to `ReputationMilestone` and populate it.
    let inspected = 0;
    for (const milestone of reputationMilestones()) {
      expect(Object.keys(milestone).sort()).toEqual(['reputation', 'unlocks']);
      inspected += 1;
    }
    expect(inspected).toBe(5);
  });

  it('reports which milestones are behind and which is next', () => {
    expect(milestonesReached(asReputation(0)).map((m) => m.unlocks)).toEqual(['novice']);
    expect(milestonesReached(asReputation(49)).map((m) => m.unlocks)).toEqual(['novice']);
    expect(milestonesReached(asReputation(50)).map((m) => m.unlocks)).toEqual(['novice', 'club']);
    expect(milestonesReached(asReputation(1500)).map((m) => m.unlocks)).toEqual([
      ...EMPIRE_TUNING.NPC_TIERS,
    ]);
    expect(nextMilestone(asReputation(0))?.unlocks).toBe('club');
    expect(nextMilestone(asReputation(1499))?.unlocks).toBe('legendary');
    expect(nextMilestone(asReputation(1500))).toBeNull();
  });

  it('opens the top rung by reputation and by nothing else in the vocabulary', () => {
    // GDD §5.3: the legendary tier "unlocks via reputation milestones, never
    // paid pulls". Reddening edit: add a second member to
    // `NPC_TIER_UNLOCK_KEYS`, or point a tier's row at one of the forbidden
    // routes — the second is also a compile error, which is the intent.
    expect(topNpcTier()).toBe('legendary');
    expect([...NPC_TIER_UNLOCK_KEYS]).toEqual(['reputation-milestone']);
    expect([...FORBIDDEN_UNLOCK_KEYS]).toEqual(['paid-pull', 'currency-purchase', 'chance-draw']);
    for (const key of NPC_TIER_UNLOCK_KEYS) {
      expect(FORBIDDEN_UNLOCK_KEYS as readonly string[]).not.toContain(key);
    }
    let tiers = 0;
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      expect(npcTierUnlockKey(tier)).toBe('reputation-milestone');
      expect(NPC_TIER_UNLOCK[tier]).toBe('reputation-milestone');
      tiers += 1;
    }
    expect(tiers).toBe(5);
    expect(recruitReputationThreshold(topNpcTier())).toBe(1500);
    expect(topNpcTierUnlocked(gym({ reputation: 1499 }))).toBe(false);
    expect(topNpcTierUnlocked(gym({ reputation: 1500 }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The unlock list is a function of reputation and of nothing else
// ---------------------------------------------------------------------------

/**
 * The negative control: the same list, wired so a purse pays a milestone down.
 *
 * §4.4 records a builder whose check it believed covered "the output does not
 * move" while a legal input moved 2362 of 34338 lists and left every aggregate
 * identical. The zero below is a zero against this.
 */
function unlocksReadingTheBalance(state: EmpireState): readonly NpcTierUnlock[] {
  return EMPIRE_TUNING.NPC_TIERS.map((tier) => {
    const threshold = recruitReputationThreshold(tier);
    const effective = state.reputation + state.gymBucks / REPUTATION_SWEEP.BUCKS_PER_REPUTATION;
    const shortBy = Math.max(0, threshold - effective);
    return {
      tier,
      threshold,
      unlockedBy: npcTierUnlockKey(tier),
      unlocked: shortBy === 0,
      shortBy,
    };
  });
}

describe('no amount of currency opens a tier', () => {
  it('returns a byte-identical unlock list at every purse, roster and clock', () => {
    // Element-wise, not by an aggregate. Reddening edit: read `state.gymBucks`
    // inside `npcTierUnlocks`, which is exactly what the control below does.
    let compared = 0;
    let moved = 0;
    let controlCompared = 0;
    let controlMoved = 0;
    for (const reputation of REPUTATION_SWEEP.REPUTATION_POINTS) {
      const baseline = JSON.stringify(npcTierUnlocks(gym({ reputation })));
      const controlBaseline = JSON.stringify(unlocksReadingTheBalance(gym({ reputation })));
      for (const purse of REPUTATION_SWEEP.PURSES) {
        for (const size of REPUTATION_SWEEP.ROSTER_SIZES) {
          for (const skipped of [0, 3600, 2592000]) {
            const state = gym({
              reputation,
              gymBucks: purse,
              roster: roster(size),
              elapsedSeconds: EMPIRE_TUNING.SECONDS_PER_DAY,
              skippedSeconds: skipped,
            });
            if (JSON.stringify(npcTierUnlocks(state)) !== baseline) moved += 1;
            compared += 1;
            if (JSON.stringify(unlocksReadingTheBalance(state)) !== controlBaseline) {
              controlMoved += 1;
            }
            controlCompared += 1;
          }
        }
      }
    }
    expect(compared).toBe(1080);
    expect(moved).toBe(0);
    expect(controlCompared).toBe(compared);
    expect(controlMoved).toBe(630);
  });

  it('leaves the recruitment gate refusing a rich gym below the milestone', () => {
    // The claim where it actually bites: `recruitment.ts`'s own refusal list.
    // Reddening edit: make `recruitmentRefusals` compare a purse-adjusted
    // reputation against the threshold.
    //
    // The purse is put in BOTH books, and that is the correction this check
    // needed. It used to fund `gymBucks` alone, which `recruitmentRefusals` does
    // not read — a recruit is bought out of `settledBooks`, since it pays
    // Training IQ — so "rich" described a gym with nothing in the only purse the
    // subject looks at, and the check would have passed against a gate that read
    // the wall-clock balance as well as the reputation. `richestPurse` below is
    // what says the money is real: at the top purse the funds refusal is gone
    // and the reputation refusal is the only one left.
    let checked = 0;
    let refused = 0;
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      const threshold = recruitReputationThreshold(tier);
      if (threshold === 0) continue;
      for (const purse of REPUTATION_SWEEP.PURSES) {
        const state = gym({
          reputation: threshold - 1,
          gymBucks: purse,
          settledBookBalance: purse,
          roster: [],
        });
        if (recruitmentRefusals(state, tier).includes('reputation-below-threshold')) refused += 1;
        checked += 1;
      }
    }
    expect(checked).toBe(24);
    expect(refused).toBe(checked);
    // The money is live: at the richest purse in the sweep the only refusal
    // left on every gated tier is the reputation one. Without this line the
    // count above is a count over gyms that were refused for their empty
    // wallet and happened to be refused for their reputation too.
    const richestPurse = Math.max(...REPUTATION_SWEEP.PURSES);
    let onlyReputationRefused = 0;
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      const threshold = recruitReputationThreshold(tier);
      if (threshold === 0) continue;
      const rich = gym({
        reputation: threshold - 1,
        settledBookBalance: richestPurse,
        roster: [],
      });
      expect([...recruitmentRefusals(rich, tier)]).toEqual(['reputation-below-threshold']);
      onlyReputationRefused += 1;
    }
    expect(onlyReputationRefused).toBe(4);
    // And the refusal does clear on reputation alone, at the same purses — so
    // the count above is about the gate rather than about a list that always
    // holds that string.
    let cleared = 0;
    for (const tier of EMPIRE_TUNING.NPC_TIERS) {
      const threshold = recruitReputationThreshold(tier);
      if (threshold === 0) continue;
      const state = gym({ reputation: threshold, gymBucks: 0, roster: [] });
      if (!recruitmentRefusals(state, tier).includes('reputation-below-threshold')) cleared += 1;
    }
    expect(cleared).toBe(4);
  });

  it('lists the tiers a gym may recruit, in ladder order', () => {
    expect(unlockedNpcTiers(gym({ reputation: 0 }))).toEqual(['novice']);
    expect(unlockedNpcTiers(gym({ reputation: 600 }))).toEqual([
      'novice',
      'club',
      'regional',
      'national',
    ]);
    expect(unlockedNpcTiers(gym({ reputation: 5000 }))).toEqual([...EMPIRE_TUNING.NPC_TIERS]);
    const unlocks = npcTierUnlocks(gym({ reputation: 100 }));
    expect(unlocks.map((unlock) => unlock.shortBy)).toEqual([0, 0, 100, 500, 1400]);
  });
});

// ---------------------------------------------------------------------------
// Sponsorship
// ---------------------------------------------------------------------------

describe('sponsor money follows the reputation tier and nothing else', () => {
  it('pays each tier the rung the tuning block publishes', () => {
    let rungs = 0;
    for (let index = 0; index < reputationTierCount(); index += 1) {
      expect(sponsorGymBucksPerDay(reputationTierFloor(index))).toBe(
        EMPIRE_TUNING.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER[index] as number,
      );
      rungs += 1;
    }
    expect(rungs).toBe(5);
    // A gym nobody has heard of has no sponsor. Reddening edit: a non-zero rung
    // at index 0, which would pay a brand-new gym for nothing.
    expect(sponsorGymBucksPerDay(asReputation(0))).toBe(0);
  });

  it('never pays less for more reputation, and steps exactly at the tier floors', () => {
    let steps = 0;
    let decreases = 0;
    let increases = 0;
    let previous = sponsorGymBucksPerDay(asReputation(0));
    for (const reputation of REPUTATION_SWEEP.REPUTATION_POINTS) {
      const value = sponsorGymBucksPerDay(asReputation(reputation));
      if (value < previous) decreases += 1;
      if (value > previous) increases += 1;
      previous = value;
      steps += 1;
    }
    expect(steps).toBe(20);
    expect(decreases).toBe(0);
    // Four steps up across five rungs. Reddening edit: flatten the sponsor
    // ladder, which leaves `decreases` at zero and moves this.
    expect(increases).toBe(4);
  });

  it('accrues on the idle clock, capped and discounted like the rest of the economy', () => {
    // Legal under GDD §8.3B and asserted legal rather than merely permitted: a
    // bought skip is supposed to make the gym earn sooner. Reddening edit: route
    // the sponsor gap through a progression-reaching output.
    const gap = EMPIRE_TUNING.SECONDS_PER_HOUR;
    const state = gym({ reputation: 1000, elapsedSeconds: gap });
    const accrual = accrueSponsorship(state, clockAt(0));
    expect(accrual.tierIndex).toBe(2);
    expect(accrual.perDay).toBe(EMPIRE_TUNING.SPONSOR_GYM_BUCKS_PER_DAY_BY_REPUTATION_TIER[2]);
    expect(accrual.gymBucks).toBeCloseTo(
      accrual.perDay *
        EMPIRE_TUNING.OFFLINE_EARNINGS_FRACTION *
        (gap / EMPIRE_TUNING.SECONDS_PER_DAY),
      9,
    );
    expect(accrual.secondsElapsed).toBe(accrual.secondsBanked + accrual.secondsDiscarded);
    expect(() => accrueSponsorship(gym({ elapsedSeconds: 0 }), clockAt(60))).toThrow(RangeError);
  });

  it('stamps its ledger entry on the wall clock and pays the Gym Bucks output', () => {
    const state = gym({
      reputation: 2500,
      elapsedSeconds: EMPIRE_TUNING.SECONDS_PER_DAY,
      skippedSeconds: 3600,
    });
    const accrual = accrueSponsorship(state, clockAt(0, 3600));
    expect(accrual.ledger.length).toBe(1);
    const entry = accrual.ledger[0] as { at: number; output: string; amount: number };
    expect(entry.at).toBe(state.clock.unaccelerated);
    expect(entry.at).not.toBe(state.clock.accelerated);
    expect(entry.output).toBe('gym-bucks');
    expect(outputReach(entry.output as 'gym-bucks')).toBe('idle-only');
    expect(entry.amount).toBe(accrual.gymBucks);
  });

  it('never pays less for a longer absence and stops paying past the horizon', () => {
    const horizon =
      Math.max(
        EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
        EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
      ) * EMPIRE_TUNING.SECONDS_PER_HOUR;
    const at = (gap: number): number =>
      accrueSponsorship(gym({ reputation: 2500, elapsedSeconds: gap }), clockAt(0)).gymBucks;
    let decreases = 0;
    let pastHorizonMoves = 0;
    let steps = 0;
    let previous = at(0);
    for (let gap = 0; gap <= horizon * 3; gap += EMPIRE_TUNING.SECONDS_PER_HOUR) {
      const value = at(gap);
      if (value < previous) decreases += 1;
      if (gap > horizon && value !== at(horizon)) pastHorizonMoves += 1;
      previous = value;
      steps += 1;
    }
    expect(steps).toBe(37);
    expect(decreases).toBe(0);
    expect(pastHorizonMoves).toBe(0);
    expect(at(horizon)).toBeGreaterThan(at(0));
  });
});

// ---------------------------------------------------------------------------
// Chain B, closed — and the reading it used to take, kept as the control
// ---------------------------------------------------------------------------

/**
 * The wall-clock day each tier's milestone is first met, simulated check-in by
 * check-in at `CHAIN_CHECK_IN_GAP_SECONDS`, with `grantsPerCheckIn` timer-skip
 * grants applied at each one.
 *
 * A tier that never opens inside `CHAIN_MAX_CHECK_INS` records `-1`, and the
 * caller pins that none of them did — a list of `-1`s would compare equal across
 * every skip size and make the measurement below say nothing.
 */
function unlockDayList(grantsPerCheckIn: number): readonly number[] {
  const gap = REPUTATION_SWEEP.CHAIN_CHECK_IN_GAP_SECONDS;
  const grantSeconds = grantsPerCheckIn * EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;
  const lifters = roster(REPUTATION_SWEEP.CHAIN_ROSTER);
  const days = EMPIRE_TUNING.NPC_TIERS.map(() => -1);
  let reputation = 0;
  let mark = clockAt(0, 0);
  for (let checkIn = 1; checkIn <= REPUTATION_SWEEP.CHAIN_MAX_CHECK_INS; checkIn += 1) {
    const now = clockAt(checkIn * gap, checkIn * grantSeconds);
    const state = gym({
      reputation,
      roster: lifters,
      elapsedSeconds: checkIn * gap,
      skippedSeconds: checkIn * grantSeconds,
    });
    reputation = accrueReputation(state, mark, 1).reputation;
    mark = now;
    const day = Math.floor((checkIn * gap) / EMPIRE_TUNING.SECONDS_PER_DAY);
    EMPIRE_TUNING.NPC_TIERS.forEach((tier, index) => {
      if (days[index] !== -1) return;
      if (reputation >= recruitReputationThreshold(tier)) days[index] = day;
    });
  }
  return Object.freeze(days);
}

/**
 * The same simulation against the reading this module took while chain B was
 * open: reputation measured on the ACCELERATED clock.
 *
 * It does not reimplement `accrueReputation` — an oracle that restates its
 * subject cannot disagree with it. It hands the shipped function a clock whose
 * wall reading IS the idle reading, which is byte-for-byte the arithmetic the
 * pre-fix `elapsedFor(at, 'reputation')` performed, and records the day on the
 * real wall clock exactly as the shipped simulation above does.
 *
 * This is the negative control GDD §4.4 asks for beside a zero. Its counts are
 * the ones piece E4 measured on the shipped path — 2 of 3 lists, 7 of 15
 * entries — so the zero above is a zero against a number that was really there.
 */
function unlockDayListOnTheIdleClock(grantsPerCheckIn: number): readonly number[] {
  const gap = REPUTATION_SWEEP.CHAIN_CHECK_IN_GAP_SECONDS;
  const grantSeconds = grantsPerCheckIn * EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;
  const lifters = roster(REPUTATION_SWEEP.CHAIN_ROSTER);
  const days = EMPIRE_TUNING.NPC_TIERS.map(() => -1);
  let reputation = 0;
  let mark = clockAt(0, 0);
  for (let checkIn = 1; checkIn <= REPUTATION_SWEEP.CHAIN_MAX_CHECK_INS; checkIn += 1) {
    const idleSeconds = checkIn * gap + checkIn * grantSeconds;
    const state = gym({
      reputation,
      roster: lifters,
      elapsedSeconds: idleSeconds,
      skippedSeconds: 0,
    });
    reputation = accrueReputation(state, mark, 1).reputation;
    mark = clockAt(idleSeconds, 0);
    const day = Math.floor((checkIn * gap) / EMPIRE_TUNING.SECONDS_PER_DAY);
    EMPIRE_TUNING.NPC_TIERS.forEach((tier, index) => {
      if (days[index] !== -1) return;
      if (reputation >= recruitReputationThreshold(tier)) days[index] = day;
    });
  }
  return Object.freeze(days);
}

describe('the chain a purchased skip opened into the tier gate', () => {
  it('is closed: the unlock-day list is byte-identical under every skip size', () => {
    // Chain B, as piece E4 measured it and left it open, and as piece E6 closed
    // it. `gateElapsedFor(at, 'reputation')` is the wall clock, and the roster
    // filter reads `settledAt` — so neither half of the accrual moves with a
    // purchase and the wall-clock day a milestone is met does not either.
    //
    // Reddening edits, both of which put the numbers back on the control's row:
    // swap `gateElapsedFor` for `elapsedFor` in `reputationRates` and
    // `accrueReputation`, or swap `lifter.settledAt` for `lifter.joinedAt` in
    // `reputationRates`.
    const baseline = unlockDayList(0);
    // Non-vacuity: every tier really opened inside the simulation, so the lists
    // being compared are lists of days rather than lists of `-1`.
    expect(baseline.filter((day) => day === -1).length).toBe(0);
    expect(baseline).toEqual([0, 4, 15, 46, 115]);

    let compared = 0;
    let movedLists = 0;
    let movedEntries = 0;
    let entriesCompared = 0;
    for (const grants of REPUTATION_SWEEP.CHAIN_GRANTS_PER_CHECK_IN) {
      const list = unlockDayList(grants);
      expect(list.filter((day) => day === -1).length).toBe(0);
      if (JSON.stringify(list) !== JSON.stringify(baseline)) movedLists += 1;
      list.forEach((day, index) => {
        if (day !== baseline[index]) movedEntries += 1;
        entriesCompared += 1;
      });
      compared += 1;
    }
    expect(compared).toBe(3);
    expect(entriesCompared).toBe(15);
    expect(movedLists).toBe(0);
    expect(movedEntries).toBe(0);
  });

  it('is open on the reading it used to take, which is the control the zero is against', () => {
    // The same simulation, the same shipped `accrueReputation`, handed a clock
    // whose wall reading is the idle one. These are E4's numbers.
    const baseline = unlockDayListOnTheIdleClock(0);
    expect(baseline.filter((day) => day === -1).length).toBe(0);
    // The zero-skip row is the same list on both paths, which is what says the
    // control differs from the subject only where a skip is applied.
    expect(baseline).toEqual([0, 4, 15, 46, 115]);
    expect(baseline).toEqual(unlockDayList(0));

    let compared = 0;
    let movedLists = 0;
    let movedEntries = 0;
    let entriesCompared = 0;
    let later = 0;
    for (const grants of REPUTATION_SWEEP.CHAIN_GRANTS_PER_CHECK_IN) {
      const list = unlockDayListOnTheIdleClock(grants);
      expect(list.filter((day) => day === -1).length).toBe(0);
      if (JSON.stringify(list) !== JSON.stringify(baseline)) movedLists += 1;
      list.forEach((day, index) => {
        if (day !== baseline[index]) movedEntries += 1;
        if (day > (baseline[index] as number)) later += 1;
        entriesCompared += 1;
      });
      compared += 1;
    }
    expect(compared).toBe(3);
    expect(entriesCompared).toBe(15);
    expect(movedLists).toBe(2);
    expect(movedEntries).toBe(7);
    // And the movement is in the direction the chain predicts: a purchase never
    // made a milestone arrive LATER.
    expect(later).toBe(0);
  });

  it('accrues on the wall clock at every gap, and on the idle clock in the control', () => {
    // The single-gap statement of the same thing, so a reader can see the whole
    // closure without running a 1200-step simulation. Counts, not bounds.
    const horizon =
      Math.max(
        EMPIRE_TUNING.OFFLINE_EARNINGS_CAP_HOURS,
        EMPIRE_TUNING.OFFLINE_EARNINGS_NO_PUNISH_HOURS,
      ) * EMPIRE_TUNING.SECONDS_PER_HOUR;
    const skip = EMPIRE_TUNING.TIMER_SKIP_SECONDS_PER_GRANT;
    let gaps = 0;
    let movedOnTheShippedPath = 0;
    let movedOnTheControl = 0;
    let controlGapsInsideTheHorizon = 0;
    for (const gap of REPUTATION_SWEEP.GAP_SECONDS) {
      const without = accrueReputation(
        gym({ elapsedSeconds: gap, roster: roster(2) }),
        clockAt(0),
        0,
      ).gained;
      const withSkip = accrueReputation(
        gym({ elapsedSeconds: gap, roster: roster(2), skippedSeconds: skip }),
        clockAt(0, 0),
        0,
      ).gained;
      // The control: the same skip folded into the wall reading, which is what
      // measuring reputation on the accelerated clock amounts to.
      const onTheIdleClock = accrueReputation(
        gym({ elapsedSeconds: gap + skip, roster: roster(2) }),
        clockAt(0),
        0,
      ).gained;
      if (withSkip !== without) movedOnTheShippedPath += 1;
      if (onTheIdleClock !== without) movedOnTheControl += 1;
      if (gap + skip <= horizon) controlGapsInsideTheHorizon += 1;
      gaps += 1;
    }
    expect(gaps).toBe(REPUTATION_SWEEP.GAP_SECONDS.length);
    expect(gaps).toBe(11);
    expect(movedOnTheShippedPath).toBe(0);
    // Non-zero, and exactly the gaps the GDD §5.1 cap does not already absorb:
    // past the horizon the control moves nothing either, because the gap is
    // truncated before it is paid.
    expect(movedOnTheControl).toBe(6);
    expect(controlGapsInsideTheHorizon).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Purity, real-identity exposure and the magic-number audit
// ---------------------------------------------------------------------------

describe('this module is pure, numerically clean and names nobody', () => {
  const source = readFileSync(path.join(HERE, 'reputation.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('was read at all, so the scans below are not scanning an empty string', () => {
    expect(source.length).toBeGreaterThan(0);
    expect(code.length).toBeGreaterThan(0);
    expect(code).toMatch(/export function /);
  });

  it('reads no clock, rolls no dice and touches no host API', () => {
    // The directory-wide version of this lives in `empireCore.test.ts` and
    // covers this file the moment its `shipped` pin is signed. This is the same
    // ban applied here, so it bites before that.
    const banned: readonly RegExp[] = [
      /\bDate\b/,
      /\bperformance\s*\./,
      /Math\s*\.\s*random/,
      /\brandom\b/i,
      /\bshuffle\b/i,
      /\bweight/i,
      /\bseed\b/i,
      /\bdistribution\b/i,
      /\bprobability\b/i,
      /\brarity\b/i,
      /\bgacha\b/i,
      /\bfetch\s*\(/,
      /\bprocess\b/,
      /\bwindow\b/,
      /\bdocument\b/,
      /\blocalStorage\b/,
      /from ['"]react/,
    ];
    const tripwires: readonly string[] = [
      'const now = Date.now();',
      'performance . now()',
      'Math.random()',
      'const r = random();',
      'shuffle(list)',
      'const w = weights[0];',
      'const seed = 7;',
      'const distribution = [];',
      'const probability = 0.5;',
      'const rarity = 3;',
      'gacha()',
      'fetch (url)',
      'process.env',
      'window.alert',
      'document.body',
      'localStorage.getItem',
      "import x from 'react';",
    ];
    let checks = 0;
    for (const [index, pattern] of banned.entries()) {
      expect(code, `reputation.ts must not reach ${String(pattern)}`).not.toMatch(pattern);
      // Each pattern is driven against a string it should trip, so a regex that
      // stopped matching anything is red rather than quietly green.
      expect(tripwires[index], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
      checks += 1;
    }
    expect(checks).toBe(banned.length);
    expect(checks).toBe(17);
  });

  it('imports only its own directory', () => {
    const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] as string);
    expect(imports.sort()).toEqual([
      './empireCore',
      './empireTuning',
      './expansion',
      './production',
    ]);
  });

  it('ships no string a real name could be hiding in, and pins the ones it does ship', () => {
    // GDD §12.3 refuses a real, named athlete, brand or company in any string or
    // code path, and a sponsor table is precisely where a real brand gets typed
    // in as a realistic placeholder. No scan can tell a real name from an
    // invented one — that is the human, name-by-name pass §12.3 asks for. What
    // this does is make a name ARRIVING visible: every space-free single-quoted
    // literal is pinned exactly, and a `Capitalised Capitalised` pair is banned
    // across all three kinds of string literal, where the first half does not
    // look.
    const singleQuoted = new Set<string>();
    const doubleQuoted = new Set<string>();
    const templateChunks = new Set<string>();
    for (const match of code.matchAll(/'([^'\\\n]*)'/g)) singleQuoted.add(match[1] as string);
    for (const match of code.matchAll(/"([^"\\\n]*)"/g)) doubleQuoted.add(match[1] as string);
    for (const match of code.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
      templateChunks.add((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
    }
    // Counts before contents, so an empty domain reports itself.
    expect(singleQuoted.size).toBe(17);
    expect(doubleQuoted.size).toBe(0);
    expect(templateChunks.size).toBe(14);
    // The template collector really reaches this module's messages, by match
    // count rather than by presence.
    const chunks = [...templateChunks];
    expect(chunks.filter((chunk) => chunk.includes('is off the')).length).toBe(2);
    expect(chunks.filter((chunk) => chunk.includes('which GDD')).length).toBe(1);

    expect([...singleQuoted].filter((literal) => !literal.includes(' ')).sort()).toEqual([
      './empireCore',
      './empireTuning',
      './expansion',
      './production',
      'chance-draw',
      'currency-purchase',
      'gym-bucks',
      'idle-only',
      'paid-pull',
      'reputation',
      'reputation-milestone',
      'sponsorship',
      'training-iq',
    ]);
    // The one reach verdict this module writes down at all, by match count
    // rather than by presence: a second one would be a verdict asserted here
    // instead of read out of `empireCore.ts`'s tables. See §2 of the module's
    // header.
    expect([...code.matchAll(/'idle-only'/g)].length).toBe(3);
    expect([...code.matchAll(/'progression-reaching'/g)].length).toBe(0);

    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let stringsChecked = 0;
    for (const value of [...singleQuoted, ...doubleQuoted, ...templateChunks]) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      stringsChecked += 1;
    }
    expect(stringsChecked).toBe(singleQuoted.size + doubleQuoted.size + templateChunks.size);
    expect(stringsChecked).toBe(31);

    // The pattern is not a dead letter, and the probe is DERIVED from this
    // module's own vocabulary rather than written beside the pattern.
    let probes = 0;
    for (const literal of [...singleQuoted].filter((value) => !value.includes(' '))) {
      const word = literal.replace(/[^A-Za-z]/g, '');
      if (word.length < 2) continue;
      const titled = `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
      expect(personShaped.test(`${titled} ${titled}`), `${titled} is not person-shaped`).toBe(true);
      probes += 1;
    }
    expect(probes).toBe(13);
    // Nothing was silently skipped by the `< 2` guard: a one-letter token would
    // leave a shipped literal unprobed and this is what says so.
    expect(probes).toBe([...singleQuoted].filter((value) => !value.includes(' ')).length);
  });

  it('holds no number of its own', () => {
    // The repository's own audit, run against this file. `reputation.ts` is not
    // a registered constants module, so every literal in it that is not a
    // structural idiom is a finding.
    const findings = auditSource('src/empire/reputation.ts', source);
    expect(findings.length, `\n${formatFindings(findings)}\n`).toBe(0);
    // And the instrument is live on a file it has never seen, so the zero above
    // is not the audit having stopped reporting.
    expect(auditSource('src/empire/probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });
});
