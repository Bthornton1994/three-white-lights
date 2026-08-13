import { describe, expect, it } from 'vitest';

import { addDays, civilDateFromStreakDay, streakDayFromCivilDate, type StreakDay } from '../game/streak';
import { CAREER_TUNING, MEET_TIER_ORDER, type CareerMeetTier } from './careerTuning';
import {
  careerMeetFor,
  collidingMeetDays,
  isMeetDayForTier,
  isoDateOf,
  meetDaysForTier,
  nextMeetOfTier,
  qualifyingTotalKgFor,
  scheduledMeets,
  seasonAnchorDay,
  tierSeriesStartDay,
  upcomingMeets,
} from './calendar';

const ANCHOR = seasonAnchorDay();
const YEAR = CAREER_TUNING.HORIZON_DAYS;

/**
 * The weekday of a civil date, from the host's own calendar implementation.
 *
 * A deliberately independent oracle: `streak.ts` computes day indices with
 * Howard Hinnant's integer algorithm and this asks `Date`, so a leap-year bug
 * in either one disagrees with the other instead of agreeing with itself.
 */
function weekdayOf(day: StreakDay): number {
  const { year, month, day: dayOfMonth } = civilDateFromStreakDay(day);
  return new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();
}

describe('the season anchor', () => {
  it('is the civil date the tuning names, and 2026-01-03 is a Saturday', () => {
    expect(isoDateOf(ANCHOR)).toBe('2026-01-03');
    expect(civilDateFromStreakDay(ANCHOR)).toEqual(CAREER_TUNING.SEASON_ANCHOR);
    // 6 is Saturday. Read from `Date`, not from the tuning, so this is a check
    // rather than a restatement of the comment in careerTuning.ts.
    expect(weekdayOf(ANCHOR)).toBe(6);
  });

  it('each tier starts at the anchor plus its own phase', () => {
    for (const tier of MEET_TIER_ORDER) {
      expect(tierSeriesStartDay(tier)).toBe(addDays(ANCHOR, CAREER_TUNING.PHASE_DAYS[tier]));
    }
  });

  it('nothing is scheduled before the anchor', () => {
    expect(scheduledMeets('meridian', addDays(ANCHOR, -400), addDays(ANCHOR, -1))).toEqual([]);
    for (const tier of MEET_TIER_ORDER) {
      expect(isMeetDayForTier(tier, addDays(ANCHOR, -7))).toBe(false);
    }
  });
});

describe('window boundaries', () => {
  it('includes both ends', () => {
    const onlyTheAnchor = scheduledMeets('meridian', ANCHOR, ANCHOR);
    expect(onlyTheAnchor.map((meet) => meet.tier)).toEqual(['local']);
    // The local series is weekly, so a seven-day window holds two of them: the
    // day it opens on and the day it closes on.
    expect(meetDaysForTier('local', ANCHOR, addDays(ANCHOR, 7))).toEqual([
      ANCHOR,
      addDays(ANCHOR, 7),
    ]);
    expect(meetDaysForTier('local', ANCHOR, addDays(ANCHOR, 6))).toEqual([ANCHOR]);
  });

  it('an inverted window is empty rather than an error', () => {
    expect(scheduledMeets('meridian', addDays(ANCHOR, 10), ANCHOR)).toEqual([]);
    expect(meetDaysForTier('worlds', addDays(ANCHOR, 10), ANCHOR)).toEqual([]);
  });

  it('a window that closes before a series opens is empty', () => {
    // The worlds series opens six days after the anchor.
    expect(meetDaysForTier('worlds', ANCHOR, addDays(ANCHOR, 5))).toEqual([]);
    expect(meetDaysForTier('worlds', ANCHOR, addDays(ANCHOR, 6))).toEqual([addDays(ANCHOR, 6)]);
  });

  it('a meet is on the calendar on the day it is held', () => {
    const day = addDays(ANCHOR, 14);
    expect(scheduledMeets('meridian', day, day).map((meet) => meet.day)).toEqual([day]);
  });
});

describe('the shape of a year', () => {
  const year = scheduledMeets('meridian', ANCHOR, addDays(ANCHOR, YEAR));

  it('holds each tier at its stated cadence', () => {
    const counts = MEET_TIER_ORDER.map((tier) => year.filter((meet) => meet.tier === tier).length);
    // 53 weekly rather than 52: the window is inclusive at both ends and opens
    // on a local meet day. The fortnightly series opens three days in and so
    // gets 26 of its own occurrences rather than a 27th. Nationals are
    // quarterly and worlds annual, so one each per 13 and 52 weeks.
    expect(counts).toEqual([53, 26, 4, 1]);
    expect(year).toHaveLength(84);
  });

  it('is sorted by day', () => {
    for (let index = 1; index < year.length; index += 1) {
      expect((year[index] as { day: number }).day).toBeGreaterThanOrEqual(
        (year[index - 1] as { day: number }).day,
      );
    }
  });

  it('gives every meet a unique, derived id', () => {
    expect(new Set(year.map((meet) => meet.id)).size).toBe(year.length);
    const first = year[0];
    expect(first?.id).toBe('meridian-local-2026-01-03');
    expect(first?.name).toBe('Meridian Barbell Union Open');
    expect(first?.qualifyingTotalKg).toBeNull();
  });

  it('is the same list every time it is asked for', () => {
    expect(scheduledMeets('meridian', ANCHOR, addDays(ANCHOR, YEAR))).toEqual(year);
  });

  it('carries the federation’s own ruleset onto every meet', () => {
    for (const meet of year) {
      expect(meet.federationId).toBe('meridian');
      expect(meet.ruleset).toEqual({ equipment: 'raw', testing: 'tested' });
      expect(meet.qualifyingTotalKg).toBe(qualifyingTotalKgFor(meet.tier));
    }
  });
});

