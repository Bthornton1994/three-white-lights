import { describe, expect, it } from 'vitest';

import { addDays, asStreakDay, type StreakDay } from '../game/streak';
import { CAREER_COPY } from './careerTuning';
import { careerMeetFor, scheduledMeets, seasonAnchorDay, upcomingMeets, type CareerMeet } from './calendar';
import {
  ATTENDANCE_SWEEP,
  QUALIFICATION_VARIANTS,
  STRENGTH_SWEEP,
  badDayCount,
  careerAfter,
  seededCareerTotals,
  simulateSeason,
  strengthGrid,
  type QualificationVariant,
  type RecordVariant,
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
    expect(qualifiedTiers(650)).toEqual(['local', 'regional', 'nationals', 'worlds']);
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
    const worlds = careerMeetFor('meridian', 'worlds', addDays(ANCHOR, 6));
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

  it('the refusal order is the one the header states, on a meet that fails all four', () => {
    // Another federation's meet, already entered, long past, and above the
    // lifter's total. Each check moving up or down the chain changes this
    // answer, which is what makes the order a fact rather than a comment.
    const foreignWorlds = careerMeetFor('ironline', 'worlds', ANCHOR);
    const lifter = lifterWith(null, [foreignWorlds.id]);
    expect(entryVerdict(lifter, foreignWorlds, addDays(ANCHOR, 400))).toMatchObject({
      reason: 'WRONG_FEDERATION',
    });
    const ownWorlds = careerMeetFor('meridian', 'worlds', ANCHOR);
    expect(
      entryVerdict(lifterWith(null, [ownWorlds.id]), ownWorlds, addDays(ANCHOR, 400)),
    ).toMatchObject({ reason: 'ALREADY_ENTERED' });
    expect(entryVerdict(lifterWith(null), ownWorlds, addDays(ANCHOR, 400))).toMatchObject({
      reason: 'MEET_HAS_PASSED',
    });
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
    expect(upcomingMeets('meridian', ANCHOR)).toHaveLength(84);
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
    // line made a mutation of `qualifiesFor` report "expected 1200 to be 55301"
    // — true, and about the sweep's population rather than about the guarantee.
    // The domain pins below still run whenever this one passes, which is the
    // only case where their order matters at all.
    expect(shipped.violatingPairs).toBe(0);
    expect(shipped.worstDeficit).toBe(0);

    // The domain, pinned as counts rather than as bounds. An empty grid, an
    // empty window or a rule that put every lifter in the same set would leave
    // the zero above true and meaningless; these say it is not.
    expect(shipped.gridSize).toBe(402);
    expect(shipped.meetsInWindow).toBe(84);
    expect(shipped.pairs).toBe(80601);
    expect(shipped.distinctSetSizes).toBe(4);
    // These two coincide at 55301 and are not the same question: one asks
    // whether the sets are different SIZES, the other whether the stronger
    // lifter holds something the weaker does not. A rule producing equal-sized
    // but different sets separates them, so neither subsumes the other here.
    expect(shipped.differingPairs).toBe(55301);
    expect(shipped.growingPairs).toBe(55301);

    // The control: one plausible design — a lifter may only enter the highest
    // tier they have qualified for — measured on the same grid, the same
    // window and the same comparison. 55301 of the 80601 pairs violate, and a
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
    expect(control.violatingPairs).toBe(55301);
    expect(control.worstDeficit).toBe(53);
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
  readonly pairs: number;
  /** Pairs where the two lifters' qualified sets are not the same size. */
  readonly movedPairs: number;
  /** Pairs where the lifter who competed more qualifies for fewer meets. */
  readonly violatingPairs: number;
  readonly worstDeficit: number;
}

/** One implementation, two arms, for the same reason as the strength axis. */
function measureAttendanceAxis(variant: RecordVariant): AttendanceMeasurement {
  let pairs = 0;
  let movedPairs = 0;
  let violatingPairs = 0;
  let worstDeficit = 0;
  let badDays = 0;
  const seasonLengths: number[] = [];
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    badDays += badDayCount(seededCareerTotals(seed, ATTENDANCE_SWEEP.MEETS_PER_CAREER));
    const season = simulateSeason(seed);
    seasonLengths.push(season.length);
    for (let through = 0; through < season.length; through += 1) {
      const meet = season[through];
      if (meet === undefined) continue;
      const evalDay = addDays(meet.day, ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS);
      const to = addDays(evalDay, ATTENDANCE_SWEEP.WINDOW_DAYS);
      const diligent = careerAfter(season, through, null, variant);
      const attended = new Set(qualifiedMeets(diligent, evalDay, to).map((m) => m.id));
      for (let skip = 0; skip <= through; skip += 1) {
        const idle = careerAfter(season, through, skip, variant);
        const skipped = new Set(qualifiedMeets(idle, evalDay, to).map((m) => m.id));
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
    expect(shipped.seasons).toBe(24);
    expect(shipped.seasonLengths).toEqual(Array.from({ length: 24 }, () => 14));
    expect(shipped.badDays).toBe(126);
    expect(shipped.pairs).toBe(2520);
    expect(shipped.movedPairs).toBe(78);

    // The control: qualification reading the latest total instead of the best,
    // on the same seasons, the same totals and the same comparison. 24 of the
    // 2520 pairs violate and a lifter loses as many as 26 meets for having
    // competed one more time.
    //
    // Its domain is asserted equal to the shipped arm's for the reason the
    // strength axis gives, with one deliberate exception: `movedPairs` is 79
    // rather than 78, because the control's own rule changes which comparisons
    // move. That one is pinned at its own value instead of being tied to the
    // shipped arm, since forcing them equal would be asserting that a broken
    // rule moves exactly as often as a working one.
    expect(control.seasons).toBe(shipped.seasons);
    expect(control.seasonLengths).toEqual(shipped.seasonLengths);
    expect(control.badDays).toBe(shipped.badDays);
    expect(control.pairs).toBe(shipped.pairs);
    expect(control.movedPairs).toBe(79);
    expect(control.violatingPairs).toBe(24);
    expect(control.worstDeficit).toBe(26);
  });

  it('a season is a real season: fourteen meets, none of them entered twice', () => {
    // The fixture the axis rests on. A simulation that entered nothing, or
    // entered one meet fourteen times, would leave every comparison above
    // trivially equal.
    const season = simulateSeason(ATTENDANCE_SWEEP.SEEDS[0] as number);
    expect(season).toHaveLength(14);
    expect(new Set(season.map((meet) => meet.meetId)).size).toBe(14);
    for (let index = 1; index < season.length; index += 1) {
      const gap = (season[index] as { day: StreakDay }).day - (season[index - 1] as { day: StreakDay }).day;
      expect(gap).toBeGreaterThanOrEqual(ATTENDANCE_SWEEP.DAYS_BETWEEN_MEETS);
    }
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
