import { describe, expect, it } from 'vitest';

import { budgetFrom } from '../../tools/testBudget.mjs';
import { addDays, asStreakDay, type StreakDay } from '../game/streak';
import { CAREER_TUNING, CAREER_COPY, MEET_TIER_ORDER } from './careerTuning';
import { tierIndex } from './federation';
import {
  careerMeetFor,
  meetDaysForTier,
  scheduledMeets,
  seasonAnchorDay,
  upcomingMeets,
  type CareerMeet,
} from './calendar';
import {
  ATTENDANCE_SWEEP,
  CAMPAIGN_CALENDAR_VARIANTS,
  CAMPAIGN_SUMMIT_SWEEP,
  ENTRY_VARIANTS,
  QUALIFICATION_VARIANTS,
  STRENGTH_SWEEP,
  badDayCount,
  campaignArcs,
  careerAfter,
  enteredDaysOfTier,
  lastEnteredDayOf,
  measureCampaignReach,
  qualificationKey,
  seasonMeetsOfTier,
  seasonMoments,
  seededCareerTotals,
  seriesDays,
  shippedEntryList,
  simulateSeason,
  strengthGrid,
  tierOccurrenceOf,
  variantCalendar,
  type EntryVariant,
  type QualificationVariant,
  type RecordVariant,
  type SeasonMeet,
} from './careerSweep';
import {
  CAREER_LIFTER_KEYS,
  ENTRY_REFUSAL_REASONS,
  canEnter,
  careerRecordAfterMeet,
  enterableMeets,
  entryVerdict,
  meetsQualifyingTotal,
  newCareerLifter,
  qualifiedMeets,
  qualifiedTiers,
  qualifiesFor,
  type CareerLifter,
  type EntryVerdict,
} from './eligibility';

const ANCHOR = seasonAnchorDay();

function lifterWith(bestTotalKg: number | null, entered: readonly string[] = []): CareerLifter {
  return { federationId: 'meridian', bestTotalKg, enteredMeetIds: entered };
}

// ---------------------------------------------------------------------------
// Qualification
// ---------------------------------------------------------------------------

