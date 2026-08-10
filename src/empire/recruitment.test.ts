/**
 * recruitment.test.ts — the tests for GDD §5.3 recruitment, and for §12.3's
 * second refusal condition: "random-chance NPC recruitment of any kind".
 *
 * ===========================================================================
 * Why determinism is the weak half of this file and not the strong one
 * ===========================================================================
 *
 * "The same inputs give the same output" is satisfied by a generator seeded
 * from its own arguments, and a generator seeded from an elapsed-seconds
 * argument is a pull with extra steps. So determinism is asserted here, and it
 * is asserted last. The load-bearing checks are about SHAPE:
 *
 *   - `recruitmentQuote` takes a tier and returns that tier, and every other
 *     exported function that names a tier in its result names the one it was
 *     given. Measured over the whole state sweep, with the count pinned.
 *   - `recruitmentBoard` publishes the whole `NPC_TIERS` ladder in its own
 *     order for every state in the sweep, so there is no set of outcomes for
 *     anything to select from.
 *   - The quote is invariant across the entire state grid — reputation, purse,
 *     roster, axes and both clock readings — so no amount of currency changes
 *     what a tier is, costs or pays. That is "no rarity tier reachable by
 *     spending currency" as a measurement rather than as a claim.
 *   - No entropy is reachable: `src/game/prng.ts` exists, is not imported by
 *     anything in the transitive closure of these two modules, and the closure
 *     is pinned by name.
 *
 * ===========================================================================
 * The ban list is READ from its sibling, not copied
 * ===========================================================================
 *
 * `empireCore.test.ts` bans the language of chance from the shipped modules it
 * knows about, and its `shipped` list is pinned at the two files that existed
 * when it was written. Copying its patterns into this file would reproduce
 * exactly the failure CLAUDE.md records: `sessionWiring.test.ts` banned six
 * names from `useSession.ts` and `useMeetDay.ts` contained five of them, one
 * directory over, for six waves, because the twin guard was a copy rather than
 * a reader. So `siblingBanList()` parses the sibling's own array out of its
 * source and applies it here, and pins how many patterns it found — a ban list
 * that shrinks on the other side is red on this one.
 *
 * ===========================================================================
 * The sweep's parameters are written down
 * ===========================================================================
 *
 * `RECRUITMENT_SWEEP` is the named block, for the reason `src/game/streakSweep.ts`
 * exists. It sits in the test file rather than in `empireTuning.ts` because a
 * sweep parameter is not a value a playtester turns, and because a bare number
 * in a shipped `src/empire/` module fails the repository's magic-number audit.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { auditSource, formatFindings } from '../tuning/audit';
import {
  asGymBucks,
  asReputation,
  createEmpireClock,
  createEmpireState,
  createNpcLifter,
  recruitCost,
  recruitReputationThreshold,
  recruitSeconds,
  rosterCapacity,
  type EmpireClock,
  type EmpireState,
  type GymAxes,
  type NpcLifter,
  type NpcTier,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import { npcTrainingIqPerDay } from './npc';
import {
  RECRUITMENT_REFUSALS,
  beginRecruitment,
  completeRecruitment,
  mayRecruit,
  recruitmentBoard,
  recruitmentOffer,
  recruitmentQuote,
  recruitmentRefusals,
  recruitmentSchedule,
  type RecruitmentSchedule,
} from './recruitment';

// ---------------------------------------------------------------------------
// The sweep's parameters, in one named block
// ---------------------------------------------------------------------------

const RECRUITMENT_SWEEP = Object.freeze({
  /** Straddles every entry of `NPC_RECRUIT_REPUTATION_THRESHOLD`, on both sides. */
  REPUTATION: Object.freeze([0, 49, 50, 199, 200, 599, 600, 1499, 1500, 5000] as const),
  /** Straddles every entry of `NPC_RECRUIT_COST_GYM_BUCKS`, on both sides. */
  GYM_BUCKS: Object.freeze([
    0, 499, 500, 1999, 2000, 7999, 8000, 29999, 30000, 89999, 90000, 1000000,
  ] as const),
  SPACE_LEVEL: Object.freeze([0, 3, 5] as const),
  SPOTTER_LEVEL: Object.freeze([0, 4] as const),
  ROSTER_SIZE: Object.freeze([0, 2] as const),
  /** Wall-clock seconds a recruitment is started at. */
  ELAPSED_SECONDS: Object.freeze([0, 3600, 86400, 2592000] as const),
  /**
   * Seconds a purchasable accelerant has pushed the idle clock forward by. The
   * zero row is the baseline the others are compared against element-wise.
   */
  SKIP_SECONDS: Object.freeze([0, 3600, 86400, 604800, 2592000] as const),
  /** Wall-clock days the composed Training IQ series is read at. */
  HORIZON_DAYS: Object.freeze([0, 1, 5, 15, 30, 90] as const),
  /** How many interleaved repeats the no-hidden-state check drives. */
  REPEATS: 40,
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SECONDS_PER_DAY = EMPIRE_TUNING.SECONDS_PER_DAY;
const TIERS: readonly NpcTier[] = EMPIRE_TUNING.NPC_TIERS;
const OUR_MODULES = Object.freeze(['npc.ts', 'recruitment.ts'] as const);

interface StateOverrides {
  readonly reputation?: number;
  readonly gymBucks?: number;
  /** The wall-clock book. Mirrors the accelerated one unless a case parts them. */
  readonly settledGymBucks?: number;
  /** The wall-clock view of the slots. Mirrors the idle one unless parted. */
  readonly settledSpaceLevel?: number;
  readonly spaceLevel?: number;
  readonly spotter?: number;
  readonly rosterSize?: number;
  readonly elapsed?: number;
  readonly skipped?: number;
}

