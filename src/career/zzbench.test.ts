import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { addDays, type StreakDay } from '../game/streak';
import { scheduledMeets, seasonAnchorDay } from './calendar';
import {
  ATTENDANCE_SWEEP,
  badDayCount,
  seededCareerTotals,
} from './careerSweep';
import {
  canEnter,
  careerRecordAfterMeet,
  newCareerLifter,
  qualifiedMeets,
  type CareerLifter,
} from './eligibility';

interface SeasonMeet {
  readonly day: StreakDay;
  readonly meetId: string;
  readonly totalKg: number;
}

function sim(seed: number, days: number, gap: number, meetsPerCareer: number): readonly SeasonMeet[] {
  const totals = seededCareerTotals(seed, meetsPerCareer);
  const anchor = seasonAnchorDay();
  const lastDay = addDays(anchor, days);
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  const season: SeasonMeet[] = [];
  let lastMeetDay: number | null = null;
  for (let day = anchor; day <= lastDay; day = addDays(day, 1)) {
    if (lastMeetDay !== null && day - lastMeetDay < gap) continue;
    const meet = scheduledMeets(ATTENDANCE_SWEEP.FEDERATION, day, day).find((c) => canEnter(lifter, c, day));
    if (meet === undefined) continue;
    const totalKg = totals[season.length];
    if (totalKg === undefined) throw new RangeError(`ran past ${meetsPerCareer}`);
    lifter = careerRecordAfterMeet(lifter, meet.id, totalKg);
    season.push({ day, meetId: meet.id, totalKg });
    lastMeetDay = day;
  }
  return season;
}

function fold(season: readonly SeasonMeet[], through: number, skip: number | null, formAt: number | null): CareerLifter {
  let lifter: CareerLifter = newCareerLifter(ATTENDANCE_SWEEP.FEDERATION);
  for (let i = 0; i <= through; i += 1) {
    if (i === skip) continue;
    const meet = season[i];
    if (meet === undefined) break;
    if (formAt !== null && lifter.enteredMeetIds.length >= formAt) {
      lifter = {
        federationId: lifter.federationId,
        bestTotalKg: meet.totalKg,
        enteredMeetIds: lifter.enteredMeetIds.includes(meet.meetId)
          ? lifter.enteredMeetIds
          : [...lifter.enteredMeetIds, meet.meetId],
      };
    } else {
      lifter = careerRecordAfterMeet(lifter, meet.meetId, meet.totalKg);
    }
  }
  return lifter;
}

function measure(days: number, gap: number, meetsPerCareer: number, lag: number, formAt: number | null): {
  lengths: number; pairs: number; moved: number; violating: number; worst: number; badDays: number;
} {
  let pairs = 0, moved = 0, violating = 0, worst = 0, badDays = 0, lengths = 0;
  for (const seed of ATTENDANCE_SWEEP.SEEDS) {
    badDays += badDayCount(seededCareerTotals(seed, meetsPerCareer));
    const season = sim(seed, days, gap, meetsPerCareer);
    lengths = season.length;
    for (let through = 0; through < season.length; through += 1) {
      const meet = season[through];
      if (meet === undefined) continue;
      const evalDay = addDays(meet.day, lag);
      const to = addDays(evalDay, ATTENDANCE_SWEEP.WINDOW_DAYS);
      const diligent = fold(season, through, null, formAt);
      const attended = new Set(qualifiedMeets(diligent, evalDay, to).map((m) => m.id));
      for (let skip = 0; skip <= through; skip += 1) {
        const idle = fold(season, through, skip, formAt);
        const skipped = new Set(qualifiedMeets(idle, evalDay, to).map((m) => m.id));
        pairs += 1;
        let missing = 0;
        for (const id of skipped) if (!attended.has(id)) missing += 1;
        if (missing > 0) violating += 1;
        if (missing > worst) worst = missing;
        if (attended.size !== skipped.size) moved += 1;
      }
    }
  }
  return { lengths, pairs, moved, violating, worst, badDays };
}

describe('bench', () => {
  it('times the widened domain', () => {
    for (const [days, gap] of [[364, 28], [364, 7], [728, 7], [1092, 7]] as const) {
      const mpc = Math.floor(days / gap) + 1;
      const t0 = Date.now();
      const shipped = measure(days, gap, mpc, ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS, null);
      const ms = Date.now() - t0;
      appendFileSync(
        '/tmp/claude-0/-home-user-three-white-lights/2b4a8271-b1d0-5a80-85e8-1760cc3e16b5/scratchpad/bench.txt',
        `days=${days} gap=${gap} mpc=${mpc} len=${shipped.lengths} pairs=${shipped.pairs} moved=${shipped.moved} viol=${shipped.violating} bad=${shipped.badDays} ${ms}ms\n`,
      );
    }
    expect(true).toBe(true);
  }, 600_000);
});