describe('qualifying totals', () => {
  it('an open tier is cleared by a lifter who has never competed', () => {
    expect(meetsQualifyingTotal(null, null)).toBe(true);
    expect(qualifiedTiers(null)).toEqual(['local']);
  });

  it('a gated tier is not cleared without a total', () => {
    expect(meetsQualifyingTotal(null, 400)).toBe(false);
  });

  it('the bar is made, not beaten: exactly the qualifying total qualifies', () => {
    expect(meetsQualifyingTotal(400, 400)).toBe(true);
    expect(meetsQualifyingTotal(399.5, 400)).toBe(false);
  });

  it('tiers open as the total rises, and never close', () => {
    expect(qualifiedTiers(0)).toEqual(['local']);
    expect(qualifiedTiers(400)).toEqual(['local', 'regional']);
    expect(qualifiedTiers(550)).toEqual(['local', 'regional', 'nationals']);
    expect(qualifiedTiers(600)).toEqual(['local', 'regional', 'nationals', 'campaign-worlds']);
    expect(qualifiedTiers(650)).toEqual([
      'local',
      'regional',
      'nationals',
      'campaign-worlds',
      'competitive-worlds',
    ]);
  });

  it('refuses a total that is not a finite number', () => {
    expect(() => meetsQualifyingTotal(Number.NaN, 400)).toThrow(RangeError);
    expect(() => meetsQualifyingTotal(Number.POSITIVE_INFINITY, 400)).toThrow(RangeError);
  });

  it('another federation’s meet is not qualified for at any total', () => {
    const meet = careerMeetFor('ironline', 'local', ANCHOR);
    expect(qualifiesFor(lifterWith(1000), meet)).toBe(false);
    expect(qualifiesFor({ ...lifterWith(1000), federationId: 'ironline' }, meet)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

describe('entry verdicts', () => {
  const localDay = addDays(ANCHOR, 7);
  const local = careerMeetFor('meridian', 'local', localDay);

  it('opens for a lifter of the right federation on or before the day', () => {
    expect(entryVerdict(lifterWith(null), local, ANCHOR)).toEqual({ kind: 'open' });
    expect(entryVerdict(lifterWith(null), local, localDay)).toEqual({ kind: 'open' });
  });

  it('refuses the day after, and that is the boundary', () => {
    expect(canEnter(lifterWith(null), local, localDay)).toBe(true);
    expect(entryVerdict(lifterWith(null), local, addDays(localDay, 1))).toMatchObject({
      kind: 'refused',
      reason: 'MEET_HAS_PASSED',
    });
  });

  it('refuses a meet already competed at', () => {
    expect(entryVerdict(lifterWith(700, [local.id]), local, ANCHOR)).toMatchObject({
      kind: 'refused',
      reason: 'ALREADY_ENTERED',
    });
  });

  it('refuses a tier the total does not reach', () => {
    const worlds = careerMeetFor('meridian', 'competitive-worlds', addDays(ANCHOR, 6));
    expect(entryVerdict(lifterWith(649), worlds, ANCHOR)).toMatchObject({
      kind: 'refused',
      reason: 'BELOW_QUALIFYING_TOTAL',
    });
    expect(entryVerdict(lifterWith(650), worlds, ANCHOR)).toEqual({ kind: 'open' });
  });

  it('every refusal carries the sentence its own reason is keyed to', () => {
    // The sentence is read from the reason the verdict was refused for, so a
    // screen cannot show one refusal's copy under another's verdict. Swapping
    // two entries in CAREER_COPY.ENTRY_REFUSAL reddens this.
    for (const reason of ENTRY_REFUSAL_REASONS) {
      expect(CAREER_COPY.ENTRY_REFUSAL[reason]).toBeTruthy();
    }
    const passed = entryVerdict(lifterWith(null), local, addDays(localDay, 1));
    expect(passed).toEqual({
      kind: 'refused',
      reason: 'MEET_HAS_PASSED',
      sentence: CAREER_COPY.ENTRY_REFUSAL.MEET_HAS_PASSED,
    });
    const entered = entryVerdict(lifterWith(null, [local.id]), local, ANCHOR);
    expect(entered).toEqual({
      kind: 'refused',
      reason: 'ALREADY_ENTERED',
      sentence: CAREER_COPY.ENTRY_REFUSAL.ALREADY_ENTERED,
    });
    expect(CAREER_COPY.ENTRY_REFUSAL.ALREADY_ENTERED).not.toBe(
      CAREER_COPY.ENTRY_REFUSAL.MEET_HAS_PASSED,
    );
  });

  it('the refusal order is the one the header states, walked to the bottom of the chain', () => {
    // Another federation's meet, already entered, long past, and above the
    // lifter's total. Lifting one failing condition at a time walks the whole
    // chain, and the walk is what makes the order a fact rather than a comment.
    //
    // IT USED TO STOP AT THE THIRD RUNG. Three of the four positions were
    // exercised and `BELOW_QUALIFYING_TOTAL` — the last check, the one every
    // reordering of the other three still leaves at the bottom — was reached by
    // no case here, so the claim above it covered a position nothing drove.
    const foreignWorlds = careerMeetFor('ironline', 'competitive-worlds', ANCHOR);
    const ownWorlds = careerMeetFor('meridian', 'competitive-worlds', ANCHOR);
    const longAfter = addDays(ANCHOR, 400);
    const chain: readonly [string, EntryVerdict, string][] = [
      // All four fail.
      [
        'four conditions failing',
        entryVerdict(lifterWith(null, [foreignWorlds.id]), foreignWorlds, longAfter),
        'WRONG_FEDERATION',
      ],
      // The federation is right; the other three still fail.
      [
        'three, the federation lifted',
        entryVerdict(lifterWith(null, [ownWorlds.id]), ownWorlds, longAfter),
        'ALREADY_ENTERED',
      ],
      // ...and they have not been to it. Two left.
      ['two, never been to it', entryVerdict(lifterWith(null), ownWorlds, longAfter), 'MEET_HAS_PASSED'],
      // ...and the day has not gone. One left, which is the rung the old
      // version of this test never reached.
      ['one, the day still open', entryVerdict(lifterWith(null), ownWorlds, ANCHOR), 'BELOW_QUALIFYING_TOTAL'],
      // ...and they are strong enough for it. Nothing left to refuse.
      ['none, strong enough', entryVerdict(lifterWith(650), ownWorlds, ANCHOR), 'open'],
    ];
    // Rung by rung rather than as one array comparison, so a swapped pair of
    // checks fails with the rung's name and both reasons in the message. The
    // array form reddened with `expected [ 'WRONG_FEDERATION', …(4) ] to deeply
    // equal [ 'WRONG_FEDERATION', …(4) ]`, which is a red that tells a reader
    // nothing.
    for (const [label, verdict, reason] of chain) {
      expect(verdict.kind === 'refused' ? verdict.reason : 'open', label).toBe(reason);
    }
    // The chain is the whole list, in the order the module declares it, so a
    // fifth reason cannot be added without a rung here to reach it.
    expect(
      chain.filter(([, verdict]) => verdict.kind === 'refused').map(([, , reason]) => reason).sort(),
      'every declared refusal is reached by a rung',
    ).toEqual([...ENTRY_REFUSAL_REASONS].sort());
  });
});

// ---------------------------------------------------------------------------
// The list a calendar screen draws
// ---------------------------------------------------------------------------

describe('the enterable list', () => {
  it('a new lifter sees every local meet in the horizon and nothing else', () => {
    const lifter = newCareerLifter('meridian');
    const enterable = enterableMeets(lifter, ANCHOR);
    expect(enterable).toHaveLength(53);
    expect(new Set(enterable.map((meet) => meet.tier))).toEqual(new Set(['local']));
    expect(upcomingMeets('meridian', ANCHOR)).toHaveLength(86);
  });

  it('entering a meet removes that meet and leaves the rest of the list alone', () => {
    // The one place the enterable list may shrink, and it is not a punishment:
    // a dated event you have competed at is spent. Measured as an exact set
    // difference rather than as a count, so a rule that dropped a second meet
    // would redden even though the count moved by the same one.
    const lifter = newCareerLifter('meridian');
    const before = enterableMeets(lifter, ANCHOR);
    const target = before[3];
    expect(target).toBeDefined();
    const after = enterableMeets(
      careerRecordAfterMeet(lifter, (target as CareerMeet).id, 500),
      ANCHOR,
    );
    const removed = before.filter((meet) => !after.some((kept) => kept.id === meet.id));
    const added = after.filter((meet) => !before.some((kept) => kept.id === meet.id));
    expect(removed.map((meet) => meet.id)).toEqual([(target as CareerMeet).id]);
    // The 500 kg on that meet clears the regional bar, so the list also GAINS
    // the whole regional series. Pinned as a count and a tier rather than left
    // as "some meets appeared": a rule that added a nationals meet too would
    // pass a bare length check that happened to agree.
    expect(added).toHaveLength(26);
    expect(new Set(added.map((meet) => meet.tier))).toEqual(new Set(['regional']));
  });

  it('a held meet drops out of the list and the horizon rolls a new one in', () => {
    // Stated because a reader meeting the monotonicity sweeps below will ask
    // whether time passing shrinks the list. It does not: the horizon is
    // measured from `today`, so a meet leaving the front is replaced at the
    // back. What time does is change WHICH meets, and a meet that has been
    // held is gone for everyone equally rather than for the lifter who trained.
    const lifter = newCareerLifter('meridian');
    const now = enterableMeets(lifter, ANCHOR);
    const later = enterableMeets(lifter, addDays(ANCHOR, 180));
    const first = now[0] as CareerMeet;
    expect(first.day).toBe(ANCHOR);
    expect(later.some((meet) => meet.id === first.id)).toBe(false);
    expect(later.some((meet) => meet.day > (now[now.length - 1] as CareerMeet).day)).toBe(true);
    // 53 against 52 is the inclusive window, not attrition: a window that opens
    // ON a local meet day closes on one too, and day 180 is not a local day.
    expect(now).toHaveLength(53);
    expect(later).toHaveLength(52);
  });
});

// ---------------------------------------------------------------------------
// Recording a meet
// ---------------------------------------------------------------------------

describe('the career record after a meet', () => {
  it('takes the best total, not the latest', () => {
    const after = careerRecordAfterMeet(lifterWith(600), 'meridian-local-2026-01-10', 500);
    expect(after.bestTotalKg).toBe(600);
    expect(careerRecordAfterMeet(lifterWith(600), 'x', 700).bestTotalKg).toBe(700);
    expect(careerRecordAfterMeet(lifterWith(null), 'x', 500).bestTotalKg).toBe(500);
  });

  it('recording the same meet twice is the same as recording it once', () => {
    const once = careerRecordAfterMeet(lifterWith(400), 'meridian-local-2026-01-10', 500);
    const twice = careerRecordAfterMeet(once, 'meridian-local-2026-01-10', 500);
    expect(twice).toEqual(once);
    expect(twice.enteredMeetIds).toEqual(['meridian-local-2026-01-10']);
  });

  it('refuses a total that is not a finite number', () => {
    expect(() => careerRecordAfterMeet(lifterWith(400), 'x', Number.NaN)).toThrow(RangeError);
  });

  it('eligibility reads exactly three facts about a lifter, and none is a balance', () => {
    // GDD §12.3: nothing purchasable may affect meet performance, and which
    // meets you may enter is upstream of every meet result. The compile-time
    // half is CAREER_ELIGIBILITY_READS_NO_WALLET in eligibility.ts; this is the
    // runtime half, which catches a key added to the object but not the type.
    expect([...CAREER_LIFTER_KEYS].sort()).toEqual([
      'bestTotalKg',
      'enteredMeetIds',
      'federationId',
    ]);
    expect(Object.keys(newCareerLifter('meridian')).sort()).toEqual([...CAREER_LIFTER_KEYS].sort());
    expect(
      Object.keys(careerRecordAfterMeet(newCareerLifter('meridian'), 'x', 500)).sort(),
    ).toEqual([...CAREER_LIFTER_KEYS].sort());
  });
});

// ---------------------------------------------------------------------------
// AXIS A — strength
// ---------------------------------------------------------------------------

interface StrengthMeasurement {
  readonly gridSize: number;
  readonly meetsInWindow: number;
  readonly distinctSetSizes: number;
  readonly pairs: number;
  /** Pairs whose two qualified sets are not the same size. */
  readonly differingPairs: number;
  /** Pairs where the stronger lifter qualifies for something the weaker does not. */
  readonly growingPairs: number;
  /** Pairs where the weaker lifter qualifies for something the stronger does not. */
  readonly violatingPairs: number;
  /** The most meets a stronger lifter was ever missing. */
  readonly worstDeficit: number;
}

/**
 * One implementation, two arms. The shipped rule and the control are measured
 * by this function and by nothing else, so the control cannot be measured on a
 * friendlier population than the rule it is a control for.
 */
function measureStrengthAxis(variant: QualificationVariant): StrengthMeasurement {
  const rule = QUALIFICATION_VARIANTS[variant];
  const grid = strengthGrid();
  const from = addDays(seasonAnchorDay(), STRENGTH_SWEEP.WINDOW_START_OFFSET_DAYS);
  const to = addDays(from, STRENGTH_SWEEP.WINDOW_DAYS);
  const window = scheduledMeets(STRENGTH_SWEEP.FEDERATION, from, to);
  const sets = grid.map((bestTotalKg) => {
    const lifter: CareerLifter = {
      federationId: STRENGTH_SWEEP.FEDERATION,
      bestTotalKg,
      enteredMeetIds: [],
    };
    return new Set(window.filter((meet) => rule(lifter, meet)).map((meet) => meet.id));
  });

  let pairs = 0;
  let differingPairs = 0;
  let growingPairs = 0;
  let violatingPairs = 0;
  let worstDeficit = 0;
  for (let weakIndex = 0; weakIndex < sets.length; weakIndex += 1) {
    for (let strongIndex = weakIndex + 1; strongIndex < sets.length; strongIndex += 1) {
      const weaker = sets[weakIndex] as Set<string>;
      const stronger = sets[strongIndex] as Set<string>;
      pairs += 1;
      let missing = 0;
      for (const id of weaker) if (!stronger.has(id)) missing += 1;
      let gained = 0;
      for (const id of stronger) if (!weaker.has(id)) gained += 1;
      if (missing > 0) violatingPairs += 1;
      if (gained > 0) growingPairs += 1;
      if (missing > worstDeficit) worstDeficit = missing;
      if (weaker.size !== stronger.size) differingPairs += 1;
    }
  }
  return {
    gridSize: grid.length,
    meetsInWindow: window.length,
    distinctSetSizes: new Set(sets.map((set) => set.size)).size,
    pairs,
    differingPairs,
    growingPairs,
    violatingPairs,
    worstDeficit,
  };
}

describe('AXIS A — a higher best Total never qualifies for fewer meets', () => {
  it('[strength-never-removes-a-meet] every ordered pair on the grid, and the control beside it', () => {
    const shipped = measureStrengthAxis('shipped');
    const control = measureStrengthAxis('highest-tier-band');

    // THE PROPERTY IS ASSERTED FIRST, DELIBERATELY. Vitest stops a test at its
    // first failing expectation, so whichever assertion comes first is the one
    // that speaks when the module breaks. Putting the domain pins above this
    // line made a mutation of `qualifiesFor` report "expected 1200 to be 55701"
    // — true, and about the sweep's population rather than about the guarantee.
    // The domain pins below still run whenever this one passes, which is the
    // only case where their order matters at all.
    expect(shipped.violatingPairs).toBe(0);
    expect(shipped.worstDeficit).toBe(0);

    // The domain, pinned as counts rather than as bounds. An empty grid, an
    // empty window or a rule that put every lifter in the same set would leave
    // the zero above true and meaningless; these say it is not.
    expect(shipped.gridSize).toBe(402);
    expect(shipped.meetsInWindow).toBe(86);
    expect(shipped.pairs).toBe(80601);
    expect(shipped.distinctSetSizes).toBe(5);
    // These two coincide at 55701 and are not the same question: one asks
    // whether the sets are different SIZES, the other whether the stronger
    // lifter holds something the weaker does not. A rule producing equal-sized
    // but different sets separates them, so neither subsumes the other here.
    expect(shipped.differingPairs).toBe(55701);
    expect(shipped.growingPairs).toBe(55701);

    // The control: one plausible design — a lifter may only enter the highest
    // tier they have qualified for — measured on the same grid, the same
    // window and the same comparison. 55701 of the 80601 pairs violate, and a
    // stronger lifter loses as many as 53 meets.
    //
    // ITS DOMAIN IS ASSERTED EQUAL TO THE SHIPPED ONE rather than printed and
    // left. A control measured on a smaller grid or a shorter window would
    // still report a big number and would be evidence about a different
    // population than the zero above.
    expect(control.gridSize).toBe(shipped.gridSize);
    expect(control.meetsInWindow).toBe(shipped.meetsInWindow);
    expect(control.pairs).toBe(shipped.pairs);
    expect(control.distinctSetSizes).toBe(shipped.distinctSetSizes);
    expect(control.differingPairs).toBe(shipped.differingPairs);
    expect(control.growingPairs).toBe(shipped.growingPairs);
    expect(control.violatingPairs).toBe(55701);
    expect(control.worstDeficit).toBe(53);
  });

  it('qualification does not read the meets a lifter has already competed at', () => {
    // WHY THIS SITS UNDER AXIS A. The sweep above builds all 402 grid lifters
    // with an empty `enteredMeetIds`, and a reader is entitled to ask whether
    // that hides something. It does not, and this is the check that says so
    // rather than the comment: the same grid, asked the same question, with
    // every meet in the window on the lifter's record instead of none.
    //
    // It is the reason axis B is blind to entry as well — `qualifiedMeets` is
    // `qualifiesFor` over a window — and therefore the reason axis C exists.
    // Deleting `qualifiesFor`'s federation check leaves this green and reddens
    // axis A; adding an `enteredMeetIds` term to it reddens this and leaves
    // axis A green, which is what makes the two different questions.
    const from = addDays(seasonAnchorDay(), STRENGTH_SWEEP.WINDOW_START_OFFSET_DAYS);
    const to = addDays(from, STRENGTH_SWEEP.WINDOW_DAYS);
    const window = scheduledMeets(STRENGTH_SWEEP.FEDERATION, from, to);
    const everyMeet = window.map((meet) => meet.id);
    let compared = 0;
    for (const bestTotalKg of strengthGrid()) {
      const blank: CareerLifter = {
        federationId: STRENGTH_SWEEP.FEDERATION,
        bestTotalKg,
        enteredMeetIds: [],
      };
      const veteran: CareerLifter = { ...blank, enteredMeetIds: everyMeet };
      expect(qualifiedMeets(veteran, from, to).map((meet) => meet.id)).toEqual(
        qualifiedMeets(blank, from, to).map((meet) => meet.id),
      );
      // AND THE SAME FACT AS THE MEMO KEY, which is what licenses axis B to ask
      // this question once per distinct key instead of once per lifter. The two
      // lifters above differ in the one field `qualificationKey` drops, so if
      // the key is complete they share it — and if `qualifiesFor` ever grows an
      // `enteredMeetIds` term, this line and the one above it go red together
      // before anything downstream can memoise the wrong answer.
      expect(qualificationKey(veteran)).toBe(qualificationKey(blank));
      compared += 1;
    }
    // Counts, not bounds: an empty grid would satisfy the loop above silently.
    expect(compared).toBe(402);
    expect(everyMeet).toHaveLength(86);
    // And the key is not vacuously constant: two lifters who differ in a field
    // it DOES carry get different keys, so the memo above cannot be a memo on
    // nothing.
    expect(qualificationKey(lifterWith(500))).not.toBe(qualificationKey(lifterWith(600)));
    expect(qualificationKey(lifterWith(500))).not.toBe(
      qualificationKey({ ...lifterWith(500), federationId: 'ironline' }),
    );
  });

  it('the grid is ordered, so pair order is total order', () => {
    // The sweep above reads index order as strength order. If the grid stopped
    // being sorted, every pair would be compared in an arbitrary direction and
    // the zero would mean nothing.
    const grid = strengthGrid();
    expect(grid[0]).toBeNull();
    for (let index = 2; index < grid.length; index += 1) {
      expect(grid[index] as number).toBeGreaterThan(grid[index - 1] as number);
    }
    expect(grid[grid.length - 1]).toBe(STRENGTH_SWEEP.MAX_TOTAL_KG);
  });
});

// ---------------------------------------------------------------------------
// AXIS B — attendance
// ---------------------------------------------------------------------------

interface AttendanceMeasurement {
  readonly seasons: number;
  readonly seasonLengths: readonly number[];
  readonly badDays: number;
  /** Worlds meets competed at across every simulated season. */
  readonly worldsEntries: number;
  readonly pairs: number;
  /** Pairs where the two lifters' qualified sets are not the same size. */
  readonly movedPairs: number;
  /** Pairs where the lifter who competed more qualifies for fewer meets. */
  readonly violatingPairs: number;
  readonly worstDeficit: number;
}

/**
 * One implementation, every arm, for the same reason as the strength axis.
 *
 * The careers come from `seasonMoments`, which advances the previous moment's
 * lifters instead of re-folding each one from the top of the season, and the
 * qualified sets are memoised on `qualificationKey`. Both are the same
 * measurement with arithmetic removed rather than pairs removed, and both have
 * their own check: the generator is driven against `careerAfter` over a whole
 * triangle of moments below, and the memo key's completeness is what the
 * entry-blindness test under axis A asserts.
 */
function measureAttendanceAxis(variant: RecordVariant): AttendanceMeasurement {
  let pairs = 0;
  let movedPairs = 0;
  let violatingPairs = 0;
  let worstDeficit = 0;
  let badDays = 0;
  let worldsEntries = 0;
  const seasonLengths: number[] = [];
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    badDays += badDayCount(seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER));
    const season = simulateSeason(seed);
    seasonLengths.push(season.length);
    worldsEntries += seasonMeetsOfTier(season, 'competitive-worlds').length;
    for (const { throughIndex, meet, diligent, idle } of seasonMoments(season, variant)) {
      const evalDay = addDays(meet.day, ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS);
      const to = addDays(evalDay, ATTENDANCE_SWEEP.WINDOW_DAYS);
      const memo = new Map<string, Set<string>>();
      const qualified = (lifter: CareerLifter): Set<string> => {
        const key = qualificationKey(lifter);
        let hit = memo.get(key);
        if (hit === undefined) {
          hit = new Set(qualifiedMeets(lifter, evalDay, to).map((m) => m.id));
          memo.set(key, hit);
        }
        return hit;
      };
      const attended = qualified(diligent);
      for (let skip = 0; skip <= throughIndex; skip += 1) {
        const skipped = qualified(idle[skip] as CareerLifter);
        pairs += 1;
        let missing = 0;
        for (const id of skipped) if (!attended.has(id)) missing += 1;
        if (missing > 0) violatingPairs += 1;
        if (missing > worstDeficit) worstDeficit = missing;
        if (attended.size !== skipped.size) movedPairs += 1;
      }
    }
  }
  return {
    seasons: ATTENDANCE_SWEEP.SEEDS.length,
    seasonLengths,
    badDays,
    worldsEntries,
    pairs,
    movedPairs,
    violatingPairs,
    worstDeficit,
  };
}

describe('AXIS B — competing at one more meet never qualifies for fewer', () => {
  it('[attending-a-meet-never-removes-one] every skipped meet in every seeded season, and the control beside it', () => {
    const shipped = measureAttendanceAxis('shipped');
    const control = measureAttendanceAxis('latest-total-wins');

    // First, for the reason the strength axis above gives at length: a mutation
    // of `careerRecordAfterMeet` moves `movedPairs` from 78 to 79 as well as
    // breaking the property, and with the domain pins above this line the
    // failure a reader saw was the 79.
    expect(shipped.violatingPairs).toBe(0);
    expect(shipped.worstDeficit).toBe(0);

    // The domain. `badDays` is the count that matters most: a sweep whose
    // totals only ever rose could not tell the two rules apart, because the
    // last total and the best total would be the same number every time.
    //
    // `seasonLengths` is the count that matters second, and it is the one this
    // sweep got wrong first time out. It used to read fourteen for every seed,
    // because the fixture gave each lifter a 28-day rest nothing in the game
    // asks of them; a current-form rule that switched on at a lifter's 16th
    // meet was then invisible, since no lifter in the sweep had one. These are
    // the depths the shipped calendar offers a lifter who enters everything
    // they are eligible for, and the three parameters that produce them are
    // asserted against `CAREER_TUNING` two tests below rather than chosen here.
    expect(shipped.seasons).toBe(24);
    expect(shipped.seasonLengths).toEqual([
      169, 169, 168, 169, 166, 168, 164, 168, 169, 166, 164, 169, 169, 164, 164, 167, 169, 166,
      169, 168, 167, 165, 169, 168,
    ]);
    expect(shipped.badDays).toBe(1422);
    expect(shipped.pairs).toBe(337719);
    expect(shipped.movedPairs).toBe(273);

    // AND THE COUNT THIS ROUND EXISTS FOR. The sweep used to run for one
    // calendar period, which holds exactly one worlds meet, six days after the
    // anchor, with three meet days in front of it — so no simulated lifter
    // could hold the 650 kg it asks for and the worlds column of this fixture
    // was empty. Two periods put a second worlds meet on day 370, and 23 of the
    // 24 careers enter it. The 24th is a real refusal rather than a gap in the
    // harness: that lifter was holding 552.5 kg when the day came round, and
    // the test three below traces it.
    expect(shipped.worldsEntries).toBe(23);
    expect(shipped.worldsEntries).toBeLessThan(ATTENDANCE_SWEEP.SEEDS.length);

    // The control: qualification reading the latest total instead of the best,
    // on the same seasons, the same totals and the same comparison. 86 of the
    // 337719 pairs violate and a lifter loses as many as 26 meets for having
    // competed one more time.
    //
    // Its domain is asserted equal to the shipped arm's for the reason the
    // strength axis gives, with one deliberate exception: `movedPairs` is 244
    // rather than 209, because the control's own rule changes which comparisons
    // move. That one is pinned at its own value instead of being tied to the
    // shipped arm, since forcing them equal would be asserting that a broken
    // rule moves exactly as often as a working one.
    expect(control.seasons).toBe(shipped.seasons);
    expect(control.seasonLengths).toEqual(shipped.seasonLengths);
    expect(control.badDays).toBe(shipped.badDays);
    expect(control.pairs).toBe(shipped.pairs);
    expect(control.worldsEntries).toBe(shipped.worldsEntries);
    expect(control.movedPairs).toBe(308);
    expect(control.violatingPairs).toBe(109);
    expect(control.worstDeficit).toBe(26);
  });

  it('reaches a current-form rule that waits, and reports two different kinds of zero past it', () => {
    // WHERE THIS SWEEP GOES BLIND, MEASURED AND PINNED FROM THREE SIDES.
    //
    // A current-form gate does not have to switch on at a lifter's first meet.
    // Delay it — "your last total counts once you are established" — and it is
    // the same broken rule, invisible to a sweep whose careers end before the
    // delay does. That is not a hypothetical: the version of this file that
    // held every career to 14 meets reported zero for the same rule delayed to
    // a lifter's 16th, and reported it in exactly the confident shape a passing
    // sweep has.
    //
    // THE PAIR THIS REPLACES WENT VACUOUS WHEN THE DOMAIN DEEPENED, which is
    // worth more than the numbers below. It was pinned at 81 and 82 — the
    // deepest career and one past it — and 81 measured 81 violating pairs. Two
    // calendar periods take the deepest career to 165, and the same pair moved
    // to 164 and 165 reports zero and zero. Nobody edited the check; the domain
    // grew out from under it, and a reader of two zeros would have concluded
    // the axis was sensitive up to 164 when it stops at 100.
    //
    // So three arms run, and the two zeros are told apart by a count rather
    // than by this comment. `firesIn` is how many of the 24 careers are deep
    // enough for the rule's current-form branch to be taken at all:
    //
    //   - inside (100): the rule fires and the axis reports it.
    //   - past-visible (101): the rule fires in every one of the 24 careers,
    //     and the axis reports nothing. Invisible, not unreachable.
    //   - past-the-edge (165): the rule fires in none of them. Unreachable.
    const inside = measureAttendanceAxis('delayed-form-inside');
    const pastVisible = measureAttendanceAxis('delayed-form-past-visible');
    const pastTheEdge = measureAttendanceAxis('delayed-form-past-the-edge');

    expect(inside.violatingPairs, 'a delayed current-form rule inside the domain').toBe(104);
    expect(inside.worstDeficit).toBe(2);
    expect(pastVisible.violatingPairs, 'the same rule one meet past the deepest it is seen').toBe(0);
    expect(pastVisible.worstDeficit).toBe(0);
    expect(pastTheEdge.violatingPairs, 'the same rule past the deepest career').toBe(0);
    expect(pastTheEdge.worstDeficit).toBe(0);

    // Which arm's branch is reachable at all. `latestTotalAfter(n)` takes its
    // current-form branch on a career's (n+1)-th meet, so a career of length L
    // reaches it exactly when L > n. Counted from the season lengths the axis
    // above pins, so the two zeros carry their own reason.
    const firesIn = (afterMeets: number): number =>
      inside.seasonLengths.filter((length) => length > afterMeets).length;
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE), 'careers deep enough for the 103 arm').toBe(24);
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE), 'careers deep enough for the 104 arm').toBe(24);
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE), 'careers deep enough for the 169 arm').toBe(0);

    // The depth edge is the deepest career rather than a number chosen to make
    // an arm work, and the visibility edge is one meet past the last one that
    // bites. The second is a fact about this population's totals and was found
    // by scanning meet by meet, so it is pinned as adjacency and measured
    // above, not derived.
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE).toBe(Math.max(...inside.seasonLengths));
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE).toBe(
      ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE + 1,
    );
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE).toBeLessThan(
      ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE,
    );
    // And the three arms ran on the same seasons as each other and as the
    // shipped one, so the zeros are about the rules and not a smaller domain.
    expect(pastVisible.seasonLengths).toEqual(inside.seasonLengths);
    expect(pastTheEdge.seasonLengths).toEqual(inside.seasonLengths);
    expect(inside.pairs).toBe(337719);
    expect(pastVisible.pairs).toBe(337719);
    expect(pastTheEdge.pairs).toBe(337719);
  });

  it('cannot see a rule keyed to the annual tier at all, and the margin is 27.5 kg', () => {
    // THE FINDING THIS ROUND TURNED UP, AND IT IS NOT THE ONE IT WENT LOOKING
    // FOR. Deepening the simulation was meant to make a worlds-keyed rule
    // visible to this axis. It puts 23 worlds entries in the fixture and the
    // axis still sees nothing, because qualification asks one question — is the
    // best total at or above the bar — and by the time a lifter can enter a
    // worlds meet the answer has been yes for dozens of meets.
    //
    // `worlds-reset` is the rule: the annual result becomes the lifter's
    // ranking total instead of the better of the two, so a bad day at worlds
    // forgets everything above it while the lifter who stayed home keeps
    // theirs. A plausible design and a §12.3 violation, and this axis reports
    // zero for it at every one of the calendar's three worlds meets — for three
    // different reasons, which is the part worth reading.
    const first = measureAttendanceAxis('worlds-reset-first');
    const second = measureAttendanceAxis('worlds-reset-second');
    const third = measureAttendanceAxis('worlds-reset-third');

    expect(first.violatingPairs, 'the worlds meet on day 6, which nobody enters').toBe(0);
    expect(second.violatingPairs, 'the worlds meet on day 370, which 23 careers enter').toBe(0);
    expect(third.violatingPairs, 'the worlds meet on day 734, past the simulation').toBe(0);

    // The middle zero is the one that needs its reason measured, because it is
    // the one that looks like coverage. The rule FIRES: it rewrites the record
    // in 16 of the 23 careers that reach that meet, and the other 7 are careers
    // whose worlds day was their best day anyway.
    const seasons = ATTENDANCE_SWEEP.SEEDS.map((seed) => simulateSeason(seed));
    const worldsSeasons = seasons.filter(
      (season) => seasonMeetsOfTier(season, 'competitive-worlds').length > 0,
    );
    const rewritten = worldsSeasons.filter((season) => {
      const worlds = seasonMeetsOfTier(season, 'competitive-worlds')[0] as SeasonMeet;
      const index = season.indexOf(worlds);
      return (
        careerAfter(season, index, null, 'shipped').bestTotalKg !==
        careerAfter(season, index, null, 'worlds-reset-second').bestTotalKg
      );
    });
    expect(worldsSeasons).toHaveLength(23);
    expect(rewritten).toHaveLength(16);

    // And here is why rewriting it changes nothing this axis can read. The
    // lowest total anybody in this sweep put up at a competitive worlds meet is
    // 677.5 kg, against a top qualifying total of 650. So even the worst world result
    // here leaves the lifter clearing every bar on the ladder, and a rule that
    // replaces their best with it cannot take a meet away.
    //
    // 27.5 kg of daylight between this axis being blind to the top tier and not,
    // on a fixture that reaches 1752.5 kg at the other end. It was 7.5 kg before
    // the summit split moved every total's index; the margin is a fact about a
    // population, and this is what one looks like when it drifts.
    const worldsTotals = worldsSeasons.map(
      (season) => (seasonMeetsOfTier(season, 'competitive-worlds')[0] as SeasonMeet).totalKg,
    );
    expect(Math.min(...worldsTotals)).toBe(677.5);
    expect(Math.max(...worldsTotals)).toBe(1752.5);
    expect(Math.min(...worldsTotals) - ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG).toBe(27.5);
    expect(ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG).toBe(
      Math.max(
        ...MEET_TIER_ORDER.map((tier) => CAREER_TUNING.QUALIFYING_TOTAL_KG[tier] ?? 0),
      ),
    );
    // The first and third zeros are the cheap kind: nobody stands on those two
    // days, so the rule's branch is never taken. Counted rather than asserted.
    const occurrencesEntered = new Set(
      seasons.flatMap((season) =>
        seasonMeetsOfTier(season, 'competitive-worlds').map((meet) => tierOccurrenceOf('competitive-worlds', meet.day)),
      ),
    );
    expect([...occurrencesEntered]).toEqual([ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_SECOND]);
    expect(occurrencesEntered.has(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_FIRST)).toBe(false);
    expect(occurrencesEntered.has(ATTENDANCE_SWEEP.WORLDS_OCCURRENCE_THIRD)).toBe(false);
    // Same domain on all three arms, so none of the zeros is about a smaller one.
    expect(first.pairs).toBe(337719);
    expect(second.pairs).toBe(337719);
    expect(third.pairs).toBe(337719);
    expect(second.worldsEntries).toBe(23);
  });

  it('a season is a real season: every meet distinct, and none of them entered twice', () => {
    // The fixture the axis rests on. A simulation that entered nothing, or
    // entered one meet eighty times, would leave every comparison above
    // trivially equal.
    const season = simulateSeason(ATTENDANCE_SWEEP.SEEDS[0] as number);
    expect(season).toHaveLength(169);
    expect(new Set(season.map((meet) => meet.meetId)).size).toBe(169);
    for (let index = 1; index < season.length; index += 1) {
      const gap = (season[index] as { day: StreakDay }).day - (season[index - 1] as { day: StreakDay }).day;
      expect(gap).toBeGreaterThanOrEqual(ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS);
    }
    // All five rungs of the ladder. At a 28-day rest the simulated career was
    // every fourth local meet and nothing else; at the calendar's own
    // resolution it picks up the fortnightly and quarterly series as the lifter
    // qualifies for them; and at two calendar periods it reaches the annual one
    // as well, which is what this round was for.
    expect([...new Set(season.map((meet) => meet.tier))].sort()).toEqual([
      'campaign-worlds',
      'competitive-worlds',
      'local',
      'nationals',
      'regional',
    ]);
  });

  it('reaches the second worlds meet and not the first, and the first is unreachable by arithmetic', () => {
    // WHY THE SIMULATION RUNS FOR TWO CALENDAR PERIODS AND NOT ONE, as a pair
    // of measurements rather than as a paragraph.
    //
    // A period holds exactly one worlds meet. It falls six days after the
    // season anchor with three meet days in front of it, and a lifter starts
    // below the regional bar — so the most anyone can be holding when it comes
    // round is `FIRST_TOTAL_KG + 3 x MAX_GAIN_KG` = 590 kg against a 650 kg
    // bar. That is arithmetic, not a seed: no career this fixture can generate
    // enters the first worlds meet, at any depth, for any distribution of good
    // and bad days bounded by `MAX_GAIN_KG`.
    const wholeRun = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), ATTENDANCE_SWEEP.SIMULATION_DAYS),
    );
    const worlds = wholeRun.filter((meet) => meet.tier === 'competitive-worlds');
    expect(worlds).toHaveLength(2);
    expect(worlds.map((meet) => meet.day - seasonAnchorDay())).toEqual([6, 370]);
    expect(worlds.map((meet) => tierOccurrenceOf('competitive-worlds', meet.day))).toEqual([0, 1]);
    expect((worlds[0] as CareerMeet).qualifyingTotalKg).toBe(650);

    const beforeFirstWorlds = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), 5),
    );
    expect(beforeFirstWorlds).toHaveLength(3);
    expect(
      ATTENDANCE_SWEEP.FIRST_TOTAL_KG + beforeFirstWorlds.length * ATTENDANCE_SWEEP.MAX_GAIN_KG,
    ).toBe(590);
    expect(
      ATTENDANCE_SWEEP.FIRST_TOTAL_KG + beforeFirstWorlds.length * ATTENDANCE_SWEEP.MAX_GAIN_KG,
    ).toBeLessThan(ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG);

    // The second one is 370 days in, which is one worlds cadence past the
    // first, and 23 of the 24 seeded careers enter it. Both halves are pinned:
    // the count, so the domain says how often it reached the case, and the
    // refusal, so a reader knows the qualifying total is still doing work at
    // the top of the ladder rather than waved through.
    const entered = ATTENDANCE_SWEEP.SEEDS.map((seed) =>
      seasonMeetsOfTier(simulateSeason(seed), 'competitive-worlds'),
    );
    expect(entered.filter((meets) => meets.length > 0)).toHaveLength(23);
    expect(entered.filter((meets) => meets.length === 0)).toHaveLength(1);
    expect(
      (worlds[1] as CareerMeet).day - (worlds[0] as CareerMeet).day,
      'the second worlds is one annual cadence after the first',
    ).toBe(CAREER_TUNING.CADENCE_DAYS['competitive-worlds']);
    // The one that misses, traced rather than described: it was holding
    // 552.5 kg on the day, which is over the nationals bar and under the
    // worlds one.
    const misses = ATTENDANCE_SWEEP.SEEDS.map((seed) => simulateSeason(seed)).filter(
      (season) => seasonMeetsOfTier(season, 'competitive-worlds').length === 0,
    );
    const missedSeason = misses[0] as readonly SeasonMeet[];
    const secondWorldsDay = (worlds[1] as CareerMeet).day;
    const bestByThen = Math.max(
      ...missedSeason.filter((meet) => meet.day < secondWorldsDay).map((meet) => meet.totalKg),
    );
    expect(bestByThen).toBe(552.5);
    expect(bestByThen).toBeLessThan(ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG);
    expect(bestByThen).toBeGreaterThanOrEqual(CAREER_TUNING.QUALIFYING_TOTAL_KG.nationals ?? 0);
  });

  it('builds the same careers incrementally as `careerAfter` builds from the top', () => {
    // THE CHECK THAT MAKES THE FAST PATH A FAST PATH RATHER THAN A DIFFERENT
    // MEASUREMENT. `seasonMoments` advances the previous moment's lifters by
    // one meet; `careerAfter` re-folds the whole prefix. They are two ways of
    // writing the same fold and they have to agree at every (moment, skipped
    // meet) the pair loop visits, under every record rule, or the numbers above
    // are about something nobody wrote down.
    //
    // Driven over a whole triangle rather than at a sample of points, on the
    // first seed truncated to a depth the slow path can afford — it is cubic in
    // the season length, which is the reason the fast path exists. The deep end
    // is covered separately below, at the one moment the slow path is cheap
    // there: the last one.
    const full = simulateSeason(ATTENDANCE_SWEEP.SEEDS[0] as number);
    const truncated = full.slice(0, 40);
    const variants: readonly RecordVariant[] = [
      'shipped',
      'latest-total-wins',
      'delayed-form-inside',
      'delayed-form-past-visible',
      'delayed-form-past-the-edge',
      'worlds-reset-first',
      'worlds-reset-second',
      'worlds-reset-third',
    ];
    let compared = 0;
    for (const variant of variants) {
      for (const { throughIndex, diligent, idle } of seasonMoments(truncated, variant)) {
        expect(diligent, `${variant} diligent at ${throughIndex}`).toEqual(
          careerAfter(truncated, throughIndex, null, variant),
        );
        for (let skip = 0; skip <= throughIndex; skip += 1) {
          expect(idle[skip], `${variant} skip ${skip} at ${throughIndex}`).toEqual(
            careerAfter(truncated, throughIndex, skip, variant),
          );
          compared += 1;
        }
      }
    }
    // Counts, not bounds. 40 moments is 820 pairs, eight rules is 6560, and an
    // empty variant list or a zero-length season would walk none of them.
    expect(truncated).toHaveLength(40);
    expect(variants).toHaveLength(8);
    expect(compared).toBe(6560);

    // The deep end, at full season length, where the slow path is affordable
    // only at the final moment. This is the region the truncated triangle above
    // says nothing about, and it is where the delayed-form rules switch on.
    const last = full.length - 1;
    let deepCompared = 0;
    for (const variant of variants) {
      const moments = [...seasonMoments(full, variant)];
      const final = moments[last];
      expect(final).toBeDefined();
      expect((final as { throughIndex: number }).throughIndex).toBe(last);
      expect((final as { diligent: CareerLifter }).diligent).toEqual(
        careerAfter(full, last, null, variant),
      );
      for (const skip of [0, 1, Math.floor(last / 2), last - 1, last]) {
        expect((final as { idle: readonly CareerLifter[] }).idle[skip], `${variant} deep skip ${skip}`).toEqual(
          careerAfter(full, last, skip, variant),
        );
        deepCompared += 1;
      }
    }
    expect(full).toHaveLength(169);
    expect(deepCompared).toBe(40);
  });

  it('the sweep’s depth is read off the shipped calendar, not chosen in the sweep', () => {
    // THE PARAMETER THAT WAS HOLDING THE MEASUREMENT SHALLOW. Three numbers in
    // `careerSweep.ts` decide how deep a career the attendance axes see, and
    // each of the three is derived from `careerTuning.ts` rather than picked.
    // Asserted here so that a tuner who speeds the calendar up gets a red in
    // the sweep instead of a sweep that quietly stops covering the game.
    //
    // 1. The rest between meets is the calendar's own resolution: one day, so
    //    the harness imposes none of its own.
    expect(ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS).toBe(1);
    expect(ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS).toBeLessThanOrEqual(
      Math.min(...MEET_TIER_ORDER.map((tier) => CAREER_TUNING.CADENCE_DAYS[tier])),
    );
    // 2. The period is the calendar's own: every cadence divides it, so the
    //    pattern of meet days repeats from there, and it is the span a calendar
    //    screen draws.
    expect(ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS).toBe(CAREER_TUNING.HORIZON_DAYS);
    for (const tier of MEET_TIER_ORDER) {
      expect(ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS % CAREER_TUNING.CADENCE_DAYS[tier]).toBe(0);
    }
    // 3. How many of those periods the simulation runs for, and it is the one
    //    number this round moved. Two, because the annual series' first
    //    occurrence is unreachable and its second is 364 days later — asserted
    //    against the cadence rather than written down, so a tuner who makes
    //    worlds biennial gets a red here instead of an empty worlds column.
    expect(ATTENDANCE_SWEEP.CALENDAR_PERIODS).toBe(2);
    expect(ATTENDANCE_SWEEP.SIMULATION_DAYS).toBe(
      ATTENDANCE_SWEEP.CALENDAR_PERIODS * ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS,
    );
    expect(ATTENDANCE_SWEEP.SIMULATION_DAYS).toBeGreaterThanOrEqual(
      CAREER_TUNING.PHASE_DAYS['competitive-worlds'] + CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
    );
    for (const tier of MEET_TIER_ORDER) {
      expect(ATTENDANCE_SWEEP.SIMULATION_DAYS % CAREER_TUNING.CADENCE_DAYS[tier]).toBe(0);
    }
    // 4. The draw per career is the number of meets that whole run holds, which
    //    is the ceiling on a career: one meet a day at most, each one different.
    const wholeRun = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), ATTENDANCE_SWEEP.SIMULATION_DAYS),
    );
    expect(ATTENDANCE_SWEEP.MEETS_PER_CAREER).toBe(wholeRun.length);
    expect(wholeRun).toHaveLength(171);
    // 5. Nothing about the calendar restarts at a period boundary, which is the
    //    thing a "season" word invites a reader to assume. There is one anchor
    //    and four arithmetic progressions running forward from it, so the run's
    //    second half is generated by the same rule as its first: the meets in
    //    days 364..727 are the days 0..363 meets shifted by one period, tier for
    //    tier and day for day.
    const firstHalf = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS - 1),
    );
    const secondHalf = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      addDays(seasonAnchorDay(), ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS),
      addDays(seasonAnchorDay(), 2 * ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS - 1),
    );
    expect(secondHalf.map((meet) => meet.tier)).toEqual(firstHalf.map((meet) => meet.tier));
    expect(secondHalf.map((meet) => meet.day - ATTENDANCE_SWEEP.CALENDAR_PERIOD_DAYS)).toEqual(
      firstHalf.map((meet) => meet.day),
    );
    expect(firstHalf).toHaveLength(85);
  });
});