describe('a decade', () => {
  const DECADE_DAYS = 3640;
  const decade = scheduledMeets('meridian', ANCHOR, addDays(ANCHOR, DECADE_DAYS));

  it('never puts two of one federation’s tiers on the same day', () => {
    // The census, not a rule — see `collidingMeetDays`. It is zero because
    // every cadence is a whole number of weeks and the four phases differ
    // modulo seven, which careerTuning.test.ts checks as arithmetic; this
    // checks that the generator actually produces what that argument implies.
    // Decomposed rather than taken on trust: 3640 inclusive days hold 521
    // weekly, 260 fortnightly, 40 quarterly and 10 annual meets.
    expect(MEET_TIER_ORDER.map((tier) => decade.filter((meet) => meet.tier === tier).length)).toEqual(
      [521, 260, 40, 10],
    );
    expect(decade.length).toBe(831);
    expect(collidingMeetDays('meridian', ANCHOR, addDays(ANCHOR, DECADE_DAYS))).toEqual([]);
  });

  it('keeps each tier on one weekday for ten years, leap years included', () => {
    // The reason the cadences are whole weeks. Read through `Date`, so a drift
    // in the day arithmetic shows up as a disagreement rather than as two
    // copies of the same mistake.
    const weekdays = new Map<CareerMeetTier, Set<number>>();
    for (const meet of decade) {
      const seen = weekdays.get(meet.tier) ?? new Set<number>();
      seen.add(weekdayOf(meet.day));
      weekdays.set(meet.tier, seen);
    }
    expect([...weekdays.keys()].sort()).toEqual([...MEET_TIER_ORDER].sort());
    const perTier = MEET_TIER_ORDER.map((tier) => [...(weekdays.get(tier) ?? new Set())]);
    expect(perTier).toEqual([[6], [2], [4], [5]]);
    // Four tiers, four different weekdays, which is the same fact the collision
    // census reports from the other side.
    expect(new Set(perTier.flat()).size).toBe(MEET_TIER_ORDER.length);
    // February 29th fell inside this window twice.
    expect(decade.some((meet) => meet.dateIso.startsWith('2028-'))).toBe(true);
  });
});

describe('upcoming meets', () => {
  it('starts at today and runs to the horizon', () => {
    const meets = upcomingMeets('meridian', ANCHOR);
    expect(meets).toHaveLength(84);
    expect(meets[0]?.day).toBe(ANCHOR);
    expect((meets[meets.length - 1] as { day: number }).day).toBeLessThanOrEqual(
      addDays(ANCHOR, YEAR),
    );
  });

  it('refuses a horizon that is not a whole number of days at or above zero', () => {
    expect(() => upcomingMeets('meridian', ANCHOR, -1)).toThrow(RangeError);
    expect(() => upcomingMeets('meridian', ANCHOR, 1.5)).toThrow(RangeError);
    expect(upcomingMeets('meridian', ANCHOR, 0).map((meet) => meet.tier)).toEqual(['local']);
  });

  it('shows every tier inside the default horizon', () => {
    // What a calendar screen depends on: a lifter can always see one of each.
    const tiers = new Set(upcomingMeets('meridian', ANCHOR).map((meet) => meet.tier));
    expect([...tiers].sort()).toEqual([...MEET_TIER_ORDER].sort());
  });
});

describe('the next meet of a tier', () => {
  it('is the first on or after the day given', () => {
    const next = nextMeetOfTier('meridian', 'nationals', ANCHOR);
    expect(next?.day).toBe(addDays(ANCHOR, CAREER_TUNING.PHASE_DAYS.nationals));
    const after = nextMeetOfTier('meridian', 'nationals', addDays(next?.day ?? ANCHOR, 1));
    expect(after?.day).toBe(
      addDays(next?.day ?? ANCHOR, CAREER_TUNING.CADENCE_DAYS.nationals),
    );
  });

  it('is null when the horizon given holds none', () => {
    expect(nextMeetOfTier('meridian', 'worlds', ANCHOR, 5)).toBeNull();
    expect(nextMeetOfTier('meridian', 'worlds', ANCHOR, 6)).not.toBeNull();
  });
});

describe('ISO dates', () => {
  it('pads month and day', () => {
    expect(isoDateOf(streakDayFromCivilDate({ year: 2026, month: 1, day: 3 }))).toBe('2026-01-03');
    expect(isoDateOf(streakDayFromCivilDate({ year: 2026, month: 12, day: 25 }))).toBe('2026-12-25');
  });

  it('handles a leap day', () => {
    expect(isoDateOf(streakDayFromCivilDate({ year: 2028, month: 2, day: 29 }))).toBe('2028-02-29');
  });
});

describe('one meet', () => {
  it('is built from the federation, the tier and the day, and nothing else', () => {
    const day = addDays(ANCHOR, 5);
    const meet = careerMeetFor('anvil-coast', 'nationals', day);
    expect(meet).toEqual({
      id: 'anvil-coast-nationals-2026-01-08',
      federationId: 'anvil-coast',
      federationName: 'Anvil Coast Union',
      ruleset: { equipment: 'equipped', testing: 'untested' },
      tier: 'nationals',
      scheduling: 'sync',
      name: 'Anvil Coast Union National Championships',
      day,
      dateIso: '2026-01-08',
      qualifyingTotalKg: 550,
    });
  });
});
