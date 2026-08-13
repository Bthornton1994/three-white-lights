import { describe, expect, it } from 'vitest';

import { budgetFrom } from '../../tools/testBudget.mjs';
import { addDays, asStreakDay, type StreakDay } from '../game/streak';
import { CAREER_TUNING, CAREER_COPY, MEET_TIER_ORDER } from './careerTuning';
import { careerMeetFor, scheduledMeets, seasonAnchorDay, upcomingMeets, type CareerMeet } from './calendar';
import {
  ATTENDANCE_SWEEP,
  ENTRY_VARIANTS,
  QUALIFICATION_VARIANTS,
  STRENGTH_SWEEP,
  badDayCount,
  careerAfter,
  lastEnteredDayOf,
  seededCareerTotals,
  simulateSeason,
  strengthGrid,
  type EntryVariant,
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

  it('the refusal order is the one the header states, walked to the bottom of the chain', () => {
    // Another federation's meet, already entered, long past, and above the
    // lifter's total. Lifting one failing condition at a time walks the whole
    // chain, and the walk is what makes the order a fact rather than a comment.
    //
    // IT USED TO STOP AT THE THIRD RUNG. Three of the four positions were
    // exercised and `BELOW_QUALIFYING_TOTAL` — the last check, the one every
    // reordering of the other three still leaves at the bottom — was reached by
    // no case here, so the claim above it covered a position nothing drove.
    const foreignWorlds = careerMeetFor('ironline', 'worlds', ANCHOR);
    const ownWorlds = careerMeetFor('meridian', 'worlds', ANCHOR);
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
      compared += 1;
    }
    // Counts, not bounds: an empty grid would satisfy the loop above silently.
    expect(compared).toBe(402);
    expect(everyMeet).toHaveLength(84);
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
  it('[attending-a-meet-never-removes-one] every skipped meet in every seeded season, and the control beside it', { timeout: budgetFrom(11_109) }, () => {
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
      82, 82, 81, 82, 82, 81, 77, 81, 82, 80, 77, 82, 82, 78, 77, 80, 82, 80, 82, 81, 81, 79, 82,
      81,
    ]);
    expect(shipped.badDays).toBe(708);
    expect(shipped.pairs).toBe(78926);
    expect(shipped.movedPairs).toBe(193);

    // The control: qualification reading the latest total instead of the best,
    // on the same seasons, the same totals and the same comparison. 74 of the
    // 78926 pairs violate and a lifter loses as many as 26 meets for having
    // competed one more time.
    //
    // Its domain is asserted equal to the shipped arm's for the reason the
    // strength axis gives, with one deliberate exception: `movedPairs` is 218
    // rather than 193, because the control's own rule changes which comparisons
    // move. That one is pinned at its own value instead of being tied to the
    // shipped arm, since forcing them equal would be asserting that a broken
    // rule moves exactly as often as a working one.
    expect(control.seasons).toBe(shipped.seasons);
    expect(control.seasonLengths).toEqual(shipped.seasonLengths);
    expect(control.badDays).toBe(shipped.badDays);
    expect(control.pairs).toBe(shipped.pairs);
    expect(control.movedPairs).toBe(218);
    expect(control.violatingPairs).toBe(74);
    expect(control.worstDeficit).toBe(26);
  });

  it('reaches a current-form rule that waits, and stops one meet past the deepest career', { timeout: budgetFrom(11_946) }, () => {
    // WHERE THIS SWEEP GOES BLIND, MEASURED AND PINNED FROM BOTH SIDES.
    //
    // A current-form gate does not have to switch on at a lifter's first meet.
    // Delay it — "your last total counts once you are established" — and it is
    // the same broken rule, invisible to a sweep whose careers end before the
    // delay does. That is not a hypothetical: the version of this file that
    // held every career to 14 meets reported zero for the same rule delayed to
    // a lifter's 16th, and reported it in exactly the confident shape a passing
    // sweep has.
    //
    // So both sides of the edge run. Inside the domain the axis reports the
    // rule; one meet past the deepest career it reports nothing, because no
    // lifter here ever gets that far. The second number is this measurement's
    // blind spot as a pin: deepen the domain and it stops being zero, shallow
    // it and the first arm stops being non-zero.
    const inside = measureAttendanceAxis('delayed-form-inside');
    const pastTheEdge = measureAttendanceAxis('delayed-form-past-the-edge');

    expect(inside.violatingPairs, 'a delayed current-form rule inside the domain').toBe(81);
    expect(inside.worstDeficit).toBe(4);
    expect(pastTheEdge.violatingPairs, 'the same rule one meet past the deepest career').toBe(0);
    expect(pastTheEdge.worstDeficit).toBe(0);

    // The edge is the deepest career, not a number chosen to make the arms
    // work. Both are asserted against the season lengths the axis above pins.
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE).toBe(
      Math.max(...inside.seasonLengths),
    );
    expect(ATTENDANCE_SWEEP.DELAYED_FORM_INSIDE).toBe(
      ATTENDANCE_SWEEP.DELAYED_FORM_PAST_THE_EDGE - 1,
    );
    // And the two arms ran on the same seasons as each other and as the shipped
    // one, so the zero above is about the rule and not about a smaller domain.
    expect(pastTheEdge.seasonLengths).toEqual(inside.seasonLengths);
    expect(inside.pairs).toBe(78926);
    expect(pastTheEdge.pairs).toBe(78926);
  });

  it('a season is a real season: every meet distinct, and none of them entered twice', () => {
    // The fixture the axis rests on. A simulation that entered nothing, or
    // entered one meet eighty times, would leave every comparison above
    // trivially equal.
    const season = simulateSeason(ATTENDANCE_SWEEP.SEEDS[0] as number);
    expect(season).toHaveLength(82);
    expect(new Set(season.map((meet) => meet.meetId)).size).toBe(82);
    for (let index = 1; index < season.length; index += 1) {
      const gap = (season[index] as { day: StreakDay }).day - (season[index - 1] as { day: StreakDay }).day;
      expect(gap).toBeGreaterThanOrEqual(ATTENDANCE_SWEEP.MIN_DAYS_BETWEEN_MEETS);
    }
    // Three rungs of the ladder, not one. At a 28-day rest the simulated career
    // was every fourth local meet and nothing else; at the calendar's own
    // resolution it picks up the fortnightly and quarterly series as the lifter
    // qualifies for them, which is what makes the entered list worth reading.
    expect([...new Set(season.map((meet) => meet.tier))].sort()).toEqual([
      'local',
      'nationals',
      'regional',
    ]);
    // AND THE FOURTH RUNG IS OUT OF REACH, which is a limit of this domain and
    // is pinned rather than left for a reader to notice. One period holds
    // exactly one worlds meet, six days in, and a lifter cannot hold a 650 kg
    // total six days into their first season — they start below the regional
    // bar. So a rule that only ever bites at a worlds meet is invisible to
    // every sweep in this file, and lengthening the simulation rather than
    // deepening it is what would close that.
    const worlds = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), ATTENDANCE_SWEEP.SIMULATION_DAYS),
    ).filter((meet) => meet.tier === 'worlds');
    expect(worlds).toHaveLength(1);
    expect((worlds[0] as CareerMeet).day - seasonAnchorDay()).toBe(6);
    expect((worlds[0] as CareerMeet).qualifyingTotalKg).toBe(650);
    // Three meet days fall before it, so the most a lifter can be holding when
    // it comes round is the first total plus three perfect days.
    const beforeWorlds = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), 5),
    );
    expect(beforeWorlds).toHaveLength(3);
    expect(
      ATTENDANCE_SWEEP.FIRST_TOTAL_KG + beforeWorlds.length * ATTENDANCE_SWEEP.MAX_GAIN_KG,
    ).toBeLessThan(650);
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
    // 2. The simulation runs one period of the calendar. Every cadence divides
    //    it, so the pattern of meet days repeats from there, and it is also the
    //    span a calendar screen draws.
    expect(ATTENDANCE_SWEEP.SIMULATION_DAYS).toBe(CAREER_TUNING.HORIZON_DAYS);
    for (const tier of MEET_TIER_ORDER) {
      expect(ATTENDANCE_SWEEP.SIMULATION_DAYS % CAREER_TUNING.CADENCE_DAYS[tier]).toBe(0);
    }
    // 3. The draw per career is the number of meets that period holds, which is
    //    the ceiling on a career: one meet a day at most, each one different.
    const period = scheduledMeets(
      ATTENDANCE_SWEEP.FEDERATION,
      seasonAnchorDay(),
      addDays(seasonAnchorDay(), ATTENDANCE_SWEEP.SIMULATION_DAYS),
    );
    expect(ATTENDANCE_SWEEP.MEETS_PER_CAREER).toBe(period.length);
    expect(period).toHaveLength(84);
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
 * One implementation, two arms, for the same reason the two axes above give.
 *
 * `lag` is a parameter rather than a constant read inside, because the third
 * arm this function is called for is the shipped rule at the shipped axis B
 * lag — the arm that measures what this axis was blind to before it existed.
 */