// ---------------------------------------------------------------------------
// AXIS C — entry
// ---------------------------------------------------------------------------

interface EntryMeasurement {
  readonly pairs: number;
  /** Meets across every simulated season. The size of the case axis C is about. */
  readonly seasonMeets: number;
  /** Pairs whose two enterable lists are not the same size. */
  readonly movedPairs: number;
  /** Pairs where the lifter who competed more may enter something the other cannot. */
  readonly growingPairs: number;
  /** Pairs where they may not enter something on their own record. Spending it. */
  readonly spentPairs: number;
  /** Pairs where they may not enter something that is NOT on their record. */
  readonly unexplainedPairs: number;
  readonly worstUnexplained: number;
}

/**
 * One implementation, every arm, for the same reason the two axes above give —
 * and every arm named in one call, which is what keeps five of them costing
 * roughly what one used to.
 *
 * `enterableMeets` is the expensive part of this axis: it asks `entryVerdict`
 * about each of 86 meets, and `entryVerdict` scans an entered list that reaches
 * 165 ids. Every control here is a lockout, so all of them filter the same
 * engine list, and computing that list once per lifter per moment is the
 * difference between the arms sharing a pass and each paying for its own.
 *
 * `lag` is a parameter rather than a constant read inside, because one of the
 * calls is the shipped rule at the shipped axis B lag — the arm that measures
 * what this axis was blind to before it existed.
 */
