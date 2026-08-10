/**
 * social.test.ts — the tests for GDD §5.5's social layer.
 *
 * ===========================================================================
 * What is graded by what
 * ===========================================================================
 *
 * Four `@ts-expect-error` directives in this file are graded by
 * `npx tsc --noEmit` and not by vitest, which strips types without checking
 * them. Their vitest-reddenable companion is 'declares the calendar day against
 * its own brand', which pins the DECLARATIONS: a brand is erased at runtime, so
 * no value `social.ts` produces can tell whether a parameter was declared
 * `CalendarDay` or `number`. `empireCore.test.ts` records what happens when a
 * directive ships without one — five sat over assertions no state of the
 * subject could have reddened.
 *
 * ===========================================================================
 * The sweep's parameters are written down
 * ===========================================================================
 *
 * `SOCIAL_SWEEP` below holds the calendar lengths, the anchors, the horizons
 * and the attendance generator, as a named frozen block, for the reason
 * `src/game/streakSweep.ts` exists: the first version of a measurement in this
 * repository was reported with its inputs unstated and could not afterwards be
 * reproduced, and six plausible parameterisations gave six different numbers.
 * "A measurement whose inputs are not written down is an anecdote."
 *
 * It lives here rather than in `empireTuning.ts` because a sweep parameter is
 * not a game-feel value a playtester turns, and because `src/tuning/audit.ts`
 * classifies every unregistered file under `src/empire/` as a `renderer` — so a
 * bare number in `social.ts` fails the suite by name, line and literal, while a
 * test file is deliberately not scanned. `npc.test.ts` and `expansion.test.ts`
 * put their own sweeps in the same place for the same reason.
 *
 * ===========================================================================
 * What the calendar-keying sweep is, exactly
 * ===========================================================================
 *
 * GDD §8.3C measured, on the shipped streak engine at 100 days: a reward keyed
 * to session count gives 1156 violating pairs; keyed to the streak, 54 pairs
 * and 239 lifetime-best inversions; landed on a fixed calendar day, 0. GDD §4.4
 * says the second reading of "structurally unable" needs an assertion on the
 * output list itself — "for every legal tender, at every length, adding a
 * trained day leaves the list byte-identical" — because a legal input that
 * moved 2362 of 34338 purchase-day lists left every aggregate identical.
 *
 * So the subject here is `socialRewardSchedule`, the list of calendar days this
 * module's rewards move on, and the property is: for two histories identical
 * except that one has an extra trained day, that list is byte-identical,
 * compared element by element rather than by a sum or a bound.
 *
 * Two arms, and two controls beside them:
 *
 *   - exhaustive over every one of the 2^L calendars of length
 *     `EXHAUSTIVE_CALENDAR_DAYS` and every single-day superset of each, which
 *     is a proof over that length rather than a sample;
 *   - sampled over longer calendars from the deterministic generator below;
 *   - the same sweep against a variant keyed to SESSION COUNT, and a second
 *     keyed to STREAK LENGTH — GDD §8.3C's two measured-bad shapes — with their
 *     divergence counts pinned non-zero, so the zero above is zero against
 *     something rather than a report from an empty domain.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  IDLE_ONLY_OUTPUTS,
  PROGRESSION_REACHING_OUTPUTS,
  asAcceleratedSeconds,
  outputReach,
  type LeaderboardScope,
} from './empireCore';
import { EMPIRE_TUNING } from './empireTuning';
import * as socialModule from './social';
import {
  LEADERBOARD_METRICS,
  RIVAL_OUTCOMES,
  SOCIAL_OUTPUT,
  SOCIAL_REWARD_EVENTS,
  SOCIAL_SURFACES,
  VISIT_REFUSALS,
  asCalendarDay,
  compareWithRival,
  encouragementGymBucksOn,
  isLeaderboardMetric,
  isSocialSurface,
  leaderboardBracketSize,
  leaderboardRankOf,
  leaderboardScore,
  mayVisitFriendGym,
  rankLeaderboard,
  recordFriendVisit,
  rivalPeriodCloseDay,
  rivalPeriodCloseDays,
  rivalPeriodIndex,
  rivalPeriodStartDay,
  socialContextFaults,
  socialOutput,
  socialReach,
  socialRewardSchedule,
  socialVocabularyFaults,
  visitRefusals,
  visitsLeftOn,
  visitsUsedOn,
  type CalendarDay,
  type Encouragement,
  type FriendVisit,
  type GymSnapshot,
  type LeaderboardMetric,
  type SocialCalendarContext,
  type SocialContext,
  type SocialRewardDay,
} from './social';

// ---------------------------------------------------------------------------
// The sweep's parameters, in one named block
// ---------------------------------------------------------------------------

const SOCIAL_SWEEP = Object.freeze({
  /**
   * Length of the calendars enumerated exhaustively. Every one of the 2^L
   * calendars of this length is compared against every single-day superset of
   * itself, so this arm is a proof over this length rather than a sample. It
   * stops being runnable a few powers above this.
   */
  EXHAUSTIVE_CALENDAR_DAYS: 9,
  /**
   * Account-creation days the schedule is measured from, so the property is not
   * checked at one offset. The second is deliberately not a multiple of the
   * rival period.
   */
  ANCHOR_DAYS: Object.freeze([0, 30] as const),
  /**
   * Horizons the reward-day list is compared at. Straddles the first period
   * boundary in both directions and reaches GDD §8.3C's own 100 days.
   */
  HORIZON_DAYS: Object.freeze([0, 1, 7, 8, 14, 40, 60, 100] as const),
  /** Lengths the sampled arm runs at — GDD §4.4's four horizons. */
  LONG_CALENDAR_DAYS: Object.freeze([40, 60, 80, 100] as const),
  /**
   * The deterministic attendance generator's parameters.
   *
   * `trainedOn(day, step) = (day * step) % CYCLE < ATTENDED_OF_CYCLE`. No
   * randomness and nothing to reproduce from a note: a reader with this file
   * has the calendars.
   */
  ATTENDANCE_STEPS: Object.freeze([3, 5, 7, 11] as const),
  ATTENDANCE_CYCLE: 7,
  ATTENDANCE_ATTENDED_OF_CYCLE: 4,
  /** Sessions per unlocked season-pass tier, for the tier field of a context. */
  SESSIONS_PER_PASS_TIER: 5,
});