function measureEntryAxis(variant: EntryVariant, lag: number): EntryMeasurement {
  const rule = ENTRY_VARIANTS[variant];
  let pairs = 0;
  let seasonMeets = 0;
  let movedPairs = 0;
  let growingPairs = 0;
  let spentPairs = 0;
  let unexplainedPairs = 0;
  let worstUnexplained = 0;
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    const season = simulateSeason(seed);
    seasonMeets += season.length;
    for (let through = 0; through < season.length; through += 1) {
      const meet = season[through];
      if (meet === undefined) continue;
      const today = addDays(meet.day, lag);
      const diligent = careerAfter(season, through, null, 'shipped');
      const diligentList = new Set(
        rule(diligent, { today, lastEnteredDay: lastEnteredDayOf(season, through, null) }).map(
          (candidate) => candidate.id,
        ),
      );
      for (let skip = 0; skip <= through; skip += 1) {
        const idle = careerAfter(season, through, skip, 'shipped');
        const idleList = new Set(
          rule(idle, { today, lastEnteredDay: lastEnteredDayOf(season, through, skip) }).map(
            (candidate) => candidate.id,
          ),
        );
        pairs += 1;
        let spent = 0;
        let unexplained = 0;
        for (const id of idleList) {
          if (diligentList.has(id)) continue;
          if (diligent.enteredMeetIds.includes(id)) spent += 1;
          else unexplained += 1;
        }
        let gained = 0;
        for (const id of diligentList) if (!idleList.has(id)) gained += 1;
        if (spent > 0) spentPairs += 1;
        if (gained > 0) growingPairs += 1;
        if (unexplained > 0) unexplainedPairs += 1;
        if (unexplained > worstUnexplained) worstUnexplained = unexplained;
        if (diligentList.size !== idleList.size) movedPairs += 1;
      }
    }
  }
  return {
    pairs,
    seasonMeets,
    movedPairs,
    growingPairs,
    spentPairs,
    unexplainedPairs,
    worstUnexplained,
  };
}