function measureEntryAxis(
  variants: readonly EntryVariant[],
  lag: number,
): Readonly<Record<string, EntryMeasurement>> {
  const tally = variants.map((variant) => ({
    variant,
    rule: ENTRY_VARIANTS[variant],
    pairs: 0,
    seasonMeets: 0,
    movedPairs: 0,
    growingPairs: 0,
    spentPairs: 0,
    unexplainedPairs: 0,
    worstUnexplained: 0,
  }));
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    const season = simulateSeason(seed);
    for (const row of tally) row.seasonMeets += season.length;
    for (const { throughIndex, meet, diligent, idle } of seasonMoments(season, 'shipped')) {
      const today = addDays(meet.day, lag);
      const diligentContext = {
        today,
        lastEnteredDay: lastEnteredDayOf(season, throughIndex, null),
        worldsDaysEntered: enteredDaysOfTier(season, throughIndex, null, 'competitive-worlds'),
      };
      const diligentBase = shippedEntryList(diligent, diligentContext);
      const diligentLists = tally.map(
        (row) => new Set(row.rule(diligentBase, diligentContext).map((c) => c.id)),
      );
      for (let skip = 0; skip <= throughIndex; skip += 1) {
        const idleLifter = idle[skip] as CareerLifter;
        const idleContext = {
          today,
          lastEnteredDay: lastEnteredDayOf(season, throughIndex, skip),
          worldsDaysEntered: enteredDaysOfTier(season, throughIndex, skip, 'competitive-worlds'),
        };
        const idleBase = shippedEntryList(idleLifter, idleContext);
        for (const [index, row] of tally.entries()) {
          const diligentList = diligentLists[index] as Set<string>;
          const idleList = new Set(row.rule(idleBase, idleContext).map((c) => c.id));
          row.pairs += 1;
          let spent = 0;
          let unexplained = 0;
          for (const id of idleList) {
            if (diligentList.has(id)) continue;
            if (diligent.enteredMeetIds.includes(id)) spent += 1;
            else unexplained += 1;
          }
          let gained = 0;
          for (const id of diligentList) if (!idleList.has(id)) gained += 1;
          if (spent > 0) row.spentPairs += 1;
          if (gained > 0) row.growingPairs += 1;
          if (unexplained > 0) row.unexplainedPairs += 1;
          if (unexplained > row.worstUnexplained) row.worstUnexplained = unexplained;
          if (diligentList.size !== idleList.size) row.movedPairs += 1;
        }
      }
    }
  }
  return Object.fromEntries(tally.map((row) => [row.variant, row]));
}

