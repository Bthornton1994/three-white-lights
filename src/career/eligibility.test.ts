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
  careerPotentialKg,
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
    //
    // THESE NUMBERS ALL MOVED WHEN THE TOTALS GENERATOR WAS BOUNDED, and the
    // direction is worth reading rather than just the values. Careers got
    // DEEPER and more uniform — 168 or 169 meets each, against a spread of 164
    // to 169 before — because a bad day is now a bad day rather than a
    // permanent loss of strength, so a lifter no longer falls back under a gate
    // they had already cleared and stops being offered the tier above.
    //
    // AND THEY MOVED AGAIN WHEN `MAX_GAIN_KG` WENT FROM 70 TO 20, THIS TIME
    // SHALLOWER: 164 to 167 meets. The direction is the same mechanism read the
    // other way. A season's length is how many of the 171 meets two calendar
    // periods hold this lifter was eligible for, and a slower lifter spends more
    // of the run under the regional, nationals and summit gates — so they are
    // refused meets a faster lifter would have taken. The per-tier census in
    // axis D counts exactly where the meets went: regional 9959 -> 9788,
    // nationals 1447 -> 1243, campaign summits 709 -> 552.
    expect(shipped.seasons).toBe(24);
    expect(shipped.seasonLengths).toEqual([
      167, 166, 167, 166, 166, 166, 164, 164, 167, 167, 165, 167, 167, 166, 165, 164, 166, 166,
      166, 167, 167, 165, 164, 165,
    ]);
    // `badDays` counts DESCENTS in the total sequence, and it fell from 1422 to
    // 1078 when the generator was bounded, for the same reason it has to stay
    // non-zero: `BAD_DAY_SHARE` still makes 35% of meets bad days, but a bad day
    // early in a career, when capability is climbing fastest, can still land
    // above the meet before it. The count is what says the two rules below are
    // being told apart on real data rather than on a monotone sequence.
    //
    // 1078 -> 1077 AT GAIN 20, AND THE ONE-UNIT MOVE WAS TRACED RATHER THAN
    // WAVED AT, because a change this small in a count this large is exactly the
    // shape of a number nobody checks. Classifying every one of the 4080
    // consecutive pairs at both gains: 21 pairs became descents and 22 stopped
    // being descents, netting -1. Both directions are real. A smaller gain makes
    // a bad day more likely to land under the meet before it (more descents),
    // and it also makes more consecutive totals round to the SAME 2.5 kg grid
    // point, which is not a descent (fewer). Equal-valued pairs go from 1280 to
    // 986, so the second effect is the larger population and the first is the
    // larger per-pair push; they very nearly cancel.
    expect(shipped.badDays).toBe(1077);
    expect(shipped.pairs).toBe(332012);
    // `movedPairs` fell from 273 to 107 when the generator was bounded, and it
    // is the count this axis has least margin on, so it was flagged rather than
    // absorbed. It is how many pairs differ in the SIZE of their qualified set
    // at all — the axis's own domain — and a bounded fixture takes careers to
    // the top of the ladder sooner and keeps them there, so skipping one meet
    // changes which tiers a lifter qualifies for less often.
    //
    // SLOWING THE GAIN RATE PUT IT BACK UP, 107 -> 127, WHICH IS THE ONE COUNT
    // HERE THAT THE RATE CHANGE IMPROVED. A career that takes 41 meets to reach
    // the campaign gate rather than 12 spends far longer straddling each
    // qualifying total, and a pair only moves while the two lifters sit on
    // opposite sides of a gate. The control below moves it to 658.
    expect(shipped.movedPairs).toBe(127);

    // AND THE COUNT THIS ROUND EXISTS FOR. The sweep used to run for one
    // calendar period, which holds exactly one worlds meet, six days after the
    // anchor, with three meet days in front of it — so no simulated lifter
    // could hold the 650 kg it asks for and the worlds column of this fixture
    // was empty. Two periods put a second worlds meet on day 370, and 16 of the
    // 24 careers enter it. The other eight are real refusals rather than a gap
    // in the harness, and the test three below traces them — TWO for their own
    // ceiling and SIX for pace, which is a split that did not exist at gain 70.
    //
    // 22 -> 16 AT GAIN 20, WHICH IS THE RATE CHANGE ARRIVING AT THE TOP OF THE
    // LADDER. The day-370 meet asks 650 kg on a fixed date; a slower lifter is
    // simply not there yet. The count is what says so, and it is the reason the
    // trace below had to be rewritten rather than re-pinned.
    //
    // THE SECOND LINE IS NOT DECORATION AND IT CONSTRAINED THE FIX. A bounded
    // generator whose floor cleared 650 kg would take every career to the top
    // rung and leave this assertion unable to fail; `POTENTIAL_MIN_KG`'s block
    // records that as the reason its band straddles the top gate rather than
    // sitting above it.
    expect(shipped.worldsEntries).toBe(16);
    expect(shipped.worldsEntries).toBeLessThan(ATTENDANCE_SWEEP.SEEDS.length);

    // The control: qualification reading the latest total instead of the best,
    // on the same seasons, the same totals and the same comparison. 283 of the
    // 332012 pairs violate and a lifter loses as many as 26 meets for having
    // competed one more time.
    //
    // THE WORST DEFICIT FELL FROM 26 TO 4 WHEN THE GENERATOR WAS BOUNDED AND IS
    // BACK AT 26 AT GAIN 20, FOR A DIFFERENT REASON EACH TIME. A current-form
    // rule costs a lifter every tier the total they just put up fails to clear.
    // Under the unbounded walk a single bad day could drop a lifter 70 kg and
    // take three rungs of the ladder with it. Bounding the generator made a bad
    // day at most `BAD_DAY_MAX_SHARE` of capability, so it usually crossed one
    // gate rather than several.
    //
    // WHAT PUTS IT BACK AT 26 IS NOT A BIGGER DROP, IT IS WHERE THE CAREER IS
    // STANDING. 26 is exactly the number of regional meets a 364-day window
    // holds — the same 26 the enterable-list test above pins as the tier a
    // lifter GAINS on clearing 400 kg. At gain 70 a career cleared the regional
    // bar on its first or second meet and never came near it again; at gain 20 a
    // career lingers just above 400 kg for many meets, so one bad day under a
    // current-form rule drops it back under that gate and takes the WHOLE
    // regional series away at once. The control bites harder because the fixture
    // now spends real time in the region the rule is dangerous in.
    //
    // Its domain is asserted equal to the shipped arm's for the reason the
    // strength axis gives, with one deliberate exception: `movedPairs` is
    // pinned at its own value rather than tied to the shipped arm, since
    // forcing them equal would be asserting that a broken rule moves exactly as
    // often as a working one.
    expect(control.seasons).toBe(shipped.seasons);
    expect(control.seasonLengths).toEqual(shipped.seasonLengths);
    expect(control.badDays).toBe(shipped.badDays);
    expect(control.pairs).toBe(shipped.pairs);
    expect(control.worldsEntries).toBe(shipped.worldsEntries);
    expect(control.movedPairs).toBe(658);
    expect(control.violatingPairs).toBe(283);
    expect(control.worstDeficit).toBe(26);
    // The worst deficit IS the regional series, not a number that happens to be
    // near it. Asserted rather than left in the comment above, so the account of
    // why this control got sharper is a check instead of a story.
    expect(control.worstDeficit).toBe(
      scheduledMeets(
        ATTENDANCE_SWEEP.FEDERATION,
        ANCHOR,
        addDays(ANCHOR, ATTENDANCE_SWEEP.WINDOW_DAYS),
      ).filter((meet) => meet.tier === 'regional').length,
    );
  });

  it('reaches a current-form rule that waits, and reports two different kinds of zero past it', { timeout: budgetFrom(20_000) }, () => {
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
    // A THIRD ARM WENT AWAY ENTIRELY WHEN THE GENERATOR WAS BOUNDED, AND
    // SLOWING `MAX_GAIN_KG` TO 20 BROUGHT IT BACK. Both halves are this test's
    // subject, and the second half is the finding.
    //
    // `delayed-form-past-visible` sits at a meet count where the rule FIRES and
    // the axis reports nothing — "invisible, not unreachable", which is a
    // different zero from "the rule never ran". It was deleted because on the
    // bounded fixture that region did not exist: scanned at every n from 0 to
    // 170, the violating count was non-zero at all 169 values of n at which the
    // rule fired in any career and zero at exactly the two where it fired in
    // none. Two constants measuring the same zero for the same reason is a check
    // that cannot speak, so it went — with the note that a future fixture change
    // could reopen the region and that the way to find out was to re-run the
    // scan rather than assume.
    //
    // THE SCAN WAS RE-RUN AT GAIN 20, AT EVERY n FROM 0 TO 167. The region is
    // three points wide — 164, 165 and 166 all fire and all report zero — and
    // there are NO interior gaps: every n from 0 to 162 reports a non-zero. So
    // the arm is back, at a point that is no longer adjacent to the far edge.
    //
    // THE PREDICTED CAUSE WAS NOT THE CAUSE. The deletion expected the region to
    // reopen if careers outgrew the top qualifying total again, leaving the rule
    // nothing to take. What actually happened is that the fixture ran out of
    // SUBJECTS: a slower lifter enters fewer gated meets, so seasons are 164 to
    // 167 meets long rather than 168 to 169, and at n = 164 the rule fires in 20
    // careers rather than 24 — too few for one of them to have a bad enough last
    // meet. A silent control can be silent because the rule lost its teeth or
    // because the population thinned, and the zero looks identical either way.
    //
    // So three arms run, and each zero carries a count rather than this comment.
    // `firesIn` is how many of the 24 careers are deep enough for the rule's
    // current-form branch to be taken at all:
    //
    //   - inside (163): the deepest count at which the rule BITES. It fires in
    //     all 24 careers and the axis reports 164 violating pairs.
    //   - past-visible (164): fires in 20 of the 24 and the axis reports
    //     nothing. Invisible.
    //   - past-the-edge (167): fires in none of them. Unreachable.
    const inside = measureAttendanceAxis('delayed-form-inside');
    const pastVisible = measureAttendanceAxis('delayed-form-past-visible');
    const pastTheEdge = measureAttendanceAxis('delayed-form-past-the-edge');

    expect(inside.violatingPairs, 'a delayed current-form rule inside the domain').toBe(164);
    expect(inside.worstDeficit).toBe(1);
    expect(pastVisible.violatingPairs, 'the same rule where it fires and cannot be seen').toBe(0);
    expect(pastVisible.worstDeficit).toBe(0);
    expect(pastTheEdge.violatingPairs, 'the same rule past the deepest career').toBe(0);
    expect(pastTheEdge.worstDeficit).toBe(0);

    // Which arm's branch is reachable at all. `latestTotalAfter(n)` takes its
    // current-form branch on a career's (n+1)-th meet, so a career of length L
    // reaches it exactly when L > n. Counted from the season lengths the axis
    // above pins, so each zero carries its own reason.
    const firesIn = (afterMeets: number): number =>
      inside.seasonLengths.filter((length) => length > afterMeets).length;
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE), 'careers deep enough for the 163 arm').toBe(24);
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE), 'careers deep enough for the 164 arm').toBe(20);
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE), 'careers deep enough for the 167 arm').toBe(0);

    // THE TWO ZEROS ARE HELD APART BY THEIR OWN COUNTS, WHICH IS THE WHOLE
    // REASON THE MIDDLE ARM IS WORTH HAVING. `past-visible` fires in some
    // careers and reports nothing; `past-the-edge` fires in none. Without the
    // middle one a reader of a single zero could not tell which it was — and for
    // one round of this file's history, could not have known there was a
    // difference to tell.
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE)).toBeGreaterThan(0);
    expect(firesIn(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE)).toBe(0);
    // The far edge is the deepest career, derived rather than typed, so a
    // fixture change that deepens the sweep reddens here instead of leaving a
    // stale constant behind.
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE).toBe(Math.max(...inside.seasonLengths));
    // The invisible point is one meet past the last one that bites, which is
    // what makes it the tightest such point rather than any point in the silent
    // region. The scan says the region is {164, 165, 166}; this pins its floor.
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE).toBe(
      ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE + 1,
    );
    // ...and the three are strictly ordered and strictly inside the domain, so
    // none of them has quietly become another.
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE).toBeLessThan(
      ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE,
    );
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_VISIBLE).toBeLessThan(
      ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE,
    );
    // And all three arms ran on the same seasons as each other and as the
    // shipped one, so no zero is about a smaller domain.
    expect(pastVisible.seasonLengths).toEqual(inside.seasonLengths);
    expect(pastTheEdge.seasonLengths).toEqual(inside.seasonLengths);
    expect(inside.pairs).toBe(332012);
    expect(pastVisible.pairs).toBe(332012);
    expect(pastTheEdge.pairs).toBe(332012);
  });

  it('sees a rule keyed to the annual tier now that totals stop above it, and the margin is -10 kg', { timeout: budgetFrom(20_000) }, () => {
    // A ZERO THAT TURNED INTO A ONE WHEN THE FIXTURE CHANGED, AND THE RULE WAS
    // NEVER EDITED. This test used to be called "cannot see a rule keyed to the
    // annual tier at all, and the margin is 27.5 kg", and every word of it was
    // true of the fixture it was written against.
    //
    // `worlds-reset` is the rule: the annual result becomes the lifter's ranking
    // total instead of the better of the two, so a bad day at worlds forgets
    // everything above it while the lifter who stayed home keeps theirs. A
    // plausible design and a §12.3 violation.
    //
    // Under the unbounded totals generator this axis reported zero for it at all
    // three of the calendar's worlds meets, and the middle zero had a measured
    // reason: the lowest total anybody put up at a worlds meet was 677.5 kg
    // against a 650 kg bar, so rewriting a record with it still left the lifter
    // clearing every rung. That reason was written down as a fact about a
    // population rather than a theorem, with a warning that it could move.
    //
    // It moved. Bounded careers plateau in a band that straddles the top of the
    // ladder, the lowest worlds-day total went to 632.5 kg — UNDER the bar — and
    // the middle arm reports a violation. The two outer arms still report zero,
    // and for their own unchanged reason: nobody stands on those two days.
    //
    // AND IT MOVED A THIRD TIME AT `MAX_GAIN_KG` 20, TO -10 kg, WITHOUT THE SIGN
    // CHANGING AND FOR A THIRD REASON. A slower career has not reached its
    // plateau by day 370, so the totals put up at that meet approach the 650 kg
    // bar from below rather than sitting above it: 640 to 745 kg, against 632.5
    // to 862.5 at the old rate. The margin is thinner and the conclusion is the
    // same, which is the most a control's zero can ever be asked to survive.
    const first = measureAttendanceAxis('worlds-reset-first');
    const second = measureAttendanceAxis('worlds-reset-second');
    const third = measureAttendanceAxis('worlds-reset-third');

    expect(first.violatingPairs, 'the worlds meet on day 6, which nobody enters').toBe(0);
    expect(second.violatingPairs, 'the worlds meet on day 370, which 16 careers enter').toBe(1);
    expect(second.worstDeficit).toBe(1);
    expect(third.violatingPairs, 'the worlds meet on day 734, past the simulation').toBe(0);

    // How often the rule's branch is taken at all, so the size of the non-zero
    // is read against the size of the opportunity rather than on its own. It
    // rewrites the record in 4 of the 16 careers that reach that meet.
    //
    // 6 AND NOT 16, AND THE DROP IS A PROPERTY OF THE TWO-LAYER GENERATOR
    // RATHER THAN OF THE RULE. Capability only ever climbs, so a GOOD day puts
    // up exactly the highest capability the lifter has ever had and is
    // therefore always a new best — and `BAD_DAY_SHARE` makes 65% of meets good
    // days. A worlds meet that lands on a good day leaves the record identical
    // under both folds. So roughly a third of the careers get their record
    // rewritten, which is about what a 35% bad-day rate predicts, and the count
    // is here so that a future change to either share shows up as a moved number
    // rather than as a quietly smaller opportunity.
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
    expect(worldsSeasons).toHaveLength(16);
    expect(rewritten).toHaveLength(4);

    // THE MARGIN, WHICH IS THE NUMBER THAT DECIDES WHETHER THIS AXIS CAN SEE THE
    // TIER AT ALL. It is the gap between the worst world result in the fixture
    // and the bar that result has to clear to keep the lifter's ladder intact.
    // Positive means blind; negative means the rule can take a rung away.
    //
    // 677.5 - 650 = +27.5 under the unbounded walk. 632.5 - 650 = -17.5 once it
    // was bounded. 640 - 650 = -10 at gain 20. All three are facts about a
    // population rather than about the calendar, and the three of them together
    // are the clearest thing in this file about how much a control's zero is
    // worth: the same rule, the same check, three fixtures, and the answer
    // flipped once and then nearly flipped back.
    const worldsTotals = worldsSeasons.map(
      (season) => (seasonMeetsOfTier(season, 'competitive-worlds')[0] as SeasonMeet).totalKg,
    );
    expect(Math.min(...worldsTotals)).toBe(640);
    expect(Math.max(...worldsTotals)).toBe(745);
    expect(Math.min(...worldsTotals) - ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG).toBe(-10);
    // A `Math.max(...worldsTotals) <= POTENTIAL_MAX_KG` line stood here and was
    // DELETED AS DOMINATED. The per-career bound test asserts every total is at
    // or under its own career's ceiling, and the band test asserts every ceiling
    // is at or under `POTENTIAL_MAX_KG`; together those imply it, so no state of
    // the generator could have made this the assertion that spoke. The 862.5
    // pin above is the check here, because it moves on any change to the
    // distribution rather than only on an unbounded one.
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
    expect(first.pairs).toBe(332012);
    expect(second.pairs).toBe(332012);
    expect(third.pairs).toBe(332012);
    expect(second.worldsEntries).toBe(16);
  });

  it('a season is a real season: every meet distinct, and none of them entered twice', () => {
    // The fixture the axis rests on. A simulation that entered nothing, or
    // entered one meet eighty times, would leave every comparison above
    // trivially equal.
    const season = simulateSeason(ATTENDANCE_SWEEP.SEEDS[0] as number);
    expect(season).toHaveLength(167);
    expect(new Set(season.map((meet) => meet.meetId)).size).toBe(167);
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
    // round is `FIRST_TOTAL_KG + 3 x MAX_GAIN_KG` = 440 kg against a 650 kg
    // bar. That is arithmetic, not a seed: no career this fixture can generate
    // enters the first worlds meet, at any depth, for any distribution of good
    // and bad days bounded by `MAX_GAIN_KG`. It was 590 at the old gain rate and
    // the argument did not depend on the value — only on the bound being one,
    // which is why this expression is written out rather than pinned as 440.
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
    ).toBe(440);
    expect(
      ATTENDANCE_SWEEP.FIRST_TOTAL_KG + beforeFirstWorlds.length * ATTENDANCE_SWEEP.MAX_GAIN_KG,
    ).toBeLessThan(ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG);

    // The second one is 370 days in, which is one worlds cadence past the
    // first, and 16 of the 24 seeded careers enter it. Both halves are pinned:
    // the count, so the domain says how often it reached the case, and the
    // refusal, so a reader knows the qualifying total is still doing work at
    // the top of the ladder rather than waved through.
    const entered = ATTENDANCE_SWEEP.SEEDS.map((seed) =>
      seasonMeetsOfTier(simulateSeason(seed), 'competitive-worlds'),
    );
    expect(entered.filter((meets) => meets.length > 0)).toHaveLength(16);
    expect(entered.filter((meets) => meets.length === 0)).toHaveLength(8);
    expect(
      (worlds[1] as CareerMeet).day - (worlds[0] as CareerMeet).day,
      'the second worlds is one annual cadence after the first',
    ).toBe(CAREER_TUNING.CADENCE_DAYS['competitive-worlds']);

    // WHY THEY MISS, AND THE ANSWER IS NOW TWO ANSWERS — WHICH IS THE FINDING
    // THAT FORCED THIS BLOCK TO BE REWRITTEN RATHER THAN RE-PINNED.
    //
    // Under the unbounded walk it was one career "holding 552.5 kg on the day" —
    // circumstance. Under the bounded generator at gain 70 it was two careers
    // whose own drawn ceilings sat UNDER the 650 kg bar, so no amount of further
    // running would get them in — structure, and this block said so.
    //
    // At gain 20 it is eight, and SIX OF THE EIGHT HAVE CEILINGS ABOVE THE BAR.
    // They miss because the day-370 meet arrives before they do: their best on
    // that day is 597.5 to 645 kg against a ceiling of 655 to 727.5. Calling all
    // eight structural would have been a false sentence, and the previous
    // version's `toBeLessThan` on every missed seed's ceiling is exactly the
    // assertion that would have gone red — which is the mechanism working.
    //
    // The two categories are pinned separately, so neither can quietly become
    // the other. A future rate change that makes the pace category empty again
    // reddens here rather than leaving this paragraph describing a fixture that
    // has moved.
    const missedSeeds = ATTENDANCE_SWEEP.SEEDS.filter(
      (seed) => seasonMeetsOfTier(simulateSeason(seed), 'competitive-worlds').length === 0,
    );
    expect(missedSeeds).toHaveLength(8);
    const worldsDay = addDays(seasonAnchorDay(), 370);
    const bestOnWorldsDay = (seed: number): number | null => {
      let best: number | null = null;
      for (const meet of simulateSeason(seed)) {
        if (meet.day > worldsDay) break;
        best = best === null ? meet.totalKg : Math.max(best, meet.totalKg);
      }
      return best;
    };
    const refusedByTheirCeiling = missedSeeds.filter(
      (seed) => careerPotentialKg(seed) < ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG,
    );
    const refusedByPace = missedSeeds.filter(
      (seed) => careerPotentialKg(seed) >= ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG,
    );
    expect(refusedByTheirCeiling, 'missed because their ceiling is under the bar').toHaveLength(2);
    expect(refusedByPace, 'missed because the day came first').toHaveLength(6);
    // The two categories are the whole of the misses, so nothing is
    // unaccounted for.
    expect(refusedByTheirCeiling.length + refusedByPace.length).toBe(missedSeeds.length);
    // And each category is what it says. The ceiling group can never get in
    // however long they run; the pace group was genuinely short ON THE DAY,
    // which is a different fact and is measured rather than inferred from the
    // ceiling.
    for (const seed of refusedByPace) {
      expect(bestOnWorldsDay(seed) as number, `seed ${seed} best on the day`).toBeLessThan(
        ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG,
      );
      expect(careerPotentialKg(seed), `seed ${seed} could have got there`).toBeGreaterThanOrEqual(
        ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG,
      );
    }
    // And none of the eight is a weak lifter — every one plateaus above the
    // nationals bar, so the fixture is refusing them one rung rather than
    // shutting them out.
    for (const seed of missedSeeds) {
      expect(careerPotentialKg(seed), `seed ${seed} ceiling over nationals`).toBeGreaterThan(
        CAREER_TUNING.QUALIFYING_TOTAL_KG.nationals ?? 0,
      );
    }
    // Every career that DOES enter drew a ceiling over the bar, which is the
    // one direction that survived the rate change intact and is what makes the
    // count of 16 a measurement of the gate rather than of the calendar alone.
    for (const seed of ATTENDANCE_SWEEP.SEEDS.filter((s) => !missedSeeds.includes(s))) {
      expect(careerPotentialKg(seed), `seed ${seed} ceiling clears the bar`).toBeGreaterThanOrEqual(
        ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG,
      );
    }
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
    // empty variant list or a zero-length season would walk none of them. It was
    // eight, then seven while `delayed-form-past-visible` was deleted as
    // dominated, and is eight again now that slowing the gain rate reopened the
    // region that arm names; see the delayed-form test above.
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
    expect(full).toHaveLength(167);
    // Eight rules times five skips. It was 35 while `delayed-form-past-visible`
    // was deleted.
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
// THE TOTALS GENERATOR'S BOUND
// ---------------------------------------------------------------------------

describe('the totals generator is bounded to a plausible range for the sport', () => {
  // WHY THIS BLOCK EXISTS. The generator used to be an unbounded two-sided
  // random walk. Over the sweep's own 728-day window it reached a peak meet
  // total of 3020 kg and a median of 1107.5 kg — roughly two and a half times
  // the heaviest total any human has recorded, and a distribution whose upper
  // half is about nothing. Every percentile taken deep into it, and every check
  // keyed to where a total sat relative to a qualifying gate, was measuring an
  // artifact.
  //
  // `seededCareerTotals`' own block carries the proof that the replacement is
  // bounded. These are that proof's assertions: without them "bounded" is a
  // sentence in a comment, which is the failure mode CLAUDE.md records most
  // often.

  it('never lets any career, at any depth, exceed the ceiling it drew', () => {
    // THE PER-CAREER BOUND, WHICH IS THE STRONG ONE. A global ceiling would be
    // satisfied by a generator that clamped every career onto the same number;
    // this says each career respects ITS OWN drawn potential, which a clamp at
    // the band's top would fail.
    let checked = 0;
    let closest = Number.POSITIVE_INFINITY;
    for (const seed of ATTENDANCE_SWEEP.SEEDS) {
      const potential = careerPotentialKg(seed);
      const totals = seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER);
      for (const total of totals) {
        expect(total, `seed ${seed} against its own ceiling ${potential}`).toBeLessThanOrEqual(
          potential,
        );
        closest = Math.min(closest, potential - total);
        checked += 1;
      }
    }
    // Counts, not bounds: an empty seed list or a zero-length draw would make
    // every line above trivially true.
    expect(checked).toBe(ATTENDANCE_SWEEP.SEEDS.length * ATTENDANCE_SWEEP.MEETS_PER_CAREER);
    expect(checked).toBe(4104);
    // HOW TIGHT THE BOUND IS, PINNED EXACTLY BECAUSE THE ANSWER CHANGED AND A
    // BOUND WOULD HAVE HIDDEN IT. At gain 70 the closest any career came to its
    // own ceiling was 2.5 kg — one grid step — and this line read
    // `toBeLessThanOrEqual(ROUNDING_KG)`, which said the bound was not passing
    // by being generous. At gain 20 the closest approach is 12.5 kg, so that
    // assertion is FALSE and is replaced by the measurement rather than by a
    // looser bound.
    //
    // WHAT THE 12.5 MEANS, since it is the honest cost of the rate change on
    // this test: a slower career does not close on its own asymptote inside the
    // 171 meets the sweep draws. The bound is still a real bound — every one of
    // the 4104 totals is under its own career's ceiling — and it now has 12.5 kg
    // of daylight rather than one grid step, so it is measurably less tight than
    // it was. `GAIN_DECAY_EXPONENT`'s block carries the same finding from the
    // other end, where it shows up as a minimum peak of 615 against a 625 floor.
    expect(closest).toBe(12.5);
    expect(closest).toBeGreaterThan(ATTENDANCE_SWEEP.ROUNDING_KG);
  });

  it('draws different ceilings for different seeds, so nothing piles up on one number', () => {
    // A HARD CLAMP IS THE OBVIOUS FIX AND IT IS THE WRONG ONE. Clamping every
    // walk at one elite ceiling makes many arcs sit at exactly that ceiling,
    // which is its own unrealism and makes a percentile near the top
    // degenerate. This is the check that says the fix is not that.
    const potentials = ATTENDANCE_SWEEP.SEEDS.map((seed) => careerPotentialKg(seed));
    const peaks = ATTENDANCE_SWEEP.SEEDS.map((seed) =>
      Math.max(...seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER)),
    );
    // Ceilings spread across the band rather than bunching.
    expect(new Set(potentials).size).toBeGreaterThanOrEqual(20);
    expect(Math.min(...potentials)).toBeGreaterThanOrEqual(ATTENDANCE_SWEEP.POTENTIAL_MIN_KG);
    expect(Math.max(...potentials)).toBeLessThanOrEqual(ATTENDANCE_SWEEP.POTENTIAL_MAX_KG);
    // And so do the peaks the careers actually reach, which is the thing a
    // percentile would be taken over. No two-thirds of them share a value.
    expect(new Set(peaks).size).toBeGreaterThanOrEqual(20);
    expect(Math.max(...peaks)).toBe(825);
    expect(Math.min(...peaks)).toBe(615);
    // A `Math.max(...peaks) < POTENTIAL_MAX_KG` line stood here, to say the
    // asymptote is soft, and was DELETED AS DOMINATED by the exact pin directly
    // above it: 882.5 against a 900 band top is decided, so the pin reddens
    // first in every reachable case. The softness is instead visible in the
    // spread assertions above, which a hard clamp fails.
    //
    // THE MINIMUM PEAK IS NOW BELOW THE BAND'S OWN FLOOR — 615 against
    // `POTENTIAL_MIN_KG` of 625 — AND THAT IS REPORTED RATHER THAN SMOOTHED.
    // The two numbers are not in conflict: the floor bounds the ceiling a career
    // is DRAWN, and every draw still respects it (the assertion two lines above
    // this one), while a peak is how far a career actually GOT in 171 meets. At
    // gain 70 those coincided at 625 because careers reached their asymptote; at
    // gain 20 the weakest one stops 12.5 kg short.
    //
    // IT MATTERS BECAUSE IT IS THE EXACT CONDITION THAT RULED OUT
    // `GAIN_DECAY_EXPONENT` 2. That constant's block rejects exponent 2 partly
    // because "the observed minimum peak falls to 617.5 against a 625 floor,
    // which makes the floor stop being something a reader can see in the
    // output". The shipped exponent now does the same thing, harder. The
    // exponent is deliberately NOT changed here — that is a second knob and a
    // human's call — and the block says so at length.
    expect(Math.min(...peaks)).toBeLessThan(ATTENDANCE_SWEEP.POTENTIAL_MIN_KG);
    expect(Math.min(...potentials)).toBeGreaterThanOrEqual(ATTENDANCE_SWEEP.POTENTIAL_MIN_KG);
  });

  it('holds the constant inequality its bound is proved from', () => {
    // THE PROOF'S PREMISE, PINNED SO A TUNER CANNOT QUIETLY REMOVE IT. One
    // meet's gain is at most `MAX_GAIN_KG x (P - c) / (P - FIRST_TOTAL_KG)`.
    // That is strictly less than the remaining gap `P - c` exactly when
    // `MAX_GAIN_KG < P - FIRST_TOTAL_KG`, and the smallest `P` can be is
    // `POTENTIAL_MIN_KG`. Raise `MAX_GAIN_KG` past that span, or lower the band
    // onto the opening total, and the generator stops being bounded — with no
    // other test in this file necessarily noticing.
    expect(ATTENDANCE_SWEEP.MAX_GAIN_KG).toBeLessThan(
      ATTENDANCE_SWEEP.POTENTIAL_MIN_KG - ATTENDANCE_SWEEP.FIRST_TOTAL_KG,
    );
    // Every potential lands on the competition grid, which is the second half of
    // the rounding argument: rounding a value strictly below a grid point to
    // that grid cannot land above it.
    for (const seed of ATTENDANCE_SWEEP.SEEDS) {
      expect((careerPotentialKg(seed) * 10) % (ATTENDANCE_SWEEP.ROUNDING_KG * 10)).toBe(0);
    }
  });

  it('puts the band where the sourced research puts real elite totals', () => {
    // THE BAND IS A RULE RATHER THAN A TASTE, AND THE RULE IS WHAT IS ASSERTED.
    // `POTENTIAL_MIN_KG`'s block gives the argument; this is it as a check, so a
    // tuner who moves a qualifying total past the band is told that the band has
    // stopped being derived from anything.
    //
    // ABOVE the campaign summit's gate, so GDD §6.6's R1 stays a statement about
    // the CALENDAR rather than becoming one about strength.
    expect(ATTENDANCE_SWEEP.POTENTIAL_MIN_KG).toBeGreaterThan(
      CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds'] as number,
    );
    // BELOW the competitive summit's gate, so the top of the ladder goes on
    // refusing somebody and `worldsEntries` cannot saturate at the seed count.
    expect(ATTENDANCE_SWEEP.POTENTIAL_MIN_KG).toBeLessThan(
      CAREER_TUNING.QUALIFYING_TOTAL_KG['competitive-worlds'] as number,
    );
    // Which, at the shipped gates, is the midpoint — the same stated-rule shape
    // the campaign gate itself is set by.
    expect(ATTENDANCE_SWEEP.POTENTIAL_MIN_KG).toBe(
      ((CAREER_TUNING.QUALIFYING_TOTAL_KG['campaign-worlds'] as number) +
        (CAREER_TUNING.QUALIFYING_TOTAL_KG['competitive-worlds'] as number)) /
        2,
    );
    // The top of the band sits inside the range the derived table's strongest
    // designated cells occupy — `docs/research/qualifying-totals.md` §3.1's raw
    // men's Open `worlds` row runs 537.5 to 902.5 kg — and under the heaviest
    // single total anywhere in that dataset, 1153.5 kg. Both are transcribed
    // here rather than imported, because that document is research and is wired
    // into nothing; what the assertion buys is that the band cannot drift out of
    // the range it was justified by without this line moving too.
    expect(ATTENDANCE_SWEEP.POTENTIAL_MAX_KG).toBeLessThan(902.5);
    // A second bound at 1153.5 — the heaviest single total anywhere in that
    // dataset — stood here and was DELETED AS DOMINATED by the 902.5 above it.
    // 902.5 < 1153.5, so the looser one could never be the assertion that spoke.
    // The number is kept in the comment, where it is doing the job it was
    // actually doing: telling a reader how far under the extreme the band sits.
    expect(ATTENDANCE_SWEEP.POTENTIAL_MAX_KG).toBeGreaterThan(
      ATTENDANCE_SWEEP.POTENTIAL_MIN_KG,
    );
  });

  it('keeps the totals two-sided, which every record control depends on', () => {
    // THE PROPERTY THE BOUND COULD HAVE DESTROYED. Capability only climbs in
    // the new generator, and a sequence that only ever rose would make
    // `latest-total-wins` and every delayed form of it report zero — an empty
    // domain in the one place nobody would look for one. What keeps it
    // non-empty is that a bad day is a haircut off capability, so the TOTALS go
    // down even though the strength behind them does not.
    let descents = 0;
    let drawn = 0;
    for (const seed of ATTENDANCE_SWEEP.SEEDS) {
      const totals = seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER);
      descents += badDayCount(totals);
      drawn += totals.length;
    }
    expect(descents).toBe(1077);
    expect(drawn).toBe(4104);
    // A `descents / drawn > 0.2` line stood here and was DELETED AS DOMINATED:
    // with both the numerator and the denominator pinned exactly on the two
    // lines above, the ratio is arithmetic rather than a check, and it could
    // never have been the assertion that reddened. The count and its
    // denominator are what a reader needs — 1078 of 4104, about a quarter.
    //
    // DELIBERATELY THE SAME NUMBER AS AXIS B's `badDays`, which is the same
    // quantity computed the same way. That duplication is kept rather than
    // pruned: this is the generator's own test and the natural place to read the
    // count off, and axis B pins it because the axis is worthless without it.
    // Both can fail, and they fail together, which is a different thing from one
    // of them being unable to speak.
  });

  it('is a prefix extension in its depth argument, so both sweeps get the same lifters', () => {
    // AXIS B DRAWS 171 AND AXIS D DRAWS 200 FROM THE SAME SEEDS. If the ceiling
    // draw depended on how deep the caller asked, those would be different
    // lifters wearing the same seed, and the two axes would silently be about
    // different populations. The draw is the head of the stream for exactly this
    // reason, and this is the assertion that says so.
    for (const seed of ATTENDANCE_SWEEP.SEEDS) {
      const shallow = seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER);
      const deep = seededCareerTotals(seed, CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC);
      expect(deep.slice(0, shallow.length), `seed ${seed} prefix`).toEqual([...shallow]);
    }
    expect(CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC).toBeGreaterThan(ATTENDANCE_SWEEP.MEETS_PER_CAREER);
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
 * 167 ids. Every control here is a lockout, so all of them filter the same
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
  it('every skipped meet in every seeded season, against a rest control and three tier-keyed ones', { timeout: budgetFrom(112_460) }, () => {
    // WHAT THIS AXIS IS FOR, and it is the one thing axes A and B cannot do.
    // Both of them run through `qualifiedMeets`, which reads the federation and
    // the Total and never looks at `enteredMeetIds` — pinned directly under
    // axis A. So across all 80601 + 332012 of their compared pairs the entered
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
    expect(shipped.pairs).toBe(332012);
    expect(shipped.spentPairs).toBe(3980);
    expect(shipped.spentPairs).toBe(shipped.seasonMeets);
    expect(shipped.movedPairs).toBe(3995);
    expect(shipped.growingPairs).toBe(127);

    // The rest control: a mandatory 28 days off after a meet, which is the most
    // plausible design of the controls this module measures against and is
    // exactly what GDD §12.3 refuses. The lifter who competed at one more meet
    // starts their lockout later, so 3739 pairs hand them a shorter calendar
    // than the lifter who stayed home, and as many as 4 of the meets they lose
    // are meets they never went to.
    //
    // Its domain is asserted against the shipped arm's where the two are the
    // same question, and pinned at its own value where the control's rule
    // changes the answer. `spentPairs` collapses from 3980 to 24 under it, and
    // the collapse is the control describing itself: at the calendar's own
    // resolution the lifter who stayed home is nearly always inside a lockout
    // of their own, so the meet the other one spent was unavailable to both.
    // The 24 that survive are one per season — the pair at a lifter's very
    // first meet, where the one who stayed home has no previous meet and so no
    // lockout — which is why the count is asserted against the seed list as
    // well as pinned.
    expect(rest.pairs).toBe(shipped.pairs);
    expect(rest.seasonMeets).toBe(shipped.seasonMeets);
    // `growingPairs` USED TO BE ASSERTED EQUAL TO THE SHIPPED ARM'S, WAS THEN
    // PINNED ONE LOWER, AND IS EQUAL AGAIN — WHICH IS WHY IT IS PINNED AT ITS
    // OWN VALUE IN BOTH WORLDS RATHER THAN TIED TO THE OTHER ARM.
    //
    // The equality was never a domain identity. A lockout filters BOTH lifters'
    // lists, and the diligent lifter's lockout starts later because they
    // competed more recently, so a meet the diligent lifter uniquely could have
    // entered can be locked out from under them. At gain 70 exactly one pair in
    // the fixture did that, and this file recorded the `- 1` as the control
    // touching the thing it is built to touch. At gain 20 no pair does, so the
    // two are equal again — and if the `- 1` had been left in place it would
    // have gone red for a reason that is about the fixture rather than the rule.
    //
    // A DIFFERENCE OF ZERO IS NOT EVIDENCE THAT THE CONTROL IS INERT. Its
    // `unexplainedPairs` is 3739, which is the count that says what it does.
    expect(rest.growingPairs).toBe(127);
    expect(rest.growingPairs).toBe(shipped.growingPairs);
    expect(rest.movedPairs).toBe(3751);
    expect(rest.spentPairs).toBe(24);
    expect(rest.spentPairs).toBe(ATTENDANCE_SWEEP.SEEDS.length);
    expect(rest.unexplainedPairs).toBe(3739);
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
    // closed: 96 pairs where the lifter who went to the world championship may
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
    expect(worldsSecond.unexplainedPairs, 'a lockout after the day-370 worlds meet').toBe(96);
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
    expect(worldsSecond.spentPairs).toBe(3884);
    expect(worldsSecond.movedPairs).toBe(3979);
    expect(worldsSecond.spentPairs).toBeLessThan(shipped.spentPairs);
    // Every arm ran the same pairs, so none of the numbers above is about a
    // domain of its own.
    for (const arm of [worldsFirst, worldsSecond, worldsThird]) {
      expect(arm.pairs).toBe(shipped.pairs);
      expect(arm.seasonMeets).toBe(shipped.seasonMeets);
      expect(arm.growingPairs).toBe(shipped.growingPairs);
    }

  });

  it('is blind at axis B’s evaluation lag, which is why it has its own', { timeout: budgetFrom(96_198) }, () => {
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
    expect(blindLag.movedPairs).toBe(127);
    expect(blindLag.growingPairs).toBe(127);
    expect(blindLag.pairs).toBe(332012);
    expect(blindLag.seasonMeets).toBe(3980);
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
    expect(CAMPAIGN_CALENDAR_VARIANTS['semi-annual-at-the-competitive-phase']).toEqual({
      cadenceDays: CAREER_TUNING.CADENCE_DAYS['campaign-worlds'],
      phaseDays: CAREER_TUNING.PHASE_DAYS['competitive-worlds'],
    });
    // The four shapes are the four corners of the two-knob square, which is
    // what makes them able to separate the knobs. Asserted as a set of pairs so
    // a duplicated corner — two arms that are secretly the same calendar —
    // reddens rather than quietly halving the measurement.
    const corners = Object.values(CAMPAIGN_CALENDAR_VARIANTS).map(
      (shape) => `${shape.cadenceDays}/${shape.phaseDays}`,
    );
    expect(new Set(corners).size).toBe(4);
    expect(new Set(Object.values(CAMPAIGN_CALENDAR_VARIANTS).map((s) => s.cadenceDays)).size).toBe(2);
    expect(new Set(Object.values(CAMPAIGN_CALENDAR_VARIANTS).map((s) => s.phaseDays)).size).toBe(2);
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
    for (const variant of [
      'annual-at-the-competitive-phase',
      'annual-late',
      'semi-annual-at-the-competitive-phase',
    ] as const) {
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
    const semiAnnualAtTheOldPhase = measureCampaignReach('semi-annual-at-the-competitive-phase');

    // THE SHIPPED ARM'S OWN PROPERTIES FIRST, AND THE ORDER IS DELIBERATE for
    // the reason axis A states at length: vitest stops a test at its first
    // failing expectation, so whichever assertion comes first is the one that
    // speaks when the calendar breaks. An earlier draft of this test put the
    // controls above R2b, and a mutation that made the summit unreachable
    // reported "expected 191 to be 189" — true, and about a control.

    // R1. GDD §6.6 requires the campaign summit to be "always reachable"; every
    // one of the 192 arcs reaches one.
    expect(shipped.arcsReachingASummit).toBe(shipped.arcs);
    expect(shipped.arcs).toBe(192);
    expect(shipped.arcs).toBe(
      ATTENDANCE_SWEEP.SEEDS.length * CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS.length,
    );

    // R2b, WHICH IS THE CLAUSE THAT ACTUALLY BITES. "Always reachable" is a
    // claim about every player, not about an average, and cutting the
    // first-year count by signup day is what turns it into one. The shipped
    // calendar's worst signup day gets 15 of its 24 arcs to a summit inside the
    // first year. That number has been 19, then 24 when the totals generator was
    // bounded, and 15 since `MAX_GAIN_KG` went to 20. The controls' zeros have
    // not moved on any of the three fixtures, which is what says the gap is the
    // calendar's rather than the fixture's — and is why this clause survived the
    // rate change while R2 below did not.
    expect(shipped.worstOffsetFirstYearArcs).toBeGreaterThanOrEqual(
      CAMPAIGN_SUMMIT_SWEEP.MIN_FIRST_YEAR_ARCS_PER_OFFSET,
    );
    expect(shipped.worstOffsetFirstYearArcs).toBe(15);
    expect(shipped.firstYearArcsPerOffset).toEqual([23, 23, 21, 20, 20, 20, 16, 15]);

    // =====================================================================
    // R2 IS RED HERE, DELIBERATELY, AND THE TWO LINES BELOW ARE THE FINDING
    // =====================================================================
    // At `MAX_GAIN_KG` 20 the shipped calendar takes 158 of 192 arcs to a summit
    // inside their first year against a required 168, and the median arc waits
    // 290 days against a ceiling of 250. Both halves of R2 miss.
    //
    // THE BARS ARE NOT MOVED TO MATCH. A requirement adjusted to fit the
    // measurement that just broke it is a pin nudged until green, which CLAUDE.md
    // calls worse than no pin at all — and this particular requirement has been
    // read off three different fixtures already (176, then 192, now 158) without
    // ever being derived from what a campaign should feel like. Whether it is
    // still the right requirement at a gain rate deliberately slowed by a factor
    // of three and a half is a human's ruling, not a builder's.
    //
    // WHAT IS NOT IN DOUBT: R1 above is 192 of 192 and R2b above clears its bar
    // on every signup day, so the summit is REACHABLE for every arc and no
    // signup day is locked out. R2 is a PACE clause and the pace was slowed on
    // purpose. See `FIRST_YEAR_ARCS_REQUIRED`'s block for the full account.
    //
    // THE TWO BARS ARE `expect.soft` AND NOTHING ELSE IN THIS REPOSITORY IS.
    // Vitest stops a test at its first failing expectation — a property the rest
    // of this file relies on and states at length, which is why the PROPERTY is
    // always asserted before the domain pins. Here that property works against
    // the reader: R2 has two halves, both miss, and a hard assertion on the
    // first means a run only ever reports one of them. A finding that a human
    // has to rule on should arrive whole. `soft` still fails the test — this is
    // not a suppression — it just lets both halves and the exact measurements
    // below them speak in the same run.
    expect.soft(
      shipped.arcsReachingInsideAYear,
      'R2 first half: 158 of 192 against a required 168 at MAX_GAIN_KG 20 — reported, not re-pinned',
    ).toBeGreaterThanOrEqual(CAMPAIGN_SUMMIT_SWEEP.FIRST_YEAR_ARCS_REQUIRED);
    expect(shipped.arcsReachingInsideAYear).toBe(158);
    expect.soft(
      shipped.medianDaysToFirstSummit as number,
      'R2 second half: a 290-day median against a 250-day ceiling — reported, not re-pinned',
    ).toBeLessThanOrEqual(CAMPAIGN_SUMMIT_SWEEP.MEDIAN_DAYS_CEILING);
    expect(shipped.medianDaysToFirstSummit).toBe(290);
    expect(shipped.worstDaysToFirstSummit).toBe(562);

    // R3's second half, WHICH IS THE CLAUSE THE RATE CHANGE REPAIRED. The
    // fastest arc had EIGHT meets behind it under the unbounded walk and NINE
    // once the generator was given a per-lifter ceiling — and that one-meet move
    // was the finding, because a ceiling bounds where a career ENDS UP and
    // barely touches how fast it STARTS. `MAX_GAIN_KG` is the knob that touches
    // how fast it starts, and moving it took the floor to THIRTY-ONE. The
    // fastest arc in the whole 192 now has thirty meets behind it before it
    // stands on a summit.
    expect(shipped.fewestMeetsBeforeASummit as number).toBeGreaterThanOrEqual(
      CAMPAIGN_SUMMIT_SWEEP.MIN_MEETS_BEFORE_A_SUMMIT,
    );
    expect(shipped.fewestMeetsBeforeASummit).toBe(31);

    // NOW THE CONTROLS, AND THE FIRST THING THEY SAY IS THAT R1 HAS ONE ARC OF
    // SEPARATING POWER BACK. It used to separate the calendar GDD §6.6 recorded
    // as a design violation from the one that repairs it by a single arc — 192
    // against 191. Bounding the totals generator took that to zero and this test
    // recorded R1 as exactly vacuous. Slowing the gain rate puts the annual
    // controls back at 191.
    //
    // ONE ARC IS NOT EVIDENCE, AND R1 IS KEPT FOR THE REASON IT WAS KEPT WHEN IT
    // SEPARATED NOTHING: GDD §6.6 states it as an absolute and CLAUDE.md has
    // three times refused a documented breach of one. R2b separates them by
    // fifteen.
    expect(atTheOldPhase.arcsReachingASummit).toBe(191);
    expect(annualLate.arcsReachingASummit).toBe(191);
    expect(shipped.arcsReachingASummit).toBeGreaterThan(atTheOldPhase.arcsReachingASummit);
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
    expect(atTheOldPhase.firstYearArcsPerOffset).toEqual([0, 23, 22, 21, 20, 20, 17, 16]);
    expect(annualLate.firstYearArcsPerOffset).toEqual([10, 1, 0, 0, 0, 0, 0, 0]);
    // Neither knob alone. That is the whole argument for changing both, and it
    // is these two rows rather than a paragraph.
    expect(atTheOldPhase.firstYearArcsPerOffset[0]).toBe(0);
    expect(
      annualLate.firstYearArcsPerOffset[CAMPAIGN_SUMMIT_SWEEP.SIGNUP_OFFSET_DAYS.length - 1],
    ).toBe(0);

    // The controls on the pacing statistics, so the shipped numbers are numbers
    // against something. AND NOTE WHAT THE SLOWER RATE DID TO `annual-late`: its
    // first-year count fell from 133 to 11 and its median from 154 to 449 days.
    // An annual series and a lifter who needs most of a year to qualify are a
    // bad combination in a way a fast fixture could not show.
    expect(atTheOldPhase.arcsReachingInsideAYear).toBe(139);
    expect(annualLate.arcsReachingInsideAYear).toBe(11);
    expect(atTheOldPhase.medianDaysToFirstSummit).toBe(324);
    expect(annualLate.medianDaysToFirstSummit).toBe(449);

    // THE FOURTH CORNER, AND IT CORRECTS WHAT THE THREE ROWS ABOVE READ LIKE.
    // Both controls so far moved the CADENCE as well as the phase, so "neither
    // knob alone" is not something they can establish — and `PHASE_DAYS` said
    // it anyway. Holding the cadence at the shipped semi-annual and putting the
    // phase back on day six: still 192 of 192, worst signup day 14 against the
    // shipped calendar's 15. That pair has been 18/19, then 24/24, then 14/15
    // across three fixtures.
    //
    // THE CADENCE IS THE REACHABILITY FIX. The phase is very nearly free for
    // that purpose, and the reason is arithmetic rather than this population —
    // a series coming round twice a year has an occurrence within 182 days of
    // every day there is, wherever it starts.
    expect(semiAnnualAtTheOldPhase.arcsReachingASummit).toBe(192);
    expect(semiAnnualAtTheOldPhase.worstOffsetFirstYearArcs).toBe(14);
    expect(semiAnnualAtTheOldPhase.arcsReachingInsideAYear).toBe(153);
    // Read as a 2x2 on the one statistic R2b is about: the two semi-annual
    // corners clear the bar and the two annual corners are zero, whichever
    // phase each is at. That is the shape of "one knob decides this", and it is
    // the same shape at 15/14/0/0 as it was at 24/24/0/0.
    expect([
      shipped.worstOffsetFirstYearArcs,
      semiAnnualAtTheOldPhase.worstOffsetFirstYearArcs,
      annualLate.worstOffsetFirstYearArcs,
      atTheOldPhase.worstOffsetFirstYearArcs,
    ]).toEqual([15, 14, 0, 0]);

    // AND THE PHASE'S OWN STATISTIC, WHICH NOTHING ABOVE REACHES. R1, R2 and
    // R2b are all about whether a summit ARRIVES. This is about whether the
    // first one a new lifter is SHOWN is one they could ever enter: at the
    // day-six phase the season opens with a world championship that no seed can
    // make, under either cadence, and the calendar draws it anyway.
    //
    // 10 OF 24 RATHER THAN 24 OF 24, AND THAT IS WHERE THE RATE CHANGE COSTS
    // SOMETHING REAL. The first campaign summit an anchor-signup lifter is shown
    // falls on day 177, and at gain 20 the median career needs 187 days to put
    // up the 600 kg it asks for — so slightly over half of them now watch that
    // one go past too. The phase still buys what this block says it buys; it
    // buys less of it, and the split on the phase is unchanged.
    expect(shipped.anchorArcsEnteringTheirFirstOfferedSummit).toBe(10);
    expect(annualLate.anchorArcsEnteringTheirFirstOfferedSummit).toBe(10);
    expect(atTheOldPhase.anchorArcsEnteringTheirFirstOfferedSummit).toBe(0);
    expect(semiAnnualAtTheOldPhase.anchorArcsEnteringTheirFirstOfferedSummit).toBe(0);
    // The 2x2 the other way up, so the two knobs are visibly orthogonal: this
    // statistic splits on the PHASE and R2b's splits on the CADENCE.
    expect([
      shipped.anchorArcsEnteringTheirFirstOfferedSummit,
      annualLate.anchorArcsEnteringTheirFirstOfferedSummit,
      semiAnnualAtTheOldPhase.anchorArcsEnteringTheirFirstOfferedSummit,
      atTheOldPhase.anchorArcsEnteringTheirFirstOfferedSummit,
    ]).toEqual([10, 10, 0, 0]);
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
      regional: 9788,
      nationals: 1243,
      'campaign-worlds': 552,
      'competitive-worlds': 227,
    });
    // Every tier is entered and no tier is entered more often than it is
    // offered, which is the shape a census has when it is a census of something.
    for (const tier of MEET_TIER_ORDER) {
      expect(shipped.enteredPerTier[tier], `${tier} entered`).toBeGreaterThan(0);
      expect(shipped.enteredPerTier[tier], `${tier} against offered`).toBeLessThanOrEqual(
        shipped.offeredPerTier[tier],
      );
    }
    // NATIONALS IS THIN AND IS REPORTED AS THIN. 1243 of 1536 offered is 81%,
    // which is the number a reader should have rather than "nationals is fine
    // now". It has been 1328 (86%) under the unbounded generator, 1447 (94%)
    // once that was bounded, and 1243 (81%) since `MAX_GAIN_KG` went to 20 —
    // which is the LOWEST of the three. Every one of those moves is the fixture
    // rather than the tier: what decides the ratio is how much of a 728-day run
    // a lifter spends under the 550 kg nationals bar, and a slower lifter spends
    // more of it there than either faster fixture did.
    expect(shipped.enteredPerTier.nationals / shipped.offeredPerTier.nationals).toBeCloseTo(
      0.8092,
      4,
    );
    expect(shipped.offeredPerTier.nationals - shipped.enteredPerTier.nationals).toBe(293);
    // AND COMPETITIVE WORLDS WENT THE OTHER WAY — 343 entries, then 318, now
    // 227 — which is the check that says the moves above are not just
    // "everything got easier" or "everything got harder" in step. Two of the 24
    // seeds draw a ceiling under the 650 kg bar and can never enter that tier;
    // at gain 20 six more arrive at the day-370 meet too light. Both are the top
    // gate refusing somebody, for two different reasons, and the axis-B trace
    // holds them apart.
    expect(shipped.enteredPerTier['competitive-worlds']).toBeLessThan(
      shipped.offeredPerTier['competitive-worlds'],
    );
    // And the summit is scarce. 768 offered against 20016 local meets is what
    // keeps it a summit rather than a rung.
    expect(shipped.offeredPerTier['campaign-worlds'] / shipped.offeredPerTier.local).toBeLessThan(0.05);

    // `MEETS_PER_ARC` is a ceiling rather than a count, so the slack is
    // measured instead of assumed. An arc that ran past it throws.
    expect(shipped.deepestArc).toBe(168);
    expect(shipped.deepestArc).toBeLessThan(CAMPAIGN_SUMMIT_SWEEP.MEETS_PER_ARC);
    expect(shipped.summitsEntered).toBe(552);
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
    // THIS COUNT HAS BEEN 23, THEN 24, AND IS 23 AGAIN, AND THE ROUND TRIP IS
    // WHY IT IS WORTH KEEPING. The check was first written asserting all 24 and
    // measured 23; the comment was corrected to record that one seed was
    // genuinely slow, not clearing 600 kg until day 437, and was therefore
    // locked out for a reason the design is entitled to. Bounding the totals
    // generator removed that seed's slow year and the count saturated at 24 —
    // which cost this test its discrimination, because a `toBeGreaterThan`
    // comparing 24 against 0 cannot fail while any arc clears the gate.
    //
    // SLOWING `MAX_GAIN_KG` TO 20 GAVE THE DISCRIMINATION BACK: one arc again
    // fails to clear the gate inside its first year, so the comparison below is
    // 23 against 1 rather than 24 against 0. The evidence is still the zero
    // above it — no arc ENTERS a summit inside its first year — measured against
    // 23 arcs that could have.
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
    expect(measureCampaignReach('shipped').enteredPerTier['competitive-worlds']).toBe(227);
    expect(tierIndex('campaign-worlds')).toBeLessThan(tierIndex('competitive-worlds'));
    // The other three tiers are untouched by the control, which is what says
    // the zero above is the collision and not a thinner fixture.
    expect(atTheOldPhase.enteredPerTier.local).toBe(20016);
    expect(atTheOldPhase.enteredPerTier.regional).toBe(9788);
    expect(atTheOldPhase.enteredPerTier.nationals).toBe(1243);
  });
});