function stateWith(over: StateOverrides): EmpireState {
  const base = createEmpireState();
  const axes: GymAxes = {
    equipment: base.axes.equipment,
    spaceLevel: over.spaceLevel ?? 0,
    staffLevel: Object.freeze({ coach: 0, spotter: over.spotter ?? 0, physio: 0 }),
  };
  const roster: readonly NpcLifter[] = Array.from({ length: over.rosterSize ?? 0 }, (_, at) =>
    createNpcLifter(`seatholder-${at}`, 'novice', 'Placeholder', 0, 0),
  );
  return Object.freeze({
    ...base,
    clock: createEmpireClock(over.elapsed ?? 0, over.skipped ?? 0),
    axes: Object.freeze(axes),
    // Both books and both views of the ladders, mirrored, because this file
    // sweeps the GATE rather than the split: a fixture whose wall-clock book
    // was empty would refuse every tier for one reason and measure nothing
    // about the other three. The two cases in "a recruit is bought out of the
    // wall-clock book" are where they are deliberately parted.
    settledAxes: Object.freeze({
      ...axes,
      spaceLevel: over.settledSpaceLevel ?? axes.spaceLevel,
    }),
    roster: Object.freeze(roster),
    reputation: asReputation(over.reputation ?? 0),
    gymBucks: asGymBucks(over.gymBucks ?? 0),
    settledGymBucks: asGymBucks(over.settledGymBucks ?? over.gymBucks ?? 0),
  });
}

/** Every state the grid describes. Materialised once; the counts below pin it. */
const SWEPT_STATES: readonly EmpireState[] = (() => {
  const states: EmpireState[] = [];
  for (const reputation of RECRUITMENT_SWEEP.REPUTATION) {
    for (const gymBucks of RECRUITMENT_SWEEP.GYM_BUCKS) {
      for (const spaceLevel of RECRUITMENT_SWEEP.SPACE_LEVEL) {
        for (const spotter of RECRUITMENT_SWEEP.SPOTTER_LEVEL) {
          for (const rosterSize of RECRUITMENT_SWEEP.ROSTER_SIZE) {
            states.push(stateWith({ reputation, gymBucks, spaceLevel, spotter, rosterSize }));
          }
        }
      }
    }
  }
  return Object.freeze(states);
})();

/**
 * The negative control for the clock split: the same schedule with `settlesAt`
 * read off the accelerated clock.
 *
 * GDD §4.4's bar is that a zero be zero against something. This is the variant
 * where a bought GDD §8.3B skip does move the origin the Training IQ half
 * measures tenure from, and its non-zero counts are pinned beside the shipped
 * engine's zeroes.
 */
function mutantSettlesAt(tier: NpcTier, clock: EmpireClock): number {
  return clock.accelerated + recruitSeconds(tier);
}

function lifterFrom(schedule: RecruitmentSchedule, settlesAtSeconds: number): NpcLifter {
  const joinedAt: number = schedule.joinsAt;
  return createNpcLifter('probe', schedule.tier, 'Placeholder', joinedAt, settlesAtSeconds);
}

// ---------------------------------------------------------------------------
// Shape: what you see is what you get
// ---------------------------------------------------------------------------

describe('the quote takes a tier and returns that tier', () => {
  it('publishes the flat cost, the threshold and the timer for every tier', () => {
    let quoted = 0;
    for (const tier of TIERS) {
      const quote = recruitmentQuote(tier);
      expect(quote.tier).toBe(tier);
      expect(quote.costGymBucks).toBe(recruitCost(tier));
      expect(quote.reputationThreshold).toBe(recruitReputationThreshold(tier));
      expect(quote.durationSeconds).toBe(recruitSeconds(tier));
      // Read a second way, off the tuning tables rather than through
      // `empireCore.ts`'s lookups, so a quote assembled from the wrong tier is
      // red on both paths.
      expect(quote.costGymBucks).toBe(EMPIRE_TUNING.NPC_RECRUIT_COST_GYM_BUCKS[tier]);
      expect(quote.reputationThreshold).toBe(
        EMPIRE_TUNING.NPC_RECRUIT_REPUTATION_THRESHOLD[tier],
      );
      quoted += 1;
    }
    expect(quoted).toBe(5);
    expect(quoted).toBe(TIERS.length);
  });

  it('prices every tier differently, so no quote is a constant lookup', () => {
    // Reddens on `recruitCost(NPC_TIERS[0])` — a lookup keyed to anything but
    // the argument collapses these sets to one member each.
    expect(new Set(TIERS.map((tier) => recruitmentQuote(tier).costGymBucks)).size).toBe(5);
    expect(new Set(TIERS.map((tier) => recruitmentQuote(tier).durationSeconds)).size).toBe(5);
    expect(new Set(TIERS.map((tier) => recruitmentQuote(tier).reputationThreshold)).size).toBe(5);
  });

  it('gates the top tier behind a reputation milestone rather than a price', () => {
    // GDD §5.3: the legendary tier "unlocks via reputation milestones, never
    // paid pulls". The threshold is above zero and reachable, which is what
    // makes it a milestone rather than either a formality or dead content.
    const top = TIERS[TIERS.length - 1] as NpcTier;
    expect(top).toBe('legendary');
    const threshold = recruitmentQuote(top).reputationThreshold;
    expect(threshold).toBeGreaterThan(0);
    expect(threshold).toBeLessThanOrEqual(EMPIRE_TUNING.REPUTATION_MAX);
    expect(threshold).toBeGreaterThan(recruitmentQuote(TIERS[0] as NpcTier).reputationThreshold);
  });
});