const PERIOD_DAYS = EMPIRE_TUNING.RIVAL_COMPARISON_PERIOD_DAYS;
const SCOPES: readonly LeaderboardScope[] = EMPIRE_TUNING.LEADERBOARD_SCOPES;
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** A module's source with its comments removed, so a scan reads code only. */
function readModule(name: string): string {
  const source = readFileSync(path.join(HERE, name), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (code.trim().length === 0) throw new Error(`${name} stripped to nothing`);
  return code;
}

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

/**
 * The body of one exported function, so a scan can be scoped to it.
 *
 * A module-wide count of `calendar.anchorDay` mixes the schedule's one read
 * with the validator's three, and a pin on the total would stay green if the
 * schedule stopped reading it and the validator grew a line. Scoped counts do
 * not have that hole.
 */
function bodyOf(source: string, name: string): string {
  const at = source.indexOf(`export function ${name}(`);
  if (at < 0) throw new Error(`${name} is not declared in this source`);
  const opens = source.indexOf('{', source.indexOf(')', at));
  let depth = 0;
  for (let i = opens; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(opens, i + 1);
    }
  }
  throw new Error(`${name} has no closing brace`);
}

function gym(gymId: string, reputation: number, combinedTotalKg: number): GymSnapshot {
  return Object.freeze({ gymId, displayName: 'Placeholder', reputation, combinedTotalKg });
}

// ---------------------------------------------------------------------------
// Calendars, contexts and the two engines the sweep compares
// ---------------------------------------------------------------------------

/** Every calendar of `length` days, as attendance flags. 2^length of them. */
function everyCalendar(length: number): readonly (readonly boolean[])[] {
  const all: (readonly boolean[])[] = [];
  for (let mask = 0; mask < 2 ** length; mask += 1) {
    const days: boolean[] = [];
    for (let at = 0; at < length; at += 1) days.push((mask >> at) % 2 === 1);
    all.push(Object.freeze(days));
  }
  return all;
}

/** The deterministic attendance pattern. See `SOCIAL_SWEEP.ATTENDANCE_STEPS`. */
function generatedCalendar(length: number, step: number): readonly boolean[] {
  const days: boolean[] = [];
  for (let at = 0; at < length; at += 1) {
    days.push((at * step) % SOCIAL_SWEEP.ATTENDANCE_CYCLE < SOCIAL_SWEEP.ATTENDANCE_ATTENDED_OF_CYCLE);
  }
  return Object.freeze(days);
}

/** Every calendar that is this one plus exactly one more trained day. */
function singleDaySupersets(days: readonly boolean[]): readonly (readonly boolean[])[] {
  const supersets: (readonly boolean[])[] = [];
  days.forEach((trained, at) => {
    if (trained) return;
    const more = [...days];
    more[at] = true;
    supersets.push(Object.freeze(more));
  });
  return supersets;
}

/** The trailing streak of a calendar, in days. */
function trailingStreak(days: readonly boolean[]): number {
  let streak = 0;
  for (let at = days.length - 1; at >= 0; at -= 1) {
    if (days[at] !== true) break;
    streak += 1;
  }
  return streak;
}

/** A calendar context: the anchor, plus every training-shaped field. */
function contextFor(anchorDay: number, days: readonly boolean[]): SocialCalendarContext {
  const trainedDays: CalendarDay[] = [];
  days.forEach((trained, at) => {
    if (trained) trainedDays.push(asCalendarDay(anchorDay + at));
  });
  return Object.freeze({
    anchorDay: asCalendarDay(anchorDay),
    trainedDays: Object.freeze(trainedDays),
    sessionCount: trainedDays.length,
    streakDays: trailingStreak(days),
    passTiersUnlocked: Math.floor(trainedDays.length / SOCIAL_SWEEP.SESSIONS_PER_PASS_TIER),
  });
}

/**
 * The first negative control: the same schedule keyed to SESSION COUNT.
 *
 * GDD §8.3C's worst measured shape — 1156 violating pairs at 100 days. The
 * allowance resets on a trained day rather than on a calendar day, and a rival
 * period closes on every `RIVAL_COMPARISON_PERIOD_DAYS`-th session. Both are
 * spellings a builder could reach for without noticing they had changed the
 * unit, which is why they are the control rather than something absurd.
 */
function sessionKeyedSchedule(
  calendar: SocialCalendarContext,
  horizonDays: number,
): readonly SocialRewardDay[] {
  const trained = new Set<number>(calendar.trainedDays);
  const schedule: SocialRewardDay[] = [];
  let sessions = 0;
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = asCalendarDay(calendar.anchorDay + offset);
    if (!trained.has(day)) continue;
    sessions += 1;
    schedule.push(Object.freeze({ day, event: 'friend-visit-allowance-reset' }));
    if (sessions % PERIOD_DAYS === 0) {
      schedule.push(Object.freeze({ day, event: 'rival-period-close' }));
    }
  }
  return Object.freeze(schedule);
}

/**
 * The second negative control: keyed to STREAK LENGTH.
 *
 * GDD §8.3C's other measured-bad shape — 54 pairs and 239 lifetime-best
 * inversions. The period closes whenever the running streak reaches a multiple
 * of the period. It is here because a single control makes the zero above zero
 * against one thing, and §8.3C measured two.
 */
function streakKeyedSchedule(
  calendar: SocialCalendarContext,
  horizonDays: number,
): readonly SocialRewardDay[] {
  const trained = new Set<number>(calendar.trainedDays);
  const schedule: SocialRewardDay[] = [];
  let streak = 0;
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const day = asCalendarDay(calendar.anchorDay + offset);
    streak = trained.has(day) ? streak + 1 : 0;
    schedule.push(Object.freeze({ day, event: 'friend-visit-allowance-reset' }));
    if (streak > 0 && streak % PERIOD_DAYS === 0) {
      schedule.push(Object.freeze({ day, event: 'rival-period-close' }));
    }
  }
  return Object.freeze(schedule);
}

/** How many positions two reward-day lists differ in. Element-wise, not a sum. */
function divergences(
  left: readonly SocialRewardDay[],
  right: readonly SocialRewardDay[],
): number {
  let differing = Math.abs(left.length - right.length);
  const shared = Math.min(left.length, right.length);
  for (let at = 0; at < shared; at += 1) {
    const a = left[at] as SocialRewardDay;
    const b = right[at] as SocialRewardDay;
    if (a.day !== b.day || a.event !== b.event) differing += 1;
  }
  return differing;
}

interface SweepResult {
  readonly pairs: number;
  readonly elements: number;
  readonly movedLists: number;
  readonly movedElements: number;
}

/**
 * Run one engine over one population of (calendar, superset) pairs.
 *
 * The two counters that are not the verdict — `pairs` and `elements` — are the
 * non-vacuity guard: an empty calendar population, an empty horizon list or an
 * engine that returned nothing would leave the verdict at zero while measuring
 * nothing at all, and both are pinned as counts rather than bounds.
 */
