import { appendFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';

import { addDays } from '../game/streak';
import { scheduledMeets, seasonAnchorDay } from './calendar';
import {
  ATTENDANCE_SWEEP,
  ENTRY_VARIANTS,
  badDayCount,
  careerAfter,
  enteredDaysOfTier,
  lastEnteredDayOf,
  qualificationKey,
  seasonMeetsOfTier,
  seasonMoments,
  seededCareerTotals,
  shippedEntryList,
  simulateSeason,
  tierOccurrenceOf,
  type EntryVariant,
  type RecordVariant,
  type SeasonMeet,
} from './careerSweep';
import { qualifiedMeets, type CareerLifter } from './eligibility';

const OUT =
  '/tmp/claude-0/-home-user-three-white-lights/2b4a8271-b1d0-5a80-85e8-1760cc3e16b5/scratchpad/measure.txt';
const log = (line: string) => appendFileSync(OUT, line + '\n');
writeFileSync(OUT, '');

function measureAttendanceAxis(variant: RecordVariant) {
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
    worldsEntries += seasonMeetsOfTier(season, 'worlds').length;
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
    seasonLengths,
    badDays,
    worldsEntries,
    pairs,
    movedPairs,
    violatingPairs,
    worstDeficit,
  };
}

function measureEntryAxis(variants: readonly EntryVariant[], lag: number) {
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
        worldsDaysEntered: enteredDaysOfTier(season, throughIndex, null, 'worlds'),
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
          worldsDaysEntered: enteredDaysOfTier(season, throughIndex, skip, 'worlds'),
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
  return tally;
}

describe('measure', () => {
  it('dumps every number the new pins need', { timeout: 1_800_000 }, () => {
    const anchor = seasonAnchorDay();

    // 1. The delayed-form edge, refined around the cliff at 104.
    for (const variant of [
      'shipped',
      'latest-total-wins',
      'delayed-form-inside',
      'delayed-form-past-visible',
      'delayed-form-past-the-edge',
      'worlds-reset-first',
      'worlds-reset-second',
      'worlds-reset-third',
    ] as RecordVariant[]) {
      const at = performance.now();
      const m = measureAttendanceAxis(variant);
      log(
        `B ${variant}: violating=${m.violatingPairs} worst=${m.worstDeficit} pairs=${m.pairs} moved=${m.movedPairs} badDays=${m.badDays} worldsEntries=${m.worldsEntries} ms=${Math.round(performance.now() - at)}`,
      );
      if (variant === 'shipped') log(`  seasonLengths=${JSON.stringify(m.seasonLengths)}`);
    }

    // 2. Saturation indices.
    const sat = ATTENDANCE_SWEEP.SEEDS.map((seed) => {
      const season = simulateSeason(seed);
      let best = 0;
      for (let i = 0; i < season.length; i += 1) {
        best = Math.max(best, (season[i] as SeasonMeet).totalKg);
        if (best >= ATTENDANCE_SWEEP.TOP_QUALIFYING_TOTAL_KG) return i;
      }
      return -1;
    });
    log(`saturationIndices=${JSON.stringify(sat)} max=${Math.max(...sat)}`);

    // 3. Does worlds-reset-second actually fire?
    let firing = 0;
    for (const seed of ATTENDANCE_SWEEP.SEEDS) {
      const season = simulateSeason(seed);
      const w = seasonMeetsOfTier(season, 'worlds');
      if (w.length === 0) continue;
      const wIndex = season.indexOf(w[0] as SeasonMeet);
      if (
        careerAfter(season, wIndex, null, 'shipped').bestTotalKg !==
        careerAfter(season, wIndex, null, 'worlds-reset-second').bestTotalKg
      ) {
        firing += 1;
      }
    }
    log(`worlds-reset-second changes the record in ${firing} seasons`);

    // 4. Worlds detail.
    const perSeed = ATTENDANCE_SWEEP.SEEDS.map((seed) => {
      const season = simulateSeason(seed);
      const w = seasonMeetsOfTier(season, 'worlds');
      return {
        worlds: w.length,
        occ: w.map((m) => tierOccurrenceOf('worlds', m.day)),
        index: w.map((m) => season.indexOf(m)),
      };
    });
    log(`worldsPerSeed=${JSON.stringify(perSeed.map((p) => p.worlds))}`);
    log(`worldsOcc=${JSON.stringify([...new Set(perSeed.flatMap((p) => p.occ))])}`);
    log(`worldsSeasonIndexRange=${Math.min(...perSeed.flatMap((p) => p.index))}..${Math.max(...perSeed.flatMap((p) => p.index))}`);

    // 5. Axis C, all five arms at lag 0 in one pass, then the blind lag.
    let t0 = performance.now();
    for (const row of measureEntryAxis(
      [
        'shipped',
        'entry-cooldown',
        'worlds-cooldown-first',
        'worlds-cooldown-second',
        'worlds-cooldown-third',
      ],
      ATTENDANCE_SWEEP.ENTRY_EVALUATION_LAG_DAYS,
    )) {
      log(
        `C ${row.variant}@0: pairs=${row.pairs} seasonMeets=${row.seasonMeets} moved=${row.movedPairs} growing=${row.growingPairs} spent=${row.spentPairs} unexplained=${row.unexplainedPairs} worst=${row.worstUnexplained}`,
      );
    }
    log(`axisC five-arm pass ms=${Math.round(performance.now() - t0)}`);

    t0 = performance.now();
    for (const row of measureEntryAxis(['shipped'], ATTENDANCE_SWEEP.EVALUATION_LAG_DAYS)) {
      log(
        `C ${row.variant}@7: pairs=${row.pairs} seasonMeets=${row.seasonMeets} moved=${row.movedPairs} growing=${row.growingPairs} spent=${row.spentPairs} unexplained=${row.unexplainedPairs} worst=${row.worstUnexplained}`,
      );
    }
    log(`axisC blind-lag pass ms=${Math.round(performance.now() - t0)}`);

    // 6. Small-test pins.
    log(`axisA window meets=${scheduledMeets('meridian', anchor, addDays(anchor, 364)).length}`);
    const season0 = simulateSeason(ATTENDANCE_SWEEP.SEEDS[0] as number);
    log(
      `season0 length=${season0.length} distinctIds=${new Set(season0.map((m) => m.meetId)).size} tiers=${JSON.stringify([...new Set(season0.map((m) => m.tier))].sort())}`,
    );
    log(
      `period tiers: ${JSON.stringify(
        (['local', 'regional', 'nationals', 'worlds'] as const).map(
          (t) =>
            [
              t,
              scheduledMeets(
                'meridian',
                anchor,
                addDays(anchor, ATTENDANCE_SWEEP.SIMULATION_DAYS),
              ).filter((m) => m.tier === t).length,
            ] as const,
        ),
      )}`,
    );
  });
});
