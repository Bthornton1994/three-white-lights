/** SCRATCH — deleted before commit. Traces the residue under the first-affordable anchor. */
import { describe, expect, it } from 'vitest';

import { EMPIRE_SWEEP, socialInputs } from './empireSweep.test';
import {
  SHIPPED_ROSTER_UPGRADE,
  anchorConsumesDayOnlyOnPurchase,
  isDaySpendingMoment,
  purchasesMade,
  spendingMoment,
  spendsAtMoment,
  stepGym,
  createEmpireGym,
  NO_ACCELERANT,
  SHIPPED_FUNDING,
  type EmpireDaySpendingAnchor,
  type EmpireGym,
  type EmpirePolicy,
  type SocialInputs,
} from './empireInvariant';
import {
  compareEngagement,
  historyFrom,
  runEngagement,
  shippedEngagementWiring,
  slotWallSeconds,
  type EngagementHistory,
  type EngagementRun,
} from './engagement';
import { asCalendarDay, type SocialCalendarContext } from './social';

const DAYS = 12;
const CADENCE = EMPIRE_SWEEP.CHECK_INS_PER_DAY;
const WINDOW = 12;
const ANCHOR: EmpireDaySpendingAnchor = 'first-affordable-check-in';
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

function historyOf(mask: number): EngagementHistory {
  return historyFrom(
    DAYS * CADENCE,
    (slot) => (slot >= WINDOW ? true : (mask & (1 << slot)) !== 0),
    BASE_TRAINED_DAYS,
  );
}

function runAt(history: EngagementHistory): EngagementRun {
  return runEngagement(
    DAYS,
    policyFor(),
    history,
    socialFor(history),
    shippedEngagementWiring(),
    'spend-once-per-calendar-day',
    SHIPPED_ROSTER_UPGRADE,
    history,
    ANCHOR,
  );
}

interface TraceRow {
  readonly slot: number;
  readonly offered: boolean;
  readonly bought: boolean;
  readonly expansions: number;
  readonly recruits: number;
  readonly pending: number;
  readonly promotions: number;
  readonly axes: string;
  readonly roster: string;
  readonly books: string;
  readonly nextAxis: number;
  readonly reputation: number;
}

/** Mirrors `runEngagement`'s loop, recording what each check-in did. */
function trace(history: EngagementHistory): TraceRow[] {
  const policy = policyFor();
  const rows: TraceRow[] = [];
  let gym: EmpireGym = createEmpireGym();
  for (let day = 0; day < DAYS; day += 1) {
    let firstAttendedTick: number | null = null;
    let lastAttendedTick: number | null = null;
    for (let tick = 0; tick < CADENCE; tick += 1) {
      if (history.attended[day * CADENCE + tick] !== true) continue;
      if (firstAttendedTick === null) firstAttendedTick = tick;
      lastAttendedTick = tick;
    }
    let boughtEarlierToday = false;
    for (let tick = 0; tick < CADENCE; tick += 1) {
      const slot = day * CADENCE + tick;
      if (history.attended[slot] !== true) continue;
      const moment = spendingMoment(
        'spend-once-per-calendar-day',
        isDaySpendingMoment(ANCHOR, {
          firstAttendedOfDay: tick === firstAttendedTick,
          lastAttendedOfDay: tick === lastAttendedTick,
          boughtEarlierToday,
        }),
      );
      const before = gym;
      gym = stepGym(
        gym,
        policy,
        slotWallSeconds(slot, CADENCE),
        NO_ACCELERANT,
        0,
        SHIPPED_FUNDING,
        moment,
        SHIPPED_ROSTER_UPGRADE,
      );
      let bought = false;
      if (spendsAtMoment(moment)) {
        bought = purchasesMade(gym) > purchasesMade(before);
        if (bought) boughtEarlierToday = true;
        if (!bought && anchorConsumesDayOnlyOnPurchase(ANCHOR)) {
          gym = stepGym(
            before,
            policy,
            slotWallSeconds(slot, CADENCE),
            NO_ACCELERANT,
            0,
            SHIPPED_FUNDING,
            spendingMoment('spend-once-per-calendar-day', false),
            SHIPPED_ROSTER_UPGRADE,
          );
        }
      }
      rows.push({
        slot,
        offered: spendsAtMoment(moment),
        bought,
        expansions: gym.expansions,
        recruits: gym.recruits,
        pending: gym.pending.length,
        promotions: gym.promotions,
        axes: JSON.stringify(gym.state.settledAxes),
        roster: gym.state.roster.map((l) => l.tier).join('/'),
        books: JSON.stringify(gym.state.settledBooks),
        nextAxis: gym.nextAxis,
        reputation: gym.state.reputation,
      });
    }
  }
  return rows;
}