function sweep(
  engine: (calendar: SocialCalendarContext, horizonDays: number) => readonly SocialRewardDay[],
  population: readonly (readonly boolean[])[],
): SweepResult {
  let pairs = 0;
  let elements = 0;
  let movedLists = 0;
  let movedElements = 0;
  for (const anchorDay of SOCIAL_SWEEP.ANCHOR_DAYS) {
    for (const days of population) {
      const base = contextFor(anchorDay, days);
      for (const more of singleDaySupersets(days)) {
        const diligent = contextFor(anchorDay, more);
        for (const horizon of SOCIAL_SWEEP.HORIZON_DAYS) {
          const before = engine(base, horizon);
          const after = engine(diligent, horizon);
          const moved = divergences(before, after);
          if (moved > 0) movedLists += 1;
          movedElements += moved;
          elements += before.length;
          pairs += 1;
        }
      }
    }
  }
  return { pairs, elements, movedLists, movedElements };
}

const EXHAUSTIVE_POPULATION = everyCalendar(SOCIAL_SWEEP.EXHAUSTIVE_CALENDAR_DAYS);
const SAMPLED_POPULATION: readonly (readonly boolean[])[] = SOCIAL_SWEEP.LONG_CALENDAR_DAYS.flatMap(
  (length) => SOCIAL_SWEEP.ATTENDANCE_STEPS.map((step) => generatedCalendar(length, step)),
);

// ---------------------------------------------------------------------------
// The calendar-keying measurement
// ---------------------------------------------------------------------------

