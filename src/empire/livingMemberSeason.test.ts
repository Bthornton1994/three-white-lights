/**
 * livingMemberSeason.test.ts — G2-ATHLETE-SEASON-01 calendar and copy.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EMPIRE_TUNING } from './empireTuning';
import { createLivingMemberRoster, type LivingGymMember } from './livingMembers';
import {
  athleteSeasonBoundariesBetween,
  athleteSeasonBoundaryWouldMove,
  athleteSeasonPhaseAt,
  athleteSeasonPhaseAtWeek,
  createLivingMemberSeasonLeaveRecord,
  createLivingMemberSeasonLedger,
  createLivingMemberSeasonReturnRecord,
  lastLivingMemberSeasonEvent,
  livingMemberTakesSeasonLeave,
  playerFacingSeasonLine,
  requireAthleteSeasonKnobs,
} from './livingMemberSeason';
import { trainingWeekIndexAt } from './sessions';

const T = EMPIRE_TUNING;
const WEEK = T.DAYS_PER_TRAINING_WEEK * T.SECONDS_PER_DAY;
const KIT = Object.freeze([...T.LADDER_STARTING_EQUIPMENT]);

function athleteFixture(): LivingGymMember {
  const roster = createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
  const member = roster.members[0];
  if (member === undefined) throw new Error('missing opening member');
  return Object.freeze({ ...member, type: 'athlete' as const });
}

describe('G2-ATHLETE-SEASON-01 — knobs', () => {
  it('ships integer cadence knobs with in-season inside the cycle', () => {
    const knobs = requireAthleteSeasonKnobs();
    expect(knobs).toBe(T.ATHLETE_SEASON);
    expect(knobs.cycleWeeks).toBe(6);
    expect(knobs.inSeasonWeeks).toBe(2);
    expect(knobs.firstInSeasonWeek).toBe(4);
    expect(knobs.inSeasonWeeks).toBeGreaterThan(0);
    expect(knobs.inSeasonWeeks).toBeLessThan(knobs.cycleWeeks);
    expect(knobs.firstInSeasonWeek).toBeGreaterThanOrEqual(1);
  });

  it('does not scatter cadence literals outside tuning and tests', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'livingMemberSeason.ts'), 'utf8');
    expect(source).not.toMatch(/cycleWeeks:\s*6/);
    expect(source).not.toMatch(/inSeasonWeeks:\s*2/);
    expect(source).not.toMatch(/firstInSeasonWeek:\s*4/);
  });
});

describe('G2-ATHLETE-SEASON-01 — phase math', () => {
  it('is off-season before the first in-season week and in-season for two weeks', () => {
    expect(athleteSeasonPhaseAtWeek(0)).toBe('off-season');
    expect(athleteSeasonPhaseAtWeek(1)).toBe('off-season');
    expect(athleteSeasonPhaseAtWeek(2)).toBe('off-season');
    expect(athleteSeasonPhaseAtWeek(3)).toBe('off-season');
    expect(athleteSeasonPhaseAtWeek(4)).toBe('in-season');
    expect(athleteSeasonPhaseAtWeek(5)).toBe('in-season');
    expect(athleteSeasonPhaseAtWeek(6)).toBe('off-season');
    expect(athleteSeasonPhaseAtWeek(9)).toBe('off-season');
    expect(athleteSeasonPhaseAtWeek(10)).toBe('in-season');
    expect(athleteSeasonPhaseAtWeek(11)).toBe('in-season');
  });

  it('uses the same week index sessions.ts ships', () => {
    expect(athleteSeasonPhaseAt(0)).toBe('off-season');
    expect(athleteSeasonPhaseAt(WEEK * 4 - 1)).toBe('off-season');
    expect(athleteSeasonPhaseAt(WEEK * 4)).toBe('in-season');
    expect(trainingWeekIndexAt(WEEK * 4)).toBe(4);
  });

  it('refuses a non-integer or negative week index', () => {
    expect(() => athleteSeasonPhaseAtWeek(-1)).toThrow(/non-negative integer/);
    expect(() => athleteSeasonPhaseAtWeek(1.5)).toThrow(/non-negative integer/);
    expect(() => athleteSeasonPhaseAt(Number.NaN)).toThrow(/finite/);
  });
});

describe('G2-ATHLETE-SEASON-01 — boundaries', () => {
  it('returns sorted unique flips in (from, to]', () => {
    const boundaries = athleteSeasonBoundariesBetween(0, WEEK * 12);
    expect(boundaries.map((row) => row.atSeconds)).toEqual([
      WEEK * 4,
      WEEK * 6,
      WEEK * 10,
      WEEK * 12,
    ]);
    expect(boundaries.map((row) => row.phase)).toEqual([
      'in-season',
      'off-season',
      'in-season',
      'off-season',
    ]);
    const unique = new Set(boundaries.map((row) => row.atSeconds));
    expect(unique.size).toBe(boundaries.length);
  });

  it('is empty on an already-settled mark and exclusive of from', () => {
    expect(athleteSeasonBoundariesBetween(WEEK * 4, WEEK * 4)).toEqual([]);
    expect(athleteSeasonBoundariesBetween(0, WEEK * 4 - 1)).toEqual([]);
    expect(athleteSeasonBoundariesBetween(0, WEEK * 4)).toEqual([
      Object.freeze({ atSeconds: WEEK * 4, phase: 'in-season' }),
    ]);
  });

  it('refuses a non-finite, negative, or reversed interval', () => {
    expect(() => athleteSeasonBoundariesBetween(Number.NaN, WEEK)).toThrow(/non-negative/);
    expect(() => athleteSeasonBoundariesBetween(-1, WEEK)).toThrow(/non-negative/);
    expect(() => athleteSeasonBoundariesBetween(WEEK, WEEK - 1)).toThrow(/earlier than start/);
  });
});

describe('G2-ATHLETE-SEASON-01 — type and records', () => {
  it('takes season leave only for Athletes', () => {
    expect(livingMemberTakesSeasonLeave('athlete')).toBe(true);
    expect(livingMemberTakesSeasonLeave('casual')).toBe(false);
    expect(livingMemberTakesSeasonLeave('bodybuilder')).toBe(false);
    expect(livingMemberTakesSeasonLeave('powerlifter')).toBe(false);
    expect(livingMemberTakesSeasonLeave('serious-lifter')).toBe(false);
  });

  it('creates a ledger, leave, and return without inventing a return date field', () => {
    const member = athleteFixture();
    const ledger = createLivingMemberSeasonLedger(0);
    expect(ledger.settledAtSeconds).toBe(0);
    expect(ledger.onLeave).toEqual([]);
    expect(ledger.returns).toEqual([]);
    const leave = createLivingMemberSeasonLeaveRecord(member, WEEK * 4);
    expect(leave.member).toBe(member);
    expect(leave.leftAtSeconds).toBe(WEEK * 4);
    expect(Object.keys(leave).sort()).toEqual(['leftAtSeconds', 'member']);
    const returned = createLivingMemberSeasonReturnRecord(leave, WEEK * 6);
    expect(returned.member).toBe(member);
    expect(returned.leftAtSeconds).toBe(WEEK * 4);
    expect(returned.returnedAtSeconds).toBe(WEEK * 6);
  });

  it('refuses a leave for a non-Athlete and a return before the leave', () => {
    const roster = createLivingMemberRoster('garage', KIT, Object.freeze([]), 0, T.FLOOR_SIM_RENDER_SEED);
    const powerlifter = roster.members[0];
    if (powerlifter === undefined) throw new Error('missing opening member');
    expect(() => createLivingMemberSeasonLeaveRecord(powerlifter, WEEK * 4)).toThrow(/Athletes/);
    const leave = createLivingMemberSeasonLeaveRecord(athleteFixture(), WEEK * 4);
    expect(() => createLivingMemberSeasonReturnRecord(leave, WEEK * 4 - 1)).toThrow(/earlier than leave/);
    expect(() => createLivingMemberSeasonLedger(-1)).toThrow(/non-negative/);
    expect(() => createLivingMemberSeasonLeaveRecord(athleteFixture(), Number.NaN)).toThrow(
      /non-negative/,
    );
  });

  it('names the latest leave or return for the floor notice', () => {
    const member = athleteFixture();
    const empty = createLivingMemberSeasonLedger(0);
    expect(lastLivingMemberSeasonEvent(empty)).toBeNull();
    const leave = createLivingMemberSeasonLeaveRecord(member, WEEK * 4);
    const away = Object.freeze({
      ...empty,
      onLeave: Object.freeze([leave]),
    });
    expect(lastLivingMemberSeasonEvent(away)).toEqual({
      kind: 'leave',
      member,
      atSeconds: WEEK * 4,
    });
    expect(playerFacingSeasonLine(lastLivingMemberSeasonEvent(away)!)).toBe(
      `${member.displayName} is away for the season.`,
    );
    const returned = createLivingMemberSeasonReturnRecord(leave, WEEK * 6);
    const back = Object.freeze({
      ...empty,
      onLeave: Object.freeze([]),
      returns: Object.freeze([returned]),
    });
    const event = lastLivingMemberSeasonEvent(back);
    expect(event?.kind).toBe('return');
    expect(playerFacingSeasonLine(event!)).toBe(`${member.displayName} is back from the season.`);
    expect(playerFacingSeasonLine(event!)).not.toMatch(/%/);
    expect(playerFacingSeasonLine(event!)).not.toMatch(/\d+\s*week/);
    expect(playerFacingSeasonLine(event!)).not.toMatch(/days/i);
  });

  it('treats an in-season boundary as a move only when an Athlete is present', () => {
    const member = athleteFixture();
    const boundary = Object.freeze({ atSeconds: WEEK * 4, phase: 'in-season' as const });
    expect(athleteSeasonBoundaryWouldMove([member], [], boundary)).toBe(true);
    expect(athleteSeasonBoundaryWouldMove([], [], boundary)).toBe(false);
    const end = Object.freeze({ atSeconds: WEEK * 6, phase: 'off-season' as const });
    const leave = createLivingMemberSeasonLeaveRecord(member, WEEK * 4);
    expect(athleteSeasonBoundaryWouldMove([], [leave], end)).toBe(true);
    expect(athleteSeasonBoundaryWouldMove([], [], end)).toBe(false);
  });
});

describe('G2-ATHLETE-SEASON-01 — purity', () => {
  it('contains no Math.random or Date.now', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'livingMemberSeason.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/Math\.random\(/);
    expect(source).not.toMatch(/Date\.now\(/);
  });
});