describe('no rarity tier is reachable by spending currency', () => {
  it('holds the quote byte-identical across the whole state grid', () => {
    // The state grid moves reputation, purse, roster, both axes that pay slots
    // and both clock readings. If any of them reached the quote there would be
    // more than one distinct quote per tier, which is a rarity tier with extra
    // steps.
    let observations = 0;
    for (const tier of TIERS) {
      const distinct = new Set<string>();
      for (const state of SWEPT_STATES) {
        distinct.add(JSON.stringify(recruitmentOffer(state, tier).quote));
        observations += 1;
      }
      expect(distinct.size, `${tier} was quoted more than one way`).toBe(1);
    }
    // Counts, not bounds: an empty grid would make every line above pass.
    expect(SWEPT_STATES.length).toBe(1440);
    expect(observations).toBe(7200);
    expect(observations).toBe(TIERS.length * SWEPT_STATES.length);
  });

  it('refuses a gated tier at every purse, however large', () => {
    // The §5.3 milestone as a measurement: below the threshold, no amount of
    // Gym Bucks makes the tier recruitable. The `richEnough` counter is the
    // non-vacuity guard — a grid whose purses never reached the flat cost would
    // make this pass while testing nothing, which is exactly the "purchase arm
    // at a price that buys nothing" shape CLAUDE.md lists.
    let gatedAndRefused = 0;
    let richEnough = 0;
    for (const tier of TIERS) {
      const quote = recruitmentQuote(tier);
      for (const reputation of RECRUITMENT_SWEEP.REPUTATION) {
        if (reputation >= quote.reputationThreshold) continue;
        for (const gymBucks of RECRUITMENT_SWEEP.GYM_BUCKS) {
          const state = stateWith({ reputation, gymBucks, spaceLevel: 5, spotter: 4 });
          expect(mayRecruit(state, tier), `${tier} unlocked at ${gymBucks} bucks`).toBe(false);
          expect(recruitmentRefusals(state, tier)).toContain('reputation-below-threshold');
          gatedAndRefused += 1;
          if (gymBucks >= quote.costGymBucks) richEnough += 1;
        }
      }
    }
    expect(gatedAndRefused).toBe(240);
    expect(richEnough).toBe(80);
  });

  it('publishes the whole ladder, in ladder order, for every state', () => {
    // "No outcome set from which one member is selected." The board is a
    // catalogue: a tier a gym cannot afford is shown priced and refused rather
    // than hidden. Reddens on any `.filter`, any reordering and any subsetting.
    const ladder = [...TIERS];
    let boards = 0;
    let refusedRows = 0;
    for (const state of SWEPT_STATES) {
      const board = recruitmentBoard(state);
      expect(board.map((offer) => offer.quote.tier)).toEqual(ladder);
      expect(board.length).toBe(TIERS.length);
      for (const offer of board) if (!offer.available) refusedRows += 1;
      boards += 1;
    }
    expect(boards).toBe(1440);
    // The board really does refuse things, so the equality above is not being
    // taken on a grid where everything is available anyway.
    expect(refusedRows).toBe(4780);
  });

  it('reads the ladder in exactly one place, and that place is the board', () => {
    // The source half of the claim above. A second reader of `NPC_TIERS` in
    // these modules would be a second place a tier could be produced from
    // something that is not a tier. Match COUNTS are pinned rather than
    // presence: a pattern with more than one witness in a file is a textual pin
    // this codebase has been bitten by.
    const recruitment = readModule('recruitment.ts');
    const npc = readModule('npc.ts');
    expect(countOf(recruitment, /NPC_TIERS/g)).toBe(1);
    expect(countOf(npc, /NPC_TIERS/g)).toBe(0);
    expect(
      countOf(recruitment, /export function recruitmentBoard[\s\S]*?NPC_TIERS\.map\(/g),
    ).toBe(1);
    // And the scan is live: it sees the declarations it is scoped over.
    expect(countOf(recruitment, /export function /g)).toBe(8);
    expect(countOf(npc, /export function /g)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

describe('eligibility', () => {
  it('refuses on reputation, purse and slots, in the published order', () => {
    const broke = stateWith({ reputation: 0, gymBucks: 0, rosterSize: 2 });
    expect(recruitmentRefusals(broke, 'legendary')).toEqual([...RECRUITMENT_REFUSALS]);
    expect(RECRUITMENT_REFUSALS).toEqual([
      'reputation-below-threshold',
      'gym-bucks-below-cost',
      'roster-at-capacity',
    ]);
    expect(mayRecruit(broke, 'legendary')).toBe(false);
  });

  it('turns on exactly at the published threshold and the published price', () => {
    let boundaries = 0;
    for (const tier of TIERS) {
      const quote = recruitmentQuote(tier);
      const rich = { gymBucks: quote.costGymBucks, spaceLevel: 5, spotter: 4 };
      if (quote.reputationThreshold > 0) {
        expect(
          mayRecruit(stateWith({ ...rich, reputation: quote.reputationThreshold - 1 }), tier),
        ).toBe(false);
      }
      expect(mayRecruit(stateWith({ ...rich, reputation: quote.reputationThreshold }), tier)).toBe(
        true,
      );
      const gated = { reputation: quote.reputationThreshold, spaceLevel: 5, spotter: 4 };
      if (quote.costGymBucks > 0) {
        expect(mayRecruit(stateWith({ ...gated, gymBucks: quote.costGymBucks - 1 }), tier)).toBe(
          false,
        );
      }
      expect(mayRecruit(stateWith({ ...gated, gymBucks: quote.costGymBucks }), tier)).toBe(true);
      boundaries += 1;
    }
    expect(boundaries).toBe(5);
  });

  it('refuses at capacity and allows one slot below it, on both axes', () => {
    let cases = 0;
    for (const spaceLevel of RECRUITMENT_SWEEP.SPACE_LEVEL) {
      for (const spotter of RECRUITMENT_SWEEP.SPOTTER_LEVEL) {
        const axes: GymAxes = {
          equipment: createEmpireState().axes.equipment,
          spaceLevel,
          staffLevel: Object.freeze({ coach: 0, spotter, physio: 0 }),
        };
        const capacity = rosterCapacity(axes);
        const full = stateWith({ gymBucks: 1000000, spaceLevel, spotter, rosterSize: capacity });
        const room = stateWith({ gymBucks: 1000000, spaceLevel, spotter, rosterSize: capacity - 1 });
        expect(recruitmentRefusals(full, 'novice')).toEqual(['roster-at-capacity']);
        expect(recruitmentRefusals(room, 'novice')).toEqual([]);
        cases += 1;
      }
    }
    expect(cases).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// The clock split, measured element-wise
// ---------------------------------------------------------------------------

describe('a purchasable skip moves when a recruit joins and not when they settled', () => {
  const settledSeries = (
    read: (tier: NpcTier, clock: EmpireClock) => number,
    tier: NpcTier,
    skip: number,
  ): readonly number[] =>
    RECRUITMENT_SWEEP.ELAPSED_SECONDS.map((elapsed) =>
      read(tier, createEmpireClock(elapsed, skip)),
    );

  const shipped = (tier: NpcTier, clock: EmpireClock): number =>
    recruitmentSchedule(tier, clock).settlesAt;
  const joins = (tier: NpcTier, clock: EmpireClock): number =>
    recruitmentSchedule(tier, clock).joinsAt;

  it('leaves the settled-at list byte-identical under every skip', () => {
    let comparisons = 0;
    let elements = 0;
    for (const tier of TIERS) {
      const baseline = settledSeries(shipped, tier, 0);
      for (const skip of RECRUITMENT_SWEEP.SKIP_SECONDS) {
        const moved = settledSeries(shipped, tier, skip);
        expect(moved, `${tier} settled differently under a ${skip}s skip`).toEqual(baseline);
        comparisons += 1;
        elements += moved.length;
      }
    }
    expect(comparisons).toBe(25);
    expect(elements).toBe(100);
  });

  it('moves the negative control, so the zero above is zero against something', () => {
    let movedElements = 0;
    for (const tier of TIERS) {
      const baseline = settledSeries(mutantSettlesAt, tier, 0);
      for (const skip of RECRUITMENT_SWEEP.SKIP_SECONDS) {
        settledSeries(mutantSettlesAt, tier, skip).forEach((value, at) => {
          if (value !== baseline[at]) movedElements += 1;
        });
      }
    }
    expect(movedElements).toBe(80);
    // The control agrees with the shipped engine where there is no skip, so the
    // difference above is the skip and not two unrelated formulas.
    expect(settledSeries(mutantSettlesAt, 'club', 0)).toEqual(settledSeries(shipped, 'club', 0));
  });

  it('does move the join time, because that is what GDD §8.3B sells', () => {
    let movedElements = 0;
    for (const tier of TIERS) {
      const baseline = settledSeries(joins, tier, 0);
      for (const skip of RECRUITMENT_SWEEP.SKIP_SECONDS) {
        settledSeries(joins, tier, skip).forEach((value, at) => {
          if (value !== baseline[at]) movedElements += 1;
        });
      }
    }
    expect(movedElements).toBe(80);
  });

  it('leaves the composed Training IQ series byte-identical under every skip', () => {
    // The end of the chain rather than the middle of it: a recruit started
    // under a skip, completed, and then read for Training IQ at every horizon.
    // This is the list GDD §8.1 is actually about, and §4.4 is explicit that an
    // aggregate will not do.
    const series = (tier: NpcTier, skip: number, settlesAt: (t: NpcTier, c: EmpireClock) => number) => {
      const clock = createEmpireClock(0, skip);
      const schedule = recruitmentSchedule(tier, clock);
      const lifter = lifterFrom(schedule, settlesAt(tier, clock));
      return RECRUITMENT_SWEEP.HORIZON_DAYS.map((day) =>
        npcTrainingIqPerDay(lifter, createEmpireClock(day * SECONDS_PER_DAY, skip)),
      );
    };

    let comparisons = 0;
    let elements = 0;
    for (const tier of TIERS) {
      const baseline = series(tier, 0, shipped);
      for (const skip of RECRUITMENT_SWEEP.SKIP_SECONDS) {
        const moved = series(tier, skip, shipped);
        expect(moved, `${tier}'s Training IQ moved under a ${skip}s skip`).toEqual(baseline);
        comparisons += 1;
        elements += moved.length;
      }
    }
    expect(comparisons).toBe(25);
    expect(elements).toBe(150);

    // And the same sweep on the control, which does move it.
    let movedElements = 0;
    for (const tier of TIERS) {
      const baseline = series(tier, 0, mutantSettlesAt);
      for (const skip of RECRUITMENT_SWEEP.SKIP_SECONDS) {
        series(tier, skip, mutantSettlesAt).forEach((value, at) => {
          if (value !== baseline[at]) movedElements += 1;
        });
      }
    }
    expect(movedElements).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// Starting and completing
// ---------------------------------------------------------------------------

describe('a recruit is bought out of the wall-clock book and gated on the wall-clock slots', () => {
  // The two halves of §2 of the module header, driven where the two views of a
  // gym disagree. Every other fixture in this file mirrors them, so without
  // these two cases the split would be a rule nothing in this file could tell
  // apart from the rule it replaced.
  const tier: NpcTier = 'novice';
  const price = recruitmentQuote(tier).costGymBucks;

  it('refuses a gym holding the price a hundred times over in the ACCELERATED book', () => {
    // Reddening edit: read `state.gymBucks` in `recruitmentRefusals`.
    const rich = stateWith({
      reputation: EMPIRE_TUNING.REPUTATION_MAX,
      gymBucks: price * 100,
      settledGymBucks: price - 1,
      spaceLevel: 5,
      spotter: 4,
    });
    expect(recruitmentRefusals(rich, tier)).toEqual(['gym-bucks-below-cost']);
    expect(mayRecruit(rich, tier)).toBe(false);
    // One buck of wall-clock earnings later the same gym may recruit, so the
    // refusal above is about which book and not about the tier, the reputation
    // or the slots.
    const earned = stateWith({
      reputation: EMPIRE_TUNING.REPUTATION_MAX,
      gymBucks: price * 100,
      settledGymBucks: price,
      spaceLevel: 5,
      spotter: 4,
    });
    expect(recruitmentRefusals(earned, tier)).toEqual([]);
    expect(mayRecruit(earned, tier)).toBe(true);
  });

  it('counts the slots on the wall clock, so a skipped space build opens none early', () => {
    // The player's gym shows a full space ladder because a purchased skip
    // finished those builds; the wall clock has not reached them. Reddening
    // edit: read `state.axes` in `recruitmentRefusals`.
    const ahead = stateWith({
      reputation: EMPIRE_TUNING.REPUTATION_MAX,
      gymBucks: price * 100,
      settledGymBucks: price * 100,
      spaceLevel: 5,
      settledSpaceLevel: 0,
      rosterSize: 2,
    });
    // The two views really do disagree, or the refusal below is about a gym
    // that was full on both readings.
    expect(rosterCapacity(ahead.axes)).toBe(12);
    expect(rosterCapacity(ahead.settledAxes)).toBe(EMPIRE_TUNING.ROSTER_SLOTS_BASE);
    expect(recruitmentRefusals(ahead, tier)).toEqual(['roster-at-capacity']);
    const caughtUp = stateWith({
      reputation: EMPIRE_TUNING.REPUTATION_MAX,
      gymBucks: price * 100,
      settledGymBucks: price * 100,
      spaceLevel: 5,
      settledSpaceLevel: 5,
      rosterSize: 2,
    });
    expect(recruitmentRefusals(caughtUp, tier)).toEqual([]);
    // And completing a sale asks the same view the verdict asked, rather than
    // the more permissive one beside it.
    expect(() =>
      completeRecruitment(ahead, recruitmentSchedule(tier, ahead.clock), 'late-arrival', 'Placeholder'),
    ).toThrow(RangeError);
  });
});

describe('starting a recruitment', () => {
  const affordable = (tier: NpcTier): EmpireState =>
    stateWith({
      reputation: recruitmentQuote(tier).reputationThreshold,
      gymBucks: recruitmentQuote(tier).costGymBucks,
      spaceLevel: 5,
      spotter: 4,
      elapsed: 86400,
      skipped: 3600,
    });

  it('charges the published price and nothing else', () => {
    let started = 0;
    for (const tier of TIERS) {
      const before = affordable(tier);
      const decision = beginRecruitment(before, tier);
      expect(decision.kind).toBe('accepted');
      if (decision.kind !== 'accepted') throw new Error('unreachable');
      // The WALL-CLOCK book pays, and the accelerated one is untouched. See §2
      // of the module header: a recruit pays Training IQ, so the day this
      // decision can be taken has to be a day no purchase moved, and a price
      // taken out of the accelerated book would make the gate ornamental.
      expect(before.settledGymBucks - decision.state.settledGymBucks).toBe(
        recruitmentQuote(tier).costGymBucks,
      );
      expect(decision.state.settledGymBucks).toBe(0);
      expect(decision.state.gymBucks).toBe(before.gymBucks);
      expect(decision.schedule.tier).toBe(tier);
      started += 1;
    }
    expect(started).toBe(5);
  });

  it('leaves the state alone when it refuses', () => {
    const broke = stateWith({ reputation: 0, gymBucks: 0 });
    const decision = beginRecruitment(broke, 'legendary');
    expect(decision.kind).toBe('refused');
    if (decision.kind !== 'refused') throw new Error('unreachable');
    expect(decision.refusals).toEqual([
      'reputation-below-threshold',
      'gym-bucks-below-cost',
    ]);
    // No `state` on the refused arm at all, so there is no path where a refusal
    // charges. Reddens if the union grows a state field on this side.
    expect(Object.keys(decision).sort()).toEqual(['kind', 'refusals']);
  });

  it('schedules from the state clock on both readings', () => {
    const tier: NpcTier = 'regional';
    const state = affordable(tier);
    const decision = beginRecruitment(state, tier);
    if (decision.kind !== 'accepted') throw new Error('unreachable');
    expect(decision.schedule.settlesAt).toBe(state.clock.unaccelerated + recruitSeconds(tier));
    expect(decision.schedule.joinsAt).toBe(state.clock.accelerated + recruitSeconds(tier));
    // The two readings differ on this fixture, so an implementation that used
    // one clock for both would be red rather than green by coincidence.
    expect(decision.schedule.joinsAt).not.toBe(decision.schedule.settlesAt);
  });

  it('refuses every tier the board refuses, and accepts every tier it offers', () => {
    // The two surfaces cannot disagree: a player who is shown an available
    // offer and then refused would be reading a screen that lied.
    let agreements = 0;
    let accepted = 0;
    for (const state of SWEPT_STATES) {
      for (const offer of recruitmentBoard(state)) {
        const decision = beginRecruitment(state, offer.quote.tier);
        expect(decision.kind).toBe(offer.available ? 'accepted' : 'refused');
        if (decision.kind === 'accepted') accepted += 1;
        agreements += 1;
      }
    }
    expect(agreements).toBe(7200);
    // Both arms are reached, so the equality above is not one branch repeated.
    expect(accepted).toBe(2420);
  });
});

describe('completing a recruitment', () => {
  const ready = (tier: NpcTier): { state: EmpireState; schedule: RecruitmentSchedule } => {
    const decision = beginRecruitment(
      stateWith({
        reputation: EMPIRE_TUNING.REPUTATION_MAX,
        gymBucks: 1000000,
        spaceLevel: 5,
        spotter: 4,
        elapsed: 86400,
        skipped: 3600,
      }),
      tier,
    );
    if (decision.kind !== 'accepted') throw new Error('unreachable');
    return { state: decision.state, schedule: decision.schedule };
  };

  it('puts the scheduled tier on the roster with both of its arrival times', () => {
    let completed = 0;
    for (const tier of TIERS) {
      const { state, schedule } = ready(tier);
      const next = completeRecruitment(state, schedule, `id-${tier}`, 'Placeholder');
      expect(next.roster.length).toBe(state.roster.length + 1);
      const lifter = next.roster[next.roster.length - 1] as NpcLifter;
      expect(lifter.tier).toBe(tier);
      expect(lifter.joinedAt).toBe(schedule.joinsAt);
      expect(lifter.settledAt).toBe(schedule.settlesAt);
      expect(lifter.id).toBe(`id-${tier}`);
      // The two times are different numbers on this fixture, so a completion
      // that crossed them would be red.
      expect(lifter.joinedAt).not.toBe(lifter.settledAt);
      completed += 1;
    }
    expect(completed).toBe(5);
  });

  it('refuses a roster that outgrew its slots between the two calls', () => {
    // CLAUDE.md's "a store verdict may render stale; a completed sale may not",
    // one subsystem over: the timer runs for hours and an axis can be torn
    // down in between.
    const { schedule } = ready('novice');
    const shrunk = stateWith({ rosterSize: 2 });
    expect(rosterCapacity(shrunk.axes)).toBe(2);
    expect(() => completeRecruitment(shrunk, schedule, 'late', 'Placeholder')).toThrow(
      /roster holds 2 of 2 slots/,
    );
  });

  it('refuses a duplicate id through the whole state battery', () => {
    const { state, schedule } = ready('club');
    const once = completeRecruitment(state, schedule, 'same', 'Placeholder');
    expect(() => completeRecruitment(once, schedule, 'same', 'Placeholder')).toThrow(
      /duplicate lifter id same/,
    );
  });

  it('refuses an empty display name and an empty id', () => {
    const { state, schedule } = ready('club');
    expect(() => completeRecruitment(state, schedule, 'ok', '')).toThrow(/displayName/);
    expect(() => completeRecruitment(state, schedule, '', 'Placeholder')).toThrow(/npcId/);
  });
});

// ---------------------------------------------------------------------------
// Determinism — the weak half, asserted last
// ---------------------------------------------------------------------------

describe('nothing here carries state between calls', () => {
  it('gives the same answer under interleaving and repetition', () => {
    // Kills a generator seeded from a module-level counter, which is the shape
    // determinism-by-argument would not catch. It does not kill a generator
    // seeded from the arguments; the shape checks above are what do that, by
    // there being no draw to seed.
    const states = SWEPT_STATES.slice(0, 12);
    const first = new Map<string, string>();
    let calls = 0;
    for (let repeat = 0; repeat < RECRUITMENT_SWEEP.REPEATS; repeat += 1) {
      for (const [at, state] of states.entries()) {
        for (const tier of TIERS) {
          const key = `${at}:${tier}`;
          const seen = JSON.stringify({
            board: recruitmentBoard(state).map((offer) => offer.quote.tier),
            offer: recruitmentOffer(state, tier),
            schedule: recruitmentSchedule(tier, state.clock),
            decision: beginRecruitment(state, tier),
          });
          if (!first.has(key)) first.set(key, seen);
          expect(seen, `${key} changed on repeat ${repeat}`).toBe(first.get(key));
          calls += 1;
        }
      }
    }
    expect(calls).toBe(2400);
    expect(calls).toBe(RECRUITMENT_SWEEP.REPEATS * states.length * TIERS.length);
    expect(first.size).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// No entropy is reachable
// ---------------------------------------------------------------------------

/** A module's source with its comments removed, so a scan reads code only. */
function readModule(name: string): string {
  const source = readFileSync(path.join(HERE, name), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (code.trim().length === 0) throw new Error(`${name} stripped to nothing`);
  return code;
}

function countOf(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

/** A regex literal's source text, turned back into a `RegExp`. */
function parseRegexLiteral(text: string): RegExp {
  const match = /^\/(.*)\/([a-z]*)$/.exec(text.trim());
  if (match === null) throw new Error(`not a regex literal: ${text}`);
  return new RegExp(match[1] as string, match[2] as string);
}

/** The named array of regex literals out of `empireCore.test.ts`'s own source. */
function siblingArray(declaration: RegExp): readonly string[] {
  const source = readFileSync(path.join(HERE, 'empireCore.test.ts'), 'utf8');
  const start = source.search(declaration);
  if (start < 0) throw new Error(`empireCore.test.ts no longer declares ${String(declaration)}`);
  const open = source.indexOf('= [', start) + 2;
  // The close is matched as a bracket on its own line rather than as the first
  // `];` after the open. Two of the sibling's tripwire STRINGS contain `];`
  // inside them — `'const w = weights[0];'` is the first — so an `indexOf`
  // truncated the list at seven entries and the count pin below is what said
  // so. A parser that reads a real value as missing is one of the vacuity
  // shapes CLAUDE.md lists, and this one was caught by pinning the count.
  const tail = source.slice(open).search(/\n\s*\];/);
  if (tail < 0) throw new Error('the sibling declaration is not a closed array');
  const close = open + tail;
  return source
    .slice(open + 1, close)
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter((line) => line.length > 0 && !line.startsWith('//'));
}

describe('no source of entropy is reachable from these two modules', () => {
  it('applies the sibling ban list, read from the sibling rather than copied', () => {
    // The twin guard reads `empireCore.test.ts`'s own array. A pattern removed
    // there is removed here, and a list that shrank is caught by the count.
    const banned = siblingArray(/const banned: readonly RegExp\[\] =/).map(parseRegexLiteral);
    const tripwires = siblingArray(/const tripwires: readonly string\[\] =/).map((text) =>
      text.slice(1, -1).replace(/\\'/g, "'"),
    );
    expect(banned.length).toBe(18);
    expect(tripwires.length).toBe(18);

    let checks = 0;
    for (const name of OUR_MODULES) {
      const code = readModule(name);
      expect(code, `${name} lost its declarations to the comment strip`).toMatch(/export /);
      for (const pattern of banned) {
        expect(code, `${name} must not reach ${String(pattern)}`).not.toMatch(pattern);
        checks += 1;
      }
    }
    expect(checks).toBe(36);
    expect(checks).toBe(OUR_MODULES.length * banned.length);

    // Each pattern is driven against the sibling's own tripwire for it, so a
    // regex that stopped matching anything is red rather than quietly green.
    let live = 0;
    for (const [at, pattern] of banned.entries()) {
      expect(tripwires[at], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
      live += 1;
    }
    expect(live).toBe(18);
  });

  it('bans the vocabulary a pull would be written in, with its own tripwires', () => {
    // The sibling's list is about clocks, hosts and dice. These are about the
    // mechanic GDD §5.3 refuses by name, so they are declared here rather than
    // asked of a file that has no reason to carry them.
    const banned: readonly RegExp[] = [
      /\bprng\b/i,
      /\bcrypto\b/i,
      /\bentropy\b/i,
      /\bpity\b/i,
      /\blootbox\b/i,
      /\blottery\b/i,
      /\bbanner\b/i,
      /\bodds\b/i,
      /\bchance\b/i,
      /\bluck\b/i,
      /\broll\b/i,
      /\bdraw\b/i,
      /\bpull\b/i,
      /\bsample\b/i,
    ];
    const tripwires: readonly string[] = [
      "import { nextFloat } from '../game/prng';",
      'crypto.getRandomValues(bytes)',
      'const entropy = 0;',
      'const pity = 10;',
      'lootbox(tiers)',
      'lottery(tiers)',
      'const banner = tiers;',
      'const odds = 0.1;',
      'const chance = 0.1;',
      'const luck = 1;',
      'roll(tiers)',
      'draw(tiers)',
      'pull(tiers)',
      'sample(tiers)',
    ];
    let checks = 0;
    for (const name of OUR_MODULES) {
      const code = readModule(name);
      for (const pattern of banned) {
        expect(code, `${name} must not reach ${String(pattern)}`).not.toMatch(pattern);
        checks += 1;
      }
    }
    expect(checks).toBe(28);
    expect(checks).toBe(OUR_MODULES.length * banned.length);
    let live = 0;
    for (const [at, pattern] of banned.entries()) {
      expect(tripwires[at], `pattern ${String(pattern)} matches nothing`).toMatch(pattern);
      live += 1;
    }
    expect(live).toBe(14);
  });

  it('keeps a real generator out of the import closure, by walking it', () => {
    // `src/game/prng.ts` exists, so the ban is about a real file rather than
    // about a name nothing answers to. The closure is walked rather than
    // eyeballed: an edge added anywhere inside it — not only in these two
    // modules — moves the pinned list.
    const prngPath = path.join(REPO_ROOT, 'src', 'game', 'prng.ts');
    expect(readFileSync(prngPath, 'utf8').length).toBeGreaterThan(0);

    const closure = new Set<string>();
    const queue = OUR_MODULES.map((name) => path.join(HERE, name));
    let walked = 0;
    while (queue.length > 0) {
      const file = queue.shift() as string;
      if (closure.has(file)) continue;
      closure.add(file);
      walked += 1;
      const code = readModule(path.relative(HERE, file));
      for (const match of code.matchAll(/from\s+'([^']+)'/g)) {
        const specifier = match[1] as string;
        expect(specifier, `${path.basename(file)} imports outside this directory`).toMatch(/^\.\//);
        queue.push(path.join(path.dirname(file), `${specifier.slice(2)}.ts`));
      }
    }
    const names = [...closure].map((file) => path.basename(file)).sort();
    expect(names).toEqual(['empireCore.ts', 'empireTuning.ts', 'npc.ts', 'recruitment.ts']);
    expect(walked).toBe(4);
    expect(closure.has(prngPath)).toBe(false);

    // The walker is live on a file it has never seen: a module importing the
    // generator is caught rather than skipped.
    expect(() => {
      const probe = "import { x } from '../game/prng';\nexport const y = x;\n";
      for (const match of probe.matchAll(/from\s+'([^']+)'/g)) {
        expect(match[1] as string).toMatch(/^\.\//);
      }
    }).toThrow();
  });

  it('names nothing a real athlete, brand or federation could be hiding in', () => {
    // GDD §12.3's last refusal condition, checked on this piece as it is on
    // every other. Neither half adjudicates — no scan can tell a real name from
    // an invented one, and that is the human, name-by-name pass. What they do
    // is make a name arriving visible: the first pins every space-free
    // single-quoted literal these two modules ship, so a new vocabulary token
    // is a decision somebody signs; the second bans a `Capitalised Capitalised`
    // pair across single-quoted, double-quoted AND template text, which is the
    // shape a person's name takes inside a message and is where the sibling
    // scan found its own blind spot.
    const singleQuoted = new Set<string>();
    const doubleQuoted = new Set<string>();
    const templateChunks = new Set<string>();
    let filesRead = 0;
    for (const name of OUR_MODULES) {
      const code = readModule(name);
      for (const match of code.matchAll(/'([^'\\\n]*)'/g)) singleQuoted.add(match[1] as string);
      for (const match of code.matchAll(/"([^"\\\n]*)"/g)) doubleQuoted.add(match[1] as string);
      for (const match of code.matchAll(/`((?:[^`\\]|\\[\s\S])*)`/g)) {
        templateChunks.add((match[1] as string).replace(/\$\{[^}]*\}/g, ' '));
      }
      filesRead += 1;
    }
    expect(filesRead).toBe(2);
    expect(singleQuoted.size).toBe(9);
    expect(doubleQuoted.size).toBe(0);
    expect(templateChunks.size).toBe(1);
    // The template collector really reaches this module's one runtime message,
    // named from the real source in both directions.
    expect(
      [...templateChunks].filter((chunk) => chunk.includes('roster holds')).length,
    ).toBe(1);

    expect([...singleQuoted].filter((literal) => !literal.includes(' ')).sort()).toEqual([
      './empireCore',
      './empireTuning',
      'accepted',
      'gym-bucks',
      'gym-bucks-below-cost',
      'refused',
      'reputation-below-threshold',
      'roster-at-capacity',
      'training-iq',
    ]);

    const personShaped = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;
    let stringsChecked = 0;
    for (const value of [...singleQuoted, ...doubleQuoted, ...templateChunks]) {
      expect(personShaped.test(value), `${value} is shaped like a person's name`).toBe(false);
      stringsChecked += 1;
    }
    expect(stringsChecked).toBe(10);
    expect(stringsChecked).toBe(singleQuoted.size + doubleQuoted.size + templateChunks.size);

    // The pattern is not a dead letter, and the probe is DERIVED from the
    // shipped vocabulary rather than written beside it, so renaming a token
    // renames the probe instead of leaving a literal passing about a token that
    // is gone.
    let probes = 0;
    for (const literal of [...singleQuoted]) {
      const word = literal.replace(/[^A-Za-z]/g, '');
      if (word.length < 2) continue;
      const titled = `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
      expect(personShaped.test(`${titled} ${titled}`), `${titled} is not person-shaped`).toBe(true);
      probes += 1;
    }
    expect(probes).toBe(9);
    expect(probes).toBe(singleQuoted.size);
  });

  it('holds no bare number, by the repository audit run from inside this piece', () => {
    // The magic-number rule, measured on these two files rather than waited for
    // in the tree-wide pass. Neither is a registered constants home, so a bare
    // literal in either is a finding.
    let audited = 0;
    for (const name of OUR_MODULES) {
      const relPath = `src/empire/${name}`;
      const source = readFileSync(path.join(HERE, name), 'utf8');
      const findings = auditSource(relPath, source);
      expect(findings.length, `${relPath}\n${formatFindings(findings)}`).toBe(0);
      audited += 1;
    }
    expect(audited).toBe(2);
    // The instrument is live on a file it has never seen, so the two zeroes
    // above are not an audit that stopped reporting.
    expect(auditSource('src/empire/__probe.ts', 'export const RATE = 42;\n').length).toBe(1);
  });
});

describe('the exported surface is pinned, so a new producer of a tier is a signed diff', () => {
  it('lists exactly what these two modules export', () => {
    const exportsOf = (name: string): readonly string[] =>
      [
        ...readModule(name).matchAll(
          /export (?:function|const|interface|type) ([A-Za-z_$][\w$]*)/g,
        ),
      ]
        .map((match) => match[1] as string)
        .sort();
    expect(exportsOf('npc.ts')).toEqual([
      'NpcOutputRates',
      'idleLoyaltyMultiplier',
      'npcGymBucksPerHour',
      'npcOutputRates',
      'npcTierOutputMultiplier',
      'npcTrainingIqPerDay',
      'rosterGymBucksPerHour',
      'rosterOutputRates',
      'rosterTrainingIqPerDay',
      'settledLoyaltyMultiplier',
    ]);
    expect(exportsOf('recruitment.ts')).toEqual([
      'RECRUITMENT_REFUSALS',
      'RecruitmentDecision',
      'RecruitmentOffer',
      'RecruitmentQuote',
      'RecruitmentRefusal',
      'RecruitmentSchedule',
      'beginRecruitment',
      'completeRecruitment',
      'mayRecruit',
      'recruitmentBoard',
      'recruitmentOffer',
      'recruitmentQuote',
      'recruitmentRefusals',
      'recruitmentSchedule',
    ]);
  });
});