/** One arm of the entry axis, for a call site that wants a single variant. */
function measureOneEntryArm(variant: EntryVariant, lag: number): EntryMeasurement {
  return measureEntryAxis([variant], lag)[variant] as EntryMeasurement;
}

describe('AXIS C — entering a meet spends that meet and takes nothing else', () => {
  it('every skipped meet in every seeded season, against a rest control and three tier-keyed ones', { timeout: budgetFrom(82_895) }, () => {
    // WHAT THIS AXIS IS FOR, and it is the one thing axes A and B cannot do.
    // Both of them run through `qualifiedMeets`, which reads the federation and
    // the Total and never looks at `enteredMeetIds` — pinned directly under
    // axis A. So across all 80601 + 337719 of their compared pairs the entered
    // list decides nothing, and the module's claim that spending an entry is
    // not a punishment had no subject.
    //
    // The claim, in the form measured here: for two careers identical except
    // that one lifter competed at one more meet, every meet the lifter who
    // stayed home may enter and the lifter who competed may not is a meet on
    // that lifter's own record.
    const arms = measureEntryAxis(
      [
        'shipped',
        'entry-cooldown',
        'worlds-cooldown-first',
        'worlds-cooldown-second',
        'worlds-cooldown-third',
      ],
      ATTENDANCE_SWEEP.ENTRY_EVALUATION_LAG_DAYS,
    );
    const shipped = arms['shipped'] as EntryMeasurement;
    const rest = arms['entry-cooldown'] as EntryMeasurement;
    const worldsFirst = arms['worlds-cooldown-first'] as EntryMeasurement;
    const worldsSecond = arms['worlds-cooldown-second'] as EntryMeasurement;
    const worldsThird = arms['worlds-cooldown-third'] as EntryMeasurement;

    // The property first, for the reason axes A and B give at length.
    expect(shipped.unexplainedPairs).toBe(0);
    expect(shipped.worstUnexplained).toBe(0);

    // THE DOMAIN, AND THE HALF OF IT THAT WAS EMPTY. `spentPairs` is the count
    // that matters most here: it is how many of the compared pairs actually
    // reach an entry being spent, and a zero above means nothing without it.
    // It is asserted equal to the total number of meets across the seasons as
    // well as pinned, because the two are the same quantity counted from
    // different ends — the pair loop reaches the case exactly once per meet —
    // and a rule that stopped spending entries would break the equality rather
    // than only moving a literal.
    expect(shipped.pairs).toBe(337719);
    expect(shipped.spentPairs).toBe(4014);
    expect(shipped.spentPairs).toBe(shipped.seasonMeets);
    expect(shipped.movedPairs).toBe(4173);
    expect(shipped.growingPairs).toBe(273);

    // The rest control: a mandatory 28 days off after a meet, which is the most
    // plausible design of the controls this module measures against and is
    // exactly what GDD §12.3 refuses. The lifter who competed at one more meet
    // starts their lockout later, so 3746 pairs hand them a shorter calendar
    // than the lifter who stayed home, and as many as 4 of the meets they lose
    // are meets they never went to.
    //
    // Its domain is asserted against the shipped arm's where the two are the
    // same question, and pinned at its own value where the control's rule
    // changes the answer. `spentPairs` collapses from 4014 to 24 under it, and
    // the collapse is the control describing itself: at the calendar's own
    // resolution the lifter who stayed home is nearly always inside a lockout
    // of their own, so the meet the other one spent was unavailable to both.
    // The 24 that survive are one per season — the pair at a lifter's very
    // first meet, where the one who stayed home has no previous meet and so no
    // lockout — which is why the count is asserted against the seed list as
    // well as pinned.
    expect(rest.pairs).toBe(shipped.pairs);
    expect(rest.seasonMeets).toBe(shipped.seasonMeets);
    expect(rest.growingPairs).toBe(shipped.growingPairs);
    expect(rest.movedPairs).toBe(3904);
    expect(rest.spentPairs).toBe(24);
    expect(rest.spentPairs).toBe(ATTENDANCE_SWEEP.SEEDS.length);
    expect(rest.unexplainedPairs).toBe(3746);
    expect(rest.worstUnexplained).toBe(4);

    // THE THREE TIER-KEYED CONTROLS, AND THE REASON THIS ROUND WIDENED THE
    // DOMAIN. Each is the same 28-day rest charged after one nominated
    // occurrence of the annual series and after nothing else, which is a rule a
    // designer would write without noticing it is the shape §12.3 refuses.
    //
    // At one calendar period all three of these measure zero, because a career
    // that never crosses a period boundary never enters a worlds meet — the
    // only one on offer is six days after the anchor and asks for 650 kg. That
    // is the blind spot this round was sent to close, and the middle arm is it
    // closed: 138 pairs where the lifter who went to the world championship may
    // not enter a meet the lifter who stayed home may, and as many as 6 of them
    // at once.
    //
    // The outer two stay at zero and are the new edges, one on each side of the
    // domain rather than both at the far end: the day-6 meet is inside the
    // calendar and outside every career, and the day-734 meet is outside the
    // simulation. `worlds-cooldown-first` is the more interesting of the pair,
    // because a reader scanning the calendar would count two worlds meets in
    // range and assume both are reachable.
    expect(worldsFirst.unexplainedPairs, 'a lockout after the day-6 worlds meet').toBe(0);
    expect(worldsSecond.unexplainedPairs, 'a lockout after the day-370 worlds meet').toBe(138);
    expect(worldsThird.unexplainedPairs, 'a lockout after the day-734 worlds meet').toBe(0);
    expect(worldsSecond.worstUnexplained).toBe(6);
    expect(worldsFirst.worstUnexplained).toBe(0);
    expect(worldsThird.worstUnexplained).toBe(0);

    // The two zeros are zero because the lockout never starts, not because the
    // axis stopped looking: an arm whose lockout never fires leaves the shipped
    // list untouched, so every other count it reports is the shipped arm's.
    // That equality is what separates "no lockout happened" from "a lockout
    // happened and cost nothing", and it is asserted rather than assumed.
    expect(worldsFirst.spentPairs).toBe(shipped.spentPairs);
    expect(worldsFirst.movedPairs).toBe(shipped.movedPairs);
    expect(worldsThird.spentPairs).toBe(shipped.spentPairs);
    expect(worldsThird.movedPairs).toBe(shipped.movedPairs);
    // ...and the middle arm's counts are NOT the shipped arm's, which is the
    // same statement from the other side: its lockout removed meets the shipped
    // list held, so both counts move.
    expect(worldsSecond.spentPairs).toBe(3876);
    expect(worldsSecond.movedPairs).toBe(4150);
    expect(worldsSecond.spentPairs).toBeLessThan(shipped.spentPairs);
    // Every arm ran the same pairs, so none of the numbers above is about a
    // domain of its own.
    for (const arm of [worldsFirst, worldsSecond, worldsThird]) {
      expect(arm.pairs).toBe(shipped.pairs);
      expect(arm.seasonMeets).toBe(shipped.seasonMeets);
      expect(arm.growingPairs).toBe(shipped.growingPairs);
    }

  });

  it('is blind at axis B’s evaluation lag, which is why it has its own', { timeout: budgetFrom(71_005) }, () => {
    // The blind lag, kept runnable rather than described. This is the shipped
    // engine measured at axis B's evaluation lag of a week, and it is what this
    // axis looked like before it had its own: `spentPairs` is 0, because the
    // one meet the two lifters differ on is a week behind the window and
    // `entryVerdict` refuses it to both of them. Every count that survives is a
    // count axis B already holds, which is the definition of a second harness
    // that is blind for the same reason as the first.
    //
    // In its own test rather than beside the arms above, because it needs its
    // own pass over every lifter at a different day and the two together run
    // long enough that one hang guard covering both would have to be twice as
    // patient as either needs. The domain literals are the same ones the test
    // above pins on the shipped arm.
    const blindLag = measureOneEntryArm('shipped', ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS);
    expect(blindLag.spentPairs).toBe(0);
    expect(blindLag.unexplainedPairs).toBe(0);
    expect(blindLag.movedPairs).toBe(273);
    expect(blindLag.growingPairs).toBe(273);
    expect(blindLag.pairs).toBe(337719);
    expect(blindLag.seasonMeets).toBe(4014);
    // And the lag it is blind at is axis B's own, not a number picked to make
    // the zero above happen.
    expect(ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS).toBeGreaterThan(
      ATTENDANCE_SWEEP.ENTRY_EVALUATION_LAG_DAYS,
    );
    expect(ATTENDANCE_SWEEP.ENTRY_EVALUATION_LAG_DAYS).toBe(0);
  });

  it('runs its shipped arm on the engine’s own list, and every control as a filter of it', () => {
    // THE CLAIM THE ARMS ABOVE REST ON, and it moved this round so it is worth
    // a check rather than a sentence. The controls used to call
    // `enterableMeets` each for themselves; they now filter one list the
    // measurement computes, because five arms each paying for their own pass
    // over 165-id entered lists is most of this file's wall clock.
    //
    // Two things have to hold for that to be the same measurement. The list
    // handed to the filters has to be the engine's own — not a restatement of
    // it — and the shipped arm has to be the identity on it, so "shipped" in
    // the tables above means `enterableMeets` and nothing else.
    const lifter = careerRecordAfterMeet(newCareerLifter('meridian'), 'meridian-local-2026-01-03', 700);
    const context = {
      today: ANCHOR,
      lastEnteredDay: ANCHOR,
      worldsDaysEntered: [],
    };
    const engineList = enterableMeets(lifter, ANCHOR, ATTENDANCE_SWEEP.WINDOW_DAYS);
    expect(shippedEntryList(lifter, context)).toEqual(engineList);
    expect(ENTRY_VARIANTS.shipped(engineList, context)).toBe(engineList);
    // And a control is a filter of it: never longer, and every member of the
    // result a member of the input. Checked on the arm that really does remove
    // something here, so this is not asserted on an empty difference.
    const cooled = ENTRY_VARIANTS['entry-cooldown'](engineList, context);
    expect(cooled.length).toBeLessThan(engineList.length);
    for (const meet of cooled) expect(engineList).toContain(meet);
    // Counts, not bounds: a zero-length engine list would satisfy the loop.
    expect(engineList.length).toBe(85);
    expect(cooled.length).toBe(77);
  });

  it('the two axes read two different functions, so neither can stand in for the other', () => {
    // THE DOMINATION QUESTION, ASKED IN CODE. A new sweep beside an old one is
    // worth nothing if one of them can no longer speak. These two cannot cover
    // for each other, and the reason is structural rather than statistical:
    // `qualifiedMeets` is `qualifiesFor` over a window and drops nothing else,
    // while `enterableMeets` runs `entryVerdict`, which also refuses a meet
    // already competed at and a meet whose day has gone.
    const lifter = newCareerLifter('meridian');
    const window = qualifiedMeets(lifter, ANCHOR, addDays(ANCHOR, 364));
    const first = window[0] as CareerMeet;
    const veteran = careerRecordAfterMeet(lifter, first.id, 300);

    // Axis B's function cannot see the entry: the meet is still qualified for.
    expect(qualifiedMeets(veteran, ANCHOR, addDays(ANCHOR, 364)).some((m) => m.id === first.id)).toBe(
      true,
    );
    // Axis C's function can, and drops exactly that one.
    const enterable = enterableMeets(veteran, ANCHOR, 364);
    expect(
      enterable.map((meet) => meet.id).filter((id) => id === first.id),
      'the meet just competed at is still on the enterable list',
    ).toEqual([]);
    expect(enterable, 'the enterable list lost more than the one meet').toHaveLength(
      window.length - 1,
    );
    // And the other direction: a day that has gone is refused by entry and not
    // by qualification, which is the second thing axis B is structurally unable
    // to report on. Qualification is day-blind; entry is not.
    expect(qualifiesFor(lifter, first)).toBe(true);
    expect(canEnter(lifter, first, ANCHOR)).toBe(true);
    expect(canEnter(lifter, first, addDays(ANCHOR, 1))).toBe(false);
    expect(window).toHaveLength(53);
  });
});

