import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { addDays } from '../game/streak';
import { scheduledMeets, seasonAnchorDay } from './calendar';
import {
  ATTENDANCE_SWEEP,
  ENTRY_VARIANTS,
  badDayCount,
  careerAfter,
  lastEnteredDayOf,
  seededCareerTotals,
  simulateSeason,
  type EntryVariant,
  type RecordVariant,
} from './careerSweep';
import { qualifiedMeets } from './eligibility';

function axisB(variant: RecordVariant) {
  const t0 = Date.now();
  let pairs = 0,
    movedPairs = 0,
    violatingPairs = 0,
    worstDeficit = 0,
    badDays = 0;
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
  return { seasonLengths, badDays, pairs, movedPairs, violatingPairs, worstDeficit, ms: Date.now() - t0 };
}

function axisC(entry: EntryVariant, record: RecordVariant, lag: number) {
  const t0 = Date.now();
  let pairs = 0,
    movedPairs = 0,
    growingPairs = 0,
    consumingPairs = 0,
    violatingPairs = 0,
    worstDeficit = 0,
    seasonMeets = 0;
  const rule = ENTRY_VARIANTS[entry];
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    const season = simulateSeason(seed);
    seasonMeets += season.length;
    for (let through = 0; through < season.length; through += 1) {
      const meet = season[through];
      if (meet === undefined) continue;
      const today = addDays(meet.day, lag);
      const diligent = careerAfter(season, through, null, record);
      const dList = new Set(
        rule(diligent, { today, lastEnteredDay: lastEnteredDayOf(season, through, null) }).map((m) => m.id),
      );
      for (let skip = 0; skip <= through; skip += 1) {
        const idle = careerAfter(season, through, skip, record);
        const iList = new Set(
          rule(idle, { today, lastEnteredDay: lastEnteredDayOf(season, through, skip) }).map((m) => m.id),
        );
        pairs += 1;
        let lost = 0;
        let lostUnentered = 0;
        for (const id of iList) {
          if (dList.has(id)) continue;
          lost += 1;
          if (!diligent.enteredMeetIds.includes(id)) lostUnentered += 1;
        }
        let gained = 0;
        for (const id of dList) if (!iList.has(id)) gained += 1;
        if (lost > 0) consumingPairs += 1;
        if (gained > 0) growingPairs += 1;
        if (lostUnentered > 0) violatingPairs += 1;
        if (lostUnentered > worstDeficit) worstDeficit = lostUnentered;
        if (dList.size !== iList.size) movedPairs += 1;
      }
    }
  }
  return {
    seasonMeets,
    pairs,
    movedPairs,
    growingPairs,
    consumingPairs,
    violatingPairs,
    worstDeficit,
    ms: Date.now() - t0,
  };
}

const OUT = '/tmp/bench.txt';

describe('bench', () => {
  it('axis B', () => {
    for (const v of ['shipped', 'latest-total-wins'] as const) {
      const r = axisB(v);
      appendFileSync(OUT, `B ${v} ${JSON.stringify(r)}\n`);
    }
    const year = scheduledMeets(ATTENDANCE_SWEEP.FEDERATION, seasonAnchorDay(), addDays(seasonAnchorDay(), 364));
    appendFileSync(OUT, `year=${year.length}\n`);
    expect(true).toBe(true);
  }, 600_000);

  it('axis C', () => {
    for (const [e, rec, lag] of [
      ['shipped', 'shipped', 0],
      ['entry-cooldown', 'shipped', 0],
      ['shipped', 'shipped', 7],
      ['shipped', 'latest-total-wins', 0],
    ] as const) {
      const r = axisC(e, rec, lag);
      appendFileSync(OUT, `C entry=${e} rec=${rec} lag=${lag} ${JSON.stringify(r)}\n`);
    }
    expect(true).toBe(true);
  }, 900_000);
});