describe('AXIS C — entering a meet spends that meet and takes nothing else', () => {
  it('every skipped meet in every seeded season, against a rest control and against the blind lag', { timeout: budgetFrom(33_856) }, () => {
    // WHAT THIS AXIS IS FOR, and it is the one thing axes A and B cannot do.
    // Both of them run through `qualifiedMeets`, which reads the federation and
    // the Total and never looks at `enteredMeetIds` — pinned directly under
    // axis A. So across all 80601 + 78926 of their compared pairs the entered
    // list decides nothing, and the module's claim that spending an entry is
    // not a punishment had no subject.
    //
    // The claim, in the form measured here: for two careers identical except
    // that one lifter competed at one more meet, every meet the lifter who
    // stayed home may enter and the lifter who competed may not is a meet on
    // that lifter's own record.
    const shipped = measureEntryAxis('shipped', ATTENDANCE_SWEEP.ENTRY_EVALUATION_LAG_DAYS);
    const rest = measureEntryAxis('entry-cooldown', ATTENDANCE_SWEEP.ENTRY_EVALUATION_LAG_DAYS);
    const blindLag = measureEntryAxis('shipped', ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS);

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
    expect(shipped.pairs).toBe(78926);
    expect(shipped.spentPairs).toBe(1934);
    expect(shipped.spentPairs).toBe(shipped.seasonMeets);
    expect(shipped.movedPairs).toBe(2033);
    expect(shipped.growingPairs).toBe(193);

    // The rest control: a mandatory 28 days off after a meet, which is the most
    // plausible design of the three controls this module measures against and
    // is exactly what GDD §12.3 refuses. The lifter who competed at one more
    // meet starts their lockout later, so 1874 pairs hand them a shorter
    // calendar than the lifter who stayed home, and as many as 4 of the meets
    // they lose are meets they never went to.
    //
    // Its domain is asserted against the shipped arm's where the two are the
    // same question, and pinned at its own value where the control's rule
    // changes the answer. `spentPairs` collapses from 1934 to 24 under it, and
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
    expect(rest.movedPairs).toBe(1973);
    expect(rest.spentPairs).toBe(24);
    expect(rest.spentPairs).toBe(ATTENDANCE_SWEEP.SEEDS.length);
    expect(rest.unexplainedPairs).toBe(1874);
    expect(rest.worstUnexplained).toBe(4);

    // The blind lag, kept runnable rather than described. This is the shipped
    // engine measured at axis B's evaluation lag of a week, and it is what this
    // axis looked like before it had its own: `spentPairs` is 0, because the
    // one meet the two lifters differ on is a week behind the window and
    // `entryVerdict` refuses it to both of them. Every count that survives is a
    // count axis B already holds, which is the definition of a second harness
    // that is blind for the same reason as the first.
    expect(blindLag.spentPairs).toBe(0);
    expect(blindLag.unexplainedPairs).toBe(0);
    expect(blindLag.movedPairs).toBe(193);
    expect(blindLag.growingPairs).toBe(193);
    expect(blindLag.pairs).toBe(shipped.pairs);
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