describe('every reward day is keyed to the calendar and to nothing the player did', () => {
  it('leaves the reward-day list byte-identical when a trained day is added, exhaustively', () => {
    // The property GDD §8.3C measured at 0 for a fixed calendar day. Compared
    // element-wise: §8.2 records a legal input that moved 2362 of 34338
    // purchase-day lists and left every aggregate identical, so a sum will not
    // do.
    //
    // The reddening edit, named before the check was written: give
    // `socialRewardSchedule` any dependence on the history — closing a period on
    // `calendar.sessionCount % RIVAL_COMPARISON_PERIOD_DAYS`, or resetting the
    // allowance on a trained day — and `movedLists` leaves zero. Both are run as
    // the two controls below.
    const result = sweep(socialRewardSchedule, EXHAUSTIVE_POPULATION);
    expect(result.movedLists).toBe(0);
    expect(result.movedElements).toBe(0);
    // Counts, not bounds. A population that had gone empty, a horizon list that
    // had, or an engine returning nothing would each make the two lines above
    // pass while measuring nothing.
    expect(EXHAUSTIVE_POPULATION.length).toBe(512);
    expect(EXHAUSTIVE_POPULATION.length).toBe(2 ** SOCIAL_SWEEP.EXHAUSTIVE_CALENDAR_DAYS);
    expect(result.pairs).toBe(36864);
    expect(result.elements).toBe(1193472);
  });

  it('leaves it byte-identical on the sampled long calendars too', () => {
    const result = sweep(socialRewardSchedule, SAMPLED_POPULATION);
    expect(result.movedLists).toBe(0);
    expect(result.movedElements).toBe(0);
    expect(SAMPLED_POPULATION.length).toBe(16);
    expect(SAMPLED_POPULATION.length).toBe(
      SOCIAL_SWEEP.LONG_CALENDAR_DAYS.length * SOCIAL_SWEEP.ATTENDANCE_STEPS.length,
    );
    expect(result.pairs).toBe(5712);
    expect(result.elements).toBe(184926);
  });

  it('moves the session-keyed control, so the zeroes above are zero against something', () => {
    // GDD §8.3C's worst shape — 1156 violating pairs at 100 days on the streak
    // engine. Here the same shape moves this many reward-day lists, on the same
    // populations and the same horizons as the shipped engine's zeroes.
    const exhaustive = sweep(sessionKeyedSchedule, EXHAUSTIVE_POPULATION);
    expect(exhaustive.pairs).toBe(36864);
    expect(exhaustive.movedLists).toBe(26624);
    expect(exhaustive.movedElements).toBe(78916);

    const sampled = sweep(sessionKeyedSchedule, SAMPLED_POPULATION);
    expect(sampled.pairs).toBe(5712);
    expect(sampled.movedLists).toBe(1968);
    expect(sampled.movedElements).toBe(36786);

    // The controls run the same pair counts as the verdicts above, so the
    // numbers are comparable rather than two unrelated measurements.
    expect(exhaustive.pairs).toBe(sweep(socialRewardSchedule, EXHAUSTIVE_POPULATION).pairs);
    expect(sampled.pairs).toBe(sweep(socialRewardSchedule, SAMPLED_POPULATION).pairs);
  });

  it('moves the streak-keyed control on the exhaustive population', () => {
    // GDD §8.3C's other measured-bad shape, which it also measured as the
    // milder of the two — 54 pairs against 1156. The same ordering shows up
    // here: 588 moved lists against the session control's 26624, because a
    // streak has to reach the full period before the key moves at all.
    const result = sweep(streakKeyedSchedule, EXHAUSTIVE_POPULATION);
    expect(result.pairs).toBe(36864);
    expect(result.movedLists).toBe(588);
    expect(result.movedElements).toBe(19700);
  });

  it('measures the streak-keyed control at zero on the sampled population, and says why', () => {
    // A zero recorded as a fact rather than filed as a pass. This one is worth
    // the space because the first diagnosis of it was wrong: "the generated
    // calendars never reach a seven-day run" is false — the step-7 pattern
    // attends every day, and its longest run is the whole calendar. What is
    // true is narrower. That pattern has no idle day to turn into a trained
    // one, so it contributes no comparison pairs at all, and over the calendars
    // the sweep DOES compare the longest run is 5, below the rival period. The
    // streak key therefore never fires on this population.
    //
    // So the sampled arm's control is the session-keyed one above, not this.
    // The number below is a measurement of an empty domain, named as one.
    const result = sweep(streakKeyedSchedule, SAMPLED_POPULATION);
    expect(result.pairs).toBe(5712);
    expect(result.movedLists).toBe(0);

    const longestRun = (days: readonly boolean[]): number => {
      let best = 0;
      let run = 0;
      for (const trained of days) {
        run = trained ? run + 1 : 0;
        if (run > best) best = run;
      }
      return best;
    };
    const compared = SAMPLED_POPULATION.flatMap((days) => {
      const supersets = singleDaySupersets(days);
      return supersets.length === 0 ? [] : [days, ...supersets];
    });
    expect(Math.max(...compared.map(longestRun))).toBe(5);
    expect(Math.max(...compared.map(longestRun))).toBeLessThan(PERIOD_DAYS);
    // The two counts behind the correction, so the sentence above is checked
    // rather than asserted.
    expect(SAMPLED_POPULATION.filter((days) => days.every((day) => day)).length).toBe(4);
    expect(Math.max(...SAMPLED_POPULATION.map(longestRun))).toBe(100);
  });

  it('reads the anchor day and none of the four history fields', () => {
    // The textual companion to the sweep. Match COUNTS rather than presence,
    // because a pattern with more than one witness in a file is the textual pin
    // this codebase has been bitten by. `trainedDays` is 1 because
    // `socialContextFaults` validates it; the other three are read nowhere at
    // all, which is what makes the sweep's zero a property of the module rather
    // than of the fixtures.
    const source = readModule('social.ts');
    expect(count(source, /calendar\.sessionCount/g)).toBe(0);
    expect(count(source, /calendar\.streakDays/g)).toBe(0);
    expect(count(source, /calendar\.passTiersUnlocked/g)).toBe(0);
    expect(count(source, /calendar\.trainedDays/g)).toBe(1);
    expect(count(source, /calendar\.anchorDay/g)).toBe(4);
    // Scoped to the schedule's own body, so the validator's three reads of the
    // anchor cannot stand in for the schedule's one. A module-wide pin on the
    // total would stay green if the schedule stopped reading the anchor and the
    // validator grew a line.
    const schedule = bodyOf(source, 'socialRewardSchedule');
    expect(count(schedule, /calendar\.anchorDay/g)).toBe(1);
    expect(count(schedule, /calendar\./g)).toBe(1);
    // The scan is live: it finds the reads that are there, so a zero above is a
    // fact about the file rather than a pattern that matches nothing.
    expect(count(source, /export function socialRewardSchedule/g)).toBe(1);
    expect(schedule.length).toBeGreaterThan(0);
    expect(count(bodyOf(source, 'socialContextFaults'), /calendar\.anchorDay/g)).toBe(3);
  });

  it('carries the four history fields through the API, so the sweep has a domain', () => {
    // Without these the sweep would be a check on a domain that cannot reach
    // the case — the vacuity shape CLAUDE.md names. They are on the interface
    // so a future edit that reads one is a change to a swept function.
    const context = contextFor(0, [true, false, true, true, true]);
    expect(context.sessionCount).toBe(4);
    expect(context.streakDays).toBe(3);
    expect(context.passTiersUnlocked).toBe(0);
    expect(context.trainedDays.length).toBe(4);
    // And the fields really differ between a calendar and its superset, so the
    // byte-identical verdict above is about two contexts that are not equal.
    const diligent = contextFor(0, [true, true, true, true, true]);
    expect(diligent.sessionCount).not.toBe(context.sessionCount);
    expect(diligent.streakDays).not.toBe(context.streakDays);
    expect(diligent.trainedDays.length).not.toBe(context.trainedDays.length);
  });

  it('puts a rival close on a fixed calendar day and on every period boundary', () => {
    const anchor = asCalendarDay(30);
    const schedule = socialRewardSchedule(contextFor(30, []), PERIOD_DAYS * 3);
    const closes = schedule.filter((entry) => entry.event === 'rival-period-close');
    expect(closes.map((entry) => entry.day)).toEqual([anchor + PERIOD_DAYS, anchor + PERIOD_DAYS * 2]);
    // Counts, not bounds: the allowance resets on every day of the horizon and
    // the closes are the two above, so the list is not silently short.
    expect(schedule.length).toBe(PERIOD_DAYS * 3 + 2);
    expect(schedule.filter((entry) => entry.event === 'friend-visit-allowance-reset').length).toBe(
      PERIOD_DAYS * 3,
    );
  });

  it('refuses a horizon that is not a whole number of days at or above zero', () => {
    const calendar = contextFor(0, []);
    expect(() => socialRewardSchedule(calendar, -1)).toThrow(RangeError);
    expect(() => socialRewardSchedule(calendar, 1.5)).toThrow(RangeError);
    expect(socialRewardSchedule(calendar, 0)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reach: a social surface inherits its verdict from empireCore's tables
// ---------------------------------------------------------------------------

describe('no social surface pays a stat, and the verdict is inherited rather than asserted', () => {
  it('sends every surface to an idle-only output', () => {
    // The reddening edit: re-point any row of `SOCIAL_OUTPUT` at `'training-iq'`
    // or `'physio-days-saved'`. That is a `tsc` error against
    // `SocialSurfacesAreIdleOnly` and it reddens both loops here.
    let checked = 0;
    for (const surface of SOCIAL_SURFACES) {
      const output = socialOutput(surface);
      expect(IDLE_ONLY_OUTPUTS, `${surface} feeds ${output}`).toContain(output);
      expect(PROGRESSION_REACHING_OUTPUTS).not.toContain(output);
      expect(socialReach(surface)).toBe('idle-only');
      checked += 1;
    }
    expect(checked).toBe(3);
    expect(checked).toBe(SOCIAL_SURFACES.length);
  });

  it('is grading against tables that really discriminate', () => {
    // The non-vacuity guard for the loop above. If every output in
    // `empireCore.ts` were idle-only, the loop would pass whatever
    // `SOCIAL_OUTPUT` said, and CLAUDE.md's empty-domain shape would be back.
    expect(PROGRESSION_REACHING_OUTPUTS.length).toBe(2);
    expect([...PROGRESSION_REACHING_OUTPUTS].sort()).toEqual([
      'physio-days-saved',
      'training-iq',
    ]);
    expect(outputReach('training-iq')).toBe('progression-reaching');
    expect(outputReach('gym-bucks')).toBe('idle-only');
    expect(IDLE_ONLY_OUTPUTS.length).toBe(4);
  });

  it('declares one row per surface and nothing else', () => {
    expect(Object.keys(SOCIAL_OUTPUT).sort()).toEqual([...SOCIAL_SURFACES].sort());
    expect(SOCIAL_OUTPUT['leaderboard-placement']).toBe('cosmetic-unlock');
    expect(SOCIAL_OUTPUT['friend-encouragement']).toBe('gym-bucks');
    expect(SOCIAL_OUTPUT['rival-week']).toBe('gym-bucks');
  });

  it('narrows an unknown wire value to a surface and to a metric', () => {
    expect(isSocialSurface('rival-week')).toBe(true);
    expect(isSocialSurface('training-iq')).toBe(false);
    expect(isSocialSurface(7)).toBe(false);
    expect(isLeaderboardMetric('combined-total')).toBe(true);
    expect(isLeaderboardMetric('reputation')).toBe(true);
    expect(isLeaderboardMetric('dots')).toBe(false);
  });

  it('reports no fault against the shipped tuning', () => {
    expect(socialVocabularyFaults()).toEqual([]);
  });

  it('pins the exported surface, so a new producer is a diff somebody signs', () => {
    expect(Object.keys(socialModule).sort()).toEqual([
      'LEADERBOARD_METRICS',
      'RIVAL_OUTCOMES',
      'SOCIAL_LAYER_PAYS_NO_STAT',
      'SOCIAL_OUTPUT',
      'SOCIAL_REWARD_EVENTS',
      'SOCIAL_SURFACES',
      'VISIT_REFUSALS',
      'asCalendarDay',
      'compareWithRival',
      'encouragementGymBucksOn',
      'isLeaderboardMetric',
      'isSocialSurface',
      'leaderboardBracketSize',
      'leaderboardRankOf',
      'leaderboardScore',
      'mayVisitFriendGym',
      'rankLeaderboard',
      'recordFriendVisit',
      'rivalPeriodCloseDay',
      'rivalPeriodCloseDays',
      'rivalPeriodIndex',
      'rivalPeriodStartDay',
      'socialContextFaults',
      'socialOutput',
      'socialReach',
      'socialRewardSchedule',
      'socialVocabularyFaults',
      'visitRefusals',
      'visitsLeftOn',
      'visitsUsedOn',
    ]);
  });
});

// ---------------------------------------------------------------------------
// §5.5 row 1 — leaderboards
// ---------------------------------------------------------------------------

describe('gym leaderboards', () => {
  const board: readonly GymSnapshot[] = Object.freeze([
    gym('gym-c', 400, 1100),
    gym('gym-a', 900, 700),
    gym('gym-b', 400, 1600),
    gym('gym-d', 100, 1600),
  ]);

  it('publishes a bracket size per scope, and both are boards rather than mirrors', () => {
    let read = 0;
    for (const scope of SCOPES) {
      expect(leaderboardBracketSize(scope)).toBe(EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE[scope]);
      expect(leaderboardBracketSize(scope)).toBeGreaterThan(1);
      read += 1;
    }
    expect(read).toBe(2);
    expect(read).toBe(SCOPES.length);
    // Reddens on a lookup keyed to something other than the argument: the two
    // scopes are different sizes at the shipped tuning.
    expect(new Set(SCOPES.map((scope) => leaderboardBracketSize(scope))).size).toBe(2);
  });

  it('scores by the metric the caller named', () => {
    const entry = gym('gym-a', 900, 700);
    expect(leaderboardScore(entry, 'reputation')).toBe(900);
    expect(leaderboardScore(entry, 'combined-total')).toBe(700);
    // The two are different numbers on this entry, so a scorer wired to one
    // field is red rather than green by coincidence.
    expect(leaderboardScore(entry, 'reputation')).not.toBe(
      leaderboardScore(entry, 'combined-total'),
    );
    expect(LEADERBOARD_METRICS.length).toBe(2);
  });

  it('ranks highest first, shares a rank on a tie and skips the one after', () => {
    const rows = rankLeaderboard(board, 'reputation', 'global');
    expect(rows.map((row) => row.entry.gymId)).toEqual(['gym-a', 'gym-b', 'gym-c', 'gym-d']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 2, 4]);
    expect(rows.map((row) => row.score)).toEqual([900, 400, 400, 100]);
  });

  it('breaks a tie by gym id, so two clients on one snapshot agree', () => {
    // Reddens on a comparator that returns 0 for a tie and leaves the order to
    // the input: the two orderings below would then differ.
    const forwards = rankLeaderboard(board, 'reputation', 'global');
    const backwards = rankLeaderboard([...board].reverse(), 'reputation', 'global');
    expect(backwards.map((row) => row.entry.gymId)).toEqual(
      forwards.map((row) => row.entry.gymId),
    );
    // And the tie is real, so the two orderings are not trivially equal.
    expect(forwards[1]?.score).toBe(forwards[2]?.score);
  });

  it('ranks by combined totals too, which is the other metric §5.5 names', () => {
    const rows = rankLeaderboard(board, 'combined-total', 'global');
    expect(rows.map((row) => row.entry.gymId)).toEqual(['gym-b', 'gym-d', 'gym-c', 'gym-a']);
    expect(rows.map((row) => row.rank)).toEqual([1, 1, 3, 4]);
  });

  it('truncates to the bracket size of the scope it was asked for', () => {
    const many = Array.from({ length: 130 }, (_, at) =>
      gym(`gym-${String(at).padStart(3, '0')}`, at, at),
    );
    let checked = 0;
    for (const scope of SCOPES) {
      const rows = rankLeaderboard(many, 'reputation', scope);
      expect(rows.length).toBe(EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE[scope]);
      checked += 1;
    }
    expect(checked).toBe(2);
    // The population is above both bracket sizes, so the truncation is real
    // rather than a list that happened to be short.
    expect(many.length).toBeGreaterThan(EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE.global);
    expect(many.length).toBeGreaterThan(EMPIRE_TUNING.LEADERBOARD_BRACKET_SIZE.regional);
  });

  it('does not reorder the snapshot it was handed', () => {
    const supplied = [...board];
    rankLeaderboard(supplied, 'reputation', 'global');
    expect(supplied.map((entry) => entry.gymId)).toEqual([
      'gym-c',
      'gym-a',
      'gym-b',
      'gym-d',
    ]);
  });

  it('reports where a gym sits, and null for one that is off the bracket', () => {
    const rows = rankLeaderboard(board, 'reputation', 'global');
    expect(leaderboardRankOf(rows, 'gym-a')).toBe(1);
    expect(leaderboardRankOf(rows, 'gym-d')).toBe(4);
    expect(leaderboardRankOf(rows, 'gym-absent')).toBeNull();
    expect(leaderboardRankOf([], 'gym-a')).toBeNull();
  });

  it('ranks an empty board as an empty board', () => {
    // The one domain in this file that is empty on purpose, said so rather than
    // left looking like coverage of the loop.
    expect(rankLeaderboard([], 'reputation', 'regional')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §5.5 row 2 — visiting friends' gyms
// ---------------------------------------------------------------------------

describe("visiting friends' gyms", () => {
  const own = gym('gym-own', 500, 900);
  const friends: readonly GymSnapshot[] = Object.freeze([
    gym('gym-f1', 100, 200),
    gym('gym-f2', 300, 400),
  ]);
  const day = asCalendarDay(12);

  function contextWith(
    visits: readonly FriendVisit[],
    received: readonly Encouragement[] = [],
  ): SocialContext {
    return Object.freeze({
      ownGym: own,
      calendar: contextFor(0, []),
      friends,
      visits,
      encouragementsReceived: received,
      rival: gym('gym-rival', 700, 1200),
    });
  }

  function visitsOn(onDay: CalendarDay, howMany: number): readonly FriendVisit[] {
    return Array.from({ length: howMany }, (_, at) =>
      Object.freeze({ day: onDay, gymId: `gym-v${at}`, encouraged: true }),
    );
  }

  it('counts the visits recorded on a day and no others', () => {
    const log = [...visitsOn(day, 3), ...visitsOn(asCalendarDay(13), 2)];
    expect(visitsUsedOn(log, day)).toBe(3);
    expect(visitsUsedOn(log, asCalendarDay(13))).toBe(2);
    expect(visitsUsedOn(log, asCalendarDay(14))).toBe(0);
  });

  it('gives every calendar day the same allowance, carrying nothing over', () => {
    // The §8.3C shape applied to a budget rather than to a payout: an allowance
    // that accumulated while the player was away, or one earned per check-in,
    // would be the same quantity keyed to what the player did.
    expect(visitsLeftOn([], day)).toBe(EMPIRE_TUNING.FRIEND_VISITS_PER_DAY);
    expect(visitsLeftOn(visitsOn(day, 4), day)).toBe(EMPIRE_TUNING.FRIEND_VISITS_PER_DAY - 4);
    expect(visitsLeftOn(visitsOn(day, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY), day)).toBe(0);
    // Spent yesterday, full today. Reddens on an allowance that spans days.
    expect(visitsLeftOn(visitsOn(day, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY), asCalendarDay(13))).toBe(
      EMPIRE_TUNING.FRIEND_VISITS_PER_DAY,
    );
    // And a log longer than the allowance clamps at zero rather than going
    // negative.
    expect(visitsLeftOn(visitsOn(day, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY + 5), day)).toBe(0);
  });

  it('reports every refusal in the published order', () => {
    // All four at once: the gym is not a friend, it is the player's own, it has
    // already been visited today, and the allowance is spent. The order is the
    // contract a screen reads.
    const log: readonly FriendVisit[] = [
      ...visitsOn(day, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY - 1),
      Object.freeze({ day, gymId: own.gymId, encouraged: false }),
    ];
    expect(visitRefusals(contextWith(log), own.gymId, day)).toEqual([...VISIT_REFUSALS]);
    expect(VISIT_REFUSALS.length).toBe(4);
  });

  it('refuses one reason at a time when only one applies', () => {
    expect(visitRefusals(contextWith([]), 'gym-stranger', day)).toEqual(['not-a-friend-gym']);
    expect(
      visitRefusals(
        contextWith([Object.freeze({ day, gymId: 'gym-f1', encouraged: true })]),
        'gym-f1',
        day,
      ),
    ).toEqual(['already-visited-today']);
    expect(
      visitRefusals(contextWith(visitsOn(day, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY)), 'gym-f1', day),
    ).toEqual(['daily-allowance-spent']);
    expect(visitRefusals(contextWith([]), 'gym-f1', day)).toEqual([]);
    expect(mayVisitFriendGym(contextWith([]), 'gym-f1', day)).toBe(true);
    expect(mayVisitFriendGym(contextWith([]), 'gym-stranger', day)).toBe(false);
  });

  it('records a visit, pays the visited gym for an encouragement, and pays nothing without one', () => {
    const context = contextWith([]);
    const encouraged = recordFriendVisit(context, 'gym-f1', day, true);
    expect(encouraged.kind).toBe('visited');
    if (encouraged.kind !== 'visited') throw new Error('expected a recorded visit');
    expect(encouraged.gymBucksOwedToVisitedGym).toBe(EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS);
    expect(encouraged.visits.length).toBe(1);
    expect(encouraged.visits[0]).toEqual({ day, gymId: 'gym-f1', encouraged: true });

    const browsed = recordFriendVisit(context, 'gym-f2', day, false);
    if (browsed.kind !== 'visited') throw new Error('expected a recorded visit');
    expect(browsed.gymBucksOwedToVisitedGym).toBe(0);
    // The two payouts differ, so a constructor wired to one branch is red.
    expect(browsed.gymBucksOwedToVisitedGym).not.toBe(encouraged.gymBucksOwedToVisitedGym);
    // And the supplied log was not mutated.
    expect(context.visits.length).toBe(0);
  });

  it('refuses to record a visit it would refuse to allow', () => {
    const context = contextWith(visitsOn(day, EMPIRE_TUNING.FRIEND_VISITS_PER_DAY));
    const decision = recordFriendVisit(context, 'gym-f1', day, true);
    expect(decision.kind).toBe('refused');
    if (decision.kind !== 'refused') throw new Error('expected a refusal');
    expect(decision.refusals).toEqual(['daily-allowance-spent']);
  });

  it('pays once per distinct sender per day', () => {
    const received: readonly Encouragement[] = Object.freeze([
      Object.freeze({ day, fromGymId: 'gym-f1' }),
      Object.freeze({ day, fromGymId: 'gym-f1' }),
      Object.freeze({ day, fromGymId: 'gym-f2' }),
      Object.freeze({ day: asCalendarDay(13), fromGymId: 'gym-f1' }),
    ]);
    expect(encouragementGymBucksOn(received, day)).toBe(
      EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS * 2,
    );
    expect(encouragementGymBucksOn(received, asCalendarDay(13))).toBe(
      EMPIRE_TUNING.ENCOURAGEMENT_REWARD_GYM_BUCKS,
    );
    expect(encouragementGymBucksOn(received, asCalendarDay(14))).toBe(0);
    // Four encouragements, three payments across two days: the dedup really
    // dropped one rather than the fixture having no duplicate in it.
    expect(received.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// §5.5 row 3 — the weekly rival comparison
// ---------------------------------------------------------------------------

describe('the rival comparison period is counted in calendar days', () => {
  const anchor = asCalendarDay(30);

  it('holds one period for exactly the published number of days', () => {
    let sameAsAnchor = 0;
    for (let offset = 0; offset < PERIOD_DAYS; offset += 1) {
      expect(rivalPeriodIndex(anchor, asCalendarDay(anchor + offset))).toBe(0);
      sameAsAnchor += 1;
    }
    expect(sameAsAnchor).toBe(PERIOD_DAYS);
    expect(rivalPeriodIndex(anchor, asCalendarDay(anchor + PERIOD_DAYS))).toBe(1);
    expect(rivalPeriodIndex(anchor, asCalendarDay(anchor + PERIOD_DAYS * 2))).toBe(2);
    // The period really is more than a day long, so the line above is not the
    // same statement as the loop.
    expect(PERIOD_DAYS).toBeGreaterThan(1);
  });

  it('refuses a day before the anchor rather than clamping it into period zero', () => {
    // A clamp would silently make period 0 longer than every other period,
    // which is the unit going soft without anything saying so.
    expect(() => rivalPeriodIndex(anchor, asCalendarDay(29))).toThrow(RangeError);
    expect(rivalPeriodIndex(anchor, anchor)).toBe(0);
  });

  it('starts and closes each period on a fixed calendar day', () => {
    expect(rivalPeriodStartDay(anchor, 0)).toBe(anchor);
    expect(rivalPeriodStartDay(anchor, 2)).toBe(anchor + PERIOD_DAYS * 2);
    expect(rivalPeriodCloseDay(anchor, 0)).toBe(anchor + PERIOD_DAYS);
    expect(rivalPeriodCloseDay(anchor, 3)).toBe(anchor + PERIOD_DAYS * 4);
    expect(() => rivalPeriodStartDay(anchor, -1)).toThrow(RangeError);
    expect(() => rivalPeriodStartDay(anchor, 1.5)).toThrow(RangeError);
  });

  it('lists every close day inside a horizon', () => {
    expect(rivalPeriodCloseDays(anchor, 0)).toEqual([]);
    expect(rivalPeriodCloseDays(anchor, PERIOD_DAYS)).toEqual([]);
    expect(rivalPeriodCloseDays(anchor, PERIOD_DAYS + 1)).toEqual([anchor + PERIOD_DAYS]);
    expect(rivalPeriodCloseDays(anchor, PERIOD_DAYS * 3 + 1)).toEqual([
      anchor + PERIOD_DAYS,
      anchor + PERIOD_DAYS * 2,
      anchor + PERIOD_DAYS * 3,
    ]);
    expect(() => rivalPeriodCloseDays(anchor, -1)).toThrow(RangeError);
  });

  it('pays the published reward for beating the rival, and nothing otherwise', () => {
    const rival = gym('gym-rival', 500, 900);
    const day = asCalendarDay(anchor + PERIOD_DAYS + 2);
    const outcomes: readonly { own: GymSnapshot; outcome: string; paid: number }[] = [
      { own: gym('gym-own', 600, 100), outcome: 'ahead', paid: EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS },
      { own: gym('gym-own', 500, 100), outcome: 'level', paid: 0 },
      { own: gym('gym-own', 400, 100), outcome: 'behind', paid: 0 },
    ];
    let checked = 0;
    for (const row of outcomes) {
      const comparison = compareWithRival(row.own, rival, 'reputation', anchor, day);
      expect(comparison.outcome).toBe(row.outcome);
      expect(comparison.gymBucksOwed).toBe(row.paid);
      expect(comparison.periodIndex).toBe(1);
      expect(comparison.closesOnDay).toBe(anchor + PERIOD_DAYS * 2);
      expect(comparison.metric).toBe('reputation');
      checked += 1;
    }
    expect(checked).toBe(3);
    expect(RIVAL_OUTCOMES.length).toBe(3);
    // The reward is not zero, so the two zeroes above are a refusal rather than
    // an empty table.
    expect(EMPIRE_TUNING.RIVAL_REWARD_GYM_BUCKS).toBeGreaterThan(0);
  });

  it('compares on the metric it was given', () => {
    const own = gym('gym-own', 100, 2000);
    const rival = gym('gym-rival', 900, 100);
    const day = asCalendarDay(anchor + 1);
    expect(compareWithRival(own, rival, 'reputation', anchor, day).outcome).toBe('behind');
    expect(compareWithRival(own, rival, 'combined-total', anchor, day).outcome).toBe('ahead');
  });

  it('reads the rival it was handed rather than choosing one', () => {
    // GDD §12.3's second refusal condition is about selecting an outcome from a
    // population. The rival is an argument, so there is no population here to
    // select from — and the scan below says the module holds no such operation.
    const source = readModule('social.ts');
    expect(count(source, /export function compareWithRival/g)).toBe(1);
    expect(count(source, /rival: GymSnapshot/g)).toBe(2);
    for (const pattern of [/\brandom/i, /\bshuffle/i, /\bpick\b/i, /\bdraw\b/i, /\broll\b/i]) {
      expect(source, `social.ts must not reach ${String(pattern)}`).not.toMatch(pattern);
    }
    // The patterns are not dead letters.
    expect('Math.random()').toMatch(/\brandom/i);
    expect('shuffle(list)').toMatch(/\bshuffle/i);
    expect('pick(list)').toMatch(/\bpick\b/i);
    expect('draw(list)').toMatch(/\bdraw\b/i);
    expect('roll(list)').toMatch(/\broll\b/i);
  });
});

// ---------------------------------------------------------------------------
// The calendar day, and the guard on its constructor
// ---------------------------------------------------------------------------

describe('the calendar day', () => {
  it('refuses anything that is not a whole day at or above zero', () => {
    expect(asCalendarDay(0)).toBe(0);
    expect(asCalendarDay(41)).toBe(41);
    expect(() => asCalendarDay(-1)).toThrow(RangeError);
    expect(() => asCalendarDay(1.5)).toThrow(RangeError);
    expect(() => asCalendarDay(Number.NaN)).toThrow(RangeError);
    expect(() => asCalendarDay(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('declares the calendar day against its own brand', () => {
    // The vitest half of the four directives below. A brand is erased at
    // runtime, so the reddenable line is the DECLARATION. Match counts are
    // pinned rather than presence, because a pattern with more than one witness
    // in a file is a textual pin this codebase has been bitten by.
    const source = readModule('social.ts');
    expect(count(source, /export type CalendarDay = number & \{/g)).toBe(1);
    expect(count(source, /anchorDay: CalendarDay/g)).toBe(6);
    expect(count(source, /day: CalendarDay/g)).toBe(11);
    expect(count(source, /value: N & Unbranded<N>/g)).toBe(1);
    expect(count(source, /export /g)).toBeGreaterThan(0);
  });

  it('refuses a bare number and an accelerated clock reading', () => {
    const anchor = asCalendarDay(0);

    // @ts-expect-error a session count is a bare number and is not a day. This
    // is the shape GDD §8.3C measured at 1156 violating pairs. Graded by `tsc`.
    rivalPeriodIndex(anchor, 7);
    // @ts-expect-error and the branch immediately below it, on the other
    // argument, so the fence is not one-sided.
    rivalPeriodIndex(0, anchor);
    // @ts-expect-error a purchase-moved clock reading may not be re-branded as a
    // calendar day. `Unbranded` in `empireCore.ts` is what refuses this.
    asCalendarDay(asAcceleratedSeconds(1));
    // @ts-expect-error the same on the horizon-free constructor's sibling: a
    // close day takes a day, not a seconds reading.
    rivalPeriodCloseDay(asAcceleratedSeconds(1), 0);

    // The runtime companion: both functions are live and neither throws on the
    // legal spelling, so the directives above sit over code that would run.
    expect(rivalPeriodIndex(anchor, asCalendarDay(PERIOD_DAYS))).toBe(1);
    expect(rivalPeriodCloseDay(anchor, 0)).toBe(PERIOD_DAYS);
  });
});

// ---------------------------------------------------------------------------
// The runtime shadow of the supplied snapshot
// ---------------------------------------------------------------------------

describe('a supplied context is validated rather than trusted', () => {
  const own = gym('gym-own', 500, 900);
  const clean: SocialContext = Object.freeze({
    ownGym: own,
    calendar: contextFor(0, [true, false, true]),
    friends: Object.freeze([gym('gym-f1', 100, 200)]),
    visits: Object.freeze([Object.freeze({ day: asCalendarDay(1), gymId: 'gym-f1', encouraged: true })]),
    encouragementsReceived: Object.freeze([Object.freeze({ day: asCalendarDay(1), fromGymId: 'gym-f1' })]),
    rival: gym('gym-rival', 700, 1200),
  });

  it('reports no fault on a well-formed context', () => {
    expect(socialContextFaults(clean)).toEqual([]);
  });

  it('reports a duplicate friend, the player own gym on the friend list, and a self-rival', () => {
    const faults = socialContextFaults(
      Object.freeze({
        ...clean,
        friends: Object.freeze([gym('gym-f1', 1, 1), gym('gym-f1', 1, 1), own]),
        rival: own,
      }),
    );
    expect(faults).toContain('friends: duplicate gym id gym-f1');
    expect(faults).toContain('friends: the player own gym is on the friend list');
    expect(faults).toContain('rival: a gym cannot be its own rival');
    expect(faults.length).toBe(3);
  });

  it('reports a visit to a gym that is not on the friend list', () => {
    const faults = socialContextFaults(
      Object.freeze({
        ...clean,
        visits: Object.freeze([
          Object.freeze({ day: asCalendarDay(1), gymId: 'gym-stranger', encouraged: false }),
        ]),
      }),
    );
    expect(faults).toEqual(['visits: gym-stranger is not on the friend list']);
  });

  it('reports a malformed snapshot field by field', () => {
    const broken: GymSnapshot = { gymId: '', displayName: '', reputation: -1, combinedTotalKg: Number.NaN };
    const faults = socialContextFaults(Object.freeze({ ...clean, ownGym: broken }));
    // Four separate faults from one snapshot, so the check is field by field
    // rather than one verdict about the object.
    expect(faults.length).toBe(4);
    expect(faults[0]).toBe('own gym: a gym arrived with no id');
  });

  it('reports a day that is not a day, wherever it arrived', () => {
    const faults = socialContextFaults(
      Object.freeze({
        ...clean,
        calendar: Object.freeze({
          ...clean.calendar,
          anchorDay: -1 as CalendarDay,
          trainedDays: Object.freeze([1.5 as CalendarDay]),
        }),
        visits: Object.freeze([
          Object.freeze({ day: -2 as CalendarDay, gymId: 'gym-f1', encouraged: false }),
        ]),
        encouragementsReceived: Object.freeze([
          Object.freeze({ day: -3 as CalendarDay, fromGymId: 'gym-f1' }),
        ]),
      }),
    );
    // One per site, so a check written for the anchor and not applied to its
    // three siblings is red rather than quiet.
    expect(faults.length).toBe(4);
    expect(faults.filter((fault) => fault.startsWith('calendar:')).length).toBe(2);
    expect(faults.filter((fault) => fault.startsWith('visits:')).length).toBe(1);
    expect(faults.filter((fault) => fault.startsWith('encouragements:')).length).toBe(1);
  });

  it('reports an encouragement from a gym with no id', () => {
    const faults = socialContextFaults(
      Object.freeze({
        ...clean,
        encouragementsReceived: Object.freeze([
          Object.freeze({ day: asCalendarDay(1), fromGymId: '' }),
        ]),
      }),
    );
    expect(faults).toEqual(['encouragements: one arrived from a gym with no id']);
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('the module is pure and imports nothing outside this directory', () => {
  it('imports only its two siblings', () => {
    const source = readModule('social.ts');
    expect([...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])).toEqual([
      './empireCore',
      './empireTuning',
    ]);
  });

  it('names every event and every surface exactly once in its own list', () => {
    expect(new Set(SOCIAL_REWARD_EVENTS).size).toBe(SOCIAL_REWARD_EVENTS.length);
    expect(new Set(SOCIAL_SURFACES).size).toBe(SOCIAL_SURFACES.length);
    expect(new Set(VISIT_REFUSALS).size).toBe(VISIT_REFUSALS.length);
    expect(new Set(RIVAL_OUTCOMES).size).toBe(RIVAL_OUTCOMES.length);
    expect(new Set(LEADERBOARD_METRICS).size).toBe(LEADERBOARD_METRICS.length);
    expect(SOCIAL_REWARD_EVENTS.length).toBe(2);
  });

  it('reads the tuning entries GDD §5.5 gave it', () => {
    const source = readModule('social.ts');
    let read = 0;
    for (const key of [
      'LEADERBOARD_BRACKET_SIZE',
      'LEADERBOARD_SCOPES',
      'RIVAL_COMPARISON_PERIOD_DAYS',
      'RIVAL_REWARD_GYM_BUCKS',
      'FRIEND_VISITS_PER_DAY',
      'ENCOURAGEMENT_REWARD_GYM_BUCKS',
    ]) {
      expect(source, `${key} is not read`).toContain(`EMPIRE_TUNING.${key}`);
      read += 1;
    }
    expect(read).toBe(6);
  });
});

/** Kept as a live reference so the metric type is exercised by name. */
const METRIC_UNDER_TEST: LeaderboardMetric = 'combined-total';
describe('the metric type', () => {
  it('is one of the two the module publishes', () => {
    expect(LEADERBOARD_METRICS).toContain(METRIC_UNDER_TEST);
  });
});