describe('trace', () => {
  it('finds the violating pairs and prints the first few traces', () => {
    const cache = new Map<number, EngagementRun>();
    const at = (mask: number): EngagementRun => {
      const hit = cache.get(mask);
      if (hit !== undefined) return hit;
      const made = runAt(historyOf(mask));
      cache.set(mask, made);
      return made;
    };
    const found: Array<{ mask: number; bit: number }> = [];
    for (let mask = 0; mask < 1 << WINDOW; mask += 1) {
      for (let bit = 0; bit < WINDOW; bit += 1) {
        if ((mask & (1 << bit)) !== 0) continue;
        if (compareEngagement(at(mask), at(mask | (1 << bit))).violating) found.push({ mask, bit });
      }
    }
    process.stdout.write(`VIOLATING ${found.length}\n`);
    process.stdout.write(
      `MASKS ${JSON.stringify(found.map((f) => ({ m: f.mask.toString(2).padStart(WINDOW, '0'), bit: f.bit })))}\n`,
    );
    const censuses = found.slice(0, 40).map((f) => {
      const b = at(f.mask).census;
      const m = at(f.mask | (1 << f.bit)).census;
      return {
        bit: f.bit,
        mask: f.mask.toString(2).padStart(WINDOW, '0'),
        base: { sm: b.spendingMoments, e: b.expansions, r: b.recruits, p: b.promotions, ph: b.physioArrivalDay, cb: b.ceilingBoundDays },
        more: { sm: m.spendingMoments, e: m.expansions, r: m.recruits, p: m.promotions, ph: m.physioArrivalDay, cb: m.ceilingBoundDays },
      };
    });
    process.stdout.write(`CENSUS ${JSON.stringify(censuses, null, 1)}\n`);
    expect(found.length).toBeGreaterThan(0);
  }, 900_000);

  it('prints one full trace pair', () => {
    // Filled in after the first check names a pair.
    const mask = Number(process.env.TRACE_MASK ?? '-1');
    const bit = Number(process.env.TRACE_BIT ?? '-1');
    if (mask < 0) return;
    const base = trace(historyOf(mask));
    const more = trace(historyOf(mask | (1 << bit)));
    const brief = (r: TraceRow): string =>
      `s${r.slot} ${r.offered ? 'OFFER' : '.....'}${r.bought ? '+BUY' : '....'} e${r.expansions} r${r.recruits}+${r.pending} p${r.promotions} ax=${r.axes.replace(/[",{}]/g, '').replace(/staffLevel:/, '')} ros=${r.roster} bk=${r.books.replace(/[",{}]/g, '')} n${r.nextAxis}`;
    const limit = Number(process.env.TRACE_LIMIT ?? '20');
    process.stdout.write(`BASE\n${base.slice(0, limit).map(brief).join('\n')}\n`);
    process.stdout.write(`MORE\n${more.slice(0, limit).map(brief).join('\n')}\n`);
    const bi = base.filter((r) => r.slot >= 12);
    const mi = more.filter((r) => r.slot >= 12);
    for (let i = 0; i < Math.min(bi.length, mi.length); i += 1) {
      const b = bi[i] as TraceRow;
      const m = mi[i] as TraceRow;
      if (JSON.stringify({ ...b, reputation: 0 }) !== JSON.stringify({ ...m, reputation: 0 })) {
        process.stdout.write(`FIRSTDIFF-AFTER-WINDOW\n B ${brief(b)}\n M ${brief(m)}\n`);
        break;
      }
    }
    expect(base.length).toBeGreaterThan(0);
  }, 900_000);
});
