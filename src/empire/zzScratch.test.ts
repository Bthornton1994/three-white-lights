/** SCRATCH — deleted before commit. Measures the day anchors. */
import { describe, expect, it } from 'vitest';

import { EMPIRE_SWEEP, socialInputs } from './empireSweep.test';
import {
  EMPIRE_DAY_SPENDING_ANCHORS,
  type EmpireDaySpendingAnchor,
  type EmpirePolicy,
  type SocialInputs,
} from './empireInvariant';
import {
  addEngagement,
  compareEngagement,
  emptyEngagementTally,
  engagementWiring,
  historyFrom,
  runEngagement,
  shippedEngagementWiring,
  type EngagementHistory,
  type EngagementRun,
  type EngagementTally,
  type EngagementWiringKey,
} from './engagement';
import { asCalendarDay, type SocialCalendarContext } from './social';

const DAYS = 12;
const CADENCE = EMPIRE_SWEEP.CHECK_INS_PER_DAY;
const WINDOW = 12;
const BASE_SOCIAL: SocialInputs = socialInputs();
const BASE_TRAINED_DAYS: readonly number[] = EMPIRE_SWEEP.TRAINED_DAYS;

function policyFor(): EmpirePolicy {
  return Object.freeze({
    checkInsPerDay: CADENCE,
    axisOrder: [...EMPIRE_SWEEP.AXIS_ORDER],
    leaderboardMetric: EMPIRE_SWEEP.LEADERBOARD_METRIC,
  });
}

function socialFor(history: EngagementHistory): SocialInputs {
  const calendar: SocialCalendarContext = Object.freeze({
    ...BASE_SOCIAL.calendar,
    trainedDays: Object.freeze(
      history.trainedDays.map((day) => asCalendarDay(EMPIRE_SWEEP.ANCHOR_DAY + day)),
    ),
    sessionCount: EMPIRE_SWEEP.SESSION_COUNT + history.trainedDays.length,
  });
  return Object.freeze({ ...BASE_SOCIAL, calendar });
}

function runAt(
  history: EngagementHistory,
  anchor: EmpireDaySpendingAnchor,
  key: EngagementWiringKey,
): EngagementRun {
  const wiring = key === 'shipped' ? shippedEngagementWiring() : engagementWiring(key, 0);
  return runEngagement(
    DAYS,
    policyFor(),
    history,
    socialFor(history),
    wiring,
    'spend-once-per-calendar-day',
    'promote-in-place',
    history,
    anchor,
  );
}

function sweep(anchor: EmpireDaySpendingAnchor, key: EngagementWiringKey): EngagementTally {
  const slots = DAYS * CADENCE;
  const cache = new Map<number, EngagementRun>();
  const at = (mask: number): EngagementRun => {
    const hit = cache.get(mask);
    if (hit !== undefined) return hit;
    const history = historyFrom(
      slots,
      (slot) => (slot >= WINDOW ? true : (mask & (1 << slot)) !== 0),
      BASE_TRAINED_DAYS,
    );
    const made = runAt(history, anchor, key);
    cache.set(mask, made);
    return made;
  };
  let tally = emptyEngagementTally();
  for (let mask = 0; mask < 1 << WINDOW; mask += 1) {
    for (let bit = 0; bit < WINDOW; bit += 1) {
      if ((mask & (1 << bit)) !== 0) continue;
      tally = addEngagement(tally, compareEngagement(at(mask), at(mask | (1 << bit))));
    }
  }
  return tally;
}

describe('scratch', () => {
  for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
    it(`anchor ${anchor} shipped`, () => {
      const tally = sweep(anchor, 'shipped');
      process.stdout.write(`RESULT shipped ${anchor} ${JSON.stringify(tally)}\n`);
      expect(tally.pairs).toBe(24576);
    }, 900_000);
  }
  for (const anchor of EMPIRE_DAY_SPENDING_ANCHORS) {
    it(`anchor ${anchor} single-purse`, () => {
      const tally = sweep(anchor, 'single-purse');
      process.stdout.write(`RESULT single-purse ${anchor} ${JSON.stringify(tally)}\n`);
      expect(tally.pairs).toBe(24576);
    }, 900_000);
  }
});