// ---------------------------------------------------------------------------
// The day scale
// ---------------------------------------------------------------------------

describe('days', () => {
  it('a verdict reads the day it is given and nothing else', () => {
    // The module holds no clock. Two calls a year apart with the same arguments
    // are the same verdict, which is what makes the sweeps above reproducible.
    const meet = careerMeetFor('meridian', 'local', addDays(ANCHOR, 14));
    const day = asStreakDay(ANCHOR);
    expect(entryVerdict(lifterWith(500), meet, day)).toEqual(entryVerdict(lifterWith(500), meet, day));
    expect(qualifiedMeets(lifterWith(500), ANCHOR, addDays(ANCHOR, 364))).toEqual(
      qualifiedMeets(lifterWith(500), ANCHOR, addDays(ANCHOR, 364)),
    );
  });
});

// ---------------------------------------------------------------------------
// AXIS D — the campaign summit is reachable
// ---------------------------------------------------------------------------

describe('AXIS D — GDD §6.6’s campaign summit is reachable, and the two calendars it is not', () => {
  it('generates its variant calendars with the engine’s own arithmetic', () => {
    // THE DRIFT GUARD, AND IT RUNS FIRST BECAUSE EVERY NUMBER BELOW RESTS ON
    // IT. `seriesDays` is a second implementation of what `meetDaysForTier`
    // already does, and it exists only because the controls need a calendar
    // `CAREER_TUNING` does not hold and `CAREER_TUNING` is frozen. A second
    // implementation of a thing the engine does is a drift hazard, so the
    // shipped shape is driven against the engine over the whole simulated span
    // rather than trusted.
    const from = seasonAnchorDay();
    const to = addDays(from, CAMPAIGN_SUMMIT_SWEEP.RUN_DAYS + Math.max(...CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS));
    const mine = seriesDays(CAMPAIGN_CALENDAR_VARIANTS.shipped, from, to);
    const engine = meetDaysForTier('campaign-worlds', from, to);
    expect(mine).toEqual(engine);
    // Counts, not bounds: two empty lists are equal. The span is the furthest
    // any arc reaches — the latest signup day plus a full run — and at a
    // 182-day cadence starting on day 177 it holds four occurrences.
    expect(to - from).toBe(889);
    expect(mine).toHaveLength(4);
    expect(mine.map((day) => day - from)).toEqual([177, 359, 541, 723]);

    // And the shipped shape READS the tuning rather than restating it, so a
    // tuner who moves the campaign cadence or phase moves the sweep with it
    // instead of leaving it measuring a calendar nobody ships. Pinned in both
    // directions, because a shape that agreed with the tuning by coincidence
    // would pass the equality above.
    expect(CAMPAIGN_CALENDAR_VARIANTS.shipped).toEqual({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['campaign-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['campaign-worlds'],
    });
    // The two controls hold each knob at its unfixed value in turn. Neither is
    // a number typed here either: the unfixed calendar IS the annual series the
    // competitive summit still runs on.
    expect(CAMPAIGN_CALENDAR_VARIANTS['annual-at-the-competitive-phase']).toEqual({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['competitive-worlds'],
    });
    expect(CAMPAIGN_CALENDAR_VARIANTS['annual-late']).toEqual({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['competitive-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['campaign-worlds'],
    });
    // The controls differ from the shipped shape in exactly one knob each,
    // which is what makes them separate the two.
    expect(CAMPAIGN_CALENDAR_VARIANTS['annual-late'].phaseDays).toBe(
      CAMPAIGN_CALENDAR_VARIANTS.shipped.phaseDays,
    );
    expect(CAMPAIGN_CALENDAR_VARIANTS['annual-late'].cadenceDays).not.toBe(
      CAMPAIGN_CALENDAR_VARIANTS.shipped.cadenceDays,
    );
    expect(CAMPAIGN_CALENDAR_VARIANTS['annual-at-the-competitive-phase'].phaseDays).not.toBe(
      CAMPAIGN_CALENDAR_VARIANTS.shipped.phaseDays,
    );

    // And a variant calendar is the WHOLE calendar with one series moved, not a
    // calendar of summits. Every other tier is the engine's own list, byte for
    // byte, so the controls cannot be measuring a thinner game.
    const shippedCalendar = variantCalendar('shipped', from, addDays(from, 728));
    const engineCalendar = scheduledMeets(CAMPAIGN_SUMMIT_SWEEP.FEDERATION, from, addDays(from, 728));
    expect(shippedCalendar).toEqual(engineCalendar);
    for (const variant of ['annual-at-the-competitive-phase', 'annual-late'] as const) {
      const moved = variantCalendar(variant, from, addDays(from, 728));
      expect(moved.filter((meet) => meet.tier !== 'campaign-worlds')).toEqual(
        engineCalendar.filter((meet) => meet.tier !== 'campaign-worlds'),
      );
      // The relocated summits carry the engine's own gate, so a control moves
      // the calendar and nothing else. This is the check that says the two
      // controls measure the CALENDAR's contribution rather than a second,
      // differently gated tier.
      for (const summit of moved.filter((meet) => meet.tier === 'campaign-worlds')) {
        expect(summit.qualifyingTotalKg).toBe(CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds']);
      }
    }
  });

  it('takes every simulated arc to a campaign summit, which neither unfixed calendar does', () => {
    const shipped = measureCampaignReach('shipped');
    const atTheOldPhase = measureCampaignReach('annual-at-the-competitive-phase');
    const annualLate = measureCampaignReach('annual-late');

    // R1 FIRST, and then immediately the sentence that says R1 is not the
    // clause doing the work. GDD §6.6 requires the campaign summit to be
    // "always reachable"; every one of the 192 arcs reaches one.
    expect(shipped.arcsReachingASummit).toBe(shipped.arcs);
    expect(shipped.arcs).toBe(192);
    expect(shipped.arcs).toBe(
      ATTENDANCE_SWEEP.SEEDS.length * CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS.length,
    );

    // AND HERE IS WHY THAT CLAUSE IS NEARLY VACUOUS ON ITS OWN, measured rather
    // than suspected: the calendar GDD §6.6 recorded as a design violation
    // takes 191 of the same 192 arcs to a summit too. An absolute stated over
    // the whole population separates the broken calendar from the repaired one
    // by a single arc, because an arc that runs for two calendar periods will
    // eventually meet an annual series whatever its phase.
    expect(atTheOldPhase.arcsReachingASummit).toBe(191);
    expect(annualLate.arcsReachingASummit).toBe(189);

    // R2b IS THE CLAUSE THAT BITES. "Always reachable" is a claim about every
    // player, not about an average, and cutting the first-year count by signup
    // day is what turns it into one. The shipped calendar's worst signup day
    // gets 19 of its 24 arcs to a summit inside the first year; both controls
    // have a signup day that gets NONE of its 24 there.
    expect(shipped.worstOffsetFirstYearArcs).toBe(19);
    expect(shipped.worstOffsetFirstYearArcs).toBeGreaterThanOrEqual(
      CAMPAIGN_SUMMIT_SWEEP.MIN_FIRST_YEAR_ARCS_PER_OFFSET,
    );
    expect(atTheOldPhase.worstOffsetFirstYearArcs).toBe(0);
    expect(annualLate.worstOffsetFirstYearArcs).toBe(0);

    // The whole row, per signup day, because WHICH day is locked out is the
    // thing that says the two controls fail for opposite reasons rather than
    // for one. The old phase locks out the player who signs up ON the season
    // anchor — the summit is six days ahead of them and the next is a year
    // away, which is the exact finding §6.6 recorded. Fixing the phase and
    // leaving the cadence annual moves the lockout to the OTHER end: the player
    // who signs up late in the season arrives just after the summit and waits a
    // whole year for the next.
    expect(shipped.firstYearArcsPerOffset).toEqual([23, 23, 23, 23, 23, 21, 21, 19]);
    expect(atTheOldPhase.firstYearArcsPerOffset).toEqual([0, 23, 23, 23, 23, 22, 21, 21]);
    expect(annualLate.firstYearArcsPerOffset).toEqual([18, 16, 14, 12, 11, 8, 4, 0]);
    // Neither knob alone. That is the whole argument for changing both, and it
    // is these three rows rather than a paragraph.
    expect(atTheOldPhase.firstYearArcsPerOffset[0]).toBe(0);
    expect(
      annualLate.firstYearArcsPerOffset[CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS.length - 1],
    ).toBe(0);

    // R2, the whole-population form, kept because it is the pacing statement
    // and pinned exactly beside its bar so the margin is visible.
    expect(shipped.arcsReachingInsideAYear).toBe(176);
    expect(shipped.arcsReachingInsideAYear).toBeGreaterThanOrEqual(
      CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_ARCS_REQUIRED,
    );
    expect(shipped.medianDaysToFirstSummit).toBe(198);
    expect(shipped.medianDaysToFirstSummit as number).toBeLessThanOrEqual(
      CAMPAIGN_SUMMIT_SWEEP.MEDIAN_DAYS_CEILING,
    );
    expect(shipped.worstDaysToFirstSummit).toBe(608);
    // The controls on the same statistic, so the shipped numbers are numbers
    // against something.
    expect(atTheOldPhase.arcsReachingInsideAYear).toBe(156);
    expect(annualLate.arcsReachingInsideAYear).toBe(83);
    expect(atTheOldPhase.medianDaysToFirstSummit).toBe(301);
    expect(annualLate.medianDaysToFirstSummit).toBe(380);

    // R3's second half. The fastest arc had eight meets behind it, which clears
    // the design floor and is ALSO a fact about the total generator rather than
    // about the calendar — see the constant's block. Pinned exactly so that a
    // generator given a plausible ceiling moves it visibly.
    expect(shipped.fewestMeetsBeforeASummit).toBe(8);
    expect(shipped.fewestMeetsBeforeASummit as number).toBeGreaterThanOrEqual(
      CAMPAIGN_SUMMIT_SWEEP.MIN_MEETS_BEFORE_A_SUMMIT,
    );
  });

  it('counts what the sweep actually saw, per tier, so none of the zeros is about an empty domain', () => {
    const shipped = measureCampaignReach('shipped');

    // THE NON-VACUITY GUARD. Counts per tier, never bounds: an arc simulation
    // that entered nothing, or a calendar that offered no summits, would leave
    // every claim above trivially true. Offered is what the calendar put in
    // front of 192 arcs; entered is what the greedy lifter took.
    expect(shipped.offeredPerTier).toEqual({
      local: 20016,
      regional: 10008,
      nationals: 1536,
      'campaign-worlds': 768,
      'competitive-worlds': 384,
    });
    expect(shipped.enteredPerTier).toEqual({
      local: 20016,
      regional: 9826,
      nationals: 1328,
      'campaign-worlds': 640,
      'competitive-worlds': 343,
    });
    // Every tier is entered and no tier is entered more often than it is
    // offered, which is the shape a census has when it is a census of something.
    for (const tier of MEET_TIER_ORDER) {
      expect(shipped.enteredPerTier[tier], `${tier} entered`).toBeGreaterThan(0);
      expect(shipped.enteredPerTier[tier], `${tier} against offered`).toBeLessThanOrEqual(
        shipped.offeredPerTier[tier],
      );
    }
    // NATIONALS IS THIN AND IS REPORTED AS THIN. 1328 of 1536 offered is 86%,
    // which is the number a reader should have rather than "nationals is fine
    // now". Under the one-year window this piece started from it was 60 of 96;
    // what changed is the window the arcs run over, not the tier.
    expect(shipped.enteredPerTier.nationals / shipped.offeredPerTier.nationals).toBeCloseTo(
      0.8646,
      4,
    );
    expect(shipped.offeredPerTier.nationals - shipped.enteredPerTier.nationals).toBe(208);
    // And the summit is scarce. 768 offered against 20016 local meets is what
    // keeps it a summit rather than a rung.
    expect(shipped.offeredPerTier['campaign-worlds'] / shipped.offeredPerTier.local).toBeLessThan(0.05);

    // `MEETS_PER_ARC` is a ceiling rather than a count, so the slack is
    // measured instead of assumed. An arc that ran past it throws.
    expect(shipped.deepestArc).toBe(170);
    expect(shipped.deepestArc).toBeLessThan(CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC);
    expect(shipped.summitsEntered).toBe(640);
  });

  it('reproduces §6.6’s own finding under the unfixed calendar, and the tie-break it forces', () => {
    // THE FINDING THIS PIECE WAS SENT AT, AS A RUNNABLE CONTROL RATHER THAN A
    // MEMORY. GDD §6.6: worlds meets are "scheduled 24 times and enterable 0
    // times" over one year from the anchor, while lifters get far past the gate.
    // Under `annual-at-the-competitive-phase` the anchor-signup arcs still
    // measure exactly that: 24 seeds, one summit offered inside their first
    // year, and none of them enters it.
    const anchorArcs = campaignArcs('annual-at-the-competitive-phase').filter(
      (arc) => arc.signupOffsetDays === 0,
    );
    expect(anchorArcs).toHaveLength(24);
    expect(
      anchorArcs.filter(
        (arc) =>
          arc.daysToFirstSummit !== null &&
          arc.daysToFirstSummit <= CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_DAYS,
      ),
    ).toHaveLength(0);
    // And it is not that they were too weak. 23 of the 24 are holding more than
    // the gate long before their first year is out — the meet and the strength
    // never coincide, which is the half of the finding a threshold change alone
    // cannot fix.
    //
    // 23 AND NOT 24, WHICH IS A CORRECTION THIS CHECK MADE TO ITS OWN COMMENT.
    // It was written asserting all 24 and measured 23: one seed is genuinely
    // slow and does not clear 600 kg until day 437. That arc is locked out of
    // its first summit for a reason the design is entitled to — it was not
    // strong enough — and the other 23 are locked out for a reason it is not.
    // Keeping the two apart is the whole point of the count.
    const gate = CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds'] as number;
    const clearedInsideTheYear = anchorArcs.filter((arc) =>
      arc.meets.some(
        (meet) =>
          meet.totalKg >= gate &&
          meet.day - seasonAnchorDay() <= CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_DAYS,
      ),
    );
    expect(clearedInsideTheYear).toHaveLength(23);
    expect(clearedInsideTheYear.length).toBeGreaterThan(
      anchorArcs.length - clearedInsideTheYear.length,
    );

    // THE SIDE EFFECT OF THAT CONTROL, PINNED RATHER THAN APOLOGISED FOR.
    // Putting the campaign summit back on the competitive summit's series puts
    // both summits on the same days, and a lifter cannot be at two meets at
    // once — so the competitive tier's entries fall to zero. That is
    // `scheduledMeets`'s same-day tie-break, which `calendar.ts` calls
    // unreachable at the shipped phases, being reached and doing what its
    // comment says: the lower tier on the ladder wins the day.
    const atTheOldPhase = measureCampaignReach('annual-at-the-competitive-phase');
    expect(atTheOldPhase.enteredPerTier['competitive-worlds']).toBe(0);
    expect(measureCampaignReach('shipped').enteredPerTier['competitive-worlds']).toBe(343);
    expect(tierIndex('campaign-worlds')).toBeLessThan(tierIndex('competitive-worlds'));
    // The other three tiers are untouched by the control, which is what says
    // the zero above is the collision and not a thinner fixture.
    expect(atTheOldPhase.enteredPerTier.local).toBe(20016);
    expect(atTheOldPhase.enteredPerTier.regional).toBe(9826);
    expect(atTheOldPhase.enteredPerTier.nationals).toBe(1328);
  });
});
